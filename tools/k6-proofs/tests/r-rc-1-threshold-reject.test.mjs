// R-RC-1 grader against its approved contract (karmaterminal/openclaw#1506; 🍃's
// finding on docs b37adbda).
//
// Contract: manifests/r-rc-1.json telemetryContract.verdictAuthority.pass, approved by
// 🌊 at docs b37adbda. PASS needs the nonce-bound request_compaction toolResult to be a
// structured rejection with no compaction side effect, either guard=context_threshold
// measured below the floor or guard=context_unmeasured with a live cause. Inventory-only
// in either form is non-PASS.
//
// 🍃's finding: b37adbda passed context_threshold with no numbers, with inventory-only
// wording, and with usage above the threshold, and the scenario set
// no_compaction_side_effect the moment the rejection arrived without looking for one.
//
// Product shapes at karmaterminal/openclaw 542d1cac46 (PR #1506 head; source walk):
// - request_compaction receipts: src/agents/tools/request-compaction-tool.ts:252-277.
//   A rejection returns before triggerCompaction (:243-295; the call is at :334-335).
// - a committed compaction appends a transcript record that sessions.get returns as
//   { role: "system", content: [{ text: "Compaction" }], __openclaw: { kind: "compaction", id } }
//   (src/gateway/session-transcript-entry-message.ts:82-112; operator-model-presentation.ts
//   leaves system rows alone). Session key and id do not change. This is the one
//   operator-visible mark of a queued (volitional) compaction: no counter is readable,
//   no session.message carries the row, and the queued path emits no compaction event.
// - the gateway announces that row to subscribers as sessions.changed { phase: "message" }
//   with no messageId (src/gateway/server-session-events.ts:596-647), a generic cue.
// - `agent` events { stream: "compaction", data: { phase } } come from in-attempt and
//   recovery compaction (src/agents/embedded-agent-runner/run/compaction-runtime.ts:102-120)
//   and reach sessions.messages subscribers for phases start and end
//   (src/gateway/server-chat-event-admission.ts:15), as does the lifecycle stream.
//
// Each test fires the real R-RC-1 scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a gateway scripted on those shapes and reads its
// VERDICT line and evidence through the real extractor. No live gateway is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRrc1Evidence, LIVE_UNMEASURED_CAUSES } from '../lib/request-compaction-receipt.js';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioPath = path.join(root, 'scenarios/r-rc-1-threshold-reject.js');
const manifestPath = path.join(root, 'manifests/r-rc-1.json');
const pipelinePath = path.join(root, 'k6-proofs-pipeline.xml');
const RUN_ID = '4c1f9a2e-0b7d-4e3a-9c55-1d2e3f4a5b6c';
const OTHER_SESSION = 'agent:main:somebody-else';

const RECEIPTS = Object.freeze({
  measured: {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 12,
    threshold: 70,
    reason: 'Context usage (12%) is below the minimum threshold (70%). Compaction is not needed yet.',
  },
  noFreshUsage: {
    status: 'rejected',
    guard: 'context_unmeasured',
    cause: 'no_fresh_usage',
    reason: 'Context usage has not been measured: this session has no fresh token totals from a completed model turn (as on its first turn, or when the provider reported no usage). request_compaction can check the 70% threshold only after a completed turn records them.',
  },
  // The pre-#1727 unknown branch: context_threshold, no numbers, inventory-only wording.
  thresholdNoNumbers: {
    status: 'rejected',
    guard: 'context_threshold',
    reason: 'Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.',
  },
  aboveThreshold: {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 80,
    threshold: 70,
    reason: 'Context usage (80%) is below the minimum threshold (70%). Compaction is not needed yet.',
  },
  inventoryOnly: {
    status: 'rejected',
    guard: 'context_unmeasured',
    cause: 'inventory_only',
    reason: 'Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.',
  },
  rateLimit: {
    status: 'rejected',
    guard: 'rate_limit',
    retryAfterSeconds: 120,
    reason: 'Rate limited. Next compaction request allowed in 120s.',
  },
  accepted: {
    status: 'compaction_requested',
    compactionRequestId: 'diag-0001',
    reason: 'Compaction enqueued.',
  },
});

