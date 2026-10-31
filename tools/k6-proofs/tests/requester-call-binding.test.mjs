// Requester-authored "minted" tokens and forked children (karmaterminal/openclaw-bootstrap#1727,
// harness review F2/F3 sibling paths).
//
// The review tests cover the live-suffix paths. These cover the nearest
// alternates:
//   - the whole-transcript path: tokenWorkHops searched for the hop-2 token
//     only after hop 1, so the child's own spawn task (its first user row,
//     the task the requester actually sent) never vetoed a token the
//     requester wrote there;
//   - a read that does not start at the spawn task cannot bind hop 2;
//   - sessions_spawn context "fork" copies the requester's transcript into
//     the child (openclaw f15237ec92 session-accessor.sqlite-parent-fork.ts:219-249),
//     and an omitted context on a thread spawn takes the channel default
//     (subagent-spawn-context.ts:207-229);
//   - R-CD-SILENT: a child report that arrives before the requester's call is
//     seen waits for it, and is refused if that call carried the token.
// They import only modules that predate the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenWorkHops } from '../lib/continue-work-chain.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = 'R-CW-TOKEN-1793326378000-abcd1234';
const REQUESTER_TOKEN = 'q1w2e3r4t5y6';
const CHILD_MINTED = 'z9x8c7v6b5n4';
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId, timestamp) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId }, ...(timestamp ? { timestamp } : {}) });
const opts = { nonce: N, hop1Marker: 'TOKEN-HOP1', hop2Marker: 'TOKEN-HOP2-DONE' };

test('tokenWorkHops: a hop-2 token the requester wrote into the spawn task is refused on the whole-transcript path', () => {
  const rows = [
    user(`[Subagent Task] k6 proof R-CW-TOKEN nonce ${N}. ... reply exactly TOKEN-HOP2-DONE ${N} TOKEN ${REQUESTER_TOKEN}.`),
    say(`TOKEN-HOP1 ${N}`, 'run-c1', 10),
    user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
    say(`TOKEN-HOP2-DONE ${N} TOKEN ${REQUESTER_TOKEN}`, 'run-c2', 20),
  ];
  const hops = tokenWorkHops(rows, opts);
  assert.equal(hops.complete, false);
  assert.equal(hops.token, null);
});

test('tokenWorkHops: a read that does not start at the spawn task binds no hop', () => {
  const suffix = [
    say(`TOKEN-HOP1 ${N}`, 'run-c1', 10),
    user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
    say(`TOKEN-HOP2-DONE ${N} TOKEN ${CHILD_MINTED}`, 'run-c2', 20),
  ];
  assert.equal(tokenWorkHops(suffix, opts).complete, false);
  // The same rows after the real spawn task bind.
  const whole = [user(`[Subagent Task] k6 proof R-CW-TOKEN nonce ${N}.`), ...suffix];
  assert.equal(tokenWorkHops(whole, opts).complete, true);
});

// ---------------------------------------------------------------------------
// R-CW-TOKEN scenario: fork refusal
// ---------------------------------------------------------------------------

const PARENT = 'agent:main:echo-fix-r-cw-token-parent';
const CHILD = 'agent:main:subagent:echo-fix-r-cw-token-child';

