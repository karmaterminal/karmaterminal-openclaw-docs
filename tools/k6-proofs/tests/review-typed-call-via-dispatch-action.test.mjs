// Independent review of the sentinel-echo fixes (karmaterminal/openclaw-bootstrap#1727).
//
// FINDING: the token-form rows prove "not the typed tool" by looking for a
// toolCall NAMED continue_delegate / continue_work. With Tool Search on, the
// typed tools are not called by name: only `message` stays a direct tool
// (openclaw f15237ec92 src/agents/tool-surface-plan.ts:145-150) and every other
// call is recorded under the raw dispatcher name `dispatch_action` with
// arguments { id: "<tool>", args } (src/agents/tool-catalog.ts:29;
// src/agents/tool-display-call.ts:5-13 unwraps it for display only, "without
// changing invocation identity"). R-CD-2's and R-CD-4's own F′ prompts tell
// the agent to reach continue_delegate exactly that way.
//
//   - R-CD-MODEL-TOKEN: typedContinueDelegate (scenarios/r-cd-model-token.js:36-41)
//     matches only `continue_delegate` / `*__continue_delegate`. The other half
//     of its token-form proof, the delegate's "[continuation:chain-hop:" task
//     prefix, does not discriminate: the typed tool writes the same prefix
//     (src/auto-reply/continuation/delegate-dispatch-request.ts:43), and the
//     bracket path enqueues into the same composer.
//   - R-CW-TOKEN: typedContinueWork (lib/continue-work-chain.mjs:116-121)
//     matches only `continue_work` / `*__continue_work`.
//
// So a hop that reached the typed tool through dispatch_action is credited as
// the bracket / bare-token form. These tests assert the desired contract and
// FAIL on codeagent/harness-review at 3283454d; the controls (the same typed
// call recorded by name) pass.
//
// The same name-only matching makes every positive receipt
// (sentinel-binding.mjs boundToolCalls/toolNameMatches) fail closed on a Tool
// Search seat: no false PASS there, but those rows cannot reach PASS.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...extra });

/** A typed tool call as the transcript records it: by name, or through Tool Search's dispatcher. */
function typedCall(id, tool, args, via) {
  return via === 'dispatch_action'
    ? { type: 'toolCall', id, name: 'dispatch_action', arguments: { id: tool, args } }
    : { type: 'toolCall', id, name: tool, arguments: args };
}

// ---------------------------------------------------------------------------
// R-CD-MODEL-TOKEN
// ---------------------------------------------------------------------------

const MT_PARENT = 'agent:main:review-model-token-parent';
const MT_HOP1 = 'agent:main:subagent:review-model-token-hop1';
const MT_DELEGATE = 'agent:main:subagent:continuation-review-model-token-delegate';
const MODEL = 'openai-codex/gpt-5.5';
const [PROVIDER, MODEL_ID] = MODEL.split('/');