const event = (name, payload) => ({ type: 'event', event: name, payload });
const COMPACTION_MARKER = Object.freeze({
  role: 'system',
  content: [{ type: 'text', text: 'Compaction' }],
  timestamp: 1_793_000_000_000,
  __openclaw: { kind: 'compaction', id: 'cmp-0001', tokensBefore: 9_000, tokensAfter: 1_200 },
});

/**
 * A gateway scripted on the 542d1cac shapes. sessions.send runs one turn: the typed
 * request_compaction call, its toolResult, the assistant sentinel row, lifecycle end. The
 * transcript sessions.get returns is the turn so far.
 *
 * compaction: where a compaction after the rejection shows up, if anywhere:
 *   'stream'          agent compaction start/end events right after the turn
 *   'transcript'      a compaction row in the transcript right after the turn
 *   'late-transcript' a compaction row that lands only after the first post-turn read
 *   'cue'             a compaction row announced by sessions.changed after the first
 *                     post-turn read
 *   'both'            stream events and the transcript row
 * compactionEventSessionKey: the session the compaction events name (null: none).
 * turnEnds: false leaves the run open (no reply row, no lifecycle end).
 * replyRow / lifecycleEnd / lifecycleEndSessionKey: the two turn-end marks, separately.
 * toolCallAfterResult: the agent calls another tool after the toolResult (not a reply).
 * baseline: transcript rows already in the session before dispatch.
 * failBaseline / failFinalRead: the read before dispatch, or every read after the
 *   first post-turn read, is refused.
 * finalRead: what every read after the first post-turn read returns instead of the
 *   transcript: 'ok-false-no-error' ({ ok: false } with no error), 'empty-payload',
 *   'empty-messages', or 'truncated' (a compaction row and 20 rows after it, so the
 *   20-row read no longer reaches back to the toolResult).
 * ackRunId / lifecycleEndRunId: the runId the sessions.send ack and the lifecycle
 *   end carry (null: none). ackLast: the turn's events arrive before the ack.
 */
