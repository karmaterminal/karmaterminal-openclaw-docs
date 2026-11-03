// R-CW-TOKEN binding (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (F′ f15237ec92, run 20261030T014725Z-r-cw-token-44aa4c89): every
// receipt flipped on substrings the parent's own sessions_spawn call carries
// (the spawn task holds TOKEN-HOP1, CONTINUE_WORK and TOKEN-HOP2-DONE), and the
// hop-2 byte matched at 18:47:43.167, 160 ms after the journal's
// `continuation:work-wake hop=1/200` and before any hop-2 reply could exist.
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes: sessions_spawn answers
// {"status":"accepted","childSessionKey":...} (src/agents/tools/sessions-spawn-tool.ts:110-126),
// rows carry __openclaw.runId, the tool-start agent item carries a title/meta
// derived from the arguments, and an unscoped connection receives agent events
// for every session (src/gateway/server/client-registry.ts:60-66). The echo
// test imports nothing added with the fix and runs against the pre-fix tree as
// its negative control (with the old clock gate set to 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cw-token-parent';
const CHILD = 'agent:main:subagent:r-cw-token-child';
const MINTED = 'm1n2b3v4c5x6';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, timestamp });
const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });

/**
 * world:
 *   childRows: 'none' | 'true' | 'typed' | 'same-run'
 *   parentReturnRun: 'wake' | 'dispatch' | null
 */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
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
        // Live child rows once the harness subscribes to the child key.
        return [...ok({ subscribed: true }), ...childHistory.map((row) => ev(CHILD, row, row.__openclaw?.runId))];
      }
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(task)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task, lightContext: true, cleanup: 'delete' } }], __openclaw: { runId: 'run-d' } };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: CHILD, runId: 'run-c1' }, null, 2) }], __openclaw: { runId: 'run-d' } };
        parentHistory = [user(message), { ...spawnCall, timestamp: 1 }, { ...spawnResult, timestamp: 2 }, say(`PARENT-SPAWNED ${nonce}`, 'run-d', 3)];
        if (world.childRows === 'true' || world.childRows === 'typed' || world.childRows === 'same-run') {
          childHistory = [user(task), say(`TOKEN-HOP1 ${nonce}`, 'run-c1', 10)];
          if (world.childRows === 'typed') {
            childHistory.splice(1, 0, { role: 'assistant', content: [{ type: 'toolCall', id: 'cw', name: 'continue_work', arguments: { delaySeconds: 5 } }], __openclaw: { runId: 'run-c1' } });
          }
          if (world.childRows === 'same-run') {
            childHistory.push(say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${MINTED}`, 'run-c1', 12));
          } else {
            childHistory.push(user('[continuation:wake] Turn 1/200. The agent elected to continue working. [provenance] Disposition: granted'));
            childHistory.push(say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${MINTED}`, 'run-c2', 20));
          }
        }
        if (world.parentReturnRun) {
          parentHistory.push(say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${MINTED}`, world.parentReturnRun === 'wake' ? 'run-p2' : 'run-d', 30));
        }
        return [
          ...ok({ runId: 'run-d' }),
          ev(PARENT, spawnCall, 'run-d'),
          ev(PARENT, spawnResult, 'run-d'),
          ev(PARENT, say(`PARENT-SPAWNED ${nonce}`, 'run-d'), 'run-d'),
          // The F′ echo shapes: the spawn task on the child's tool-start/lifecycle
          // stream at wake time, and on the parent's stream.
          { type: 'event', event: 'agent', payload: { runId: 'run-c2', sessionKey: CHILD, stream: 'item', data: { title: 'wake', meta: { task } } } },
          { type: 'event', event: 'chat', payload: { runId: 'run-d', sessionKey: PARENT, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: task }] } } },
        ];
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
      OPENCLAW_GATEWAY_TOKEN: 'r-cw-token-binding-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      // The pre-fix scenario gated its substring checks on a wall clock; the
      // stubbed runtime runs in virtual time, so open that gate for the control.
      OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS: '0',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CW-TOKEN evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CW-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: the parent\'s own sessions_spawn call and stream echoes never prove hop 2 or a return', async () => {
  const { evidence, verdict } = await fire({ childRows: 'none', parentReturnRun: null });
  assert.notEqual(verdict, 'PASS-candidate', 'the spawn task substrings must not produce a token-path PASS');
  assert.notEqual(evidence.hop_2_executed, true);
  assert.notEqual(evidence.parent_return, true);
});

test('the true chain passes: spawn receipt, child hop 1, wake, minted hop-2 token, parent reproduces it', async () => {
  const { evidence, verdict } = await fire({ childRows: 'true', parentReturnRun: 'wake' });
  assert.equal(evidence.subagent_spawn_accepted, true);
  assert.equal(evidence.token_emitted_or_stripped, true);
  assert.equal(evidence.hop_2_executed, true, evidence.hop_reason);
  assert.equal(evidence.parent_return, true, evidence.parent_return_reason);
  assert.equal(verdict, 'PASS-candidate');
  assert.ok(!JSON.stringify(evidence).includes(MINTED), 'the minted token stays out of the evidence');
});

test('a typed continue_work call in the child does not prove the token form', async () => {
  const { evidence, verdict } = await fire({ childRows: 'typed', parentReturnRun: 'wake' });
  assert.equal(evidence.child_typed_continue_work_observed, true);
  assert.equal(evidence.hop_2_executed, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});

test('hop 2 in hop 1\'s run with no wake row is not a wake', async () => {
  const { evidence, verdict } = await fire({ childRows: 'same-run', parentReturnRun: 'wake' });
  assert.equal(evidence.hop_2_executed, false);
  assert.match(evidence.hop_reason, /neither after a \[continuation:wake\] row nor in a run other than hop 1/);
  assert.equal(verdict, 'PARTIAL-candidate');
});

test('the hop-2 token reproduced only in the dispatch run is not a return', async () => {
  const { evidence, verdict } = await fire({ childRows: 'true', parentReturnRun: 'dispatch' });
  assert.equal(evidence.hop_2_executed, true);
  assert.equal(evidence.parent_return, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});
