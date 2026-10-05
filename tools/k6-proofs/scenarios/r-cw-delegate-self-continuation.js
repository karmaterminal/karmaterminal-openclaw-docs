/**
 * Scenario: R-CW-DELEGATE-SELF-CONTINUATION — delegate child fires its own continue_work.
 *
 * Proves continue_work works INSIDE a delegate context (not just a main session).
 * The harness instructs the parent agent to call continue_delegate; the child is
 * instructed to fire its own continue_work after arriving, then report DONE on
 * hop-2 wake.
 *
 * Verifies:
 *   1. Parent dispatch accepted (continue_delegate fires via sessions.send agent turn)
 *   2. The delegate child is bound through the child observer (own row
 *      spawnedBy = parent, own spawn task carries the nonce; fail closed)
 *   3. From the CHILD's own chat.history, in order: the nonce-bound
 *      continue_work call, its "scheduled" result and CHILD-CW-SCHEDULED in
 *      that turn; then a "[continuation:wake]" turn carrying the nonce and
 *      CHILD-HOP2-DONE in it. The child writes these in its own turns, so the
 *      parent subscription cannot see them.
 *   4. The child's return reached the parent: the child mints a token in its
 *      turn-1 reply (CHILD-CW-SCHEDULED <nonce> TOKEN <12 chars>, absent from
 *      every harness-sent text); the parent must reproduce it as
 *      PARENT-RETURN <nonce> TOKEN <token> in its own transcript, outside and
 *      after the dispatch run (#570 review). The old event-string heuristic is
 *      kept only as parent_return_heuristic (diagnostic).
 *   Three receipts stay separate: hop 2 ran (3), the child's return reached the
 *   parent (4), and hop-2 OUTPUT reached the parent, which this row does not
 *   claim: only the turn-1 return is delivered, before hop 2.
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session — proof does not touch the live #sprites/main
 * Discord lane for repeatability runs.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#118
 *   - Manifest: tools/k6-proofs/manifests/r-cw-delegate-self.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { createChildObserver, createPreflightGate, failClosedVerdict, reconcileChildIdentity } from '../lib/child-observer.mjs';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';
import { childSessionKeysForRow } from '../lib/row-child-correlation.mjs';
import { childMintedToken, cwDelegateSelfHops, parentReturnReceipt } from '../lib/cw-delegate-self-receipt.mjs';

export const options = {
  scenarios: {
    r_cw_delegate_self: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '150s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_delegate_self_duration: ['p(95)<120000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_delegate_self_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  mode: 'normal',
  delaySeconds: 1,
  cwDelaySeconds: 2,
  promptTemplate: 'k6 proof R-CW-DELEGATE-SELF nonce {{nonce}}: after arriving, call continue_work(reason="k6-self-continuation-{{nonce}}", delaySeconds=2). After the continue_work tool result reports scheduled, invent a fresh random token of exactly 12 lowercase letters and digits (make it up now; do not copy it from anywhere) and reply exactly CHILD-CW-SCHEDULED {{nonce}} TOKEN <your token>. On hop-2 wake, reply exactly CHILD-HOP2-DONE {{nonce}}. Do not mutate files. Do not post to any channel.',
  idempotencyKeyPrefix: 'R-CW-DELEGATE-SELF',
};
const HARNESS_MARKER = '[k6-proof-harness]';
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_DELEGATE_EVIDENCE_DELAY_MS || 1500);
// Child transcript re-reads until both hops bind; bounded and recorded.
const CHILD_HOP_HISTORY_MAX_READS = 40;
const CHILD_HOP_HISTORY_INTERVAL_MS = 3000;
const PARENT_RETURN_HISTORY_MAX_READS = 40;

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || __ENV.OPENCLAW_DELEGATE_MODE || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || DEFAULTS.promptTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-DS');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'R-CW-DELEGATE-SELF-CONTINUATION',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Required receipts
    delegate_accepted: false,
    child_spawned: false,
    child_continue_work_accepted: false,
    child_hop_2_woke: false,
    parent_return: false,
    child_session_key: null,
    child_status: null,
    event_child_candidates: [],
    child_identity_conflict: false,
    child_identity_reason: null,
    child_hop_history_reads: 0,
    child_hops: null,
    child_token_minted: false,
    child_token_hash: null,
    child_token_reason: null,
    dispatch_run_id: null,
    parent_return_history_reads: 0,
    parent_return_receipt: null,
    // Diagnostic only (old loose binding: any return/completion/nonce event,
    // which the parent's own continue_delegate toolCall satisfies).
    parent_return_heuristic: false,
    // Not claimed: no delivery receipt exists for hop-2 output (only the
    // turn-1 return is delivered, before hop 2).
    hop2_output_reached_parent: null,
    hop2_output_reached_parent_reason: 'not claimed by this row: the child delivers one return (its spawned run), before hop 2; no hop-2 delivery exists to bind',
    // Diagnostic only: the parent stream is not where the child writes its hops.
    parent_stream_cw_scheduled_seen: false,
    parent_stream_hop2_seen: false,
    observation_refused: null,
    dispatch_accepted_at_ms: null,
    trace_id: null,
    preflight: null,
    verdict_reason: null,
    redacted_events: [],
  };

  const started = Date.now();
  const gate = createPreflightGate('R-CW-DELEGATE-SELF-CONTINUATION');
  const observer = createChildObserver({ rootSessionKey: () => sessionKey });

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let hopReadInFlight = false;
    let hopReadScheduled = false;
    const harnessTexts = [];
    let childToken = null;
    let childTokenTimestamp = null;
    let parentHistoryRequestId = null;
    let parentHistoryScheduled = false;

    function requestParentReturn(delayMs) {
      if (!childToken || evidence.parent_return || parentHistoryRequestId || parentHistoryScheduled) return;
      if (evidence.parent_return_history_reads >= PARENT_RETURN_HISTORY_MAX_READS) return;
      parentHistoryScheduled = true;
      socket.setTimeout(() => {
        parentHistoryScheduled = false;
        evidence.parent_return_history_reads += 1;
        parentHistoryRequestId = tracker.send(socket, 'chat.history', { sessionKey, limit: 200 });
      }, k6TimeoutMs(delayMs));
    }

    function onParentHistory(classified) {
      parentHistoryRequestId = null;
      if (!classified.ok) { requestParentReturn(CHILD_HOP_HISTORY_INTERVAL_MS); return; }
      const messages = Array.isArray(classified.payload?.messages) ? classified.payload.messages : [];
      const receipt = parentReturnReceipt(messages, {
        rowNonce, token: childToken, dispatchRunId: evidence.dispatch_run_id, tokenTimestamp: childTokenTimestamp,
      });
      evidence.parent_return_receipt = { bound: receipt.bound, source: receipt.source, index: receipt.index, reason: receipt.reason };
      if (receipt.bound) {
        evidence.parent_return = true;
        console.log(`✓ parent reproduced the child-minted token (${receipt.source})`);
      } else {
        requestParentReturn(CHILD_HOP_HISTORY_INTERVAL_MS);
      }
    }

    // Only the observer binding binds; parent-event candidates cross-check it.
    function resolveChild() {
      const identity = reconcileChildIdentity({
        observerBinding: observer.boundChild(rowNonce),
        eventCandidates: evidence.event_child_candidates,
      });
      evidence.child_identity_reason = identity.reason;
      if (identity.conflict) { evidence.child_identity_conflict = true; return; }
      const key = identity.childSessionKey;
      if (!key || evidence.child_identity_conflict) return;
      if (evidence.child_session_key && evidence.child_session_key !== key) { evidence.child_identity_conflict = true; return; }
      evidence.child_status = observer.childStatus(key);
      if (evidence.child_session_key) return;
      evidence.child_session_key = key;
      evidence.child_spawned = true;
      console.log('✓ delegate child bound (own spawnedBy + own spawn task nonce)');
      requestChildHops(0);
    }

    function requestChildHops(delayMs) {
      if (!evidence.child_session_key || hopReadInFlight || hopReadScheduled) return;
      if (evidence.child_hop_2_woke || evidence.child_hop_history_reads >= CHILD_HOP_HISTORY_MAX_READS) return;
      hopReadScheduled = true;
      socket.setTimeout(() => {
        hopReadScheduled = false;
        if (observer.refreshHistory(evidence.child_session_key, 200, 'cw-hops')) {
          hopReadInFlight = true;
          evidence.child_hop_history_reads += 1;
        }
      }, k6TimeoutMs(delayMs));
    }

    function onChildHops(messages) {
      hopReadInFlight = false;
      const hops = cwDelegateSelfHops(messages, { rowNonce });
      if (!childToken) {
        const minted = childMintedToken(messages, { rowNonce, harnessTexts });
        evidence.child_token_reason = minted.reason;
        if (minted.token) {
          childToken = minted.token;
          childTokenTimestamp = minted.timestamp;
          evidence.child_token_minted = true;
          evidence.child_token_hash = crypto.sha256(minted.token, 'hex').slice(0, 16);
          requestParentReturn(0);
        }
      }
      evidence.child_hops = {
        yield_index: hops.yieldIndex,
        scheduled_result_index: hops.scheduledResultIndex,
        scheduled_sentinel_index: hops.scheduledSentinelIndex,
        wake_index: hops.wakeIndex,
        hop2_index: hops.hop2Index,
        reason: hops.reason,
      };
      if (hops.childContinueWorkAccepted && !evidence.child_continue_work_accepted) {
        evidence.child_continue_work_accepted = true;
        console.log('✓ child turn 1: continue_work scheduled + CHILD-CW-SCHEDULED (child transcript)');
      }
      if (hops.childHop2Woke && !evidence.child_hop_2_woke) {
        evidence.child_hop_2_woke = true;
        console.log('✓ child wake turn: CHILD-HOP2-DONE after [continuation:wake] (child transcript)');
      }
      if (!evidence.child_hop_2_woke) requestChildHops(CHILD_HOP_HISTORY_INTERVAL_MS);
    }

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Bind the delegate child through the observer (sessions.list spawnedBy +
      // the child's own spawn task), then read its hops from its own transcript.
      for (const delayMs of [5000, 15000, 30000, 60000, 90000]) {
        socket.setTimeout(() => observer.poll(), k6TimeoutMs(delayMs));
      }

      // Dispatch via sessions.send — triggers agent turn that calls continue_delegate.
      // The delegate's task instructs the child to fire its own continue_work.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const task = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        const agentInstruction =
          `[k6-proof-harness] Call continue_delegate with: ` +
          `mode="${inv.mode}", delaySeconds=${inv.delaySeconds}, ` +
          `task="${task}", ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${rowNonce}". ` +
          `Execute the tool call immediately. This is a proof run. ` +
          `Later, when the delegate's return arrives, reply exactly PARENT-RETURN ${rowNonce} TOKEN <the TOKEN value from that return>.`;
        harnessTexts.push(agentInstruction, task);
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // #562: the old task-ledger poll only copied a traceId into evidence (no
      // verdict input). Session rows carry no traceId, so nothing replaces it;
      // trace_id still comes from the sessions.send answer.

      socket.setTimeout(() => socket.close(), 120000);
    }

    function afterHello(socket) {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cw-ds-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CW-DELEGATE-SELF ${rowNonce}`,
          });
        }, 250);
      } else {
        socket.setTimeout(() => startProofFlow(socket), 500);
      }
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      observer.attach(
        (method, params) => tracker.send(socket, method, params),
        (delayMs, fn) => socket.setTimeout(fn, k6TimeoutMs(delayMs)),
      );
      socket.setTimeout(() => { if (gate.timeout(10000)) socket.close(); }, 10000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const preflight = gate.observe(msg);
        if (preflight === 'refused') {
          console.error(`✗ R-CW-DELEGATE-SELF-CONTINUATION preflight refused before dispatch: ${gate.result.reason}`);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello(socket);
        const observed = observer.claim(msg);
        const isParentHistory = Boolean(parentHistoryRequestId && msg && msg.type === 'res' && msg.id === parentHistoryRequestId);
        const classified = tracker.classify(msg);
        if (isParentHistory) onParentHistory(classified);
        if (observed) {
          const history = observer.handle(observed, classified);
          if (observed.purpose === 'cw-hops') {
            if (history) onChildHops(history);
            else { hopReadInFlight = false; if (!observer.state.refusal) requestChildHops(CHILD_HOP_HISTORY_INTERVAL_MS); }
          }
          resolveChild();
        }

        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        // Disposable session creation
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            startProofFlow(socket);
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        // Parent dispatch accepted (sessions.send → agent turn triggered)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.delegate_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            // The dispatch run cannot carry the parent-return receipt.
            evidence.dispatch_run_id = typeof classified.payload?.runId === 'string' ? classified.payload.runId : null;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered (will call continue_delegate)');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Session/agent events — primary proof surface.
        if (classified.kind === 'event') {
          const eventStr = JSON.stringify(classified.data || {});
          const eventName = classified.event || '';
          // Event-borne child keys only cross-check the observer binding.
          for (const key of childSessionKeysForRow(classified.data || {}, rowNonce)) {
            if (key !== sessionKey && !evidence.event_child_candidates.includes(key)) {
              evidence.event_child_candidates.push(key);
              resolveChild();
            }
          }

          if (eventStr.includes(rowNonce)) {
            if (eventStr.includes(HARNESS_MARKER)) {
              console.log('ℹ Ignoring harness prompt echo event');
            } else if (evidence.delegate_accepted && evidence.dispatch_accepted_at_ms &&
              (Date.now() - evidence.dispatch_accepted_at_ms) >= POST_DISPATCH_EVIDENCE_GATE_MS) {
              // The child writes its hop sentinels in its own turns; seeing them
              // on the parent stream is diagnostic only, never the receipt.
              if (eventStr.includes(`CHILD-CW-SCHEDULED ${rowNonce}`)) evidence.parent_stream_cw_scheduled_seen = true;
              if (eventStr.includes(`CHILD-HOP2-DONE ${rowNonce}`)) evidence.parent_stream_hop2_seen = true;

              // Old loose binding, diagnostic only: the parent's own
              // continue_delegate toolCall (nonce + task text) satisfies it.
              if (eventName === 'delegate.return' ||
                eventStr.includes('return') ||
                eventStr.includes('completion') ||
                (eventName === 'session.message' && eventStr.includes(rowNonce))) {
                evidence.parent_return_heuristic = true;
              }
            }
          }
        }

        // Early close when primary evidence collected
        if (evidence.delegate_accepted &&
            evidence.child_continue_work_accepted &&
            evidence.child_hop_2_woke &&
            evidence.parent_return) {
          console.log('Primary R-CW-DELEGATE-SELF evidence gathered, closing early');
          socket.close();
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'delegate dispatch accepted (sessions.send)': () => evidence.delegate_accepted,
    'child continue_work scheduled post-dispatch': () => evidence.child_continue_work_accepted,
    'child hop-2 woke (required)': () => evidence.child_hop_2_woke,
    'parent return bound (child-minted token reproduced by the parent)': () => evidence.parent_return,
    'delegate child bound via the observer': () => evidence.child_spawned,
    'no child identity conflict': () => !evidence.child_identity_conflict,
  });

  if (!evidence.delegate_accepted ||
      !evidence.child_continue_work_accepted ||
      !evidence.child_hop_2_woke ||
      !evidence.parent_return) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.delegate_accepted &&
    evidence.child_spawned &&
    !evidence.child_identity_conflict &&
    evidence.child_continue_work_accepted &&
    evidence.child_hop_2_woke &&
    evidence.parent_return;
  const finalVerdict = failClosedVerdict(passed ? 'PASS-candidate' : 'PARTIAL-candidate', { gate, observer });
  if (evidence.child_identity_conflict && !finalVerdict.reason) {
    finalVerdict.verdict = 'PARTIAL-candidate';
    finalVerdict.reason = `child identity conflict: ${evidence.child_identity_reason || 'observer and event path disagree'}`;
  }
  evidence.verdict_reason = finalVerdict.reason;
  if (finalVerdict.reason) failures.add(1);

  console.log(`\n--- R-CW-DELEGATE-SELF-CONTINUATION EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CW-DELEGATE-SELF-CONTINUATION] VERDICT: ${finalVerdict.verdict}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CW-DELEGATE-SELF-CONTINUATION',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cw_delegate_self_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CW-DELEGATE-SELF-CONTINUATION] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cw-delegate-self-continuation-summary.json': JSON.stringify(summary, null, 2),
  };
}
