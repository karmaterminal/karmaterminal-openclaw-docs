/**
 * Scenario: R-CD-RECIPIENT-AUTHORITY, one case of the live isolated-gateway row, pinned to j12′.
 *
 * Rulings: 🌊, room msg 1567077062139838485 (2026-11-03): a live, isolated-gateway row, separate
 * from the supervised-restart row; every case MISSING until an owner runs it; observe the refusal
 * reason AND the absence of target adoption, ack and final effect, including replay. 🌊, room msg
 * 1567104742604406896: fix before presenting; j12′ carries a reason at enqueue, replay/wake and
 * prompt drain and no "Delivered to" for an empty set; a silent park or the sweep is not wake
 * proof. Bound issue: karmaterminal/karmaterminal-openclaw-docs#536.
 *
 * Only the control runs this: tools/k6-proofs/scripts/run-recipient-authority-row.mjs starts the
 * disposable gateway, runs this scenario once per case and grades. A parked case runs twice: drive
 * (up to its child's return), then transition, which the control starts only once it has witnessed
 * the return's queued copy (section 9); replay-restart runs a third time, observe, after its
 * supervised restart. Without the control's run id the scenario refuses from setup() and from
 * default(). It never decides a verdict: it prints evidence, and lib/recipient-authority-row.mjs
 * grades the control's case record.
 *
 * Product path at j12′, karmaterminal/openclaw 2907e656a892c0efa93821670e9488c07be12c17 (the merged
 * head with the delegate dispatch grant), every anchor re-walked with git show / git grep at that
 * commit. j12 352f56029dc95c60149ab4aaa127226a861d0b3d is the named baseline only, the refused chain
 * e9dc1c31 the row's former interim pin, and 1ab5a73e (the merged head before the grant) its former
 * pin. Sections 1-4 and 6 read files that are j12's own or whose cited lines j12′ only moved;
 * section 5 is j12′'s return refusal, section 7 its continue_work binding and section 8 the grant.
 *
 * 1. Authority. One UUID epoch per logical session key in session_recipient_authority (per-agent
 *    database). A binding is current only while the stored epoch equals the captured one
 *    (src/config/sessions/session-recipient-authority-types.ts:96-101). Capture is insert-if-absent
 *    for ANY key, existing session or not (src/config/sessions/session-recipient-authority.worker.ts:36-56,
 *    src/config/sessions/session-sharing-store.worker.ts:170-174).
 *
 * 2. Bound. continue_delegate with targetSessionKey (src/agents/tools/continue-delegate-tool.ts:319-339)
 *    enqueues the delegate (:424-434 -> src/auto-reply/continuation/delegate-store.ts:205-224), and the
 *    custody record is created only after the binding is captured
 *    (src/auto-reply/continuation/delegate-flow-store.ts:432-452, the binding at :435-442 ->
 *    src/auto-reply/continuation/recipient-authority-binding.ts:56-74). The tool's "scheduled" result
 *    (continue-delegate-tool.ts:436-449) is therefore after capture. The child carries the binding
 *    (src/auto-reply/continuation/delegate-dispatch-request.ts:65-66,
 *    src/agents/subagents/spawn/subagent-spawn-request.ts:328, subagent-spawn-continuation.ts:138-159).
 *
 * 3. What advances the epoch: exactly four writers, plus first capture
 *    (src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37 and its callers):
 *    - deletion, every deletion owner: src/config/sessions/session-accessor.sqlite-entry-store.ts:56-69
 *      (gateway sessions.delete, src/gateway/server-methods/sessions-delete.ts:589; the epoch row
 *      outlives the session, so sessions.create of the same key keeps the advanced epoch);
 *    - owner change: src/config/sessions/session-accessor.sqlite-owner.ts:158-182 (sessions.assignOwner,
 *      src/gateway/server-methods/sessions-mutations.ts:343-518; it refuses a caller that is neither
 *      an agent runtime nor a human profile, :362-374, so a shared-token client cannot drive it; the
 *      agent's sessions tool action assign_owner can, src/agents/tools/sessions-tool.ts:384-419);
 *    - visibility narrowing, every writer: src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136
 *      (session.visibility.set, src/gateway/server-methods/sessions-sharing.ts:527-610; rank
 *      shared 3 > suggest 2 > read-only 1 > draft 0, session-recipient-authority-types.ts:75-108;
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
 *    span (src/auto-reply/continuation/delegate-dispatch.ts:268-291). The policy is read at each
 *    decision (config.ts:84-92), and agents.defaults.continuation.* reloads hot
 *    (src/gateway/config-reload.prepared-model-runtime.test.ts:74-96), so config.patch
 *    (src/gateway/server-methods/config.ts:798-980) changes it without a restart. j12′ has no per-target
 *    addressability check.
 *
 * 5. Checked, enqueued, woken, adopted, and what a refusal leaves (all at j12′):
 *    - every refusal logs `[continuation:return-refused] stage=<enqueue|replay|wake|prompt-drain>
 *      reason=recipient-authority-changed session=<key>[ deliveryId=<id>]` from the subsystem
 *      continuation/return-refused (src/auto-reply/continuation/return-refusal.ts:16-36), and a
 *      written row is retired as a bounded `failed` receipt, never acked (return-refusal.ts:53-66);
 *    - return routing: src/agents/subagent-announce.continuation-return.ts:98-215. It logs
 *      `[continuation:targeted-return] Delivered to <keys> from <child>` only for the recipients it
 *      delivered, and nothing at all when every recipient was refused (:189-203); it wakes them
 *      unless the mode is silent (:175);
 *    - enqueue: src/auto-reply/continuation/targeting.ts:249-411. Its first authority read refuses a
 *      stale recipient before any row, with no deliveryId (:277-280, through refuseStaleRecipient
 *      :261-276); a row gone stale after its write (:313-347) or after its queueing (:358-374) is
 *      refused with its deliveryId; a current return queues an adoption-scoped event (:322-341)
 *      and requests a wake (:395-403);
 *    - wake handoff: src/auto-reply/continuation/continuation-wake.ts:127-256, 250 ms after the
 *      request (:41, :106). It re-reads authority (:163-171) and refuses a stale event with
 *      stage=wake (:233-243 -> src/auto-reply/reply/session-system-event-adoption.ts:118-147). No
 *      public RPC can land a transition inside those 250 ms on purpose, so no case pins stage=wake;
 *    - prompt drain: src/auto-reply/reply/session-system-events.ts:192-207 refuses stale events with
 *      stage=prompt-drain before formatting, and final adoption re-checks under writer admission
 *      (session-system-event-adoption.ts:191-211, 248-270);
 *    - durable replay (the 45-75 s pending sweep, src/infra/session-delivery-queue-runtime.ts:52-66,
 *      143-160, and the boot recovery, src/gateway/server-restart-sentinel.ts:80-97, 138-153):
 *      src/gateway/server-restart-sentinel-delivery.ts:263-281 and 307-329 call
 *      refuseStaleAuthorityReplay (:50-76), which DEFERS while the row still has a queued copy in
 *      memory (:61-65) and otherwise logs stage=replay with deliveryId=<row id> (:66-71);
 *    - settlement: a refused row moves to `failed` with its receipt kept, an adopted one is
 *      `recovered` (src/infra/session-delivery-queue-recovery.ts:152-215). No public surface reads
 *      the receipt: the gateway health's failed count leaves it out on purpose
 *      (src/infra/delivery-queue-sqlite.kernel.ts:397-429; src/gateway/health/collector.ts:640-654);
 *    - adoption: the adopting transcript row carries __openclaw.sessionDeliveryAckIds (the turn input
 *      src/auto-reply/reply/managed-delivery-turn-lifecycle.ts:107-111, written to the row by
 *      src/sessions/user-turn-transcript.metadata.ts:102-104; read back at
 *      session-system-event-adoption.ts:53-71) only when the turn's recorder can take the ids. A
 *      sessions.send turn stages its input before the drain
 *      (src/gateway/server-methods/chat-send-input-dispatch.ts:330-350), the staged recorder refuses
 *      them (src/sessions/user-turn-transcript.ts:130-140), and the return is adopted without a
 *      receipt (session-system-event-adoption.ts:287-296), its model seeing it all the same
 *      (src/auto-reply/continuation/continuation-wake.test.ts:878-920). chat.history hides the wake's
 *      own rows (see lib/wake-turn-receipt.mjs). So every adoption this row reads, a wake's or the
 *      probe turn's, is the primed target's TARGET-ACK, bound to its run (🌊's ruling (a), room msg
 *      1567556038281007235). The probe is conditional (🌊, room msg 1567590902694936678): a turn
 *      that drained the return follows its priming, any other answers PROBE-OK; the unconditional
 *      probe before it won over the priming, so allowed-silent's ack could never show;
 *    - sessions.delete (and sessions.reset) consume the session's queued events
 *      (src/gateway/server-methods/sessions-delete.ts:454-470 -> src/gateway/session-lifecycle-cleanup.ts:74-92
 *      -> src/gateway/session-reset-runtime-cleanup.ts:77-93 -> src/gateway/session-reset-runtime-state.ts:11-51
 *      -> src/auto-reply/reply/session-reset-cleanup.ts:149-227, consumed at :202-203). At j12′ a
 *      delete still ends the session's own custody (cancelSessionContinuations, :171-175); /new and
 *      /reset end only the replaced head's (retireReplacedHeadContinuations). Neither touches a
 *      return another session's delegate owes this one.
 *    So each case's stage (RRA_CASES, refusedAt): revoked-visibility, revoked-membership and
 *    revoked-owner park a silent return whose queued copy survives the transition, so the sweep
 *    defers and the probe turn's prompt drain refuses it (stage=prompt-drain); reassigned deletes the
 *    target, which drops the copy, so the sweep refuses it (stage=replay), unless a sweep replayed
 *    the row between the delete's consume and its epoch commit (sessions-delete.ts:454, 514) and
 *    re-queued the copy while the epoch was current (server-restart-sentinel-delivery.ts:263-274,
 *    307-314), which the probe turn's drain then refuses; that sweep logs its arming line while the
 *    delete is in flight (session-delivery-queue-runtime.ts:480-484), the control records it and
 *    the grade requires it (RRA_CASES, otherFirstStages); wake-revoked-visibility
 *    and wake-reassigned (silent-wake) transition while the delegate waits to fire, so the router's
 *    first read refuses it with no row and no Delivered to line (stage=enqueue); replay-restart
 *    restarts before any prompt, so the replacement's boot replay refuses it (stage=replay).
 *
 * 6. Restart (replay-restart). The control is the declared external supervisor
 *    (OPENCLAW_SUPERVISOR_MODE=external, src/infra/gateway-supervision.ts:5-12): gateway.restart.request
 *    (operator.admin, src/gateway/methods/core-descriptors.ts:339) closes, writes the restart handoff
 *    and exits 0 (src/cli/gateway-cli/run-loop.ts:496-551); the control consumes it
 *    (`gateway restart-handoff consume --expected-pid`, src/cli/gateway-cli/register-restart-handoff.ts:41-74)
 *    and starts the replacement, whose boot recovery replays the parked row. This reuses the restart
 *    control's branch, not its row: nothing here reads or feeds R-CD-RETURN-COVENANT-AUTHORITY.
 *
 * 7. continue_work (work-revoked-visibility). A kept continue_work wake is bound to its session's
 *    recipient authority (src/auto-reply/continuation/work-recipient-authority.ts, RFC
 *    docs/design/continue-work-signal-v2.md "Kept continue_work wakes and recipient authority"):
 *    - the tool only queues the request and answers `scheduled` (src/agents/tools/continue-work-tool.ts:84-110,
 *      src/auto-reply/reply/agent-runner-embedded-candidate.ts:222-224); the turn schedules it after the
 *      attempt (src/auto-reply/reply/agent-runner-continuation-signal.ts:467 ->
 *      src/auto-reply/continuation/work-dispatch.ts:631-740), whose election captures the epoch first
 *      (:662-665 -> work-operator-continuation.ts:34-52 -> work-recipient-authority.ts:63-67,
 *      insert-if-absent). So the capture comes AFTER the scheduled toolResult; the control reads it
 *      from the store, where this session's row first appears with it;
 *    - the wake is due no earlier than the election plus its delay: then, or at an anchor taken on a
 *      later dispatcher pass, matured if overdue (work-dispatch.ts:667-668, work-store.ts:315-365).
 *      The timer drives the dispatcher with no busy check first (work-dispatch.ts:169-199), which
 *      claims the due record (work-store.ts:213-313)
 *      and at the handoff refuses a stale binding (work-dispatch.ts:529 -> work-recipient-authority.ts
 *      :102-152) before the busy, fold, admission and turn-start-fence branches (:573-627). The record
 *      fails with no notice (work-store.ts:639-655) and the refusal logs
 *      `[continuation:work-refused] stage=wake reason=recipient-authority-changed session=<key> flowId=<id>`
 *      from the subsystem continuation/work-refused (src/auto-reply/continuation/return-refusal.ts:38-46);
 *      a failed record is never claimed again (work-store.ts:226, 260);
 *    - the only earlier boundary, the replay sweep, runs at custody boot (custody-boot.ts:114-121 ->
 *      work-recipient-authority.ts:159-171); a later one, adoption (work-dispatch-execution.ts:267, 450),
 *      refuses a wake only if the handoff could not read the authority (work-recipient-authority.ts:116-124)
 *      or the authority moved after the handoff's read.
 *    So the case pins stage=wake: the session elects with a delay, narrows its own visibility after
 *    the capture, and is probed only after the wake was due.
 *
 * 8. The delegate dispatch grant (2907e656; 🌊's ruling A, room msg 1567487338383413250). This
 *    scenario's connection is a Gateway operator: the shared token over loopback, no device, admitted
 *    as the Gateway owner (src/gateway/server/ws-connection/connect-session.ts:216-220, 360-367,
 *    377-378). Before the grant, a delegate's spawn re-read the authority of the request that armed its
 *    timer, this connection's own, when it fired (src/gateway/operator-run-authority.ts:358-359), so
 *    the spawn needed this connection still current. Now the election captures the operator's
 *    bounded grant beside the binding, before the "scheduled" result
 *    (src/auto-reply/continuation/delegate-flow-store.ts:443-451 ->
 *    src/auto-reply/continuation/delegate-dispatch-grant.ts:48-79), and the spawn runs under it after
 *    the policy check (delegate-dispatch.ts:449-484 -> delegate-dispatch-grant.ts:85-141): another
 *    session, expiry, revocation or narrowed scopes fail the delegate with a named reason and no
 *    child (delegate-dispatch.ts:565-596). It governs the spawn and the child's run, not the return's
 *    path: routing, enqueue, wake, drain and replay are unchanged, so no case's stage or oracle moves.
 *    A refused grant leaves no child, which grades MISSING. That this owner connection gets a grant is
 *    read from the bytes; the grant's unit pins elect through a paired-device operator, and its
 *    refusals are those pins' (src/agents/subagents/spawn/subagent-spawn.continuation-operator-grant.test.ts),
 *    not this row's.
 *
 * 9. The orderings and allowed's fallback (🌊's ruling, room msg 1567623059727458526, on 🕯's run
 *    rra-a4d5318d426ad728, where revoked-owner's owner change settled before its return was enqueued
 *    and was refused at enqueue, and allowed's woken run gave no ack):
 *    - a parked case witnesses its return's queued copy before its transition. No gateway RPC reads a
 *      session's queued system events, so the witness is the router's line
 *      `[continuation:targeted-return] Delivered to <target> from <child>`
 *      (src/agents/subagent-announce.continuation-return.ts:198-203, console through
 *      src/runtime.ts:80-88), logged only for a target whose row was written
 *      (src/auto-reply/continuation/targeting.ts:304), whose in-memory copy was queued (:322-341) and
 *      whose authority was re-read current after it (:358-375; deliveredSessionKeys at :409). A silent
 *      return requests no wake (subagent-announce.continuation-return.ts:175; targeting.ts:395), so
 *      that copy stays parked. This scenario cannot read the gateway's console: the drive phase ends
 *      once the child returned, the control waits for the line, and only then runs the transition
 *      phase. A transition before the enqueue (refused at enqueue by targeting.ts:277-280, no row, no
 *      Delivered to) is another ordering, pinned apart as a dry-run case (RRA_EARLY_ENQUEUE_PINS);
 *    - allowed's woken run gives the ack (direct wake). Only when the woken run has no ack does
 *      allowed send the same conditional probe; one ack in that probe's own run is labelled
 *      probe-mediated (ack_path), never an ack in the wake turn.
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
  RRA_EVIDENCE_PREFIX,
  RRA_PINNED,
  RRA_PROBE_NONCE_SLOT,
  RRA_READY_MARKER,
  RRA_RETURN_MARKER,
  RRA_ROW,
  RRA_TASK_MARKER,
  countDelegateCalls,
  countParentAcks,
  countWorkCalls,
  findDelegateDispatch,
  findOwnerAssignment,
  findWorkElection,
  observeTargetTranscript,
  rraCaseSpec,
  rraProofId,
  rraProbeText,
  rraProbeTextProblems,
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
// The continue_work case's reason. A wake turn, if one ran, would answer it with a visible row; the
// marker is counted nowhere, so the model repeating it in the probe turn decides nothing.
const DEFAULT_WORK_REASON_TEMPLATE =
  'RCDRA:{{nonceSuffix16}} Proof wake {{nonce}}: when this continuation runs, reply exactly RCDRA-WOKE {{nonce}}. Do not mutate files. Do not post to any channel.';

const REFUSAL =
  'R-CD-RECIPIENT-AUTHORITY runs only under tools/k6-proofs/scripts/run-recipient-authority-row.mjs, which starts the disposable gateway at j12′ and passes its run id, case and phase.';

function controlEnv() {
  const caseId = __ENV.OPENCLAW_RCD_RA_CASE || '';
  const phase = __ENV.OPENCLAW_RCD_RA_PHASE || '';
  const runId = __ENV.OPENCLAW_RCD_RA_RUN || '';
  const problems = [];
  const spec = rraCaseSpec(caseId);
  if (!/^rra-[0-9a-f]{16}$/.test(runId)) problems.push('control run id missing');
  if (!spec) problems.push('unknown case');
  if (phase !== 'drive' && phase !== 'transition' && phase !== 'observe') problems.push('unknown phase');
  if (phase === 'transition' && spec?.timing !== 'parked') problems.push('only a parked case has a transition phase');
  if (phase === 'observe' && !spec?.restart) problems.push('only replay-restart has an observe phase');
  if ((__ENV.OPENCLAW_CANDIDATE_SHA || '') !== RRA_PINNED) problems.push('candidate is not j12′');
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
  const spec = rraCaseSpec(control.caseId);
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

  // The transition and observe phases continue the drive's case: its nonce, keys, priming runs,
  // dispatch, child and (observe) transition come from the previous phase's evidence.
  const prior = control.phase !== 'drive' ? JSON.parse(__ENV.OPENCLAW_RCD_RA_STATE || '{}') : null;
  const rowNonce = prior?.nonce || makeNonce('RCDRA');
  const suffix = rraProofId(rowNonce);
  const probeNonce = makeNonce('RCDRA-PROBE');
  // The continue_work case has no parent: its session elects its own wake and is the recipient.
  const keys = prior?.keys || {
    parent: spec.tool === 'continue_work' ? null : sessionKeyFor(`${control.caseId}-parent`, suffix),
    target: sessionKeyFor(`${control.caseId}-target`, suffix),
    ops: spec.transition === 'sessions.assignOwner' ? sessionKeyFor(`${control.caseId}-ops`, suffix) : null,
  };
  const childTask = renderRowTaskTemplate(manifest?.invocation?.promptTemplate || DEFAULT_TASK_TEMPLATE, rowNonce);
  const workReason = renderRowTaskTemplate(manifest?.invocation?.workReasonTemplate || DEFAULT_WORK_REASON_TEMPLATE, rowNonce);
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
    member_identity_found: prior?.member_identity_found ?? null,
    // Private: the identity revoked-membership adds in its drive and removes in its transition.
    member_identity: prior?.member_identity ?? null,
    config: { patched_at_ms: null, restored: spec.transition === 'config.patch' ? false : null },
    transition: prior?.transition || { method: spec.transition, ok: spec.transition ? null : true, requested_at_ms: null, settled_at_ms: null, error: null },
    probe_run_id: null,
    probe_sent_at_ms: null,
    probe_text_sha256: null,
    probe_ran: false,
    pre_transition_obs: prior?.pre_transition_obs ?? null,
    other_delegate_calls: null,
    other_work_calls: null,
    target_obs: null,
    parent_ack_rows: null,
    child_spawn_observed: null,
    // allowed: which path its ack is read on (direct-wake, or probe-mediated once the fallback probe
    // is sent), and the read that decided it.
    ack_path: spec.fallbackProbe ? 'direct-wake' : null,
    fallback: null,
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
    let memberIdentity = evidence.member_identity;
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
      const wanted = [keys.parent, keys.target, keys.ops].filter(Boolean);
      const next = (index) => {
        if (index >= wanted.length) return afterCreate();
        rpc('sessions.create', { key: wanted[index], label: `k6 ${RRA_ROW} ${control.caseId} ${control.runId} ${index}` }, (r) => {
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
      if (spec.tool === 'continue_work') return electWork();
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
        evidence.member_identity = memberIdentity;
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
        'This is a proof run: perform the discovery and call, then no other action. ' +
        'On any later turn, including after an interrupted notice, call no tool.';
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

    // continue_work (work-revoked-visibility): the session elects its own kept wake. The electing
    // run plays the priming run's part: it is the one run the observation excludes, because the
    // model may quote its own reason there.
    function electWork() {
      evidence.reason_hash = crypto.sha256(workReason, 'hex').slice(0, 16);
      evidence.reason_length = workReason.length;
      const instruction =
        `[k6-proof-harness] Call the continue_work tool with args={reason:"${workReason}", delaySeconds:${delaySeconds}}. ` +
        'If continue_work is deferred, discover it with tool_search and call it through dispatch_action with id from that result. ' +
        'This is a proof run: perform the call, then no other action.';
      send(keys.target, instruction, `${RRA_ROW}-WORK-${rowNonce}`, (r) => {
        const runId = r.payload?.runId || null;
        if (!r.ok || !runId) {
          refuse('election turn not accepted with a run id; the electing run cannot be excluded');
          return finish();
        }
        evidence.priming_run_ids.push(runId);
        evidence.target_primed = true;
        pollHistory(keys.target, (messages) => {
          const found = findWorkElection(messages, { reasonMarker: `${RRA_TASK_MARKER}:${suffix}` });
          return found && found.status ? found : null;
        }, attempts(windowMs), (found) => {
          evidence.dispatch = found
            ? {
              status: found.status,
              accepted: found.status === 'scheduled',
              tool_call_id: found.toolCallId,
              error_text: null,
              result_mode: null,
              result_delay_seconds: found.delaySeconds,
              observed_at_ms: Date.now(),
            }
            : { status: null, accepted: null, tool_call_id: null, error_text: null, result_mode: null, result_delay_seconds: null, observed_at_ms: null };
          if (found?.status === 'scheduled') evidence.dispatch_accepted_at_ms = evidence.dispatch.observed_at_ms;
          afterElection();
        });
      });
    }

    function afterElection() {
      if (evidence.dispatch?.accepted !== true) {
        refuse('continue_work was not accepted (no scheduled toolResult bound to this case)');
        return finalReads();
      }
      // The scheduled result comes before the capture (the turn schedules the election after its
      // attempt), so wait for the capture before narrowing: the control reads it from the store. The
      // probe comes only once the wake was due, after its refusal.
      later(numberEnv('OPENCLAW_RCD_RA_CAPTURE_WAIT_MS', 8000), () => transition((ok) => (ok ? later(delaySeconds * 1000 + parkMs, probeThenFinal) : finalReads())));
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
        // allowed-silent: the silent return parks un-adopted, and the probe turn adopts it: the primed
        // target acks it in the probe's own run.
        if (spec.probeAdopts) return waitForChild(() => later(parkMs, probeThenFinal));
        return waitForAck();
      }
      // Wake mode: change the target's authority while the delegate waits to fire (the control
      // samples the captured epoch first), then let the child return: the router refuses it.
      if (spec.timing === 'before-return') {
        return later(numberEnv('OPENCLAW_RCD_RA_SAMPLE_GAP_MS', 2000), () => transition((ok) => (ok ? waitForChild(() => later(parkMs, probeThenFinal)) : finalReads())));
      }
      // Parked: the drive ends once the child returned. The control then waits for the router's
      // Delivered to line for this target from this child, the witness of the parked copy, and only
      // then runs the transition phase (🌊's ruling, room msg 1567623059727458526). A child that never
      // returned hands nothing over: the case reads MISSING.
      waitForChild((bound) => {
        if (!bound) return finalReads();
        evidence.handoff = { ready_for_witness: true };
        finish();
      });
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
            // The delete's own response, before the create: the control's sweep window ends here.
            evidence.transition.delete_settled_at_ms = Date.now();
            if (!deleted.ok) return settle(false, deleted.error?.message);
            // A label is unique among the agent's sessions (session-create-service.ts:722 ->
            // sessions-patch-display-metadata.ts:52-53), and two cases of one run re-create: the
            // label names the case as well as the run.
            rpc('sessions.create', { key: keys.target, label: `k6 ${RRA_ROW} ${control.caseId} reassigned ${control.runId}` }, (created) => settle(created.ok, created.error?.message));
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
      // At least one pending sweep sees the stale row first: it defers to the queued copy, which the
      // probe turn's prompt drain then refuses, or, with no copy left (reassigned), refuses it. A
      // sweep inside reassigned's delete re-queues the copy, and the probe's drain refuses it then.
      later(sweepWaitMs, probeThenFinal);
    }

    function waitForAck() {
      pollHistory(keys.target, (messages) => {
        const seen = observeTargetTranscript(messages, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids });
        return seen.ackRuns > 0 ? seen : null;
      }, attempts(windowMs + delaySeconds * 1000), (hit) => {
        // Keep watching one more sweep period for a duplicate adoption; then, for allowed with no
        // ack yet, decide on the fallback.
        const next = hit || !spec.fallbackProbe ? finalReads : fallbackOrFinal;
        waitForChild(() => later(numberEnv('OPENCLAW_RCD_RA_DUPLICATE_WAIT_MS', 75000), next));
      });
    }

    // 🌊's ruling (room msg 1567623059727458526): "use the same conditional probe only when the woken
    // run has no ACK". The target is read once more: a woken run and no ack sends the probe, and the
    // case's ack is then read in the probe's own run, labelled probe-mediated. An ack, or no woken run
    // at all (routed and never woken stays the product's, FAIL), sends nothing.
    function fallbackOrFinal() {
      history(keys.target, (messages) => {
        const seen = messages ? observeTargetTranscript(messages, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids }) : null;
        if (seen) evidence.fallback = { decided_at_ms: Date.now(), woken_runs: seen.foreignRuns, ack_runs: seen.ackRuns };
        if (!seen || seen.ackRuns > 0 || seen.foreignRuns === 0) return finalReads();
        evidence.ack_path = 'probe-mediated';
        probeThenFinal();
      });
    }

    function probeThenFinal() {
      // 🌊's conditional probe (room msg 1567590902694936678), the same text for every case: a turn
      // that drained the return follows its priming and acks; any other answers PROBE-OK <probeNonce>.
      // It never names the ack or the row nonce, so an ack in its run is the primed target answering
      // a return its turn drained, never an echo of this text. A text that fails the text test is
      // never sent.
      const instruction = rraProbeText(probeNonce);
      const problems = rraProbeTextProblems(instruction, { rowNonce, probeNonce });
      if (problems.length) {
        refuse(`probe text refused: ${problems.join(', ')}`);
        return finalReads();
      }
      // The receipt names the probe it sent by its text's hash, its nonce written as the slot
      // (RRA_PROBE_TEXT_SHA256): a receipt with any other probe, or none, is never PASS.
      evidence.probe_text_sha256 = crypto.sha256(instruction.replaceAll(probeNonce, RRA_PROBE_NONCE_SLOT), 'hex');
      // A prompt-drain refusal must come from this turn's drain, and allowed-silent's ack must follow
      // the return's Delivered to line, so both are timed against the send.
      evidence.probe_sent_at_ms = Date.now();
      send(keys.target, instruction, `${RRA_ROW}-PROBE-${probeNonce}`, (r) => {
        evidence.probe_run_id = r.payload?.runId || null;
        evidence.probe_ran = Boolean(r.ok && evidence.probe_run_id);
        if (!evidence.probe_ran) return finalReads();
        // Once the probe run has answered, let it finish: an ack (or a second one) may follow its
        // first row, and the final read counts every row of the run.
        pollHistory(keys.target, (messages) => messages.some((m) => messageRunId(m) === evidence.probe_run_id &&
          String(m.role).toLowerCase() === 'assistant'), attempts(windowMs), () => later(numberEnv('OPENCLAW_RCD_RA_PROBE_SETTLE_MS', 10000), finalReads));
      });
    }

    function finalWorkReads() {
      history(keys.target, (messages) => {
        evidence.target_obs = messages
          ? observeTargetTranscript(messages, { nonce: rowNonce, primingRunIds: evidence.priming_run_ids, probeRunId: evidence.probe_run_id, probeNonce })
          : null;
        // Every continue_work call beyond the case's own election, and any continue_delegate, that the
        // electing or the probe run made. A call in any other run belongs to a wake turn, which is
        // itself the contradiction; counting it would turn that FAIL into a deviation.
        const inRuns = [...evidence.priming_run_ids, ...(evidence.probe_run_id ? [evidence.probe_run_id] : [])];
        const workCalls = messages ? countWorkCalls(messages, { inRuns }) : null;
        evidence.other_work_calls = workCalls === null ? null : workCalls - (evidence.dispatch?.tool_call_id ? 1 : 0);
        evidence.other_delegate_calls = messages ? countDelegateCalls(messages, { inRuns }) : null;
        finish();
      });
    }

    function finalReads() {
      if (spec.tool === 'continue_work') return finalWorkReads();
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
        // The control witnessed the parked copy and released the transition.
        if (control.phase === 'transition') return later(250, () => transition(afterTransition));
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
