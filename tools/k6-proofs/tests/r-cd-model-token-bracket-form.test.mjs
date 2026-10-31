// R-CD-MODEL-TOKEN bracket-form binding (karmaterminal/openclaw-bootstrap#1727).
//
// The hop-1 spawn task carries MODEL-TOKEN-HOP1, the whole
// [[CONTINUE_DELEGATE: ... | model=<requested>]] bracket and the word
// "bracket", and the parent's sessions_spawn call carries that task. The
// pre-fix scenario set subagent_spawn_accepted ("sessions_spawn"),
// bracket_token_observed and bracket_model_modifier_observed from any parent
// event with those substrings, so a hop-1 that used the typed tool instead of
// the bracket still proved the token form. The F′ run flipped the spawn flag
// on the parent's own sessions_spawn events.
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes: a continuation delegate's spawn task
// starts "[continuation:chain-hop:N] Delegated task (turn N/M): <task>"
// (src/auto-reply/continuation/delegate-dispatch-request.ts:43). The typed-tool
// test imports nothing added with the fix and runs against the pre-fix tree as
// its negative control (the old wall-clock gate is set to 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cd-model-token-parent';
const HOP1 = 'agent:main:subagent:model-token-hop1';
const DELEGATE = 'agent:main:subagent:continuation-model-token-delegate';
const MODEL = 'openai-codex/gpt-5.5';
const [PROVIDER, MODEL_ID] = MODEL.split('/');

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...extra });

/** world.hop1: 'bracket' | 'typed'; world.delegatePrefix: true when the delegate came through continuation dispatch */
function gatewayFor(world) {
  let childTask = null;
  let nonce = null;
  let delegateTask = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-MODEL-TOKEN']] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        childTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /nonce (R-CD-MODEL-TOKEN-\d+-[a-z0-9]+)/.exec(childTask)[1];
        delegateTask = /\[\[CONTINUE_DELEGATE: ([\s\S]*?) \+\d+s \|/.exec(childTask)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { task: childTask, runtime: 'subagent' } }], __openclaw: { runId: 'run-d' } };
        return [
          ...ok({ runId: 'run-d' }),
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: spawnCall, runId: 'run-d' } },
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: HOP1 }) }], __openclaw: { runId: 'run-d' } }, runId: 'run-d' } },
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: say(`MODEL-TOKEN-PARENT-SPAWNED ${nonce}`, 'run-d'), runId: 'run-d' } },
          // The delegate's own reply on an unscoped connection.
          { type: 'event', event: 'chat', payload: { runId: 'run-g', sessionKey: DELEGATE, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: `MODEL-TOKEN-DELEGATE-DONE ${nonce} MODEL ${MODEL}` }] } } },
        ];
      }
      case 'sessions.list': {
        if (!childTask) return ok({ sessions: [], hasMore: false });
        if (frame.params?.spawnedBy === PARENT) return ok({ sessions: [{ key: HOP1, spawnedBy: PARENT, status: 'done' }], hasMore: false });
        if (frame.params?.spawnedBy === HOP1) return ok({ sessions: [{ key: DELEGATE, spawnedBy: HOP1, status: 'done' }], hasMore: false });
        return ok({ sessions: [], hasMore: false });
      }
      case 'sessions.describe':
        return ok({ session: { key: DELEGATE, modelProvider: PROVIDER, model: MODEL_ID } });
      case 'chat.history': {
        if (frame.params?.sessionKey === HOP1) {
          const rows = [user(`[Subagent Task]\n\n${childTask}`)];
          if (world.hop1 === 'typed') {
            rows.push({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task: delegateTask, model: MODEL } }], __openclaw: { runId: 'run-h' } });
            rows.push({ role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled' }) }], __openclaw: { runId: 'run-h' } });
          }
          rows.push(say(`MODEL-TOKEN-HOP1 ${nonce}${world.hop1 === 'bracket' ? `\n[[CONTINUE_DELEGATE: ${delegateTask} +1s | model=${MODEL}]]` : ''}`, 'run-h'));
          return ok({ messages: rows, hasMore: false });
        }
        if (frame.params?.sessionKey === DELEGATE) {
          const spawn = world.delegatePrefix ? `[continuation:chain-hop:2] Delegated task (turn 2/200): ${delegateTask}` : delegateTask;
          return ok({ messages: [user(spawn), say(`MODEL-TOKEN-DELEGATE-DONE ${nonce} MODEL ${MODEL}`, 'run-g', { provider: PROVIDER, model: MODEL_ID, stopReason: 'stop' })], hasMore: false });
        }
        return ok({ messages: [], hasMore: false });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-model-token.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-model-token.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-model-token-form-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      OPENCLAW_ALT_MODEL: MODEL,
      OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS: '0',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one MODEL-TOKEN evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-MODEL-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: a hop-1 that used the typed tool never proves the token form from the parent\'s own call', async () => {
  const { evidence, verdict } = await fire({ hop1: 'typed', delegatePrefix: true });
  assert.notEqual(evidence.bracket_token_observed, true, 'the bracket substrings only rode the spawn task');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('the true bracket path passes: hop-1 turn without a typed call, continuation-dispatched delegate, requested model served', async () => {
  const { evidence, verdict } = await fire({ hop1: 'bracket', delegatePrefix: true });
  assert.equal(evidence.subagent_spawn_accepted, true);
  assert.equal(evidence.hop1_turn_bound, true);
  assert.equal(evidence.hop1_typed_continue_delegate, false);
  assert.equal(evidence.delegate_task_continuation_prefix, true);
  assert.equal(evidence.bracket_token_observed, true);
  assert.equal(evidence.bracket_model_modifier_observed, true);
  assert.equal(verdict, 'PASS-candidate', evidence.model_classification_reason);
});

test('a delegate without the continuation dispatch prefix is not the bracket path', async () => {
  const { evidence, verdict } = await fire({ hop1: 'bracket', delegatePrefix: false });
  assert.equal(evidence.delegate_task_continuation_prefix, false);
  assert.equal(evidence.bracket_token_observed, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});
