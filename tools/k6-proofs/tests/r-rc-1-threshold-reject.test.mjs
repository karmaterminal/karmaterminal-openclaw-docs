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
// Round 2 (🌊's head-pinned review of docs 3e2c83c7, Discord 1565869199908282472):
// 1. cause=inventory_only is non-PASS whatever the guard; 3e2c83c7 rejected it only
//    under context_unmeasured and passed a measured context_threshold naming it.
// 2. the side-effect window defaults to, and never drops below, the product's 180s
//    compaction timeout plus a scheduling margin.
// 3. contract change: a compaction observed after the rejection is FAIL-candidate,
//    carrying its compaction evidence; an incomplete observation stays PARTIAL.
//
// Each test fires the real R-RC-1 scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a gateway scripted on those shapes and reads its
// VERDICT line and evidence through the real extractor. No live gateway is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRrc1Evidence, LIVE_UNMEASURED_CAUSES, RRC1_MIN_SIDE_EFFECT_WINDOW_MS } from '../lib/request-compaction-receipt.js';
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
  // 🌊's case on docs 3e2c83c7: measured 10 below 70, ordinary wording, cause inventory_only.
  thresholdInventoryOnlyCause: {
    status: 'rejected',
    guard: 'context_threshold',
    contextUsage: 10,
    threshold: 70,
    cause: 'inventory_only',
    reason: 'Context usage (10%) is below the minimum threshold (70%). Compaction is not needed yet.',
  },
  // inventory_only under the unmeasured guard, without the inventory-only wording.
  unmeasuredInventoryOnlyCause: {
    status: 'rejected',
    guard: 'context_unmeasured',
    cause: 'inventory_only',
    reason: 'Context usage has not been measured: this session has no fresh token totals from a completed model turn (as on its first turn, or when the provider reported no usage). request_compaction can check the 70% threshold only after a completed turn records them.',
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
 *   'before-rejection' stream events and a transcript row inside the turn, after the
 *                     request_compaction call and before its toolResult
 *   'start-then-late-row' a compaction start event right after the turn, and its
 *                     transcript row only after the first post-turn read
 *   'replayed-baseline-row' a session.message replaying the baseline's compaction row
 *                     right after the turn (pass baseline: [COMPACTION_MARKER])
 * compactionEventSessionKey: the session the compaction events name (null: none).
 * compactionPhases: the agent compaction events 'stream' and 'both' send (start, end).
 * compactionCompleted: the end event's completed flag, as compaction-runtime.ts sets it
 *   (ok && compacted); the start event carries none.
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
 * transcriptEvents: false writes the turn's rows to the transcript without a
 *   session.message event for them (only lifecycle events reach the socket).
 */
function scriptedGateway({
  receipt = RECEIPTS.measured,
  compaction = null,
  compactionEventSessionKey,
  compactionPhases = ['start', 'end'],
  compactionCompleted = true,
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
  transcriptEvents = true,
} = {}) {
  const state = { sessionKey: null, transcript: [...baseline], sent: false, turnDone: false, readsAfterTurn: 0 };
  const lifecycle = (phase, sessionKey = state.sessionKey, runId = RUN_ID) => event('agent', { ...(runId ? { runId } : {}), stream: 'lifecycle', ts: 1, sessionKey, agentId: 'main', data: { phase } });
  const compactionEvent = (phase) => {
    const sessionKey = compactionEventSessionKey === undefined ? state.sessionKey : compactionEventSessionKey;
    const outcome = phase === 'end' ? { completed: compactionCompleted } : {};
    return event('agent', { runId: RUN_ID, stream: 'compaction', ts: 2, ...(sessionKey ? { sessionKey } : {}), agentId: 'main', data: { phase, itemId: 'diag-0001', ...outcome } });
  };
  const append = (message) => {
    state.transcript.push(message);
    if (!transcriptEvents) return null;
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
          if ((compaction === 'late-transcript' || compaction === 'start-then-late-row') && state.readsAfterTurn === 2) state.transcript.push(COMPACTION_MARKER);
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
        ];
        if (compaction === 'before-rejection') {
          replies.push(compactionEvent('start'), compactionEvent('end'));
          state.transcript.push(COMPACTION_MARKER);
        }
        replies.push(append({ role: 'toolResult', toolCallId: 'call_rc1', toolName: 'request_compaction', isError: false, content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }] }));
        if (toolCallAfterResult) {
          replies.push(append({ role: 'assistant', content: [{ type: 'text', text: 'checking' }, { type: 'toolCall', id: 'call_other', name: 'session_status', arguments: {} }], stopReason: 'toolUse' }));
        }
        if (replyRow) replies.push(append({ role: 'assistant', content: [{ type: 'text', text: `RC1-RESULT-OBSERVED ${nonce}` }], stopReason: 'stop' }));
        if (lifecycleEnd) replies.push(lifecycle('end', lifecycleEndSessionKey ?? state.sessionKey, lifecycleEndRunId));
        if (replyRow || lifecycleEnd) {
          state.turnDone = true;
          if (compaction === 'stream' || compaction === 'both') replies.push(...compactionPhases.map(compactionEvent));
          if (compaction === 'transcript' || compaction === 'both') state.transcript.push(COMPACTION_MARKER);
          if (compaction === 'start-then-late-row') replies.push(compactionEvent('start'));
          if (compaction === 'replayed-baseline-row') replies.push(event('session.message', { sessionKey: state.sessionKey, agentId: 'main', message: COMPACTION_MARKER }));
        }
        const turn = replies.filter(Boolean);
        return ackLast ? [...turn, ack] : [ack, ...turn];
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
  const result = {
    verdict: verdicts[0], evidence: records[0], proofFailures, frames: fired.frames, log: fired.log,
    options: fired.options, handleSummary: fired.handleSummary, metrics: fired.metrics,
  };
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

