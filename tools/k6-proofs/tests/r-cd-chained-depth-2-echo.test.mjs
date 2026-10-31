// R-CD-CHAINED-DEPTH-2 hop sentinels come from each hop's own transcript
// (karmaterminal/openclaw-bootstrap#1727).
//
// Both hop sentinels are written into the root's own continue_delegate task
// ("... reply exactly GRANDCHILD-DONE <nonce> ... reply exactly CHILD-DONE
// <nonce> CHILD-DELEGATE-SCHEDULED"), so the root's call, its tool-start meta
// and the return's task: line all carry them. The pre-fix scenario credited
// both from any root event 1.5 s after dispatch, and credited ROOT-CHAIN-ACK
// from any root assistant text, the dispatch run included.
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes. The echo test imports nothing added
// with the fix and runs against the pre-fix tree as its negative control (the
// old wall-clock gate is set to 0 for the stubbed virtual clock).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = 'agent:main:r-cd-chain-root';
const CHILD = 'agent:main:subagent:continuation-chain-child';
const GRANDCHILD = 'agent:main:subagent:continuation-chain-grandchild';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const rootEvent = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: ROOT, message, runId } });

/** world.hops: true when the child and grandchild answer in their own transcripts; world.ackRun: 'dispatch' | 'wake' */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-CHAINED-DEPTH-2']] } });
      case 'sessions.create': return ok({ key: ROOT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /Chain proof nonce (\S+)\./.exec(message)[1];
        const ackRun = world.ackRun === 'wake' ? 'run-w' : 'run-d';
        return [
          ...ok({ runId: 'run-d' }),
          rootEvent({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task, mode: 'silent-wake', delaySeconds: 1 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          { type: 'event', event: 'agent', payload: { runId: 'run-d', sessionKey: ROOT, stream: 'item', data: { name: 'continue_delegate', meta: { task } } } },
          rootEvent(say(`ROOT-READY ${nonce}`, 'run-d'), 'run-d'),
          rootEvent(say(`ROOT-CHAIN-ACK ${nonce}`, ackRun), ackRun),
        ];
      }
      case 'sessions.list': {
        if (!task) return ok({ sessions: [], hasMore: false });
        if (frame.params?.spawnedBy === ROOT) return ok({ sessions: [{ key: CHILD, spawnedBy: ROOT, status: 'done' }], hasMore: false });
        if (frame.params?.spawnedBy === CHILD) return ok({ sessions: [{ key: GRANDCHILD, spawnedBy: CHILD, status: 'done' }], hasMore: false });
        return ok({ sessions: [], hasMore: false });
      }
      case 'chat.history': {
        const grandchildTask = /task='([^']*)'/.exec(task || '')?.[1] || '';
        if (frame.params?.sessionKey === CHILD) {
          const rows = [user(`[Subagent Task]\n\n${task}`)];
          if (world.hops) {
            rows.push(
              { role: 'assistant', content: [{ type: 'toolCall', id: 'cd-2', name: 'continue_delegate', arguments: { task: grandchildTask, mode: 'silent-wake' } }], __openclaw: { runId: 'run-c' } },
              { role: 'toolResult', toolCallId: 'cd-2', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled' }) }], __openclaw: { runId: 'run-c' } },
              say(`CHILD-DONE ${nonce} CHILD-DELEGATE-SCHEDULED`, 'run-c'),
            );
          }
          return ok({ messages: rows, hasMore: false });
        }
        if (frame.params?.sessionKey === GRANDCHILD) {
          const rows = [user(`[Subagent Task]\n\n${grandchildTask}`)];
          if (world.hops) rows.push(say(`GRANDCHILD-DONE ${nonce}`, 'run-g'));
          return ok({ messages: rows, hasMore: false });
        }
        return ok({ messages: [], hasMore: false });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-chained-depth-2.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-chained-depth-2.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-chain-echo-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS: '0',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one chain evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-CHAINED-DEPTH-2\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: hop sentinels in the root\'s own call and an ack in the dispatch run prove no chain', async () => {
  const { evidence, verdict } = await fire({ hops: false, ackRun: 'dispatch' });
  assert.equal(evidence.child_session !== null && evidence.grandchild_session !== null, true, 'the lineage itself is real');
  assert.notEqual(verdict, 'PASS-candidate', 'the root\'s own outbound text must not complete the chain');
  assert.notEqual(evidence.child_done_sentinel, true);
  assert.notEqual(evidence.grandchild_done_sentinel, true);
});

test('the true chain passes: each hop answers in its own transcript, the root acks in a later run', async () => {
  const { evidence, verdict } = await fire({ hops: true, ackRun: 'wake' });
  assert.equal(evidence.child_done_sentinel, true);
  assert.equal(evidence.grandchild_done_sentinel, true);
  assert.notEqual(evidence.root_return_receipt, null);
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});

test('hop answers alone, with the root ack only in the dispatch run, do not pass', async () => {
  const { evidence, verdict } = await fire({ hops: true, ackRun: 'dispatch' });
  assert.equal(evidence.child_done_sentinel, true);
  assert.equal(evidence.root_return_receipt, null);
  assert.equal(verdict, 'PARTIAL-candidate');
});
