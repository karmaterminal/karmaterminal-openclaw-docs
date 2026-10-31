// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727).
//
// FINDING (fail-closed): the run exclusion that keeps a dispatch run's prompt
// restatement out of a "woken" acknowledgement is silently disabled when the
// dispatch run id is missing. R-CD-CHAINED-DEPTH-2 sets
//   evidence.dispatch_run_id = typeof payload.runId === 'string' ? payload.runId : null
// from the sessions.send response (scenarios/r-cd-chained-depth-2.js:358), then
// passes excludeRunIds: [evidence.dispatch_run_id] to
// rCdChainRootReturnCandidate and the heartbeat tracker. Both filter(Boolean)
// the list, so [null] excludes nothing: any stamped root row saying
// ROOT-CHAIN-ACK <nonce>, the dispatch run included, binds the root return.
// ROOT-CHAIN-ACK is a prompt-only sentinel (the dispatch prompt names it), so
// run exclusion is its only guard: missing evidence turns into PASS.
//
// The same [null] shape sits in R-CD-1, R-CD-3, R-CD-SILENT and R-CW-TOKEN,
// where the minted token's timestamp/knowledge keeps it harmless, and in
// R-CD-4 when the priming row is unstamped.
//
// This test asserts the desired contract (no dispatch run id => the root ack
// cannot be bound) and FAILS on codeagent/harness-review at 3283454d. The
// control (a run id present) passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = 'agent:main:review-chain-root';
const CHILD = 'agent:main:subagent:continuation-review-chain-child';
const GRANDCHILD = 'agent:main:subagent:continuation-review-chain-grandchild';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const rootEvent = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: ROOT, message, runId } });

/** world.sendRunId: the runId field of the sessions.send response (undefined = absent). The ack is in the dispatch run. */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
  let ackSent = false;
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
        return [
          ...ok(world.sendRunId === undefined ? { status: 'started' } : { runId: world.sendRunId }),
          rootEvent({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task, mode: 'silent-wake', delaySeconds: 1 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          rootEvent(say(`ROOT-READY ${nonce}`, 'run-d'), 'run-d'),
        ];
      }
      case 'sessions.list': {
        if (!task) return ok({ sessions: [], hasMore: false });
        if (frame.params?.spawnedBy === ROOT) {
          // Seconds after dispatch (the first observer poll, past the 1.5 s
          // evidence gate), the dispatch run restates its prompt, which names the ack.
          const ack = ackSent ? [] : [rootEvent(say(`ROOT-CHAIN-ACK ${nonce}`, 'run-d'), 'run-d')];
          ackSent = true;
          return [...ack, ...ok({ sessions: [{ key: CHILD, spawnedBy: ROOT, status: 'done' }], hasMore: false })];
        }
        if (frame.params?.spawnedBy === CHILD) return ok({ sessions: [{ key: GRANDCHILD, spawnedBy: CHILD, status: 'done' }], hasMore: false });
        return ok({ sessions: [], hasMore: false });
      }
      case 'chat.history': {
        const grandchildTask = /task='([^']*)'/.exec(task || '')?.[1] || '';
        if (frame.params?.sessionKey === CHILD) {
          return ok({ messages: [
            user(`[Subagent Task]\n\n${task}`),
            { role: 'assistant', content: [{ type: 'toolCall', id: 'cd-2', name: 'continue_delegate', arguments: { task: grandchildTask, mode: 'silent-wake' } }], __openclaw: { runId: 'run-c' } },
            { role: 'toolResult', toolCallId: 'cd-2', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled' }) }], __openclaw: { runId: 'run-c' } },
            say(`CHILD-DONE ${nonce} CHILD-DELEGATE-SCHEDULED`, 'run-c'),
          ], hasMore: false });
        }
        if (frame.params?.sessionKey === GRANDCHILD) {
          return ok({ messages: [user(`[Subagent Task]\n\n${grandchildTask}`), say(`GRANDCHILD-DONE ${nonce}`, 'run-g')], hasMore: false });
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
      OPENCLAW_GATEWAY_TOKEN: 'review-chain-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'review-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      // The 1.5 s evidence gate reads Date.now(), which the virtual runtime
      // does not advance; a real dispatch run speaks seconds after dispatch.
      // (r-cd-chained-depth-2-echo.test.mjs opens the gate the same way.)
      OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS: '0',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one chain evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-CHAINED-DEPTH-2\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('REVIEW CHAINED-DEPTH-2: without a dispatch run id the dispatch run\'s own ack cannot bind the root return', async () => {
  const { evidence, verdict } = await fire({ sendRunId: undefined });
  assert.equal(evidence.dispatch_run_id, null, 'precondition: sessions.send gave no run id');
  assert.equal(evidence.root_return_receipt, null,
    'with no dispatch run id to exclude, the dispatch run restating its prompt became the "woken" root ack');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control CHAINED-DEPTH-2: with the dispatch run id present the same ack is refused', async () => {
  const { evidence, verdict } = await fire({ sendRunId: 'run-d' });
  assert.equal(evidence.root_return_receipt, null);
  assert.equal(verdict, 'PARTIAL-candidate');
});