// A compaction observed after a rejection that meets the PASS rule: FAIL-candidate, with
// the compaction evidence in the reason and in side_effect.compaction_observations.
function assertFail(fired) {
  assert.equal(fired.verdict, 'FAIL-candidate', fired.evidence.verdict_reason ?? '');
  assert.equal(fired.evidence.verdict, 'FAIL-candidate');
  assert.ok(fired.proofFailures > 0, 'a FAIL run must count a proof failure, or handleSummary would say PASS');
  assert.equal(fired.evidence.rejection_meets_contract, true);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.match(fired.evidence.verdict_reason ?? '', /a compaction followed the rejection/u);
  const seen = fired.evidence.side_effect;
  assert.match(fired.evidence.verdict_reason, new RegExp(`stream signals ${seen.stream_compaction_signals}\\b`, 'u'));
  assert.match(fired.evidence.verdict_reason, new RegExp(`new transcript compaction rows ${seen.new_compaction_markers}\\b`, 'u'));
  const after = (seen.compaction_observations ?? []).filter((observation) => observation.after_rejection === true);
  assert.ok(after.length >= 1, 'FAIL carries at least one compaction shown after the rejection');
  return after;
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
  // 180s compaction timeout plus the 60s margin.
  assert.equal(fired.evidence.side_effect.window_ms, 240000);
  assert.deepEqual(fired.evidence.side_effect.compaction_observations, []);
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

test('🌊 repro (docs 3e2c83c7): a measured below-floor context_threshold naming cause inventory_only is not PASS', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.thresholdInventoryOnlyCause });
  assertNotPass(fired, /cause inventory_only/u);
  assert.equal(fired.evidence.guard, 'context_threshold');
  assert.equal(fired.evidence.cause, 'inventory_only');
  assert.equal(fired.evidence.context_usage, 10);
  assert.equal(fired.evidence.threshold, 70);
  // Ordinary wording: only the cause can refuse it.
  assert.equal(fired.evidence.inventory_only_wording, false);
  assert.equal(fired.evidence.rejection_meets_contract, false);
  assert.equal(fired.evidence.no_compaction_side_effect, null);
});

test('guard: context_unmeasured naming cause inventory_only is not PASS, with or without the inventory-only wording', async () => {
  const ordinary = await fireRrc1({ receipt: RECEIPTS.unmeasuredInventoryOnlyCause });
  assertNotPass(ordinary, /cause inventory_only/u);
  assert.equal(ordinary.evidence.guard, 'context_unmeasured');
  assert.equal(ordinary.evidence.inventory_only_wording, false);
  assert.equal(ordinary.evidence.rejection_meets_contract, false);
  assertNotPass(await fireRrc1({ receipt: RECEIPTS.inventoryOnly }), /inventory-only wording/u);
});

// Contract change (🌊, docs 3e2c83c7 review point 3): a compaction observed after a
// rejection that meets the PASS rule contradicts it, so it is FAIL-candidate.

test('side effect: a compaction after the rejection, on the stream and in the transcript, is FAIL', async () => {
  const fired = await fireRrc1({ compaction: 'both' });
  const after = assertFail(fired);
  assert.ok(fired.evidence.side_effect.new_compaction_markers >= 1);
  const sources = new Set(after.map((observation) => observation.source));
  assert.ok(sources.has('agent-compaction-event'));
  assert.ok(sources.has('transcript-compaction-row'));
});

