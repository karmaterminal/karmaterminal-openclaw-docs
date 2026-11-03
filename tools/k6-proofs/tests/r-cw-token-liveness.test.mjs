// R-CW-TOKEN must still bind a true chain whose child transcript is deleted
// before a second read (karmaterminal/openclaw-bootstrap#1727, independent
// review of the F3 fix).
//
// The child is spawned with cleanup="delete"; at openclaw f15237ec92 delete
// cleanup removes the child's transcript after its completion announce
// (subagent-registry-lifecycle-announce-cleanup.ts:288). The F3 fix decided
// hop 2 only from chat.history reads, so a true hop 2 written after the
// first read and deleted before the next was never bound. The live rows of
// the child subscription extend a read sent after that subscription was
// acknowledged; together they hold the whole transcript. Imports predate
// the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:liveness-r-cw-token-parent';
const CHILD = 'agent:main:subagent:liveness-r-cw-token-child';
const MINTED = 'p0o9i8u7y6t5';
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, timestamp });
const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });

/** world.typedLive: hop 1's typed continue_work call arrives live after the first read. */
function gatewayFor(world) {
  let childReads = 0;
  let task = null;
  let nonce = null;
  let parentHistory = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(task)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task, context: 'isolated', cleanup: 'delete' } }], __openclaw: { runId: 'run-d' }, timestamp: 1 };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: CHILD }) }], __openclaw: { runId: 'run-d' }, timestamp: 2 };
        parentHistory = [user(message), spawnCall, spawnResult, say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${MINTED}`, 'run-p2', 30)];
        return [...ok({ runId: 'run-d' }), ev(PARENT, spawnCall, 'run-d'), ev(PARENT, spawnResult, 'run-d')];
      }
      case 'chat.history': {
        if (frame.params?.sessionKey !== CHILD) return ok({ messages: parentHistory, hasMore: false });
        childReads += 1;
        // The first read sees only the spawn task; the chain then runs (live), and the
        // completion announce deletes the transcript before any later read.
        if (childReads > 1) return [{ type: 'res', id: frame.id, ok: false, error: { code: 'NOT_FOUND', message: 'session not found' } }];
        const live = [
          ...(world.typedLive ? [{ role: 'assistant', content: [{ type: 'toolCall', id: 'cw-1', name: 'continue_work', arguments: { delaySeconds: 5, reason: 'hop 2' } }], __openclaw: { runId: 'run-c1' }, timestamp: 8 }] : []),
          say(`TOKEN-HOP1 ${nonce}`, 'run-c1', 10),
          user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
          say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${MINTED}`, 'run-c2', 20),
        ];
        return [...ok({ messages: [user(`[Subagent Task] ${task}`)], hasMore: false }), ...live.map((row) => ev(CHILD, row, row.__openclaw?.runId))];
      }
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
      OPENCLAW_GATEWAY_TOKEN: 'liveness-r-cw-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'liveness-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CW-TOKEN evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CW-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('a true chain whose child transcript is deleted after the first read still binds from that read plus the live rows', async () => {
  const { evidence, verdict } = await fire({ typedLive: false });
  assert.equal(evidence.hop_2_executed, true, evidence.hop_reason);
  assert.equal(verdict, 'PASS-candidate');
});

test('a typed continue_work call that arrives live after the read still refuses the token form', async () => {
  const { evidence, verdict } = await fire({ typedLive: true });
  assert.equal(evidence.child_typed_continue_work_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});