function scriptedGateway({
  receipt = RECEIPTS.measured,
  compaction = null,
  compactionEventSessionKey,
  turnEnds = true,
  replyRow = turnEnds,
  lifecycleEnd = turnEnds,
  lifecycleEndSessionKey,
  baseline = [],
  failBaseline = false,
  failFinalRead = false,
  toolCallAfterResult = false,
  finalRead = null,
  ackRunId = RUN_ID,
  lifecycleEndRunId = RUN_ID,
  ackLast = false,
} = {}) {
  const state = { sessionKey: null, transcript: [...baseline], sent: false, turnDone: false, readsAfterTurn: 0 };
  const lifecycle = (phase, sessionKey = state.sessionKey, runId = RUN_ID) => event('agent', { ...(runId ? { runId } : {}), stream: 'lifecycle', ts: 1, sessionKey, agentId: 'main', data: { phase } });
  const compactionEvent = (phase) => {
    const sessionKey = compactionEventSessionKey === undefined ? state.sessionKey : compactionEventSessionKey;
    return event('agent', { runId: RUN_ID, stream: 'compaction', ts: 2, ...(sessionKey ? { sessionKey } : {}), agentId: 'main', data: { phase, itemId: 'diag-0001' } });
  };
  const append = (message) => {
    state.transcript.push(message);
    return event('session.message', { sessionKey: state.sessionKey, agentId: 'main', message: { ...message, __openclaw: { ...(message.__openclaw || {}), runId: RUN_ID } } });
  };
  const refuse = (frame) => ({ type: 'res', id: frame.id, ok: false, error: { code: 'UNAVAILABLE', message: 'transcript read unavailable' } });
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => ({ type: 'res', id: frame.id, ok: true, payload });
    switch (frame.method) {
      case 'connect':
        return [ok({ type: 'hello-ok' })];
      case 'sessions.create':
        state.sessionKey = `agent:main:${frame.params.key}`;
        return [ok({ key: state.sessionKey })];
      case 'tools.effective':
        return [ok({ groups: [{ id: 'continuation', tools: [{ id: 'continue_work' }, { id: 'request_compaction' }] }] })];
      case 'sessions.messages.subscribe':
        return [ok({ subscribed: true, key: frame.params.key })];
      case 'sessions.get': {
        if (!state.sent && failBaseline) return [refuse(frame)];
        if (state.turnDone) {
          state.readsAfterTurn += 1;
          if (failFinalRead && state.readsAfterTurn > 1) return [refuse(frame)];
          if (compaction === 'late-transcript' && state.readsAfterTurn === 2) state.transcript.push(COMPACTION_MARKER);
          if (finalRead && state.readsAfterTurn > 1) {
            if (finalRead === 'ok-false-no-error') return [{ type: 'res', id: frame.id, ok: false }];
            if (finalRead === 'empty-payload') return [ok({})];
            if (finalRead === 'empty-messages') return [ok({ messages: [] })];
            if (finalRead === 'truncated' && state.readsAfterTurn === 2) {
              state.transcript.push(COMPACTION_MARKER);
              for (let row = 0; row < 20; row += 1) state.transcript.push({ role: 'assistant', content: [{ type: 'text', text: `filler ${row}` }], stopReason: 'stop' });
            }
          }
        }
        const replies = [ok({ messages: state.transcript.slice(-(frame.params.limit || 200)) })];
        if (compaction === 'cue' && state.turnDone && state.readsAfterTurn === 1) {
          state.transcript.push(COMPACTION_MARKER);
          replies.push(event('sessions.changed', { sessionKey: state.sessionKey, agentId: 'main', phase: 'message', ts: 3 }));
        }
        return replies;
      }
      case 'sessions.send': {
        state.sent = true;
        const reasonJson = /reason=("(?:[^"\\]|\\.)*")/u.exec(frame.params.message)?.[1];
        assert.ok(reasonJson, 'the dispatch names the request_compaction reason');
        const reason = JSON.parse(reasonJson);
        const nonce = /nonce (\S+?):/u.exec(reason)?.[1];
        assert.ok(nonce, 'the request_compaction reason carries the row nonce');
        const ack = ok({ ...(ackRunId ? { runId: ackRunId } : {}), status: 'started' });
        const replies = [
          lifecycle('start'),
          append({ role: 'user', content: [{ type: 'text', text: frame.params.message }] }),
          append({ role: 'assistant', content: [{ type: 'toolCall', id: 'call_rc1', name: 'request_compaction', arguments: { reason } }], stopReason: 'toolUse' }),
          append({ role: 'toolResult', toolCallId: 'call_rc1', toolName: 'request_compaction', isError: false, content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }] }),
        ];
        if (toolCallAfterResult) {
          replies.push(append({ role: 'assistant', content: [{ type: 'text', text: 'checking' }, { type: 'toolCall', id: 'call_other', name: 'session_status', arguments: {} }], stopReason: 'toolUse' }));
        }
        if (replyRow) replies.push(append({ role: 'assistant', content: [{ type: 'text', text: `RC1-RESULT-OBSERVED ${nonce}` }], stopReason: 'stop' }));
        if (lifecycleEnd) replies.push(lifecycle('end', lifecycleEndSessionKey ?? state.sessionKey, lifecycleEndRunId));
        if (replyRow || lifecycleEnd) {
          state.turnDone = true;
          if (compaction === 'stream' || compaction === 'both') replies.push(compactionEvent('start'), compactionEvent('end'));
          if (compaction === 'transcript' || compaction === 'both') state.transcript.push(COMPACTION_MARKER);
        }
        return ackLast ? [...replies, ack] : [ack, ...replies];
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