test('side effect: compaction events on the subscribed stream alone are FAIL, each event carried', async () => {
  const fired = await fireRrc1({ compaction: 'stream' });
  const after = assertFail(fired);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 2);
  assert.deepEqual(fired.evidence.side_effect.stream_compaction_sources, ['agent-compaction-event']);
  // The start carries no outcome; the end says the compaction committed.
  assert.deepEqual(after.map(({ source, phase, completed, session_named }) => ({ source, phase, completed, session_named })), [
    { source: 'agent-compaction-event', phase: 'start', completed: null, session_named: true },
    { source: 'agent-compaction-event', phase: 'end', completed: true, session_named: true },
  ]);
});

test('side effect: a compaction row in the transcript alone is FAIL, its record id carried', async () => {
  const fired = await fireRrc1({ compaction: 'transcript' });
  const after = assertFail(fired);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 1);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 0);
  assert.deepEqual(after.map(({ source, record_id }) => ({ source, record_id })), [
    { source: 'transcript-compaction-row', record_id: 'cmp-0001' },
  ]);
});

test('side effect: a compaction record that lands in the transcript after the turn is FAIL', async () => {
  const fired = await fireRrc1({ compaction: 'late-transcript' });
  const after = assertFail(fired);
  // Seen by the final read, after the window.
  assert.equal(fired.evidence.side_effect.window_elapsed, true);
  assert.equal(fired.evidence.side_effect.final_read, true);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 1);
  assert.equal(after[0].read, 'final');
});

test('side effect: a sessions.changed cue catches the row before the window ends; an observed compaction is FAIL without the full window', async () => {
  const fired = await fireRrc1({ compaction: 'cue' });
  const after = assertFail(fired);
  assert.equal(fired.evidence.side_effect.cue_reads, 1);
  assert.equal(fired.evidence.side_effect.window_elapsed, false);
  assert.equal(after[0].read, 'cue');
});

test('side effect: a compaction inside the turn, before the toolResult, blocks PASS but is not FAIL', async () => {
  const fired = await fireRrc1({ compaction: 'before-rejection' });
  assertNotPass(fired, /not shown to follow the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  assert.equal(fired.evidence.side_effect.stream_compaction_signals, 2);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 1);
  const observations = fired.evidence.side_effect.compaction_observations;
  assert.equal(observations.length, 3);
  assert.ok(observations.every((observation) => observation.after_rejection !== true));
  assert.equal(observations.find((observation) => observation.source === 'transcript-compaction-row').after_rejection, false);
  // Transcript events take another path than agent events, so a stream signal that
  // arrives before the toolResult's event is not shown to precede it either.
  assert.deepEqual(observations.filter((observation) => observation.source === 'agent-compaction-event').map((observation) => observation.after_rejection), [null, null]);
});

// Independent review of 3dbd1fab: FAIL needs a committed compaction, not an attempt.

