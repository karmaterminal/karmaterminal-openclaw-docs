// R-CD-SILENT readback binding (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (F′ f15237ec92, run 20261030T013909Z-r-cd-silent-44aa4c89): the
// child token was written by the harness into the delegate task and named in
// the dispatch prompt, so the parent carried it in its own continue_delegate
// call. Its follow-up "RCDS-PARENT-OBSERVED <token>" at 18:39:35 proved nothing
// about the silent return reaching its context.
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes: chat events carry
// { runId, sessionKey, spawnedBy, state, message } (src/gateway/server-chat.ts:686-698)
// and reach an unscoped connection for every session; rows carry
// __openclaw.runId. The outbound-only test imports nothing added with the fix
// and runs against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cd-silent-parent';
const CHILD = 'agent:main:subagent:continuation-silentchild01';
const MINTED = 'p0o9i8u7y6t5';

const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const ev = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message, runId } });

/**
 * world.child:  'outbound' (repeats whatever token the task holds, or the placeholder) | 'mints'
 * world.parent: 'outbound' (repeats a token from its own call, or the placeholder) | 'minted' | 'minted-in-dispatch'
 */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (/follow-up nonce/.test(message)) {
          // A token the harness itself wrote into the task (pre-fix shape), else the placeholder.
          const outbound = /return exactly (SILENTCHILD-\S+?)\./.exec(task)?.[1];
          const reply = world.parent === 'outbound'
            ? (outbound ? `RCDS-PARENT-OBSERVED ${outbound}` : `RCDS-PARENT-OBSERVED ${nonce} TOKEN <the TOKEN value from that return>`)
            : `RCDS-PARENT-OBSERVED ${nonce} TOKEN ${MINTED}`;
          const run = world.parent === 'minted-in-dispatch' ? 'run-d' : 'run-f';
          return [...ok({ runId: 'run-f' }), ev(say(reply, run), run)];
        }
        task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /R-CD-SILENT proof nonce (\S+)\./.exec(message)[1];
        const outbound = /return exactly (SILENTCHILD-\S+?)\./.exec(task)?.[1];
        const childText = world.child === 'mints'
          ? `SILENTCHILD ${nonce} TOKEN ${MINTED}`
          : (outbound || `SILENTCHILD ${nonce} TOKEN <your token>`);
        return [
          ...ok({ runId: 'run-d' }),
          ev({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task, mode: 'silent', delaySeconds: 1 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev({ role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'silent' }) }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev(say(`RCDS-SCHEDULED ${nonce}`, 'run-d'), 'run-d'),
          { type: 'event', event: 'chat', payload: { runId: 'run-c', sessionKey: CHILD, spawnedBy: PARENT, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: childText }] } } },
        ];
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-silent.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-silent.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-silent-readback-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CD-SILENT evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CD-SILENT\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: a readback of a token the parent carried in its own call proves no return', async () => {
  const { evidence, verdict } = await fire({ child: 'outbound', parent: 'outbound' });
  assert.notEqual(evidence.parent_internal_context_observed, true, 'the parent only repeated outbound text');
  assert.notEqual(verdict, 'PASS-candidate');
});

test('the true readback passes: the child mints, the follow-up run reproduces it', async () => {
  const { evidence, verdict } = await fire({ child: 'mints', parent: 'minted' });
  assert.equal(evidence.scheduled_receipt_observed, true);
  assert.equal(evidence.scheduled_sentinel, true);
  assert.equal(evidence.child_completion_observed, true);
  assert.equal(evidence.parent_internal_context_observed, true);
  assert.equal(evidence.no_channel_delivery, true);
  assert.equal(verdict, 'PASS-candidate');
  assert.ok(!JSON.stringify(evidence).includes(MINTED), 'the minted token stays out of the evidence');
});

test('a child that only repeats the template has minted nothing', async () => {
  const { evidence, verdict } = await fire({ child: 'outbound', parent: 'minted' });
  assert.equal(evidence.child_completion_observed, false);
  assert.equal(evidence.parent_internal_context_observed, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});

test('the minted token in the dispatch run is not a readback', async () => {
  const { evidence, verdict } = await fire({ child: 'mints', parent: 'minted-in-dispatch' });
  assert.equal(evidence.child_completion_observed, true);
  assert.equal(evidence.parent_internal_context_observed, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});