/** Fire the real scenario once; return its VERDICT line, evidence and failure count. */
async function fireRrc1({ env = {}, ...options } = {}) {
  const fired = await runK6Scenario({
    scenarioPath,
    gateway: scriptedGateway(options),
    env: {
      OPENCLAW_ROW_MANIFEST: manifestPath,
      OPENCLAW_GATEWAY_TOKEN: 'docs-r-rc-1-grader-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: '542d1cac46fa8830b061f249e9b483375e88447f',
      OPENCLAW_SEAT_NAME: 'offline-fixture',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      ...env,
    },
  });
  const records = extractEvidence(fired.log);
  assert.equal(records.length, 1, `expected one R-RC-1 evidence record:\n${fired.log}`);
  const verdicts = [...fired.log.matchAll(/\[R-RC-1\] VERDICT: ([A-Z-]+-candidate)\b/gu)].map((match) => match[1]);
  assert.equal(verdicts.length, 1, `expected one VERDICT line:\n${fired.log}`);
  const proofFailures = (fired.metrics || [])
    .filter((metric) => metric.name === 'proof_failures')
    .reduce((sum, metric) => sum + metric.value, 0);
  const result = { verdict: verdicts[0], evidence: records[0], proofFailures, frames: fired.frames, log: fired.log };
  // The VERDICT line, the evidence and the shared classifier say the same thing.
  assert.equal(result.evidence.verdict, result.verdict);
  assert.equal(classifyRrc1Evidence(result.evidence).verdict, result.verdict);
  return result;
}

function assertNotPass(fired, reasonPattern) {
  assert.equal(fired.verdict, 'PARTIAL-candidate');
  assert.equal(fired.evidence.verdict, 'PARTIAL-candidate');
  assert.ok(fired.proofFailures > 0, 'a non-PASS run must count a proof failure, or handleSummary would say PASS');
  if (reasonPattern) assert.match(fired.evidence.verdict_reason ?? '', reasonPattern);
}

function assertPass(fired) {
  assert.equal(fired.verdict, 'PASS-candidate', fired.evidence.verdict_reason ?? '');
  assert.equal(fired.proofFailures, 0);
  assert.equal(fired.evidence.verdict_reason, null);
  assert.equal(fired.evidence.no_compaction_side_effect, true);
  assert.equal(fired.evidence.side_effect.baseline_read, true);
  assert.equal(fired.evidence.side_effect.turn_end_observed, true);
  assert.equal(fired.evidence.side_effect.window_elapsed, true);
  assert.equal(fired.evidence.side_effect.final_read, true);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 0);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 0);
}

const sessionGets = (fired) => fired.frames.filter((frame) => frame.method === 'sessions.get');

test('positive control: a measured below-floor rejection with no compaction after the turn is PASS', async () => {
  const fired = await fireRrc1();
  assert.equal(fired.verdict, 'PASS-candidate');
  assert.equal(fired.proofFailures, 0);
  assert.equal(fired.evidence.guard, 'context_threshold');
  assert.equal(fired.evidence.context_usage, 12);
  assert.equal(fired.evidence.threshold, 70);
  assert.equal(fired.evidence.no_compaction_side_effect, true);
  assertPass(fired);
  assert.equal(fired.evidence.rejection_shape, 'measured_below_threshold');
  assert.equal(fired.evidence.side_effect.window_ms, 30000);
  // A baseline read before the dispatch, the receipt read, and the final read after the window.
  const dispatchIndex = fired.frames.findIndex((frame) => frame.method === 'sessions.send');
  const getIndexes = fired.frames.map((frame, index) => (frame.method === 'sessions.get' ? index : -1)).filter((index) => index >= 0);
  assert.ok(getIndexes[0] < dispatchIndex, 'the transcript is read before dispatch');
  assert.equal(sessionGets(fired).length, 3);
});

