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
//   An accepted request compacts after the turn, through the lane queue (:305-397).
// - a compaction record in the transcript projects as a system row
//   { role: "system", content: [{ text: "Compaction" }], __openclaw: { kind: "compaction", id } }
//   (src/gateway/session-transcript-entry-message.ts:82-110), which sessions.get returns.
// - compaction progress is an `agent` event { stream: "compaction", data: { phase } }
//   (src/agents/embedded-agent-runner/run/compaction-runtime.ts:103-110), mirrored to
//   sessions.messages subscribers for phases start and end
//   (src/gateway/server-chat-event-admission.ts:15), as is the lifecycle stream.
//
// Each test fires the real R-RC-1 scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a gateway scripted on those shapes and reads its
// VERDICT line and evidence through the real extractor. No live gateway is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioPath = path.join(root, 'scenarios/r-rc-1-threshold-reject.js');
const manifestPath = path.join(root, 'manifests/r-rc-1.json');
const RUN_ID = '4c1f9a2e-0b7d-4e3a-9c55-1d2e3f4a5b6c';

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
 * request_compaction call, its toolResult, the assistant sentinel, lifecycle end. The
 * transcript sessions.get returns is the turn so far.
 *
 * compaction: where a compaction after the rejection shows up, if anywhere:
 *   'stream'          agent compaction start/end events right after the turn
 *   'transcript'      a compaction record in the transcript right after the turn
 *   'late-transcript' a compaction record that lands only after the first post-turn read
 *   'both'            stream events and the transcript record
 * turnEnds: false leaves the run open (no sentinel, no lifecycle end).
 */
function scriptedGateway({ receipt = RECEIPTS.measured, compaction = null, turnEnds = true } = {}) {
  const state = { sessionKey: null, transcript: [], turnDone: false, readsAfterTurn: 0, lateMarkerLanded: false };
  const lifecycle = (phase) => event('agent', { runId: RUN_ID, stream: 'lifecycle', ts: 1, sessionKey: state.sessionKey, agentId: 'main', data: { phase } });
  const compactionEvent = (phase) => event('agent', { runId: RUN_ID, stream: 'compaction', ts: 2, sessionKey: state.sessionKey, agentId: 'main', data: { phase, itemId: 'diag-0001' } });
  const append = (message) => {
    state.transcript.push(message);
    return event('session.message', { sessionKey: state.sessionKey, agentId: 'main', message: { ...message, __openclaw: { ...(message.__openclaw || {}), runId: RUN_ID } } });
  };
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
        if (state.turnDone) {
          state.readsAfterTurn += 1;
          if (compaction === 'late-transcript' && state.readsAfterTurn > 1 && !state.lateMarkerLanded) {
            state.lateMarkerLanded = true;
            state.transcript.push(COMPACTION_MARKER);
          }
        }
        return [ok({ messages: state.transcript.slice(-(frame.params.limit || 200)) })];
      }
      case 'sessions.send': {
        const reasonJson = /reason=("(?:[^"\\]|\\.)*")/u.exec(frame.params.message)?.[1];
        assert.ok(reasonJson, 'the dispatch names the request_compaction reason');
        const reason = JSON.parse(reasonJson);
        const nonce = /nonce (\S+?):/u.exec(reason)?.[1];
        assert.ok(nonce, 'the request_compaction reason carries the row nonce');
        const replies = [
          ok({ runId: RUN_ID, status: 'started' }),
          lifecycle('start'),
          append({ role: 'user', content: [{ type: 'text', text: frame.params.message }] }),
          append({ role: 'assistant', content: [{ type: 'toolCall', id: 'call_rc1', name: 'request_compaction', arguments: { reason } }], stopReason: 'toolUse' }),
          append({ role: 'toolResult', toolCallId: 'call_rc1', toolName: 'request_compaction', isError: false, content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }] }),
        ];
        if (!turnEnds) return replies;
        replies.push(
          append({ role: 'assistant', content: [{ type: 'text', text: `RC1-RESULT-OBSERVED ${nonce}` }], stopReason: 'stop' }),
          lifecycle('end'),
        );
        state.turnDone = true;
        if (compaction === 'stream' || compaction === 'both') replies.push(compactionEvent('start'), compactionEvent('end'));
        if (compaction === 'transcript' || compaction === 'both') replies.push(append(COMPACTION_MARKER));
        return replies;
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

