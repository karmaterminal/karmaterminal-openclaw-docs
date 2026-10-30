/**
 * Scenario: R-RC-1 — request_compaction below-threshold reject.
 *
 * Creates a disposable low-context session, verifies request_compaction is in
 * that session's effective tool inventory, then captures the authoritative
 * role=toolResult receipt for the invocation. Assistant sentinel prose is
 * retained as diagnostic evidence only and can never satisfy the row.
 *
 * PASS (manifests/r-rc-1.json telemetryContract.verdictAuthority.pass) needs
 * the receipt to meet the rule in lib/request-compaction-receipt.js
 * (context_threshold measured below the floor, or context_unmeasured with a
 * live cause; never inventory-only) and no compaction side effect.
 *
 * The side effect is observed, never assumed, and the claim is bounded. At
 * openclaw 542d1cac46 the one operator-visible mark of a compaction is the
 * transcript compaction row sessions.get returns, written when the compaction
 * commits (no counter is readable, and the queued request_compaction path
 * emits no compaction event). So: the transcript is read before dispatch, the
 * turn has to end (lifecycle end for this session's acknowledged send run, or
 * a reply row after the toolResult), and SIDE_EFFECT_WINDOW_MS later it is read
 * again; that read must still hold the toolResult, so it covers everything
 * after it. A compaction
 * row new since the baseline, or a compaction signal on the subscribed stream
 * at any point after dispatch, makes no_compaction_side_effect false. A window
 * that does not complete leaves it null (unproven), which is not PASS.
 * classifyRrc1Evidence is the one verdict.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  classifyLiveContextGuardRejection,
  classifyRequestCompactionReceipt,
  classifyRrc1Evidence,
  compactionStreamSignal,
  eventNamesSession,
  findRequestCompactionReceipt,
  hasEffectiveTool,
  newCompactionMarkerCount,
  requestCompactionResultIndex,
  RRC1_MIN_SIDE_EFFECT_WINDOW_MS,
  rrc1RejectionFacts,
} from '../lib/request-compaction-receipt.js';

// How long after the turn ends the row keeps watching for a compaction. The
// compaction row lands only when a compaction commits, after its summary call
// (embedded compaction safety timeout 180s at openclaw 542d1cac46). The
// default suits a one-turn disposable session; OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS
// may lengthen it (up to 300s), never shorten it. The evidence records the
// window used.
const DEFAULT_SIDE_EFFECT_WINDOW_MS = RRC1_MIN_SIDE_EFFECT_WINDOW_MS;
const MAX_SIDE_EFFECT_WINDOW_MS = 300000;
const requestedWindowMs = Number(__ENV.OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS);
const SIDE_EFFECT_WINDOW_MS = Number.isFinite(requestedWindowMs) && requestedWindowMs > DEFAULT_SIDE_EFFECT_WINDOW_MS
  ? Math.min(Math.floor(requestedWindowMs), MAX_SIDE_EFFECT_WINDOW_MS)
  : DEFAULT_SIDE_EFFECT_WINDOW_MS;
// Setup and the turn get TURN_BUDGET_MS; the window and its final read follow.
const TURN_BUDGET_MS = 60000;
const SOCKET_TIMEOUT_MS = TURN_BUDGET_MS + SIDE_EFFECT_WINDOW_MS + 5000;
const TURN_END_POLL_MS = 1000;

export const options = {
  scenarios: {
    r_rc_1_threshold_reject: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: `${Math.ceil((SOCKET_TIMEOUT_MS + 15000) / 1000)}s`,
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_rc_1_duration: [`p(95)<${SOCKET_TIMEOUT_MS + 10000}`],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_rc_1_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
// The structured context-guard rejections: measured usage below the floor, or
// usage not measured yet (openclaw-bootstrap#1727).
const CONTEXT_GUARDS = Object.freeze(['context_threshold', 'context_unmeasured']);

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS') || true;
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-RC-1');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }
  if (Number.isFinite(requestedWindowMs) && requestedWindowMs < DEFAULT_SIDE_EFFECT_WINDOW_MS) {
    console.warn(`OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS=${requestedWindowMs} is shorter than ${DEFAULT_SIDE_EFFECT_WINDOW_MS}ms; using ${SIDE_EFFECT_WINDOW_MS}ms`);
  }

  const evidence = {
    row: 'R-RC-1',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    tool_inventory_checked: false,
    tool_registered: false,
    dispatch_accepted: false,
    dispatch_accepted_at_ms: null,
    tool_name: 'request_compaction',
    tool_invocation_observed: false,
    tool_result_observed: false,
    tool_call_id: null,
    tool_call_nonce_bound: false,
    tool_result_status: null,
    tool_invoke_rejected: false,
    guard: null,
    cause: null,
    context_usage: null,
    threshold: null,
    usage_fields_present: null,
    inventory_only_wording: null,
    rejection_meets_contract: false,
    rejection_shape: null,
    rejection_reason: null,
    // true: watched and none seen; false: a compaction followed; null: unproven.
    no_compaction_side_effect: null,
    side_effect: {
      window_ms: SIDE_EFFECT_WINDOW_MS,
      baseline_read: false,
      baseline_compaction_markers: null,
      turn_end_observed: false,
      turn_end_source: null,
      window_elapsed: false,
      final_read: false,
      cue_reads: 0,
      new_compaction_markers: 0,
      stream_compaction_signals: 0,
      stream_compaction_sources: [],
      unproven_reason: null,
    },
    send_run_id: null,
    assistant_sentinel_observed: false,
    history_requested: false,
    history_attempts: 0,
    trace_id: null,
    verdict: null,
    verdict_reason: null,
    redacted_events: [],
  };
  const sideEffect = evidence.side_effect;
  let baselineMessages = [];
  // Why the final read did not count, for unproven_reason.
  let finalReadProblem = null;

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    // sessions.get request id -> 'baseline' | 'receipt' | 'turn-end' | 'cue' | 'final'
    const readPurposes = {};
    let dispatched = false;
    let receiptRecorded = false;
    let watchingSideEffect = false;
    let windowArmed = false;
    let cueReadPending = false;
    // Lifecycle ends for this session that arrived before the send ack named its run.
    const heldLifecycleEndRunIds = new Set();
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      socket.close();
    }

    function readTranscript(purpose) {
      if (finished) return;
      if (purpose === 'receipt') {
        evidence.history_requested = true;
        evidence.history_attempts += 1;
      }
      const id = tracker.send(socket, 'sessions.get', { key: sessionKey, limit: 20 });
      readPurposes[id] = purpose;
    }

    function startProofFlow() {
      tracker.send(socket, 'tools.effective', { sessionKey });
      socket.setTimeout(finish, k6TimeoutMs(SOCKET_TIMEOUT_MS));
    }

    function dispatchRequestCompaction() {
      const reason = `R-RC-1 k6 proof nonce ${rowNonce}: expected below-threshold structured rejection; do not compact.`;
      const instruction =
        `${HARNESS_MARKER} Call request_compaction with reason=${JSON.stringify(reason)}. ` +
        `After the tool returns, reply exactly RC1-RESULT-OBSERVED ${rowNonce}. ` +
        `Do not infer or restate the receipt, and take no other action.`;
      dispatched = true;
      tracker.send(socket, 'sessions.send', {
        key: sessionKey,
        message: instruction,
        idempotencyKey: `R-RC-1-${rowNonce}`,
      });
    }

    function recordSideEffect(where) {
      evidence.no_compaction_side_effect = false;
      console.error(`✗ compaction side effect observed after dispatch (${where})`);
      // Once the receipt is recorded nothing else can change the verdict.
      if (receiptRecorded) finish();
    }

    function recordStreamCompaction(source) {
      sideEffect.stream_compaction_signals += 1;
      if (!sideEffect.stream_compaction_sources.includes(source)) sideEffect.stream_compaction_sources.push(source);
      recordSideEffect(source);
    }

    function checkTranscriptForCompaction(messages) {
      const fresh = newCompactionMarkerCount(baselineMessages, messages);
      if (fresh > sideEffect.new_compaction_markers) sideEffect.new_compaction_markers = fresh;
      if (fresh > 0) recordSideEffect(`${fresh} transcript compaction row(s) new since the baseline`);
    }

    // The turn has replied once an assistant row with no further tool call
    // follows the nonce-bound toolResult.
    function transcriptShowsReplyAfterReceipt(messages) {
      const resultIndex = requestCompactionResultIndex(messages, evidence.tool_call_id);
      if (resultIndex < 0) return false;
      return messages.slice(resultIndex + 1).some((message) =>
        String(message?.role || '').toLowerCase() === 'assistant' &&
        !(Array.isArray(message.content) && message.content.some((part) => part?.type === 'toolCall')));
    }

    function markTurnEnded(source) {
      if (!sideEffect.turn_end_observed) {
        sideEffect.turn_end_observed = true;
        sideEffect.turn_end_source = source;
        console.log(`✓ turn end observed (${source})`);
      }
      armSideEffectWindow();
    }

    function armSideEffectWindow() {
      if (!watchingSideEffect || windowArmed || !sideEffect.turn_end_observed || finished) return;
      windowArmed = true;
      socket.setTimeout(() => {
        if (finished) return;
        sideEffect.window_elapsed = true;
        readTranscript('final');
      }, k6TimeoutMs(SIDE_EFFECT_WINDOW_MS));
    }

    function recordReceiptFacts(receiptResult) {
      const receipt = receiptResult.receipt || {};
      const facts = rrc1RejectionFacts(receipt);
      evidence.tool_result_observed = true;
      evidence.tool_call_id = receiptResult.toolCallId || null;
      evidence.tool_call_nonce_bound = receiptResult.nonceBound === true;
      evidence.tool_invocation_observed = evidence.tool_call_nonce_bound;
      evidence.tool_result_status = facts.status || 'invalid';
      evidence.guard = facts.guard;
      evidence.cause = facts.cause;
      evidence.context_usage = facts.contextUsage;
      evidence.threshold = facts.threshold;
      evidence.usage_fields_present = facts.usageFieldsPresent;
      evidence.inventory_only_wording = facts.inventoryOnlyWording;
      const rule = classifyLiveContextGuardRejection(receiptResult);
      evidence.rejection_meets_contract = rule.pass;
      evidence.rejection_shape = rule.shape;
      evidence.rejection_reason = rule.reason;
      receiptRecorded = true;
    }

    function recordAuthoritativeReceipt(receiptResult, messages) {
      // A disposable session's first turn has no measured usage, so builds with
      // openclaw-bootstrap#1727 answer context_unmeasured where older builds
      // answered context_threshold without numbers. Both are rejections, and
      // the evidence names what came back; only the rule in
      // classifyLiveContextGuardRejection can make one a PASS receipt.
      if (receiptResult.kind === 'threshold_rejected' || receiptResult.kind === 'unmeasured_rejected') {
        recordReceiptFacts(receiptResult);
        const receipt = receiptResult.receipt;
        evidence.tool_invoke_rejected = true;
        console.log(`✓ authoritative toolResult: status=${receipt.status} guard=${receipt.guard} cause=${receipt.cause ?? 'none'} context=${receipt.contextUsage ?? 'unknown'} threshold=${receipt.threshold ?? 'unknown'}`);
        if (!evidence.rejection_meets_contract) {
          console.error(`✗ the rejection does not meet the R-RC-1 PASS rule: ${evidence.rejection_reason}`);
          finish();
          return true;
        }
        if (evidence.no_compaction_side_effect === false) {
          finish();
          return true;
        }
        watchingSideEffect = true;
        if (transcriptShowsReplyAfterReceipt(messages)) markTurnEnded('transcript-reply');
        else if (sideEffect.turn_end_observed) armSideEffectWindow();
        else socket.setTimeout(() => readTranscript('turn-end'), k6TimeoutMs(TURN_END_POLL_MS));
        return true;
      }
      if (['invalid', 'non_threshold_result'].includes(receiptResult.kind)) {
        recordReceiptFacts(receiptResult);
        console.error(`✗ authoritative request_compaction tool result did not prove a context-guard rejection: ${JSON.stringify(receiptResult)}`);
        finish();
        return true;
      }
      return false;
    }

    // answered: the response is not a refusal. RequestTracker reads ok as !error,
    // so a bare { ok: false } is a refusal here too.
    function handleTranscriptRead(purpose, classified, answered) {
      const messages = answered && Array.isArray(classified.payload?.messages) ? classified.payload.messages : null;
      if (purpose === 'baseline') {
        if (messages) {
          baselineMessages = messages;
          sideEffect.baseline_read = true;
          sideEffect.baseline_compaction_markers = newCompactionMarkerCount([], baselineMessages);
        } else {
          console.error(`✗ baseline sessions.get gave no transcript: ${JSON.stringify(classified.error || classified.payload)}`);
        }
        dispatchRequestCompaction();
        return;
      }
      if (purpose === 'cue') cueReadPending = false;
      if (!answered) {
        console.error(`✗ sessions.get (${purpose}) rejected: ${JSON.stringify(classified.error)}`);
        if (purpose === 'final') finalReadProblem = 'was refused';
        // A rejected cue read loses nothing: the final read still decides.
        if (purpose !== 'cue') finish();
        return;
      }
      checkTranscriptForCompaction(messages);
      if (purpose === 'final') {
        // Only a read that still holds the toolResult covers what came after it.
        sideEffect.final_read = requestCompactionResultIndex(messages, evidence.tool_call_id) >= 0;
        if (!sideEffect.final_read) finalReadProblem = 'did not reach back to the toolResult';
      }
      if (finished || purpose === 'cue') return;
      if (purpose === 'receipt') {
        const receiptResult = findRequestCompactionReceipt(messages, { rowNonce });
        if (!recordAuthoritativeReceipt(receiptResult, messages)) {
          if (evidence.history_attempts < 8) {
            socket.setTimeout(() => readTranscript('receipt'), 250);
          } else {
            console.error('✗ sessions.get contained no authoritative request_compaction tool result after bounded retries');
            finish();
          }
        }
        return;
      }
      if (purpose === 'turn-end') {
        if (transcriptShowsReplyAfterReceipt(messages)) markTurnEnded('transcript-reply');
        else if (!sideEffect.turn_end_observed) socket.setTimeout(() => readTranscript('turn-end'), k6TimeoutMs(TURN_END_POLL_MS));
        return;
      }
      if (purpose === 'final') {
        // Without the baseline there is nothing to compare the final read with.
        if (evidence.no_compaction_side_effect !== false && sideEffect.baseline_read && sideEffect.final_read) {
          evidence.no_compaction_side_effect = true;
          console.log(`✓ no compaction side effect: none on the stream or in the transcript ${SIDE_EFFECT_WINDOW_MS}ms after the turn ended`);
        }
        finish();
      }
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-rc-1-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', { key: disposableKey, label: `k6 R-RC-1 ${rowNonce}` });
        }, 250);
      } else {
        socket.setTimeout(startProofFlow, 500);
      }
    });

    socket.on('message', (raw) => {
      if (finished) return;
      try {
        const msg = JSON.parse(raw);
        const readPurpose = msg?.type === 'res' && msg.id ? readPurposes[msg.id] : undefined;
        const answered = msg?.type === 'res' && msg.ok !== false && !msg.error;
        if (readPurpose) delete readPurposes[msg.id];
        const classified = tracker.classify(msg);
        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: redactEvent(classified.data || classified.payload || null),
        });

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            startProofFlow();
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            finish();
          }
        }

        if (classified.kind === 'response' && classified.method === 'tools.effective') {
          evidence.tool_inventory_checked = true;
          evidence.tool_registered = classified.ok && hasEffectiveTool(classified.payload, 'request_compaction');
          if (!evidence.tool_registered) {
            console.error(`✗ request_compaction absent from effective inventory: ${JSON.stringify(classified.error || classified.payload)}`);
            finish();
          } else {
            console.log('✓ request_compaction present in effective inventory');
            tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.messages.subscribe') {
          if (classified.ok) {
            // The side-effect baseline: compaction rows already in the transcript.
            readTranscript('baseline');
          } else {
            console.error(`✗ sessions.messages.subscribe rejected: ${JSON.stringify(classified.error)}`);
            finish();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            if (typeof classified.payload?.runId === 'string' && classified.payload.runId) {
              evidence.send_run_id = classified.payload.runId;
              if (heldLifecycleEndRunIds.has(evidence.send_run_id)) markTurnEnded('lifecycle-end');
            }
            heldLifecycleEndRunIds.clear();
            console.log('✓ sessions.send accepted — awaiting authoritative request_compaction tool result');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            finish();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.get' && readPurpose) {
          handleTranscriptRead(readPurpose, classified, answered);
        }

        if (classified.kind === 'event' && dispatched) {
          const data = classified.data || {};
          const signal = compactionStreamSignal(data, sessionKey);
          if (signal) recordStreamCompaction(signal.source);

          // Only this session's acknowledged send run ends the turn: a lifecycle
          // end that names no session, no run or another run would open the
          // window early. One that arrives before the ack waits for the ack to
          // name its run; with no run id in the ack the reply row decides.
          const runId = typeof data.runId === 'string' && data.runId ? data.runId : null;
          if (data.stream === 'lifecycle' && data.data?.phase === 'end' && eventNamesSession(data, sessionKey) && runId) {
            if (evidence.send_run_id && runId === evidence.send_run_id) {
              markTurnEnded('lifecycle-end');
              if (!evidence.history_requested) readTranscript('receipt');
            } else if (!evidence.dispatch_accepted) {
              heldLifecycleEndRunIds.add(runId);
            }
          }

          // A transcript update without a message (sessions.changed, phase
          // "message") is how the gateway announces a committed compaction row
          // to subscribers; read the transcript again rather than wait.
          if (classified.event === 'sessions.changed' && data.phase === 'message' && data.messageId === undefined &&
              watchingSideEffect && !cueReadPending && !finished && eventNamesSession(data, sessionKey)) {
            cueReadPending = true;
            sideEffect.cue_reads += 1;
            readTranscript('cue');
          }

          const receiptResult = classifyRequestCompactionReceipt(data);
          // Subscription events can be delayed or replayed. Never accept an
          // unbound tool result directly; use it only as a signal to fetch the
          // transcript, where the nonce-bearing tool call and toolCallId can be
          // correlated in the same disposable session.
          if (receiptResult.kind !== 'unrelated' && !evidence.history_requested) {
            readTranscript('receipt');
          }

          const eventMessage = data.message;
          const eventStr = JSON.stringify(eventMessage?.content || '');
          if (eventMessage?.role === 'assistant' && eventStr.includes(`RC1-RESULT-OBSERVED ${rowNonce}`)) {
            evidence.assistant_sentinel_observed = true;
            console.log('ℹ assistant sentinel observed (diagnostic only; not accepted as row evidence)');
            if (!evidence.history_requested && !evidence.tool_result_observed) {
              readTranscript('receipt');
            }
          }
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
  duration.add(evidence.duration_ms);

  if (evidence.no_compaction_side_effect === null) {
    sideEffect.unproven_reason = !evidence.rejection_meets_contract
      ? 'not watched: no rejection that meets the PASS rule'
      : !sideEffect.baseline_read
        ? 'the baseline transcript read before dispatch did not answer'
        : !sideEffect.turn_end_observed
          ? 'the turn did not end before the socket closed'
          : !sideEffect.window_elapsed
            ? `the ${SIDE_EFFECT_WINDOW_MS}ms window after the turn did not elapse before the socket closed`
            : `the final transcript read ${finalReadProblem || 'did not answer'}`;
  }
  const classified = classifyRrc1Evidence(evidence);
  evidence.verdict = classified.verdict;
  evidence.verdict_reason = classified.reason;

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'request_compaction registered': () => evidence.tool_inventory_checked && evidence.tool_registered,
    'dispatch accepted': () => evidence.dispatch_accepted,
    'typed tool invocation observed': () => evidence.tool_invocation_observed,
    'authoritative tool result observed': () => evidence.tool_result_observed,
    'tool result bound to current nonce-bearing call': () => evidence.tool_call_nonce_bound,
    'request_compaction rejected': () => evidence.tool_invoke_rejected,
    'context guard observed': () => CONTEXT_GUARDS.includes(evidence.guard),
    'rejection meets the R-RC-1 PASS rule': () => evidence.rejection_meets_contract,
    'no compaction side effect': () => evidence.no_compaction_side_effect === true,
  });

  // proof_failures==0 is handleSummary's PASS, so every non-PASS run counts one.
  if (evidence.verdict !== 'PASS-candidate') {
    failures.add(1);
  }

  console.log(`\n--- R-RC-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  if (evidence.verdict_reason) console.log(`[R-RC-1] verdict reason: ${evidence.verdict_reason}`);
  console.log(`\n[R-RC-1] VERDICT: ${evidence.verdict}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-RC-1',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_rc_1_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };
  return {
    stdout: `\n[R-RC-1] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-rc-1-summary.json': JSON.stringify(summary, null, 2),
  };
}
