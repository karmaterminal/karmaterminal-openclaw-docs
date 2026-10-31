// R-CD-MODEL-TOKEN re-reads hop 1 after it settles (karmaterminal/openclaw-bootstrap#1727,
// harness review N10).
//
// The scenario stopped reading hop 1's transcript as soon as MODEL-TOKEN-HOP1
// bound. A typed continue_delegate call persisted later in the same turn was
// then never seen, and the delegate it created passed as the bracket form.
// The world here: hop 1 says its sentinel first, then calls the typed tool;
// the delegate appears (and the call row is in the transcript) only after the
// scenario's first hop-1 read. The test imports nothing added with the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:late-call-model-token-parent';
const HOP1 = 'agent:main:subagent:late-call-model-token-hop1';
const DELEGATE = 'agent:main:subagent:continuation-late-call-model-token-delegate';
const MODEL = 'openai-codex/gpt-5.5';
const [PROVIDER, MODEL_ID] = MODEL.split('/');
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...extra });

/** world.lateTypedCall: hop 1 calls the typed tool after its sentinel. */
function gatewayFor(world) {
  let childTask = null;
  let nonce = null;
  let delegateTask = null;
  let hop1Reads = 0;
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
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { task: childTask, runtime: 'subagent', context: 'isolated' } }], __openclaw: { runId: 'run-d' } };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: HOP1 }) }], __openclaw: { runId: 'run-d' } };
        return [
          ...ok({ runId: 'run-d' }),
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: spawnCall, runId: 'run-d' } },
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: spawnResult, runId: 'run-d' } },
          { type: 'event', event: 'chat', payload: { runId: 'run-g', sessionKey: DELEGATE, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: `MODEL-TOKEN-DELEGATE-DONE ${nonce} MODEL ${MODEL}` }] } } },
        ];
      }
      case 'sessions.list': {
        if (!childTask) return ok({ sessions: [], hasMore: false });
        if (frame.params?.spawnedBy === PARENT) return ok({ sessions: [{ key: HOP1, spawnedBy: PARENT, status: 'running' }], hasMore: false });
        // The delegate exists only after the scenario has read hop 1 once (the observer reads it first).
        if (frame.params?.spawnedBy === HOP1) return ok({ sessions: hop1Reads >= 2 ? [{ key: DELEGATE, spawnedBy: HOP1, status: 'done' }] : [], hasMore: false });
        return ok({ sessions: [], hasMore: false });
      }
      case 'sessions.describe':
        return ok({ session: { key: DELEGATE, modelProvider: PROVIDER, model: MODEL_ID } });
      case 'chat.history': {
        if (frame.params?.sessionKey === HOP1) {
          hop1Reads += 1;
          const rows = [user(`[Subagent Task]\n\n${childTask}`), say(`MODEL-TOKEN-HOP1 ${nonce}`, 'run-h')];
          if (world.lateTypedCall && hop1Reads >= 3) {
            rows.push(
              { role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task: delegateTask, delaySeconds: 1, model: MODEL } }], __openclaw: { runId: 'run-h' } },
              { role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'normal', model: MODEL }) }], __openclaw: { runId: 'run-h' } },
            );
          }
          return ok({ messages: rows, hasMore: false });
        }
        if (frame.params?.sessionKey === DELEGATE) {
          return ok({ messages: [
            user(`[continuation:chain-hop:2] Delegated task (turn 2/10): ${delegateTask}`),
            say(`MODEL-TOKEN-DELEGATE-DONE ${nonce} MODEL ${MODEL}`, 'run-g', { provider: PROVIDER, model: MODEL_ID, stopReason: 'stop' }),
          ], hasMore: false });
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
      OPENCLAW_GATEWAY_TOKEN: 'late-call-model-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'late-call-seat',
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

test('N10: a typed continue_delegate persisted after hop 1\'s sentinel is seen, and the token form is refused', async () => {
  const { evidence, verdict } = await fire({ lateTypedCall: true });
  assert.equal(evidence.hop1_typed_continue_delegate, true, 'the late typed call was never read');
  assert.notEqual(evidence.bracket_token_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('N10 control: the same timing with no typed call still binds the bracket form', async () => {
  const { evidence, verdict } = await fire({ lateTypedCall: false });
  assert.equal(evidence.bracket_token_observed, true);
  assert.equal(verdict, 'PASS-candidate');
});