/** Fire the real scenario once; return its VERDICT line, evidence and failure count. */
async function fireRrc1(options = {}) {
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
    },
  });
  const records = extractEvidence(fired.log);
  assert.equal(records.length, 1, `expected one R-RC-1 evidence record:\n${fired.log}`);
  const verdicts = [...fired.log.matchAll(/\[R-RC-1\] VERDICT: ([A-Z-]+-candidate)\b/gu)].map((match) => match[1]);
  assert.equal(verdicts.length, 1, `expected one VERDICT line:\n${fired.log}`);
  const proofFailures = (fired.metrics || [])
    .filter((metric) => metric.name === 'proof_failures')
    .reduce((sum, metric) => sum + metric.value, 0);
  return { verdict: verdicts[0], evidence: records[0], proofFailures, frames: fired.frames };
}

function assertNotPass(fired) {
  assert.equal(fired.verdict, 'PARTIAL-candidate');
  assert.equal(fired.evidence.verdict, 'PARTIAL-candidate');
  assert.ok(fired.proofFailures > 0, 'a non-PASS run must count a proof failure, or handleSummary would say PASS');
}

test('positive control: a measured below-floor rejection with no compaction after the turn is PASS', async () => {
  const fired = await fireRrc1();
  assert.equal(fired.verdict, 'PASS-candidate');
  assert.equal(fired.proofFailures, 0);
  assert.equal(fired.evidence.guard, 'context_threshold');
  assert.equal(fired.evidence.context_usage, 12);
  assert.equal(fired.evidence.threshold, 70);
  assert.equal(fired.evidence.no_compaction_side_effect, true);
});

test('positive control: an unmeasured rejection with a live cause and no compaction is PASS, never measured proof', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.noFreshUsage });
  assert.equal(fired.verdict, 'PASS-candidate');
  assert.equal(fired.evidence.guard, 'context_unmeasured');
  assert.equal(fired.evidence.cause, 'no_fresh_usage');
  assert.equal(fired.evidence.context_usage, null);
  assert.equal(fired.evidence.threshold, null);
  assert.equal(fired.evidence.no_compaction_side_effect, true);
});

test('🍃 repro: context_threshold with no numbers and inventory-only wording is not PASS', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.thresholdNoNumbers });
  assertNotPass(fired);
  assert.equal(fired.evidence.guard, 'context_threshold');
});

test('🍃 repro: context_threshold with usage 80 above a threshold of 70 is not PASS', async () => {
  const fired = await fireRrc1({ receipt: RECEIPTS.aboveThreshold });
  assertNotPass(fired);
  assert.equal(fired.evidence.context_usage, 80);
  assert.equal(fired.evidence.threshold, 70);
});

test('side effect: a compaction after the rejection, on the stream and in the transcript, is not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'both' });
  assertNotPass(fired);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
});

test('side effect: compaction events on the subscribed stream alone are not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'stream' });
  assertNotPass(fired);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
});

test('side effect: a compaction record that lands in the transcript after the turn is not PASS', async () => {
  const fired = await fireRrc1({ compaction: 'late-transcript' });
  assertNotPass(fired);
  assert.equal(fired.evidence.no_compaction_side_effect, false);
});

test('side effect unproven: a run that never ends cannot show the absence of a compaction', async () => {
  const fired = await fireRrc1({ turnEnds: false });
  assertNotPass(fired);
  // The rejection itself was observed; only the side-effect window is missing.
  assert.equal(fired.evidence.tool_result_observed, true);
  assert.equal(fired.evidence.no_compaction_side_effect, null);
});