test('positive control: an unmeasured rejection with a live cause and no compaction is PASS, never measured proof', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.noFreshUsage });
  assert.equal(fired.verdict, 'PASS-candidate');
  assert.equal(fired.evidence.guard, 'context_unmeasured');
  assert.equal(fired.evidence.cause, 'no_fresh_usage');
  assert.equal(fired.evidence.context_usage, null);
  assert.equal(fired.evidence.threshold, null);
  assert.equal(fired.evidence.no_compaction_side_effect, true);
  assertPass(fired);
  assert.equal(fired.evidence.rejection_shape, 'unmeasured_live_cause');
});

test('🍃 repro: context_threshold with no numbers and inventory-only wording is not PASS', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.thresholdNoNumbers });
  assertNotPass(fired, /inventory-only wording/u);
  assert.equal(fired.evidence.guard, 'context_threshold');
  assert.equal(fired.evidence.rejection_meets_contract, false);
  // The rejection is recorded for review; the side effect is not watched.
  assert.equal(fired.evidence.tool_invoke_rejected, true);
  assert.equal(fired.evidence.no_compaction_side_effect, null);
});

test('🍃 repro: context_threshold with usage 80 above a threshold of 70 is not PASS', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.aboveThreshold });
  assertNotPass(fired, /usage 80 is not below threshold 70/u);
  assert.equal(fired.evidence.context_usage, 80);
  assert.equal(fired.evidence.threshold, 70);
});

test('a context_threshold receipt without numbers and without inventory wording is still not PASS', async () => {
  const fired = await fireRrc1({ receipt: { status: 'rejected', guard: 'context_threshold', reason: 'Compaction is not needed yet.' } });
  assertNotPass(fired, /without a measured contextUsage and threshold/u);
});

test('inventory_only, rate_limit and an accepted request are not PASS', async () => {
  assertNotPass(await fireRrc1({ receipt: RECEIPTS.inventoryOnly }), /inventory-only wording/u);
  const rateLimited = await fireRrc1({ receipt: RECEIPTS.rateLimit });
  assertNotPass(rateLimited, /not a context-guard rejection \(guard rate_limit\)/u);
  assert.equal(rateLimited.evidence.tool_invoke_rejected, false);
  const accepted = await fireRrc1({ receipt: RECEIPTS.accepted });
  assertNotPass(accepted, /did not return a rejection \(status compaction_requested\)/u);
  assert.equal(accepted.evidence.tool_result_status, 'compaction_requested');
});

test('side effect: a compaction after the rejection, on the stream and in the transcript, is not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'both' });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.ok(fired.evidence.side_effect.new_compaction_markers >= 1);
});

test('side effect: compaction events on the subscribed stream alone are not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'stream' });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 2);
  assert.deepEqual(fired.evidence.side_effect.stream_compaction_sources, ['agent-compaction-event']);
});

test('side effect: a compaction row in the transcript alone is not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'transcript' });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 1);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 0);
});

test('side effect: a compaction record that lands in the transcript after the turn is not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'late-transcript' });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  // Seen by the final read, after the window.
  assert.equal(fired.evidence.side_effect.window_elapsed, true);
  assert.equal(fired.evidence.side_effect.final_read, true);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 1);
});

test('side effect: a sessions.changed cue rereads the transcript and catches the row before the window ends', async () => {
  const fired = await fireRrc1({ compaction: 'cue' });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.equal(fired.evidence.side_effect.cue_reads, 1);
  assert.equal(fired.evidence.side_effect.window_elapsed, false);
});

test('side effect: a compaction event naming no session counts; one naming another session does not', async () => {
  const unnamed = await fireRrc1({ compaction: 'stream', compactionEventSessionKey: null });
  assertNotPass(unnamed, /a compaction followed the rejection/u);
  assert.equal(unnamed.evidence.no_compaction_side_effect, false);
  assertPass(await fireRrc1({ compaction: 'stream', compactionEventSessionKey: OTHER_SESSION }));
});

test('side effect: compaction rows already in the baseline are not new; an id-less one cannot be matched and counts', async () => {
  assertPass(await fireRrc1({ baseline: [COMPACTION_MARKER] }));
  const idless = { ...COMPACTION_MARKER, __openclaw: { kind: 'compaction' } };
  const fired = await fireRrc1({ baseline: [idless] });
  assertNotPass(fired, /a compaction followed the rejection/u);
  assert.equal(fired.evidence.side_effect.baseline_compaction_markers, 1);
});