test('side effect: a compaction start after the rejection, never committed, blocks PASS but is not FAIL; the run keeps watching', async () => {
  const fired = await fireRrc1({ compaction: 'stream', compactionPhases: ['start'] });
  assertNotPass(fired, /not shown to follow the rejection/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
  // A start alone does not settle the verdict, so the window and the final read still run.
  assert.equal(fired.evidence.side_effect.window_elapsed, true);
  assert.equal(fired.evidence.side_effect.final_read, true);
  assert.deepEqual(fired.evidence.side_effect.compaction_observations.map(({ source, phase, completed, after_rejection }) => ({ source, phase, completed, after_rejection })), [
    { source: 'agent-compaction-event', phase: 'start', completed: null, after_rejection: true },
  ]);
});

test('side effect: a compaction that ends with completed:false blocks PASS but is not FAIL', async () => {
  const fired = await fireRrc1({ compaction: 'stream', compactionCompleted: false });
  assertNotPass(fired, /not shown to follow the rejection/u);
  assert.equal(fired.evidence.side_effect.final_read, true);
  assert.equal(fired.evidence.side_effect.compaction_observations.find((observation) => observation.phase === 'end').completed, false);
});

test('side effect: a compaction start whose transcript row lands later is FAIL on the row', async () => {
  const fired = await fireRrc1({ compaction: 'start-then-late-row' });
  const after = assertFail(fired);
  assert.equal(fired.evidence.side_effect.final_read, true);
  const row = after.find((observation) => observation.source === 'transcript-compaction-row');
  assert.ok(row, 'the committed row is carried');
  assert.equal(row.read, 'final');
  assert.equal(row.record_id, 'cmp-0001');
});

test('side effect: a replayed baseline compaction row on the stream blocks PASS but is not FAIL', async () => {
  const fired = await fireRrc1({ compaction: 'replayed-baseline-row', baseline: [COMPACTION_MARKER] });
  assertNotPass(fired, /not shown to follow the rejection/u);
  assert.equal(fired.evidence.side_effect.new_compaction_markers, 0);
  assert.deepEqual(fired.evidence.side_effect.compaction_observations.map(({ source, record_id, after_rejection }) => ({ source, record_id, after_rejection })), [
    { source: 'session-message-compaction-row', record_id: 'cmp-0001', after_rejection: false },
  ]);
});

test('a non-string cause naming inventory_only is not PASS', async () => {
  const fired = await fireRrc1({ receipt: { ...RECEIPTS.measured, cause: { code: 'inventory_only' } } });
  assertNotPass(fired, /inventory_only/u);
  assert.equal(fired.evidence.rejection_meets_contract, false);
});

test('handleSummary writes the VU verdict class: PASS, PARTIAL, or FAIL on a compaction after the rejection', async () => {
  const summaryVerdict = (fired) => {
    const metrics = {};
    for (const { name, value } of fired.metrics) {
      metrics[name] ??= { values: { count: 0 } };
      metrics[name].values.count += value;
    }
    metrics.proof_failures ??= { values: { count: 0 } };
    return JSON.parse(fired.handleSummary({ metrics })['r-rc-1-summary.json']).verdict;
  };
  assert.equal(summaryVerdict(await fireRrc1()), 'PASS-candidate');
  assert.equal(summaryVerdict(await fireRrc1({ turnEnds: false })), 'PARTIAL-candidate');
  assert.equal(summaryVerdict(await fireRrc1({ compaction: 'transcript' })), 'FAIL-candidate');
});

test('side effect: a compaction after a rejection that breaks the PASS rule stays PARTIAL on the rule, naming the compaction', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.aboveThreshold, compaction: 'stream' });
  assertNotPass(fired, /usage 80 is not below threshold 70/u);
  assert.match(fired.evidence.verdict_reason, /a compaction was also observed/u);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
});

test('side effect: a compaction event naming no session blocks PASS but is not FAIL; one naming another session does not count', async () => {
  const unnamed = await fireRrc1({ compaction: 'stream', compactionEventSessionKey: null });
  assertNotPass(unnamed, /not shown to follow the rejection/u);
  assert.equal(unnamed.evidence.no_compaction_side_effect, false);
  assert.ok(unnamed.evidence.side_effect.compaction_observations.every((observation) => observation.session_named === false));
  assertPass(await fireRrc1({ compaction: 'stream', compactionEventSessionKey: OTHER_SESSION }));
});

