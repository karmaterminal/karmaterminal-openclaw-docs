/**
 * Scenario: R-CD-RECIPIENT-AUTHORITY, one case of the live isolated-gateway row at pinned j12.
 *
 * Ruling: 🌊, room msg 1567077062139838485 (2026-11-03): a live, isolated-gateway row at pinned j12,
 * separate from the supervised-restart row; every case MISSING until an owner runs it; observe the
 * refusal reason AND the absence of target adoption, ack and final effect, including replay. Bound
 * issue: karmaterminal/karmaterminal-openclaw-docs#536.
 *
 * Only the control runs this: tools/k6-proofs/scripts/run-recipient-authority-row.mjs starts the
 * disposable gateway, runs this scenario once per case (twice for replay-restart: drive, then
 * observe after its supervised restart) and grades. Without the control's run id the scenario
 * refuses from setup() and from default(). It never decides a verdict: it prints evidence, and
 * lib/recipient-authority-row.mjs grades the control's case record.
 *
 * Product path at j12, karmaterminal/openclaw 352f56029dc95c60149ab4aaa127226a861d0b3d (byte-read
 * with git show / git grep at that commit).
 *
 * 1. Authority. One UUID epoch per logical session key in session_recipient_authority (per-agent
 *    database). A binding is current only while the stored epoch equals the captured one
 *    (src/config/sessions/session-recipient-authority-types.ts:87-92). Capture is insert-if-absent
 *    for ANY key, existing session or not (src/config/sessions/session-recipient-authority.worker.ts:35-50,
 *    src/config/sessions/session-sharing-store.worker.ts:170-174).
 *
 * 2. Bound. continue_delegate with targetSessionKey (src/agents/tools/continue-delegate-tool.ts:319-339)
 *    enqueues the delegate (:424-434 -> src/auto-reply/continuation/delegate-store.ts:204-218), and the
 *    custody record is created only after the binding is captured
 *    (src/auto-reply/continuation/delegate-flow-store.ts:426-437 ->
 *    src/auto-reply/continuation/recipient-authority-binding.ts:56-74). The tool's "scheduled" result
 *    (:436-449) is therefore after capture. The child carries the binding
 *    (src/auto-reply/continuation/delegate-dispatch-request.ts:65-66,
 *    src/agents/subagents/spawn/subagent-spawn-request.ts:328, subagent-spawn-continuation.ts:138-159).
 *
 * 3. What advances the epoch: exactly four writers, plus first capture
 *    (src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37 and its callers):
 *    - deletion, every deletion owner: src/config/sessions/session-accessor.sqlite-entry-store.ts:56-69
 *      (gateway sessions.delete, src/gateway/server-methods/sessions-delete.ts:589; the epoch row
 *      outlives the session, so sessions.create of the same key keeps the advanced epoch);
 *    - owner change: src/config/sessions/session-accessor.sqlite-owner.ts:158-182 (sessions.assignOwner,
 *      src/gateway/server-methods/sessions-mutations.ts:343-470; it refuses a caller that is neither
 *      an agent runtime nor a human profile, :362-374, so a shared-token client cannot drive it; the
 *      agent's sessions tool action assign_owner can, src/agents/tools/sessions-tool.ts:384-419);
 *    - visibility narrowing, every writer: src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136
 *      (session.visibility.set, src/gateway/server-methods/sessions-sharing.ts:527-610; rank
 *      shared 3 > suggest 2 > read-only 1 > draft 0, session-recipient-authority-types.ts:66-99;
 *      every visibility allowed by default, src/gateway/session-sharing-policy.ts:85-100);
 *    - member removal: src/config/sessions/session-sharing-store.native.ts:150-195 (session.members.remove,
 *      sessions-sharing.ts:337-423, 616; members.add accepts only a known identity, :347-361).
 *    The sharing methods take { sessionKey, agentId?, ... } in closed schemas
 *    (packages/gateway-protocol/src/schema/sessions-sharing.ts:29-37, 62, 115-120); sessions.reset,
 *    sessions.delete and sessions.create take { key, ... }.
 *    Sharing mutations need the owner or operator.admin
 *    (src/gateway/server-methods/sessions-sharing-authority.ts:144-156); a loopback backend client
 *    with the shared token keeps its requested scopes (src/gateway/server/ws-connection/connect-auth.ts:286-296,
 *    handshake-auth-helpers.ts:165-187), so this scenario asks for operator.admin.
 *    NOT an edge: sessions.reset (sessions-mutations.ts:593-678) rotates the session in place
 *    (src/gateway/session-reset-service.ts:751, 1032-1043, resetSessionEntryLifecycle) and reaches no
 *    advance site; only an incognito reset deletes (:651-737). allowed-across-reset asserts it.
 *
 * 4. Admission. The only refusal of a target at admission is the policy gate
 *    agents.defaults.continuation.crossSessionTargeting, disabled unless "enabled"
 *    (src/auto-reply/continuation/config.ts:128-129): a ToolInputError at the tool
 *    (src/agents/tools/continue-delegate-tool.ts:353-362), and for a delegate accepted before the policy changed, a
 *    rejection at dispatch: log `[continuation:delegate-rejected] policy.cross_session_targeting
 *    ... session=<dispatcher>`, terminal custody failure, an owner notice and a continuation.disabled
 *    span (src/auto-reply/continuation/delegate-dispatch.ts:267-290). The policy is read at each
 *    decision (config.ts:84-92), and agents.defaults.continuation.* reloads hot
 *    (src/gateway/config-reload.prepared-model-runtime.test.ts:74-96), so config.patch
 *    (src/gateway/server-methods/config.ts:798-850) changes it without a restart. j12 has no per-target
 *    addressability check.
 *
 * 5. Checked, enqueued, woken, adopted, and what a refusal leaves:
 *    - return routing: src/agents/subagent-announce.continuation-return.ts:104-212. It logs
 *      `[continuation:targeted-return] Delivered to <keys> from <child>` (:194-201), with an EMPTY
 *      list when every recipient was refused;
 *    - enqueue: src/auto-reply/continuation/targeting.ts:240-254 refuses a stale recipient before any
 *      row (silent), :278-319 acks a row gone stale after its write (silent), :329-346 removes the
 *      queued event and acks (silent); a current return queues an adoption-scoped event and wakes the
 *      recipient unless the mode is silent (:366-374; wakeRecipients, continuation-return.ts:175);
 *    - wake handoff: src/auto-reply/continuation/continuation-wake.ts:127-238 re-checks under writer
 *      admission; a stale event is retired by settleStaleSystemEventAuthority (silent,
 *      src/auto-reply/reply/session-system-event-adoption.ts:113-134);
 *    - prompt drain: src/auto-reply/reply/session-system-events.ts:153-211 settles stale events
 *      (silent) before formatting;
 *    - durable replay (the 45-75 s pending sweep, src/infra/session-delivery-queue-runtime.ts:52-66,
 *      143-149, and the boot recovery, src/gateway/server-restart-sentinel.ts:80-97, 138-153):
 *      src/gateway/server-restart-sentinel-delivery.ts:226-243 logs
 *      `session event delivery skipped: recipient authority changed` (sessionKey, queueId) and :271-290
 *      `session event delivery wake skipped: recipient authority changed`. This is the only refusal
 *      at return time that names a reason;
 *    - settlement: an adopted and a refused row both settle "recovered"
 *      (src/infra/session-delivery-queue-recovery.ts:149-156; ackSessionDelivery,
 *      src/infra/session-delivery-queue-storage.ts:601-622), so no record says "refused";
 *    - adoption: the adopting transcript row carries __openclaw.sessionDeliveryAckIds
 *      (session-system-event-adoption.ts:49-79); chat.history hides the wake's own rows (see
 *      lib/wake-turn-receipt.mjs), so adoption is read from the primed target's TARGET-ACK.
 *    So revoked, reassigned and replay cases dispatch mode silent: the return is routed while
 *    current and parks un-adopted, the transition advances the epoch, and the replay refuses it with
 *    the reason. The probe turn then forces a prompt drain to show the parked event is never adopted.
 *
 * 6. Restart (replay-restart). The control is the declared external supervisor
 *    (OPENCLAW_SUPERVISOR_MODE=external, src/infra/gateway-supervision.ts:5-12): gateway.restart.request
 *    (operator.admin, src/gateway/methods/core-descriptors.ts:339) closes, writes the restart handoff
 *    and exits 0 (src/cli/gateway-cli/run-loop.ts:496-551); the control consumes it
 *    (`gateway restart-handoff consume --expected-pid`, src/cli/gateway-cli/register-restart-handoff.ts:42-61)
 *    and starts the replacement, whose boot recovery replays the parked row. This reuses the restart
 *    control's branch, not its row: nothing here reads or feeds R-CD-RETURN-COVENANT-AUTHORITY.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { nonce as makeNonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';
import { advertisedMethodsFromHello } from '../lib/child-observer.mjs';
import { renderRowTaskTemplate } from '../lib/row-child-correlation.mjs';
import { messageRunId, hasExactSentinelText } from '../lib/wake-turn-receipt.mjs';
import {
  RRA_ACK_MARKER,
  RRA_CASES,
  RRA_EVIDENCE_PREFIX,
  RRA_J12,
  RRA_PROBE_MARKER,
  RRA_READY_MARKER,
  RRA_RETURN_MARKER,
  RRA_ROW,
  RRA_TASK_MARKER,
  countDelegateCalls,
  countParentAcks,
  findDelegateDispatch,
  findOwnerAssignment,
  observeTargetTranscript,
  scenarioMethodsFor,
} from '../lib/recipient-authority-row.mjs';

const MAX_DURATION_S = 900;
export const options = {
  scenarios: {
    r_cd_recipient_authority: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: `${MAX_DURATION_S}s`,
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_recipient_authority_duration: [`p(95)<${MAX_DURATION_S * 1000}`],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_recipient_authority_duration');
const manifest = loadManifestFromEnv();

// The collector re-renders the manifest's template with the evidence nonce, so the dispatched task
// is rendered the same way (lib/row-child-correlation.mjs).
const DEFAULT_TASK_TEMPLATE =
  'RCDRA:{{nonceSuffix16}} Proof nonce {{nonce}}: reply exactly RCDRA-RETURN {{nonce}}. Do not mutate files. Do not post to any channel.';

const REFUSAL =
  'R-CD-RECIPIENT-AUTHORITY runs only under tools/k6-proofs/scripts/run-recipient-authority-row.mjs, which starts the disposable gateway at j12 and passes its run id, case and phase.';

function controlEnv() {
  const caseId = __ENV.OPENCLAW_RCD_RA_CASE || '';
  const phase = __ENV.OPENCLAW_RCD_RA_PHASE || '';
  const runId = __ENV.OPENCLAW_RCD_RA_RUN || '';
  const problems = [];
  if (!/^rra-[0-9a-f]{16}$/.test(runId)) problems.push('control run id missing');
  if (!RRA_CASES[caseId]) problems.push('unknown case');
  if (phase !== 'drive' && phase !== 'observe') problems.push('unknown phase');
  if (phase === 'observe' && !RRA_CASES[caseId]?.restart) problems.push('only replay-restart has an observe phase');
  if ((__ENV.OPENCLAW_CANDIDATE_SHA || '') !== RRA_J12) problems.push('candidate is not j12');
  if (!__ENV.OPENCLAW_GATEWAY_TOKEN || !__ENV.OPENCLAW_GATEWAY_WS) problems.push('the control passes the disposable gateway');
  return { caseId, phase, runId, problems };
}

// k6 logs an exception thrown by an iteration and still exits 0; one thrown from setup()
// aborts the run (exit 107), so the refusal lives there too.
export function setup() {
  const { problems } = controlEnv();
  if (problems.length) throw new Error(`${REFUSAL} (${problems.join('; ')})`);
}

function numberEnv(name, fallback) {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sessionKeyFor(kind, nonce) {
  return `agent:main:r-cd-ra-${kind}-${nonce}`.toLowerCase().replace(/[^a-z0-9:-]/g, '-');
}

function connectParams(token) {
  // A loopback backend client with the shared token keeps its requested scopes (connect-auth.ts
  // :286-296); sharing mutations, sessions.reset/delete, config.patch and the restart need admin.
  return {
    minProtocol: 3,
    maxProtocol: 4,
    client: { id: 'gateway-client', version: '0.2.0', platform: 'linux', mode: 'backend' },
    role: 'operator',
    scopes: ['operator.read', 'operator.write', 'operator.admin'],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token },
    userAgent: 'k6-proof-harness/0.2.0',
  };
}

function boundedText(value) {
  return String(value ?? '').slice(0, 400);
}

export default function () {
  const control = controlEnv();
  const spec = RRA_CASES[control.caseId];
  const evidence = {
    row: RRA_ROW,
    case: control.caseId,
    phase: control.phase,
    control_run_id: control.runId,
    candidate_sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'isolated-proof-gateway',
    manifest_loaded: Boolean(manifest),
    started: new Date().toISOString(),
    ended: null,
    refusals: [],
  };
  if (control.problems.length) {
    evidence.refusals.push(...control.problems);
    failures.add(1);
    console.error(`✗ ${REFUSAL}`);
    console.log(`${RRA_EVIDENCE_PREFIX} ${JSON.stringify(evidence)}`);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const prior = control.phase === 'observe' ? JSON.parse(__ENV.OPENCLAW_RCD_RA_STATE || '{}') : null;
  const rowNonce = prior?.nonce || makeNonce('RCDRA');
  const suffix = rowNonce.slice(-16);
  const probeNonce = makeNonce('RCDRA-PROBE');
  const keys = prior?.keys || {
    parent: sessionKeyFor(`${control.caseId}-parent`, suffix),
    target: sessionKeyFor(`${control.caseId}-target`, suffix),
    ops: spec.transition === 'sessions.assignOwner' ? sessionKeyFor(`${control.caseId}-ops`, suffix) : null,
  };
  const childTask = renderRowTaskTemplate(manifest?.invocation?.promptTemplate || DEFAULT_TASK_TEMPLATE, rowNonce);
  const delaySeconds = numberEnv('OPENCLAW_RCD_RA_DELAY_SECONDS', 30);
  const pollMs = numberEnv('OPENCLAW_RCD_RA_POLL_MS', 2000);
  const windowMs = numberEnv('OPENCLAW_RCD_RA_WINDOW_MS', 120000);
  const parkMs = numberEnv('OPENCLAW_RCD_RA_PARK_MS', 15000);
  const sweepWaitMs = numberEnv('OPENCLAW_RCD_RA_SWEEP_WAIT_MS', 160000);
  const attempts = (ms) => Math.max(1, Math.ceil(ms / pollMs));

  Object.assign(evidence, {
    nonce: rowNonce,
    probe_nonce: probeNonce,
    keys,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    dispatch_accepted_at_ms: prior?.dispatch_accepted_at_ms ?? null,
    preflight: null,
    priming_run_ids: prior?.priming_run_ids || [],
    target_primed: prior?.target_primed ?? false,
    dispatch: prior?.dispatch || null,
    child: prior?.child || { spawned: null, bound: false, done: false, key: null },
    member_identity_found: null,
    config: { patched_at_ms: null, restored: spec.transition === 'config.patch' ? false : null },
    transition: prior?.transition || { method: spec.transition, ok: spec.transition ? null : true, requested_at_ms: null, settled_at_ms: null, error: null },
    probe_run_id: null,
    probe_ran: false,
    pre_transition_obs: prior?.pre_transition_obs ?? null,
    other_delegate_calls: null,
    target_obs: null,
    parent_ack_rows: null,
    child_spawn_observed: null,
  });
  if (prior) {
    evidence.reason_hash = prior.reason_hash ?? null;
    evidence.reason_length = prior.reason_length ?? null;
    evidence.delegate_mode = prior.delegate_mode ?? null;
  }

  const started = Date.now();
  const res = ws.connect(__ENV.OPENCLAW_GATEWAY_WS, {}, (socket) => {
    const tracker = new RequestTracker();
    const handlers = {};
    let connectId = null;
    let configHash = null;
    let memberIdentity = null;
    let closed = false;

    const later = (ms, fn) => socket.setTimeout(fn, k6TimeoutMs(ms));
    const finish = () => {
      if (closed) return;
      closed = true;
      socket.close();
    };
    const refuse = (code) => {
      evidence.refusals.push(code);
      console.error(`✗ ${code}`);
    };
    const rpc = (method, params, cb) => {
      const id = tracker.send(socket, method, params);
      handlers[id] = cb;
    };
    const history = (sessionKey, cb) => rpc('chat.history', { sessionKey, limit: 200 }, (r) => cb(r.ok ? (r.payload?.messages || []) : null));
    const pollHistory = (sessionKey, test, budget, done) => {
      history(sessionKey, (messages) => {
        const hit = messages ? test(messages) : null;
        if (hit) return done(hit, messages);
        if (budget <= 1) return done(null, messages);
        later(pollMs, () => pollHistory(sessionKey, test, budget - 1, done));
      });
    };
    const send = (key, message, idem, cb) => rpc('sessions.send', { key, message, idempotencyKey: idem }, cb);

    /* ---------------------------- the case script ---------------------------- */

    function createSessions() {
      const wanted = [keys.parent, keys.target, ...(keys.ops ? [keys.ops] : [])];
      const next = (index) => {
        if (index >= wanted.length) return afterCreate();
        rpc('sessions.create', { key: wanted[index], label: `k6 ${RRA_ROW} ${control.caseId}` }, (r) => {
          if (!r.ok) {
            refuse(`sessions.create rejected: ${boundedText(r.error?.message)}`);
            return finish();
          }
          next(index + 1);
        });
      };
      next(0);
    }

    function afterCreate() {
      if (spec.transition === 'session.members.remove') return addMember(() => prime(dispatchOrAdmission));
      // A policy that could not be disabled leaves nothing to refuse: stop before dispatching.
      if (control.caseId === 'unauthorized-admission') return prime(() => setPolicy('disabled', dispatchOrAdmission, finalReads));
      return prime(dispatchOrAdmission);
    }

    function addMember(next) {
      rpc('session.members.list', { sessionKey: keys.target }, (r) => {
        const identities = Array.isArray(r.payload?.identities) ? r.payload.identities : [];
        memberIdentity = identities.find((identity) => identity && typeof identity.id === 'string' && identity.id)?.id || null;
        evidence.member_identity_found = Boolean(memberIdentity);
        if (!memberIdentity) {
          refuse('precondition: no known identity to add as a member (session.members.add accepts only a known identity)');
          return finish();
        }
        rpc('session.members.add', { sessionKey: keys.target, identityId: memberIdentity }, (added) => {
          if (!added.ok) {
            refuse(`session.members.add rejected: ${boundedText(added.error?.message)}`);
            return finish();
          }
          next();
        });
      });
    }

    function prime(next) {
      const instruction =
        `[k6-proof-harness] ${RRA_ROW} priming ${rowNonce}. Reply exactly ${RRA_READY_MARKER} ${rowNonce} now. ` +
        `On a later turn, only if an internal task completion for proof ${suffix} is in your context, reply exactly ${RRA_ACK_MARKER} ${rowNonce}.`;
      send(keys.target, instruction, `${RRA_ROW}-PRIME-${evidence.priming_run_ids.length}-${rowNonce}`, (r) => {
        const runId = r.payload?.runId || null;
        if (!r.ok || !runId) {
          refuse('target priming turn not accepted with a run id; the priming run cannot be excluded');
          return finish();
        }
        evidence.priming_run_ids.push(runId);
        pollHistory(keys.target, (messages) => messages.some((m) => messageRunId(m) === runId &&
          String(m.role).toLowerCase() === 'assistant' && hasExactSentinelText(textOf(m), RRA_READY_MARKER, rowNonce)), attempts(windowMs), (hit) => {
          if (!hit) {
            refuse('target never answered its priming turn');
            return finish();
          }
          evidence.target_primed = true;
          next();
        });
      });
    }

    function setPolicy(value, next, onFailed = next) {
      rpc('config.get', {}, (got) => {
        configHash = got.payload?.hash || got.payload?.baseHash || null;
        const raw = JSON.stringify({ agents: { defaults: { continuation: { crossSessionTargeting: value } } } });
        rpc('config.patch', { raw, ...(configHash ? { baseHash: configHash } : {}) }, (patched) => {
          const at = Date.now();
          if (value === 'disabled') {
            evidence.transition.requested_at_ms = at;
            evidence.transition.ok = patched.ok;
            evidence.transition.settled_at_ms = Date.now();
            if (!patched.ok) evidence.transition.error = boundedText(patched.error?.message);
            evidence.config.patched_at_ms = at;
          } else {
            evidence.config.restored = patched.ok;
          }
          if (!patched.ok) {
            refuse(`config.patch ${value} rejected: ${boundedText(patched.error?.message)}`);
            return onFailed();
          }
          next();
        });
      });
    }

    function dispatchOrAdmission() {
      evidence.reason_hash = crypto.sha256(childTask, 'hex').slice(0, 16);
      evidence.reason_length = childTask.length;
      evidence.delegate_mode = spec.mode;
      const instruction =
        `[k6-proof-harness] Use tool_search to discover the deferred continue_delegate tool, then call dispatch_action with id from that result and ` +
        `args={task:"${childTask}", mode:"${spec.mode}", delaySeconds:${delaySeconds}, targetSessionKey:"${keys.target}"}. ` +
        'This is a proof run: perform the discovery and call, then no other action.';
      send(keys.parent, instruction, `${RRA_ROW}-${rowNonce}`, (r) => {
        if (!r.ok) {
          refuse(`dispatch sessions.send rejected: ${boundedText(r.error?.message)}`);
          return finish();
        }
        pollHistory(keys.parent, (messages) => {
          const found = findDelegateDispatch(messages, { taskMarker: `${RRA_TASK_MARKER}:${suffix}`, targetSessionKey: keys.target });
          return found && found.status ? found : null;
        }, attempts(windowMs), (found) => {
          evidence.dispatch = found
            ? {
              status: found.status,
              accepted: found.status === 'scheduled',
              tool_call_id: found.toolCallId,
              error_text: boundedText(found.errorText),
              result_mode: found.mode,
              result_delay_seconds: found.delaySeconds,
              observed_at_ms: Date.now(),
            }
            : { status: null, accepted: null, tool_call_id: null, error_text: null, result_mode: null, result_delay_seconds: null, observed_at_ms: null };
          if (found?.status === 'scheduled') evidence.dispatch_accepted_at_ms = evidence.dispatch.observed_at_ms;
          afterDispatch();
        });
      });
    }

    function afterDispatch() {
      const accepted = evidence.dispatch?.accepted === true;
      if (control.caseId === 'unauthorized-admission') {
        // Restore at once; the refusal is already in the toolResult. Observe for the delay so a
        // delegate that was somehow accepted would have fired.
        return setPolicy('enabled', () => later(delaySeconds * 1000 + parkMs, probeThenFinal));
      }
      if (!accepted) {
        refuse('continue_delegate was not accepted (no scheduled toolResult bound to this case)');
        return finalReads();
      }
      if (control.caseId === 'unauthorized-dispatch') {
        return setPolicy('disabled', () => later(delaySeconds * 1000 + parkMs, () => setPolicy('enabled', probeThenFinal)), finalReads);
      }
      if (spec.family === 'allowed') {
        // The control samples the epoch every 500 ms; leave it a sample of the captured epoch
        // before the reset, so a reset that advanced it would show.
        if (spec.transition === 'sessions.reset') return later(numberEnv('OPENCLAW_RCD_RA_SAMPLE_GAP_MS', 2000), () => resetTarget(() => prime(waitForAck)));
        // allowed-silent: the silent return parks un-adopted, and the probe turn adopts it.
        if (spec.probeAdopts) return waitForChild(() => later(parkMs, probeThenFinal));
        return waitForAck();
      }
      // durable-replay and boot-replay: let the silent return route and park, then transition.
      waitForChild(() => later(parkMs, () => transition(afterTransition)));
    }

    function resetTarget(next) {
      evidence.transition.requested_at_ms = Date.now();
      rpc('sessions.reset', { key: keys.target, reason: 'reset' }, (r) => {
        evidence.transition.ok = r.ok;
        evidence.transition.settled_at_ms = Date.now();
        if (!r.ok) {
          evidence.transition.error = boundedText(r.error?.message);
          refuse('sessions.reset rejected');
          return finalReads();
        }
        next();
      });
    }

    function waitForChild(next) {
      const read = (budget) => {
        rpc('sessions.list', { spawnedBy: keys.parent, limit: 50 }, (r) => {
          const rows = Array.isArray(r.payload?.sessions) ? r.payload.sessions : [];
          const candidates = rows.filter((row) => row && typeof row.key === 'string' && row.key !== keys.parent && row.key !== keys.target);
          evidence.child_spawn_observed = r.ok;
          if (candidates.length) evidence.child.spawned = true;
          bindChild(candidates, (bound) => {
            if (bound && bound.status === 'done') {
              evidence.child.bound = true;
              evidence.child.done = true;
              evidence.child.key = bound.key;
              return next(true);
            }
            if (budget <= 1) return next(false);
            later(pollMs, () => read(budget - 1));
          });
        });
      };
      read(attempts(windowMs * 2));
    }

    function bindChild(candidates, cb) {
      const step = (index) => {
        if (index >= candidates.length) return cb(null);
        history(candidates[index].key, (messages) => {
          const binds = (messages || []).some((m) => String(m.role).toLowerCase() === 'user' && textOf(m).includes(`${RRA_TASK_MARKER}:${suffix}`));
          if (binds) return cb({ key: candidates[index].key, status: candidates[index].status });
          step(index + 1);
        });
      };
      step(0);
    }

    function transition(next) {
      // What the target showed just before the transition: the return must still be parked
      // un-adopted, or the transition tests nothing.
      history(keys.target, (messages) => {
        evidence.pre_transition_obs = messages
          ? observeTargetTranscript(messages, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids })
          : null;
        transitionNow(next);
      });
    }

    function transitionNow(next) {
      evidence.transition.requested_at_ms = Date.now();
      const settle = (ok, error) => {
        evidence.transition.ok = ok;
        evidence.transition.settled_at_ms = Date.now();
        if (!ok) {
          evidence.transition.error = boundedText(error);
          refuse(`transition ${spec.transition} failed`);
        }
        next(ok);
      };
      switch (spec.transition) {
        case 'session.visibility.set':
          return rpc('session.visibility.set', { sessionKey: keys.target, visibility: 'read-only' }, (r) => settle(r.ok, r.error?.message));
        case 'session.members.remove':
          return rpc('session.members.remove', { sessionKey: keys.target, identityId: memberIdentity }, (r) => settle(r.ok, r.error?.message));
        case 'sessions.delete+sessions.create':
          return rpc('sessions.delete', { key: keys.target }, (deleted) => {
            if (!deleted.ok) return settle(false, deleted.error?.message);
            rpc('sessions.create', { key: keys.target, label: `k6 ${RRA_ROW} reassigned` }, (created) => settle(created.ok, created.error?.message));
          });
        case 'sessions.assignOwner': {
          const instruction =
            `[k6-proof-harness] Use tool_search to discover the deferred sessions tool, then call dispatch_action with id from that result and ` +
            `args={action:"assign_owner", sessionKey:"${keys.target}", ownerType:"agent", ownerId:"main"}. This is a proof run: perform the call, then no other action.`;
          return send(keys.ops, instruction, `${RRA_ROW}-OWNER-${rowNonce}`, (r) => {
            if (!r.ok) return settle(false, r.error?.message);
            pollHistory(keys.ops, (messages) => findOwnerAssignment(messages, keys.target), attempts(windowMs), (found) => {
              settle(found?.status === 'updated', found ? `assign_owner ${found.status}` : 'no assign_owner toolResult');
            });
          });
        }
        default:
          return settle(false, `no transition for ${control.caseId}`);
      }
    }

    function afterTransition(ok) {
      if (!ok) return finalReads();
      if (spec.restart) {
        // The control restarts the gateway now and runs the observe phase.
        evidence.handoff = { ready_for_restart: true };
        return finalReads();
      }
      later(sweepWaitMs, probeThenFinal);
    }

    function waitForAck() {
      pollHistory(keys.target, (messages) => {
        const seen = observeTargetTranscript(messages, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids });
        return seen.ackRuns > 0 ? seen : null;
      }, attempts(windowMs + delaySeconds * 1000), () => {
        // Keep watching one more sweep period for a duplicate adoption.
        waitForChild(() => later(numberEnv('OPENCLAW_RCD_RA_DUPLICATE_WAIT_MS', 75000), finalReads));
      });
    }

    function probeThenFinal() {
      const instruction = `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: reply exactly ${RRA_PROBE_MARKER} ${probeNonce}.`;
      send(keys.target, instruction, `${RRA_ROW}-PROBE-${probeNonce}`, (r) => {
        evidence.probe_run_id = r.payload?.runId || null;
        evidence.probe_ran = Boolean(r.ok && evidence.probe_run_id);
        if (!evidence.probe_ran) return finalReads();
        pollHistory(keys.target, (messages) => messages.some((m) => messageRunId(m) === evidence.probe_run_id &&
          String(m.role).toLowerCase() === 'assistant'), attempts(windowMs), () => finalReads());
      });
    }

    function finalReads() {
      rpc('sessions.list', { spawnedBy: keys.parent, limit: 50 }, (listed) => {
        const rows = Array.isArray(listed.payload?.sessions) ? listed.payload.sessions : [];
        const candidates = rows.filter((row) => row && typeof row.key === 'string' && row.key !== keys.parent && row.key !== keys.target);
        bindChild(candidates, (bound) => {
          // The parent is a disposable session that only ever received this case's instruction, so
          // any session it spawned is this case's delegate.
          if (listed.ok) evidence.child.spawned = candidates.length > 0;
          if (bound) {
            evidence.child.bound = true;
            evidence.child.key = bound.key;
            evidence.child.done = bound.status === 'done';
          }
          history(keys.target, (target) => {
            evidence.target_obs = target
              ? observeTargetTranscript(target, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids, probeRunId: evidence.probe_run_id, probeNonce })
              : null;
            history(keys.parent, (parent) => {
              evidence.parent_ack_rows = parent ? countParentAcks(parent, rowNonce) : null;
              // Every continue_delegate call the parent made beyond the case's own bound one.
              const calls = parent ? countDelegateCalls(parent) : null;
              evidence.other_delegate_calls = calls === null ? null : calls - (evidence.dispatch?.tool_call_id ? 1 : 0);
              finish();
            });
          });
        });
      });
    }

    /* ------------------------------ transport ------------------------------ */

    socket.on('open', () => {
      connectId = tracker.send(socket, 'connect', connectParams(__ENV.OPENCLAW_GATEWAY_TOKEN));
    });

    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      const id = msg?.type === 'res' ? msg.id : null;
      const classified = tracker.classify(msg);
      if (id && id === connectId) {
        if (!classified.ok || classified.payload?.type !== 'hello-ok') {
          refuse('connect rejected');
          return finish();
        }
        const advertised = advertisedMethodsFromHello(msg) || [];
        const missingMethods = scenarioMethodsFor(control.caseId).filter((method) => !advertised.includes(method));
        evidence.preflight = { ok: missingMethods.length === 0, missing: missingMethods };
        if (missingMethods.length) {
          refuse(`preflight: methods not advertised: ${missingMethods.join(', ')}`);
          return finish();
        }
        if (control.phase === 'observe') return later(numberEnv('OPENCLAW_RCD_RA_BOOT_WAIT_MS', 30000), probeThenFinal);
        return later(250, createSessions);
      }
      if (id && handlers[id]) {
        const handler = handlers[id];
        delete handlers[id];
        try {
          handler(classified);
        } catch (error) {
          refuse(`handler error: ${boundedText(error && error.message)}`);
          finish();
        }
      }
    });

    socket.on('error', () => {
      refuse('websocket error');
      finish();
    });
    socket.setTimeout(() => {
      refuse('scenario window elapsed');
      finish();
    }, k6TimeoutMs((MAX_DURATION_S - 15) * 1000));
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, { 'case script completed without refusal': () => evidence.refusals.length === 0 });
  if (evidence.refusals.length) failures.add(1);
  console.log(`${RRA_EVIDENCE_PREFIX} ${JSON.stringify(evidence)}`);
  // The control grades the case; this line is the scenario's own completion, never a verdict.
  console.log(`\n[${RRA_ROW}] CASE ${control.caseId} ${control.phase}: evidence written (graded by the control)`);
}

function textOf(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n');
}

export function handleSummary(data) {
  const failed = data.metrics.proof_failures?.values?.count || 0;
  return {
    stdout: `\n[${RRA_ROW}] k6 summary: ${failed === 0 ? 'case script complete' : 'case script refused or incomplete'} | case ${__ENV.OPENCLAW_RCD_RA_CASE || 'unset'}\n`,
  };
}
