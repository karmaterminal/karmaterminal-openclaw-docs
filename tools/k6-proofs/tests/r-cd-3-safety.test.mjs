// R-CD-3 binding and fill safety, sibling paths of the harness review findings
// (karmaterminal/openclaw-bootstrap#1727).
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway shaped like openclaw f15237ec92 (see r-cd-3-post-compaction.test.mjs
// for the shapes). The scenario-level tests import nothing added with the
// fixes, so the file runs unchanged against the pre-fix tree as its negative
// control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'agent:main:r-cd-3-safety-disposable';
const LIFEBOAT = 'agent:main:subagent:continuation-safety-lifeboat';
const MINTED = 'm3n8b2v7c1x6';
const RELEASE = '[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ';
const ACCEPTED = { status: 'compaction_requested', compactionRequestId: 'diag-safety', trigger: 'volitional', contextUsage: 76, reason: 'R-CD-3 k6 proof', note: 'Compaction will run after this turn.' };

function quotedAfter(text, key) {
  const match = new RegExp(`${key}=("(?:[^"\\\\]|\\\\.)*")`).exec(text);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * world:
 *   lifeboatTask(task): the released child's spawn task (default: the product release composition)
 *   extraProofCalls(task): more requester calls in the proof turn ([{ name, arguments }])
 *   sendRunId(kind, n): the runId a sessions.send answer carries ('fill' | 'proof'); undefined = none
 *   parentReturnRun: the run that reproduces the token (default 'run-wake')
 */
function gatewayFor(world = {}) {
  const state = { fills: 0, total: 0, proof: null, task: null, nonce: null };
  const window = 200_000;
  const say = (text, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], ...extra });
  const event = (name, payload) => ({ type: 'event', event: name, payload });
  const sessionMessage = (message, runId) => event('session.message', { sessionKey: SESSION, message: { ...message, __openclaw: { runId } }, runId });
  const runIdFor = (kind, n) => (world.sendRunId ? world.sendRunId(kind, n) : kind === 'fill' ? `run-fill-${n}` : 'run-proof');

  function proofRows() {
    const calls = [
      { id: 'cd-1', name: 'continue_delegate', arguments: { mode: 'post-compaction', delaySeconds: 0, task: state.task } },
      ...(world.extraProofCalls ? world.extraProofCalls(state.task) : []).map((call, i) => ({ id: `extra-${i}`, ...call })),
      { id: 'rc-1', name: 'request_compaction', arguments: { reason: state.proof.reason } },
    ];
    const rows = [{ role: 'user', content: [{ type: 'text', text: state.proof.message }] }];
    for (const call of calls) {
      rows.push({ role: 'assistant', content: [{ type: 'toolCall', ...call }], __openclaw: { runId: 'run-proof' } });
      const payload = call.name === 'continue_delegate' ? { status: 'queued-for-compaction', mode: 'post-compaction' }
        : call.name === 'request_compaction' ? ACCEPTED : { status: 'accepted' };
      rows.push({ role: 'toolResult', toolCallId: call.id, toolName: call.name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, __openclaw: { runId: 'run-proof' } });
    }
    return rows;
  }

  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-3']] } });
      case 'sessions.create': return ok({ key: SESSION });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (/context fill \d+/.test(message)) {
          state.fills += 1;
          state.total += 40_000;
          const runId = runIdFor('fill', state.fills);
          return [...ok(runId === undefined ? { status: 'started' } : { runId }), ...(runId ? [event('agent', { runId, sessionKey: SESSION, stream: 'lifecycle', data: { phase: 'end' } })] : [])];
        }
        state.nonce = /R-CD-3 nonce (\S+)\./.exec(message)?.[1] || null;
        state.task = quotedAfter(message, 'task');
        state.proof = { message, reason: quotedAfter(message, 'reason') };
        const runId = runIdFor('proof', 0);
        return [...ok(runId === undefined ? { status: 'started' } : { runId }), ...proofRows().map((row) => sessionMessage(row, 'run-proof'))];
      }
      case 'sessions.describe':
        return ok({ session: { key: SESSION, totalTokens: state.total, totalTokensFresh: state.fills > 0, contextTokens: state.fills > 0 ? window : undefined } });
      case 'sessions.list':
        return ok({ sessions: state.proof && frame.params?.spawnedBy === SESSION ? [{ key: LIFEBOAT, spawnedBy: SESSION, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey === LIFEBOAT) {
          const task = world.lifeboatTask ? world.lifeboatTask(state.task) : `${RELEASE}${state.task}`;
          return ok({ messages: [
            { role: 'user', content: [{ type: 'text', text: task }], timestamp: 5_000 },
            say(`RCD3-LIFEBOAT ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: 'run-lifeboat' }, timestamp: 6_000 }),
          ], hasMore: false });
        }
        const messages = state.proof ? proofRows().map((row) => ({ ...row, timestamp: 1_000 })) : [];
        if (state.nonce) messages.push(say(`RCD3-PARENT-RETURN ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: world.parentReturnRun ?? 'run-wake' }, timestamp: 7_000 }));
        return ok({ messages, hasMore: false });
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world, env = {}) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-3-post-compaction.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-3.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-3-safety-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'r-cd-3-safety-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      ...env,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-3 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-3\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('control: the true release chain passes', async () => {
  const { evidence, verdict } = await fire({});
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});

// F4 sibling: the position check alone does not stop a requester that writes
// the whole release composition into its own call; the call itself is refused.
test('F4: a requester sessions_spawn whose task copies the release composition is refused', async () => {
  const { evidence, verdict } = await fire({
    extraProofCalls: (task) => [{ name: 'sessions_spawn', arguments: { runtime: 'subagent', task: `${RELEASE}${task}` } }],
  });
  assert.notEqual(evidence.lifeboat_child_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F4: the same call made through Tool Search\'s dispatch_action is refused', async () => {
  const { verdict } = await fire({
    extraProofCalls: (task) => [{ name: 'dispatch_action', arguments: { id: 'sessions_spawn', args: { runtime: 'subagent', task: `${RELEASE}${task}` } } }],
  });
  assert.notEqual(verdict, 'PASS-candidate');
});
