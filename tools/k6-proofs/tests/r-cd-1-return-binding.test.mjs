// R-CD-1 return binding (karmaterminal/openclaw-bootstrap#1727).
//
// The return sentinel used to be written into the delegate task
// ("reply exactly CD1-DONE <nonce>"), so the parent's own continue_delegate
// call, its tool-start meta and the return's task: line all carried it; only a
// timing window (scheduled + delegate delay) kept the call-time echo out, and
// nothing kept out a later restatement. The F′ canonical run refused four
// call-time echoes by window alone.
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes. The echo test uses delay 0 so no
// clock window hides the echo, imports nothing added with the fix, and runs
// against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-cd-1-parent';
const CHILD = 'agent:main:subagent:continuation-r-cd-1-child';
const MINTED = 'z9x8c7v6b5n4';

function manifestDelayZero() {
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifests', 'r-cd-1.json'), 'utf8'));
  manifest.invocation = { ...manifest.invocation, delaySeconds: 0 };
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'r-cd-1-return-')), 'r-cd-1.json');
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, timestamp });
const ev = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message, runId } });

/** world.child: 'mints' | 'silent'; world.parent: 'restates-task' | 'reproduces' */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-1']] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        task = /task="([\s\S]*?)", mode=/.exec(message)[1];
        nonce = /(R-CD-1-\d+-[a-z0-9]+)/.exec(task)[1];
        // The woken parent run restating the return's task: line (what a model can
        // do with the hidden `task: <spawned task>` it is shown), or reproducing the token.
        const later = world.parent === 'reproduces'
          ? `CD1-RETURN ${nonce} TOKEN ${MINTED}`
          : `The delegate finished its task: ${task}`;
        return [
          ...ok({ runId: 'run-d' }),
          ev({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task, mode: 'normal', delaySeconds: 0 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev({ role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'normal' }) }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev(say(`CD1-DELEGATE-SCHEDULED ${nonce}`, 'run-d'), 'run-d'),
          ev(say(later, 'run-w'), 'run-w'),
        ];
      }
      case 'sessions.list':
        return ok({ sessions: frame.params?.spawnedBy === PARENT && task ? [{ key: CHILD, spawnedBy: PARENT, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey === CHILD) {
          const rows = [user(`[Subagent Task]\n\n${task}`)];
          if (world.child === 'mints') rows.push(say(`CD1-DONE ${nonce} TOKEN ${MINTED}`, 'run-c', 5));
          return ok({ messages: rows, hasMore: false });
        }
        const rows = [user('dispatch'), say(`CD1-DELEGATE-SCHEDULED ${nonce}`, 'run-d', 2)];
        if (world.parent === 'reproduces') rows.push(say(`CD1-RETURN ${nonce} TOKEN ${MINTED}`, 'run-w', 6));
        return ok({ messages: rows, hasMore: false });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-1-typed-delegate.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: manifestDelayZero(),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-1-return-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      OPENCLAW_TRACE_INGEST_GRACE_MS: '1',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-1 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-1\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: a parent run restating the task never stands in for the child\'s return', async () => {
  const { evidence, verdict } = await fire({ child: 'silent', parent: 'restates-task' });
  assert.notEqual(verdict, 'PASS-candidate', 'the return sentinel only rode the task text');
  assert.notEqual(evidence.parent_return_event, true);
});

test('the true return passes: the child mints, a later parent run reproduces it', async () => {
  const { evidence, verdict } = await fire({ child: 'mints', parent: 'reproduces' });
  assert.equal(evidence.scheduled_receipt_observed, true);
  assert.equal(evidence.delegate_scheduled_sentinel, true);
  assert.equal(evidence.child_return_bound, true, evidence.child_return_reason);
  assert.equal(evidence.parent_return_event, true, evidence.parent_return_reason);
  assert.equal(verdict, 'PASS-candidate');
  assert.ok(!JSON.stringify(evidence).includes(MINTED));
});

test('a child return the parent never reproduces is not a parent return', async () => {
  const { evidence, verdict } = await fire({ child: 'mints', parent: 'restates-task' });
  assert.equal(evidence.child_return_bound, true);
  assert.equal(evidence.parent_return_event, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});
