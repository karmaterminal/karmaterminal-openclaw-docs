// R-CD-4 target ack must come from a run other than the priming run
// (karmaterminal/openclaw-bootstrap#1727).
//
// The target priming prompt names "TARGET-ACK <nonce>", so the priming run
// can restate it. The pre-fix assistant-text path accepted any exact ack in the
// target session (the heartbeat path already excluded the priming run). This
// fires the real scenario (k6 runtime stubbed) against a scripted gateway with
// openclaw f15237ec92 shapes and checks the scenario passes the priming run to
// the authority on the live path and anchors the transcript path.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cd-4-parent';
const TARGET = 'agent:main:r-cd-4-target';
const CHILD = 'agent:main:subagent:continuation-r-cd-4-child';

const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });

/** world.ackRun: 'prime' (the priming run restating its prompt) | 'wake' */
function gatewayFor(world) {
  let created = 0;
  let nonce = null;
  let task = null;
  const targetRows = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-4']] } });
      case 'sessions.create': created += 1; return ok({ key: created === 1 ? PARENT : TARGET });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (frame.params?.key === TARGET) {
          nonce = /priming nonce (\S+)\./.exec(message)[1];
          const ready = say(`TARGET-READY ${nonce}`, 'run-prime');
          targetRows.push({ role: 'user', content: [{ type: 'text', text: message }] }, ready);
          return [...ok({ runId: 'run-prime' }), ev(TARGET, ready, 'run-prime')];
        }
        task = /task:"([\s\S]*?)", mode:/.exec(message)[1];
        const ack = say(`TARGET-ACK ${nonce}`, world.ackRun === 'prime' ? 'run-prime' : 'run-wake');
        targetRows.push(ack);
        return [
          ...ok({ runId: 'run-d' }),
          { type: 'event', event: 'agent', payload: { runId: 'run-d', sessionKey: PARENT, stream: 'lifecycle', data: { phase: 'start' } } },
          ev(TARGET, ack, ack.__openclaw.runId),
        ];
      }
      case 'sessions.list':
        return ok({ sessions: frame.params?.spawnedBy === PARENT && task ? [{ key: CHILD, spawnedBy: PARENT, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey === CHILD) return ok({ messages: [{ role: 'user', content: [{ type: 'text', text: `[Subagent Task]\n\n${task}` }] }], hasMore: false });
        if (frame.params?.sessionKey === TARGET) return ok({ messages: targetRows, hasMore: false });
        return ok({ messages: [], hasMore: false });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-4-target-session-key.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-4.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-4-priming-echo-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      OPENCLAW_CREATE_DISPOSABLE_SESSIONS: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-4 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-4\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('the priming run restating its prompt is never the woken target ack', async () => {
  const { evidence, verdict } = await fire({ ackRun: 'prime' });
  assert.equal(evidence.target_primed, true);
  assert.equal(evidence.target_return_receipt, null);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('an ack from a later target run passes', async () => {
  const { evidence, verdict } = await fire({ ackRun: 'wake' });
  assert.notEqual(evidence.target_return_receipt, null);
  assert.equal(evidence.parent_return_receipt, null);
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});
