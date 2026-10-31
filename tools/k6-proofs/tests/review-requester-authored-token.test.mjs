// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727).
//
// FINDING: a "child-minted" token is only checked against the texts the
// HARNESS sent, not against the requester's own tool-call arguments. When the
// requester writes a concrete token into the task it hands the child (instead
// of passing the harness task through verbatim), the child repeats it, and the
// requester later "reproduces" it from its own call. That is the original
// R-CD-SILENT defect (a readback of a token the parent carried in its own
// continue_delegate call), reached through the requester's arguments instead
// of the harness template.
//
//   - R-CD-SILENT (scenarios/r-cd-silent.js onChildChat): the child report is
//     read from a `chat` final only; the token is refused when it occurs in
//     `sentTexts` (harness task, instruction, follow-up). The requester's
//     actual continue_delegate `task` (receipt.args.task from
//     createToolReceiptTracker) is never consulted, and no child transcript is
//     read, so the child's spawn-task user row is never consulted either.
//   - R-CW-TOKEN (scenarios/r-cw-token-bracket.js evaluateChild over
//     childRows): the live child rows start at the subscription, which the
//     scenario opens only after the sessions_spawn toolResult arrives, so the
//     child's first user row (its spawn task) is not in childRows.
//     tokenWorkHops -> mintedTokenFromHistory refuses tokens in sentTexts and
//     in user rows of the rows it is given; neither holds the requester's
//     actual sessions_spawn task. The chat.history path would refuse it (the
//     spawn-task row is there), but the live path completes first and
//     evaluateChild returns early once hop_2_executed is set.
//
// Contrast: R-CD-1 and R-CD-3 read the child's own transcript, whose first
// user row carries the task the requester actually sent, so the same token is
// refused there (positive controls below keep the true-record path green).
//
// These tests assert the desired contract and FAIL on codeagent/harness-review
// at 3283454d. Fix shape: add every bound requester call's arguments (the
// receipt's `args`) to the texts a minted token must be absent from, and on
// R-CW-TOKEN bind hop 2 only after the child's spawn-task row has been read.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A token the REQUESTER chose and wrote into its own call.
const REQUESTER_TOKEN = 'q1w2e3r4t5y6';
// A token the child really minted.
const CHILD_MINTED = 'z9x8c7v6b5n4';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...(timestamp ? { timestamp } : {}) });

// ---------------------------------------------------------------------------
// R-CD-SILENT
// ---------------------------------------------------------------------------

const SILENT_PARENT = 'agent:main:review-r-cd-silent-parent';
const SILENT_CHILD = 'agent:main:subagent:continuation-reviewsilent01';

/** world.token: 'requester' (the requester pre-fills the task) | 'child' (the child mints). */
function silentGateway(world) {
  let nonce = null;
  let reported = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    const ev = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: SILENT_PARENT, message, runId } });
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: SILENT_PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (/follow-up nonce/.test(message)) {
          // A later parent run (not the dispatch run) names the token it knows.
          return [...ok({ runId: 'run-f' }), ev(say(`RCDS-PARENT-OBSERVED ${nonce} TOKEN ${reported}`, 'run-f'), 'run-f')];
        }
        const harnessTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /R-CD-SILENT proof nonce (\S+)\./.exec(message)[1];
        // The requester's ACTUAL continue_delegate argument.
        const sentTask = world.token === 'requester'
          ? harnessTask.replace('<your token>', REQUESTER_TOKEN)
          : harnessTask;
        reported = world.token === 'requester' ? REQUESTER_TOKEN : CHILD_MINTED;
        return [
          ...ok({ runId: 'run-d' }),
          ev({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task: sentTask, mode: 'silent', delaySeconds: 1 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev({ role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'silent' }) }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev(say(`RCDS-SCHEDULED ${nonce}`, 'run-d'), 'run-d'),
          // The child follows the task it actually received.
          { type: 'event', event: 'chat', payload: { runId: 'run-c', sessionKey: SILENT_CHILD, spawnedBy: SILENT_PARENT, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: `SILENTCHILD ${nonce} TOKEN ${reported}` }] } } },
        ];
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fireSilent(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-silent.js'),
    gateway: silentGateway(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-silent.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-r-cd-silent-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'review-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CD-SILENT evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CD-SILENT\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('REVIEW R-CD-SILENT: a token the requester wrote into its own continue_delegate task is not a child-minted readback', async () => {
  const { evidence, verdict } = await fireSilent({ token: 'requester' });
  assert.notEqual(evidence.parent_internal_context_observed, true,
    'the parent reproduced a token it authored in its own continue_delegate arguments; that proves nothing about the silent return');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control R-CD-SILENT: a token the child really minted still passes', async () => {
  const { evidence, verdict } = await fireSilent({ token: 'child' });
  assert.equal(evidence.child_completion_observed, true);
  assert.equal(evidence.parent_internal_context_observed, true);
  assert.equal(verdict, 'PASS-candidate');
});