test('turn end: the reply row alone, or this session\'s lifecycle end alone, opens the window', async () => {
  const byReply = await fireRrc1({ lifecycleEnd: false });
  assertPass(byReply);
  assert.equal(byReply.evidence.side_effect.turn_end_source, 'transcript-reply');
  const byLifecycle = await fireRrc1({ replyRow: false });
  assertPass(byLifecycle);
  assert.equal(byLifecycle.evidence.side_effect.turn_end_source, 'lifecycle-end');
});

test('side effect unproven: a run that never ends cannot show the absence of a compaction', async () => {
  const fired = await fireRrc1({ turnEnds: false });
  assertNotPass(fired, /unproven: the turn did not end before the socket closed/u);
  // The rejection itself was observed; only the side-effect window is missing.
  assert.equal(fired.evidence.tool_result_observed, true);
  assert.equal(fired.evidence.no_compaction_side_effect, null);
});

test('side effect unproven: a further tool call after the toolResult is not the turn\'s reply', async () => {
  const fired = await fireRrc1({ replyRow: false, lifecycleEnd: false, toolCallAfterResult: true });
  assertNotPass(fired, /unproven: the turn did not end/u);
  assert.equal(fired.evidence.side_effect.turn_end_observed, false);
});

test('side effect unproven: a lifecycle end for another session does not open the window', async () => {
  const fired = await fireRrc1({ replyRow: false, lifecycleEndSessionKey: OTHER_SESSION });
  assertNotPass(fired, /unproven: the turn did not end/u);
  assert.equal(fired.evidence.side_effect.turn_end_observed, false);
  assert.equal(fired.evidence.no_compaction_side_effect, null);
});

test('side effect unproven: a refused baseline read or a refused final read is not PASS', async () => {
  const noBaseline = await fireRrc1({ failBaseline: true });
  assertNotPass(noBaseline, /unproven: the baseline transcript read before dispatch did not answer/u);
  assert.equal(noBaseline.evidence.no_compaction_side_effect, null);
  // The rejection is still recorded, so the fold can name it.
  assert.equal(noBaseline.evidence.guard, 'context_threshold');
  const noFinal = await fireRrc1({ failFinalRead: true });
  assertNotPass(noFinal, /unproven: the final transcript read was refused/u);
  assert.equal(noFinal.evidence.side_effect.window_elapsed, true);
  assert.equal(noFinal.evidence.side_effect.final_read, false);
  assert.equal(noFinal.evidence.no_compaction_side_effect, null);
});

// Independent review of 85a197cf: two ways to PASS without the observation.

test('side effect unproven: a final read that does not show the transcript back to the toolResult is not PASS', async () => {
  for (const finalRead of ['ok-false-no-error', 'empty-payload', 'empty-messages', 'truncated']) {
    const fired = await fireRrc1({ finalRead });
    assertNotPass(fired, /unproven: the final transcript read/u);
    assert.equal(fired.evidence.side_effect.final_read, false, finalRead);
    assert.equal(fired.evidence.no_compaction_side_effect, null, finalRead);
  }
});

test('turn end: only a lifecycle end whose runId is the acknowledged send run opens the window', async () => {
  // The real turn never replies and never ends; only a stray lifecycle end arrives.
  const noRunIdOnEnd = await fireRrc1({ replyRow: false, lifecycleEndRunId: null });
  assertNotPass(noRunIdOnEnd, /unproven: the turn did not end/u);
  assert.equal(noRunIdOnEnd.evidence.side_effect.turn_end_observed, false);
  const noRunIdOnAck = await fireRrc1({ replyRow: false, ackRunId: null, lifecycleEndRunId: 'run-other' });
  assertNotPass(noRunIdOnAck, /unproven: the turn did not end/u);
  const neither = await fireRrc1({ replyRow: false, ackRunId: null, lifecycleEndRunId: null });
  assertNotPass(neither, /unproven: the turn did not end/u);
  const otherRun = await fireRrc1({ replyRow: false, lifecycleEndRunId: 'run-other' });
  assertNotPass(otherRun, /unproven: the turn did not end/u);
});