/** world.spawnArgs: extra sessions_spawn arguments (context, thread). */
function cwTokenGateway(world) {
  let childHistory = [];
  let parentHistory = [];
  const ev = (sessionKey, message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey, message, runId } });
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const task = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        const nonce = /(R-CW-TOKEN-\d+-[a-z0-9]+)/.exec(task)[1];
        const spawnCall = { role: 'assistant', content: [{ type: 'toolCall', id: 'sp-1', name: 'sessions_spawn', arguments: { runtime: 'subagent', mode: 'run', task, lightContext: true, cleanup: 'delete', ...world.spawnArgs } }], __openclaw: { runId: 'run-d' }, timestamp: 1 };
        const spawnResult = { role: 'toolResult', toolCallId: 'sp-1', toolName: 'sessions_spawn', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', childSessionKey: CHILD, runId: 'run-c1' }) }], __openclaw: { runId: 'run-d' }, timestamp: 2 };
        childHistory = [
          user(`[Subagent Task] ${task}`),
          say(`TOKEN-HOP1 ${nonce}`, 'run-c1', 10),
          user('[continuation:wake] Turn 1/200. The agent elected to continue working.'),
          say(`TOKEN-HOP2-DONE ${nonce} TOKEN ${CHILD_MINTED}`, 'run-c2', 20),
        ];
        parentHistory = [user(message), spawnCall, spawnResult, say(`TOKEN-HOP2-RETURN ${nonce} TOKEN ${CHILD_MINTED}`, 'run-p2', 30)];
        return [...ok({ runId: 'run-d' }), ev(PARENT, spawnCall, 'run-d'), ev(PARENT, spawnResult, 'run-d')];
      }
      case 'chat.history':
        return ok({ messages: frame.params?.sessionKey === CHILD ? childHistory : parentHistory, hasMore: false });
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
      OPENCLAW_GATEWAY_TOKEN: 'echo-fix-r-cw-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'echo-fix-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CW-TOKEN evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CW-TOKEN\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('R-CW-TOKEN: a forked child is refused, whatever its transcript says', async () => {
  const { evidence, verdict } = await fireCwToken({ spawnArgs: { context: 'fork' } });
  assert.notEqual(evidence.hop_2_executed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('R-CW-TOKEN: a thread spawn that leaves the context to the channel default is refused', async () => {
  const { evidence, verdict } = await fireCwToken({ spawnArgs: { thread: true } });
  assert.notEqual(evidence.hop_2_executed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('R-CW-TOKEN control: the same child spawned isolated passes', async () => {
  const { evidence, verdict } = await fireCwToken({ spawnArgs: { context: 'isolated' } });
  assert.equal(evidence.hop_2_executed, true);
  assert.equal(verdict, 'PASS-candidate');
});

// ---------------------------------------------------------------------------
// R-CD-SILENT scenario: a child report before the requester's call is seen
// ---------------------------------------------------------------------------

const SILENT_PARENT = 'agent:main:echo-fix-r-cd-silent-parent';
const SILENT_CHILD = 'agent:main:subagent:continuation-echofixsilent01';

/** world.token: 'requester' | 'child'. The child's chat final arrives before the requester's call row. */
function silentGateway(world) {
  let nonce = null;
  let reported = null;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    const ev = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: SILENT_PARENT, message, runId } });
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: SILENT_PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (/follow-up nonce/.test(message)) {
          return [...ok({ runId: 'run-f' }), ev(say(`RCDS-PARENT-OBSERVED ${nonce} TOKEN ${reported}`, 'run-f'), 'run-f')];
        }
        const harnessTask = JSON.parse(/task=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        nonce = /R-CD-SILENT proof nonce (\S+)\./.exec(message)[1];
        const sentTask = world.token === 'requester' ? harnessTask.replace('<your token>', REQUESTER_TOKEN) : harnessTask;
        reported = world.token === 'requester' ? REQUESTER_TOKEN : CHILD_MINTED;
        return [
          ...ok({ runId: 'run-d' }),
          { type: 'event', event: 'chat', payload: { runId: 'run-c', sessionKey: SILENT_CHILD, spawnedBy: SILENT_PARENT, state: 'final', message: { role: 'assistant', content: [{ type: 'text', text: `SILENTCHILD ${nonce} TOKEN ${reported}` }] } } },
          ev({ role: 'assistant', content: [{ type: 'toolCall', id: 'cd-1', name: 'continue_delegate', arguments: { task: sentTask, mode: 'silent', delaySeconds: 1 } }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev({ role: 'toolResult', toolCallId: 'cd-1', toolName: 'continue_delegate', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', mode: 'silent' }) }], __openclaw: { runId: 'run-d' } }, 'run-d'),
          ev(say(`RCDS-SCHEDULED ${nonce}`, 'run-d'), 'run-d'),
        ];
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fireSilent(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-silent.js'),
    gateway: silentGateway(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-silent.json'),
      OPENCLAW_GATEWAY_TOKEN: 'echo-fix-r-cd-silent',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'echo-fix-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an R-CD-SILENT evidence record:\n${log}`);
  return { evidence: records[records.length - 1], verdict: /\[R-CD-SILENT\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('R-CD-SILENT: a report that beats the requester\'s call is refused once the call shows it carried the token', async () => {
  const { evidence, verdict } = await fireSilent({ token: 'requester' });
  assert.notEqual(evidence.child_completion_observed, true);
  assert.notEqual(evidence.parent_internal_context_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('R-CD-SILENT control: the same early report of a token the child minted binds once the call is seen', async () => {
  const { evidence, verdict } = await fireSilent({ token: 'child' });
  assert.equal(evidence.child_completion_observed, true);
  assert.equal(evidence.parent_internal_context_observed, true);
  assert.equal(verdict, 'PASS-candidate');
});
