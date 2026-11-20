// R-CW-DELEGATE-SELF-CONTINUATION child hops on a Tool Search seat
// (openclaw/openclaw#129388; lane proof-rows-adjudicate-10 finding H1, run 44245772142).
//
// Live: the delegate child's continue_work ran through dispatch_action on emeric
// (openclaw ab5a30ea79), the journal shows its work-wake hop=2, and the row
// recorded child_hops.reason "continue_work result is not \"scheduled\"":
// continueWorkScheduledIndex admitted the dispatch_action row by name and parsed
// the { tool, result } envelope as the answer.
//
// The real scenario (k6 runtime stubbed) binds the child through the observer
// (own spawnedBy + own spawn task) and reads its hops from the child's own
// chat.history, which keeps the result's content text and drops details.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';
import { viaToolSearch } from './helpers/tool-search-envelope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROW = 'R-CW-DELEGATE-SELF-CONTINUATION';
const PARENT = 'agent:main:delegate-self-tool-search';
const CHILD = 'agent:main:subagent:continuation-delegate-self-tool-search';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, timestamp });

function gatewayFor() {
  let task = null;
  let nonce = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS[ROW]] } });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        task = /task="([\s\S]*?)", idempotencyKey=/.exec(message)?.[1] ?? null;
        nonce = /nonce (\S+):/.exec(task || '')?.[1] ?? null;
        return ok({ runId: 'run-d' });
      }
      case 'sessions.list':
        return ok({ sessions: frame.params?.spawnedBy === PARENT && task ? [{ key: CHILD, spawnedBy: PARENT, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey !== CHILD || !task) return ok({ messages: [], hasMore: false });
        const reason = `child hop 2 ${nonce}`;
        return ok({ messages: [
          user(`[Subagent Task]\n\n${task}`),
          { role: 'assistant', content: [{ type: 'toolCall', id: 'cw-child', name: 'continue_work', arguments: { reason, delaySeconds: 5 } }], __openclaw: { runId: 'run-c1' }, timestamp: 2 },
          { role: 'toolResult', toolCallId: 'cw-child', toolName: 'continue_work', isError: false, content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', delaySeconds: 5 }, null, 2) }], __openclaw: { runId: 'run-c1' }, timestamp: 3 },
          say(`CHILD-CW-SCHEDULED ${nonce}`, 'run-c1', 4),
          user(`[continuation:wake] Turn 1/200. The agent elected to continue working. Prior reason: ${JSON.stringify(reason)}`),
          say(`CHILD-HOP2-DONE ${nonce}`, 'run-c2', 10),
        ], hasMore: false });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(wrap = (gateway) => gateway) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cw-delegate-self-continuation.js'),
    gateway: wrap(gatewayFor()),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cw-delegate-self.json'),
      OPENCLAW_GATEWAY_TOKEN: 'delegate-self-tool-search-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: PARENT,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one ${ROW} evidence record:\n${log}`);
  return { evidence: records[0], log };
}

test('direct: the child transcript binds both hops', async () => {
  const { evidence } = await fire();
  assert.equal(evidence.child_spawned, true);
  assert.equal(evidence.child_continue_work_accepted, true, evidence.child_hops?.reason);
  assert.equal(evidence.child_hop_2_woke, true, evidence.child_hops?.reason);
});

test('through Tool Search: the child\'s dispatched continue_work and its envelope bind both hops', async () => {
  const { evidence } = await fire(viaToolSearch);
  assert.equal(evidence.child_continue_work_accepted, true, `run 44245772142 recorded: ${evidence.child_hops?.reason}`);
  assert.equal(evidence.child_hop_2_woke, true, evidence.child_hops?.reason);
  assert.equal(evidence.child_hops.reason, null);
});

test('through Tool Search: an envelope naming another tool is not a scheduled yield', async () => {
  const { evidence } = await fire((gateway) => viaToolSearch(gateway, { envelope: () => ({ name: 'continue_delegate', id: 'openclaw:core:continue_delegate' }) }));
  assert.notEqual(evidence.child_continue_work_accepted, true);
  assert.equal(evidence.child_hops?.reason, 'continue_work result is not "scheduled"');
});