test('turn end: an end that arrives before the ack counts once the ack names its run; without a run id the reply row decides', async () => {
  const early = await fireRrc1({ replyRow: false, ackLast: true });
  assertPass(early);
  assert.equal(early.evidence.side_effect.turn_end_source, 'lifecycle-end');
  const earlyOther = await fireRrc1({ replyRow: false, ackLast: true, lifecycleEndRunId: 'run-other' });
  assertNotPass(earlyOther, /unproven: the turn did not end/u);
  const noAckRunId = await fireRrc1({ ackRunId: null });
  assertPass(noAckRunId);
  assert.equal(noAckRunId.evidence.side_effect.turn_end_source, 'transcript-reply');
});

test('the side-effect window can be lengthened, never shortened', async () => {
  const longer = await fireRrc1({ env: { OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS: '180000' } });
  assertPass(longer);
  assert.equal(longer.evidence.side_effect.window_ms, 180000);
  const shorter = await fireRrc1({ env: { OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS: '1000' } });
  assertPass(shorter);
  assert.equal(shorter.evidence.side_effect.window_ms, 30000);
  assert.match(shorter.log, /shorter than 30000ms; using 30000ms/u);
});

// The manifest is the declaration of record and the scenario's classifier is the
// verdict. If one moves without the other, these fail.
test('drift: the R-RC-1 manifest prose says what the grader enforces', async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const pass = manifest.telemetryContract.verdictAuthority.pass;
  const notes = manifest.liveRunSafety.notes;
  const rejected = manifest.expectedReceipts.find((receipt) => receipt.name === 'tool-invoke-rejected').description;
  const positive = manifest.telemetryContract.controls.positive;
  const pipelineRow = /<Row id="R-RC-1"[\s\S]*?<\/Row>/u.exec(readFileSync(pipelinePath, 'utf8'))?.[0] ?? '';

  // The live-cause list each document names is exactly the grader's.
  const causeList = (text) => /\(((?:[a-z_]+\s*\|\s*)+[a-z_]+)\)/u.exec(text)?.[1].split('|').map((cause) => cause.trim()).sort();
  for (const [name, text] of Object.entries({ pass, rejected, pipelineRow })) {
    assert.deepEqual(causeList(text), [...LIVE_UNMEASURED_CAUSES].sort(), `${name} names the live causes`);
  }
  for (const [name, text] of Object.entries({ pass, notes, rejected, positive, pipelineRow })) {
    assert.match(text, /measured below the floor/u, `${name} requires a measurement below the floor`);
    assert.match(text, /context_unmeasured/u, `${name} names the unmeasured guard`);
  }
  for (const [name, text] of Object.entries({ pass, notes, rejected, pipelineRow })) {
    assert.match(text, /inventory-only/iu, `${name} refuses inventory-only`);
  }
  assert.match(pass, /contextUsage < threshold/u);
  assert.match(pass, /no usage numbers/u);
  assert.match(manifest.telemetryContract.verdictAuthority.partial, /unproven/u);

  // The side-effect window the scenario uses is the one the prose names.
  const fired = await fireRrc1();
  const seconds = `${fired.evidence.side_effect.window_ms / 1000}s after the turn ends`;
  for (const [name, text] of Object.entries({ pass, notes })) {
    assert.ok(text.includes(seconds), `${name} names the ${seconds} window`);
    assert.match(text, /OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS may lengthen that window, never shorten it/u, `${name} names the window override`);
    assert.match(text, /no compaction side effect/iu, `${name} requires no compaction side effect`);
  }
  // The manifest's timeout covers the scenario's longest default run.
  assert.ok(manifest.timeoutSeconds * 1000 >= 60000 + fired.evidence.side_effect.window_ms + 5000);
});