test('side effect: compaction rows already in the baseline are not new; an id-less one cannot be matched, blocks PASS, and is not FAIL', async () => {
  assertPass(await fireRrc1({ baseline: [COMPACTION_MARKER] }));
  const idless = { ...COMPACTION_MARKER, __openclaw: { kind: 'compaction' } };
  const fired = await fireRrc1({ baseline: [idless] });
  // It sits before the toolResult in every read, so it is not shown to follow the rejection.
  assertNotPass(fired, /not shown to follow the rejection/u);
  assert.equal(fired.evidence.side_effect.baseline_compaction_markers, 1);
  assert.equal(fired.evidence.side_effect.compaction_observations[0].after_rejection, false);
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

test('turn end: a held end matched at the ack also fetches the receipt when no transcript event prompted it', async () => {
  // Second independent review of 27afed10: the whole run, end included, arrives
  // before the ack and no session.message names a row, so only the matched end
  // can prompt the transcript read.
  const fired = await fireRrc1({ replyRow: false, ackLast: true, transcriptEvents: false });
  assertPass(fired);
  assert.equal(fired.evidence.side_effect.turn_end_source, 'lifecycle-end');
  // The same run with the ack first, for comparison.
  assertPass(await fireRrc1({ replyRow: false, transcriptEvents: false }));
});

test('the side-effect window defaults to 180s plus a margin, and can be lengthened, never shortened (🌊, docs 3e2c83c7)', async () => {
  const byDefault = await fireRrc1();
  assertPass(byDefault);
  assert.ok(byDefault.evidence.side_effect.window_ms > 180000, 'the window covers the product compaction timeout and a margin');
  assert.equal(byDefault.evidence.side_effect.window_ms, RRC1_MIN_SIDE_EFFECT_WINDOW_MS);
  // The old 30s default, the bare 180s timeout, and anything under the margin.
  for (const requested of ['1000', '30000', '180000', '239999']) {
    const shorter = await fireRrc1({ env: { OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS: requested } });
    assertPass(shorter);
    assert.equal(shorter.evidence.side_effect.window_ms, 240000, requested);
    assert.match(shorter.log, /shorter than 240000ms; using 240000ms/u, requested);
  }
  const longer = await fireRrc1({ env: { OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS: '600000' } });
  assertPass(longer);
  assert.equal(longer.evidence.side_effect.window_ms, 600000);
  const capped = await fireRrc1({ env: { OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS: '900000' } });
  assert.equal(capped.evidence.side_effect.window_ms, 600000);
  assert.match(capped.log, /longer than 600000ms; using 600000ms/u);
  // k6 keeps the iteration alive through the turn budget, the window and the final read.
  for (const fired of [byDefault, longer]) {
    const maxDuration = /^(\d+)s$/u.exec(fired.options.scenarios.r_rc_1_threshold_reject.maxDuration)?.[1];
    assert.ok(Number(maxDuration) * 1000 >= 60000 + fired.evidence.side_effect.window_ms + 5000, `maxDuration ${maxDuration}s`);
  }
});

test('a negative claim over a window shorter than the contract minimum is not PASS, even recomputed from evidence', async () => {
  const fired = await fireRrc1();
  assertPass(fired);
  for (const windowMs of [30000, 180000, 239999]) {
    const evidence = structuredClone(fired.evidence);
    evidence.side_effect.window_ms = windowMs;
    const classified = classifyRrc1Evidence(evidence);
    assert.equal(classified.verdict, 'PARTIAL-candidate', String(windowMs));
    assert.match(classified.reason, new RegExp(`side-effect window ${windowMs}ms is shorter than the contract's 240000ms`, 'u'));
  }
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
  // The inventory_only cause is refused whatever the guard (round 2, point 1).
  for (const [name, text] of Object.entries({ pass, notes, rejected })) {
    assert.match(text, /inventory_only cause[^.]*whatever the guard/u, `${name} refuses an inventory_only cause whatever the guard`);
  }
  assert.match(pass, /contextUsage < threshold/u);
  assert.match(pass, /no usage numbers/u);

  // Verdict authority after the round-2 contract change (point 3): an observed
  // compaction after the rejection is FAIL; an incomplete observation stays PARTIAL.
  const { partial, fail } = manifest.telemetryContract.verdictAuthority;
  assert.match(partial, /unproven/u);
  assert.doesNotMatch(partial, /kept PARTIAL/u, 'a contradicted side effect is no longer PARTIAL');
  assert.match(fail, /FAIL-candidate/u);
  assert.match(fail, /compaction[^.]*after the rejection/u);
  assert.match(fail, /compaction_observations/u, 'the FAIL carries its compaction evidence');
  assert.doesNotMatch(fail, /Not emitted/u);
  assert.match(notes, /FAIL-candidate/u);

  // The side-effect window the scenario uses is the one the prose names (point 2).
  const fired = await fireRrc1();
  const windowMs = fired.evidence.side_effect.window_ms;
  const seconds = `${windowMs / 1000}s after the turn ends`;
  const timeoutPlusMargin = `180s compaction timeout plus a ${(windowMs - 180000) / 1000}s scheduling margin`;
  for (const [name, text] of Object.entries({ pass, notes })) {
    assert.ok(text.includes(seconds), `${name} names the ${seconds} window`);
    assert.ok(text.includes(timeoutPlusMargin), `${name} names the ${timeoutPlusMargin}`);
    assert.match(text, /OPENCLAW_RRC1_SIDE_EFFECT_WINDOW_MS may lengthen that window, never shorten it/u, `${name} names the window override`);
    assert.match(text, /bounded/u, `${name} keeps the negative claim bounded by its window`);
    assert.match(text, /no compaction side effect/iu, `${name} requires no compaction side effect`);
  }
  // The manifest's run budget covers the scenario's default maxDuration, which covers
  // the turn budget, the window and the final read, plus k6's default 30s gracefulStop.
  const maxDuration = Number(/^(\d+)s$/u.exec(fired.options.scenarios.r_rc_1_threshold_reject.maxDuration)?.[1]);
  assert.ok(maxDuration * 1000 >= 60000 + windowMs + 5000, `maxDuration ${maxDuration}s`);
  assert.equal(fired.options.scenarios.r_rc_1_threshold_reject.gracefulStop, undefined, 'the scenario keeps k6\'s default 30s gracefulStop');
  assert.ok(manifest.timeoutSeconds >= maxDuration + 30, `timeoutSeconds ${manifest.timeoutSeconds} covers maxDuration ${maxDuration}s and gracefulStop`);
});