// ---------------------------------------------------------------------------
// R-CW-TOKEN
// ---------------------------------------------------------------------------

const TOKEN_PARENT = 'agent:main:review-r-cw-token-parent';
const TOKEN_CHILD = 'agent:main:subagent:review-r-cw-token-child';

/** world.token: 'requester' | 'child'. */
function tokenGateway(world) {
  let childHistory = [];
  let parentHistory = [];
  const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: TOKEN_PARENT });
      case 'sessions.messages.subscribe': {
        if (frame.params?.key !== TOKEN_CHILD) return ok({ subscribed: true });
        // sessions.messages.subscribe is live-only: the child's spawn-task row
        // was written at spawn, before the harness could subscribe; hop 1, the
        // wake and hop 2 arrive afterwards.
        return [...ok({ subscribed: true }), ...childHistory.slice(1).map((row) => ev(TOKEN_CHILD, row, row.__openclaw?.runId))];
      }
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const harnessTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        const nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(harnessTask)[1];
        const token = world.token === 'requester' ? REQUESTER_TOKEN : CHILD_MINTED;
        // The requester's ACTUAL sessions_spawn argument.
        const sentTask = world.token === 'requester' ? harnessTask.replace('<your token>', REQUESTER_TOKEN) : harnessTask;
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task: sentTask, context: 'isolated', lightContext: true, cleanup: 'delete' } }], __openclaw: { runId: 'run-d' }, timestamp: 1 };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: TOKEN_CHILD, runId: 'run-c1' }, null, 2) }], __openclaw: { runId: 'run-d' }, timestamp: 2 };
        childHistory = [
          user(`[Subagent Task] ${sentTask}`),
          say(`TOKEN-HOP1 ${nonce}`, 'run-c1', 10),
          user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
          say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${token}`, 'run-c2', 20),
        ];
        parentHistory = [
          user(message), spawnCall, spawnResult, say(`PARENT-SPAWNED ${nonce}`, 'run-d', 3),
          // A later parent run names the token it knows (from its own call, or from the return).
          say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${token}`, 'run-p2', 30),
        ];
        return [
          ...ok({ runId: 'run-d' }),
          ev(TOKEN_PARENT, spawnCall, 'run-d'),
          ev(TOKEN_PARENT, spawnResult, 'run-d'),
          ev(TOKEN_PARENT, say(`PARENT-SPAWNED ${nonce}`, 'run-d', 3), 'run-d'),
        ];
      }
      case 'chat.history':
        return ok({ messages: frame.params?.sessionKey === TOKEN_CHILD ? childHistory : parentHistory, hasMore: false });
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fireToken(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cw-token-bracket.js'),
    gateway: tokenGateway(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cw-token.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-r-cw-token-token',
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

test('REVIEW R-CW-TOKEN: a token the requester wrote into its own sessions_spawn task is not a hop-2 mint (live path)', async () => {
  const { evidence, verdict } = await fireToken({ token: 'requester' });
  assert.notEqual(evidence.hop_2_executed, true,
    'hop 2 "minted" a token the requester authored in its own sessions_spawn arguments');
  assert.notEqual(evidence.parent_return, true,
    'the parent reproduced a token from its own call; that proves nothing about hop 2 reaching it');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control R-CW-TOKEN: a token the child really minted still passes on the live path', async () => {
  const { evidence, verdict } = await fireToken({ token: 'child' });
  assert.equal(evidence.hop_2_executed, true);
  assert.equal(evidence.parent_return, true);
  assert.equal(verdict, 'PASS-candidate');
});