/** world.via: how hop-1 called the typed continue_delegate tool ('dispatch_action' | 'name'). */
function modelTokenGateway(world) {
  let childTask = null;
  let nonce = null;
  let delegateTask = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-MODEL-TOKEN']] } });
      case 'sessions.create': return ok({ key: MT_PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        childTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /nonce (R-CD-MODEL-TOKEN-\d+-[a-z0-9]+)/.exec(childTask)[1];
        delegateTask = /\[\[CONTINUE_DELEGATE: ([\s\S]*?) \+\d+s \|/.exec(childTask)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { task: childTask, runtime: 'subagent', context: 'isolated' } }], __openclaw: { runId: 'run-d' } };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: MT_HOP1 }) }], __openclaw: { runId: 'run-d' } };
        return [
          ...ok({ runId: 'run-d' }),
          { type: 'event', event: 'session.message', payload: { sessionKey: MT_PARENT, message: spawnCall, runId: 'run-d' } },
          { type: 'event', event: 'session.message', payload: { sessionKey: MT_PARENT, message: spawnResult, runId: 'run-d' } },
          { type: 'event', event: 'chat', payload: { runId: 'run-g', sessionKey: MT_DELEGATE, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: `MODEL-TOKEN-DELEGATE-DONE ${nonce} MODEL ${MODEL}` }] } } },
        ];
      }
      case 'sessions.list': {
        if (!childTask) return ok({ sessions: [], hasMore: false });
        if (frame.params?.spawnedBy === MT_PARENT) return ok({ sessions: [{ key: MT_HOP1, spawnedBy: MT_PARENT, status: 'done' }], hasMore: false });
        if (frame.params?.spawnedBy === MT_HOP1) return ok({ sessions: [{ key: MT_DELEGATE, spawnedBy: MT_HOP1, status: 'done' }], hasMore: false });
        return ok({ sessions: [], hasMore: false });
      }
      case 'sessions.describe':
        return ok({ session: { key: MT_DELEGATE, modelProvider: PROVIDER, model: MODEL_ID } });
      case 'chat.history': {
        if (frame.params?.sessionKey === MT_HOP1) {
          // Hop-1 ignored "Do not call continue_delegate tool" and used the typed tool; no bracket.
          return ok({ messages: [
            user(`[Subagent Task]\n\n${childTask}`),
            { role: 'assistant', content: [typedCall('cd-1', 'continue_delegate', { task: delegateTask, delaySeconds: 1, model: MODEL }, world.via)], __openclaw: { runId: 'run-h' } },
            { role: 'toolResult', toolCallId: 'cd-1', toolName: world.via === 'dispatch_action' ? 'dispatch_action' : 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'normal', delaySeconds: 1, model: MODEL }) }], __openclaw: { runId: 'run-h' } },
            say(`MODEL-TOKEN-HOP1 ${nonce}`, 'run-h'),
          ], hasMore: false });
        }
        if (frame.params?.sessionKey === MT_DELEGATE) {
          // The typed tool composes the same chain-hop prefix as the bracket path.
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

async function fireModelToken(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-model-token.js'),
    gateway: modelTokenGateway(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-model-token.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-model-token-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'review-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      OPENCLAW_ALT_MODEL: MODEL,
      // The return_payload diagnostic gate reads Date.now(), which the virtual runtime does not advance.
      OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS: '0',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one MODEL-TOKEN evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-MODEL-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('REVIEW R-CD-MODEL-TOKEN: a typed continue_delegate reached through dispatch_action is not the bracket form', async () => {
  const { evidence, verdict } = await fireModelToken({ via: 'dispatch_action' });
  assert.equal(evidence.hop1_typed_continue_delegate, true,
    'hop-1 called the typed continue_delegate tool through Tool Search; the name-only check missed it');
  assert.notEqual(evidence.bracket_token_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control R-CD-MODEL-TOKEN: the same typed call recorded by name is refused', async () => {
  const { evidence, verdict } = await fireModelToken({ via: 'name' });
  assert.equal(evidence.hop1_typed_continue_delegate, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

// ---------------------------------------------------------------------------
// R-CW-TOKEN
// ---------------------------------------------------------------------------

const CT_PARENT = 'agent:main:review-cw-token-dispatch-parent';
const CT_CHILD = 'agent:main:subagent:review-cw-token-dispatch-child';
const MINTED = 'r5t6y7u8i9o0';

/** world.via: how the child called the typed continue_work tool ('dispatch_action' | 'name'). */
function cwTokenGateway(world) {
  let childHistory = [];
  let parentHistory = [];
  const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: CT_PARENT });
      case 'sessions.messages.subscribe': {
        if (frame.params?.key !== CT_CHILD) return ok({ subscribed: true });
        return [...ok({ subscribed: true }), ...childHistory.slice(1).map((row) => ev(CT_CHILD, row, row.__openclaw?.runId))];
      }
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        const nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(task)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task, context: 'isolated' } }], __openclaw: { runId: 'run-d' }, timestamp: 1 };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: CT_CHILD, runId: 'run-c1' }) }], __openclaw: { runId: 'run-d' }, timestamp: 2 };
        childHistory = [
          user(`[Subagent Task] ${task}`),
          // The child ignored "Do not call the continue_work tool": the typed tool scheduled hop 2.
          { role: 'assistant', content: [typedCall('cw-1', 'continue_work', { delaySeconds: 5, reason: 'hop 2' }, world.via)], __openclaw: { runId: 'run-c1' }, timestamp: 8 },
          { role: 'toolResult', toolCallId: 'cw-1', toolName: world.via === 'dispatch_action' ? 'dispatch_action' : 'continue_work', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', delaySeconds: 5 }) }], __openclaw: { runId: 'run-c1' }, timestamp: 9 },
          say(`TOKEN-HOP1 ${nonce}`, 'run-c1', { timestamp: 10 }),
          user('[continuation:wake] Turn 1/10. The agent elected to continue working. Prior reason: "hop 2"'),
          say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${MINTED}`, 'run-c2', { timestamp: 20 }),
        ];
        parentHistory = [user(message), spawnCall, spawnResult, say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${MINTED}`, 'run-p2', { timestamp: 30 })];
        return [...ok({ runId: 'run-d' }), ev(CT_PARENT, spawnCall, 'run-d'), ev(CT_PARENT, spawnResult, 'run-d')];
      }
      case 'chat.history':
        return ok({ messages: frame.params?.sessionKey === CT_CHILD ? childHistory : parentHistory, hasMore: false });
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fireCwToken(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cw-token-bracket.js'),
    gateway: cwTokenGateway(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cw-token.json'),
      OPENCLAW_GATEWAY_TOKEN: 'review-cw-token-dispatch-token',
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

test('REVIEW R-CW-TOKEN: a typed continue_work reached through dispatch_action is not the bare-token form', async () => {
  const { evidence, verdict } = await fireCwToken({ via: 'dispatch_action' });
  assert.equal(evidence.child_typed_continue_work_observed, true,
    'the child called the typed continue_work tool through Tool Search; the name-only check missed it');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('REVIEW control R-CW-TOKEN: the same typed call recorded by name is refused', async () => {
  const { evidence, verdict } = await fireCwToken({ via: 'name' });
  assert.equal(evidence.child_typed_continue_work_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});
