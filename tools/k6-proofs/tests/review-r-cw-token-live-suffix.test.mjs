// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727).
//
// FINDING: R-CW-TOKEN decides hop 2 from whichever path completes first, and
// the live path judges only a SUFFIX of the child transcript.
// scenarios/r-cw-token-bracket.js subscribes to the child key only after the
// parent's sessions_spawn toolResult arrives (:183), then calls
// evaluateChild(childRows) on every live row (:367-369); evaluateChild returns
// early once hop_2_executed is set (:189), so a later chat.history read (the
// whole transcript) can no longer veto it. tokenWorkHops computes
// typedToolUsed over the rows it is given (lib/continue-work-chain.mjs:139),
// so a typed continue_work call persisted before the subscription is never
// seen, and the row credits the bare-token form for a hop the typed tool
// scheduled. The token form is the row's whole claim.
//
// (review-requester-authored-token.test.mjs shows the other consequence of the
// same suffix: the child's spawn-task row is missing from the mint check.)
//
// This test asserts the desired contract and FAILS on codeagent/harness-review
// at 3283454d; the control (the typed call after the subscription) passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:review-r-cw-token-suffix-parent';
const CHILD = 'agent:main:subagent:review-r-cw-token-suffix-child';
const MINTED = 'h4j5k6l7m8n9';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, timestamp });
const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });

/** world.liveFrom: index of the first child row the subscription delivers. */
function gatewayFor(world) {
  let childHistory = [];
  let parentHistory = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': {
        if (frame.params?.key !== CHILD) return ok({ subscribed: true });
        // Live-only: rows persisted before the subscription are not replayed.
        return [...ok({ subscribed: true }), ...childHistory.slice(world.liveFrom).map((row) => ev(CHILD, row, row.__openclaw?.runId))];
      }
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        const nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(task)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task, context: 'isolated', lightContext: true, cleanup: 'delete' } }], __openclaw: { runId: 'run-d' }, timestamp: 1 };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: CHILD, runId: 'run-c1' }, null, 2) }], __openclaw: { runId: 'run-d' }, timestamp: 2 };
        // Hop 1 used the TYPED tool: its toolCall and toolResult rows are
        // persisted first, then hop 1's text; the wake follows.
        childHistory = [
          user(`[Subagent Task] ${task}`),
          { role: 'assistant', content: [{ type: 'toolCall', id: 'cw-1', name: 'continue_work', arguments: { delaySeconds: 5, reason: 'hop 2' } }], __openclaw: { runId: 'run-c1' }, timestamp: 8 },
          { role: 'toolResult', toolCallId: 'cw-1', toolName: 'continue_work', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled' }) }], __openclaw: { runId: 'run-c1' }, timestamp: 9 },
          say(`TOKEN-HOP1 ${nonce}`, 'run-c1', 10),
          user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
          say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${MINTED}`, 'run-c2', 20),
        ];
        parentHistory = [user(message), spawnCall, spawnResult, say(`PARENT-SPAWNED ${nonce}`, 'run-d', 3), say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${MINTED}`, 'run-p2', 30)];
        return [...ok({ runId: 'run-d' }), ev(PARENT, spawnCall, 'run-d'), ev(PARENT, spawnResult, 'run-d')];
      }
      case 'chat.history':
        return ok({ messages: frame.params?.sessionKey === CHILD ? childHistory : parentHistory, hasMore: false });
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cw-token-bracket.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cw-token.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-r-cw-token-suffix-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'review-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CW-TOKEN evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CW-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('REVIEW R-CW-TOKEN: a typed continue_work call persisted before the child subscription still refuses the token form', async () => {
  // The subscription lands mid-turn: after the typed call and its result, before hop 1's text.
  const { evidence, verdict } = await fire({ liveFrom: 3 });
  assert.equal(evidence.child_typed_continue_work_observed, true,
    'the child transcript holds a typed continue_work call; the live suffix hid it');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control R-CW-TOKEN: the same typed call seen live refuses the token form', async () => {
  const { evidence, verdict } = await fire({ liveFrom: 1 });
  assert.equal(evidence.child_typed_continue_work_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});
