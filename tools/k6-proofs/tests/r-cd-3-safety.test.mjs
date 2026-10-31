// R-CD-3 binding and fill safety, sibling paths of the harness review findings
// (karmaterminal/openclaw-bootstrap#1727).
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway shaped like openclaw f15237ec92 (see r-cd-3-post-compaction.test.mjs
// for the shapes). The scenario-level tests import nothing added with the
// fixes, so the file runs unchanged against the pre-fix tree as its negative
// control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'agent:main:r-cd-3-safety-disposable';
const LIFEBOAT = 'agent:main:subagent:continuation-safety-lifeboat';
const MINTED = 'm3n8b2v7c1x6';
const RELEASE = '[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ';
const ACCEPTED = { status: 'compaction_requested', compactionRequestId: 'diag-safety', trigger: 'volitional', contextUsage: 76, reason: 'R-CD-3 k6 proof', note: 'Compaction will run after this turn.' };

function quotedAfter(text, key) {
  const match = new RegExp(`${key}=("(?:[^"\\\\]|\\\\.)*")`).exec(text);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * world:
 *   lifeboatTask(task): the released child's spawn task (default: the product release composition)
 *   extraProofCalls(task): more requester calls in the proof turn ([{ name, arguments }])
 *   sendRunId(kind, n): the runId a sessions.send answer carries ('fill' | 'proof'); undefined = none
 *   parentReturnRun: the run that reproduces the token (default 'run-wake')
 *   window, perTurnTokens: the measured context window and the growth per fill turn
 *   createPayload: the sessions.create answer (default { key: SESSION })
 *   sessionIdAfterFill(n): the describe row's sessionId after fill n (default none)
 *   compaction: the request_compaction payload (default accepted)
 *   sends: an array that receives every sessions.send key
 */
function gatewayFor(world = {}) {
  const state = { fills: 0, total: 0, proof: null, task: null, nonce: null };
  const window = world.window ?? 200_000;
  const say = (text, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], ...extra });
  const event = (name, payload) => ({ type: 'event', event: name, payload });
  const sessionMessage = (message, runId) => event('session.message', { sessionKey: SESSION, message: { ...message, __openclaw: { runId } }, runId });
  const runIdFor = (kind, n) => (world.sendRunId ? world.sendRunId(kind, n) : kind === 'fill' ? `run-fill-${n}` : 'run-proof');

  function proofRows() {
    const calls = [
      { id: 'cd-1', name: 'continue_delegate', arguments: { mode: 'post-compaction', delaySeconds: 0, task: state.task } },
      ...(world.extraProofCalls ? world.extraProofCalls(state.task) : []).map((call, i) => ({ id: `extra-${i}`, ...call })),
      { id: 'rc-1', name: 'request_compaction', arguments: { reason: state.proof.reason } },
    ];
    const rows = [{ role: 'user', content: [{ type: 'text', text: state.proof.message }] }];
    for (const call of calls) {
      rows.push({ role: 'assistant', content: [{ type: 'toolCall', ...call }], __openclaw: { runId: 'run-proof' } });
      const payload = call.name === 'continue_delegate' ? { status: 'queued-for-compaction', mode: 'post-compaction' }
        : call.name === 'request_compaction' ? (world.compaction ?? ACCEPTED) : { status: 'accepted' };
      rows.push({ role: 'toolResult', toolCallId: call.id, toolName: call.name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, __openclaw: { runId: 'run-proof' } });
    }
    return rows;
  }

  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-3']] } });
      case 'sessions.create': return ok(world.createPayload ?? { key: SESSION });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (world.sends) world.sends.push(frame.params?.key);
        if (/context fill \d+/.test(message)) {
          state.fills += 1;
          state.total += world.perTurnTokens ?? 40_000;
          const runId = runIdFor('fill', state.fills);
          return [...ok(runId === undefined ? { status: 'started' } : { runId }), ...(runId ? [event('agent', { runId, sessionKey: SESSION, stream: 'lifecycle', data: { phase: 'end' } })] : [])];
        }
        state.nonce = /R-CD-3 nonce (\S+)\./.exec(message)?.[1] || null;
        state.task = quotedAfter(message, 'task');
        state.proof = { message, reason: quotedAfter(message, 'reason') };
        const runId = runIdFor('proof', 0);
        return [...ok(runId === undefined ? { status: 'started' } : { runId }), ...proofRows().map((row) => sessionMessage(row, 'run-proof'))];
      }
      case 'sessions.describe':
        return ok({ session: {
          key: SESSION,
          totalTokens: state.total,
          totalTokensFresh: state.fills > 0,
          contextTokens: state.fills > 0 ? window : undefined,
          ...(world.sessionIdAfterFill ? { sessionId: world.sessionIdAfterFill(state.fills) } : {}),
        } });
      case 'sessions.list':
        return ok({ sessions: state.proof && frame.params?.spawnedBy === SESSION ? [{ key: LIFEBOAT, spawnedBy: SESSION, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey === LIFEBOAT) {
          const task = world.lifeboatTask ? world.lifeboatTask(state.task) : `${RELEASE}${state.task}`;
          return ok({ messages: [
            { role: 'user', content: [{ type: 'text', text: task }], timestamp: 5_000 },
            say(`RCD3-LIFEBOAT ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: 'run-lifeboat' }, timestamp: 6_000 }),
          ], hasMore: false });
        }
        const messages = state.proof ? proofRows().map((row) => ({ ...row, timestamp: 1_000 })) : [];
        if (state.nonce) messages.push(say(`RCD3-PARENT-RETURN ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: world.parentReturnRun ?? 'run-wake' }, timestamp: 7_000 }));
        return ok({ messages, hasMore: false });
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world, env = {}) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-3-post-compaction.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-3.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-3-safety-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'r-cd-3-safety-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      ...env,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-3 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-CD-3\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('control: the true release chain passes', async () => {
  const { evidence, verdict } = await fire({});
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});

// F4 sibling: the position check alone does not stop a requester that writes
// the whole release composition into its own call; the call itself is refused.
test('F4: a requester sessions_spawn whose task copies the release composition is refused', async () => {
  const { evidence, verdict } = await fire({
    extraProofCalls: (task) => [{ name: 'sessions_spawn', arguments: { runtime: 'subagent', task: `${RELEASE}${task}` } }],
  });
  assert.notEqual(evidence.lifeboat_child_observed, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F4: the same call made through Tool Search\'s dispatch_action is refused', async () => {
  const { verdict } = await fire({
    extraProofCalls: (task) => [{ name: 'dispatch_action', arguments: { id: 'sessions_spawn', args: { runtime: 'subagent', task: `${RELEASE}${task}` } } }],
  });
  assert.notEqual(verdict, 'PASS-candidate');
});

// F5 sibling: the return is excluded from the proof run and every fill run; an
// unknown run id among them leaves the return unproven, never bound.
test('F5: with no proof run id the requester\'s return cannot bind', async () => {
  const { evidence, verdict } = await fire({ sendRunId: (kind, n) => (kind === 'fill' ? `run-fill-${n}` : undefined) });
  assert.equal(evidence.lifeboat_report_bound, true);
  assert.notEqual(evidence.parent_return_bound, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F5: a fill run whose id is unknown leaves the return unbound', async () => {
  const { evidence, verdict } = await fire({ sendRunId: (kind, n) => (kind === 'fill' ? (n === 2 ? undefined : `run-fill-${n}`) : 'run-proof') });
  assert.equal(evidence.fill_reached, true);
  assert.notEqual(evidence.parent_return_bound, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

// F6 sibling: a created key that names the configured session (exactly, or as
// the canonical form of a bare key) is the live session; nothing is sent.
test('F6: a sessions.create answer naming the configured session sends nothing', async () => {
  const sends = [];
  const { evidence, verdict } = await fire({ createPayload: { key: 'agent:main:main' }, sends });
  assert.deepEqual(sends, [], 'no fill or proof turn reaches the live session');
  assert.equal(evidence.proof_dispatched, false);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F6: the canonical key of a bare configured session is the configured session', async () => {
  const sends = [];
  await fire({ createPayload: { key: 'agent:main:main' }, sends }, { OPENCLAW_SESSION_KEY: 'main' });
  assert.deepEqual(sends, []);
});

test('F6: a bare key naming the canonical configured session is the configured session', async () => {
  const sends = [];
  await fire({ createPayload: { key: 'main' }, sends }, { OPENCLAW_SESSION_KEY: 'agent:main:main' });
  assert.deepEqual(sends, []);
});

// F7 siblings.
test('F7: a target not reachable below automatic compaction stops before any turn past it', async () => {
  // 64k window: the line is 48,000 (75%); the 75% target sits on it.
  const { evidence, verdict } = await fire({ window: 64_000, perTurnTokens: 20_000 });
  assert.equal(evidence.proof_dispatched, false);
  assert.match(evidence.fill_stop_reason || '', /context target unreachable below automatic compaction/);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F7: a declared larger compaction reserve lowers the line the fill must stay under', async () => {
  // 200k window, reserve 50,000: the line is 150,000 (75%).
  const { evidence } = await fire({}, { OPENCLAW_RCD3_COMPACTION_RESERVE_TOKENS: '50000' });
  assert.equal(evidence.proof_dispatched, false);
  assert.match(evidence.fill_stop_reason || '', /context target unreachable below automatic compaction/);
});

test('F7: a sessionId that changes on the describe row mid-fill stops the fill', async () => {
  // The total keeps growing (a preflight compaction can leave a larger total); only the id moves.
  const { evidence, verdict } = await fire({ sessionIdAfterFill: (n) => (n >= 2 ? 'session-after-compaction' : 'session-before') });
  assert.equal(evidence.proof_dispatched, false);
  assert.match(evidence.fill_stop_reason || '', /compacted during the fill/);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('F7 control: a steady sessionId does not stop the fill', async () => {
  const { verdict } = await fire({ sessionIdAfterFill: () => 'session-steady' });
  assert.equal(verdict, 'PASS-candidate');
});

// N2: request_compaction rounds a raw 69.5-69.99% to 70 against threshold 70.
test('N2: a rejection reported at contextUsage 70, threshold 70 is a measured below-threshold rejection', async () => {
  const { evidence, verdict } = await fire({ compaction: { status: 'rejected', guard: 'context_threshold', contextUsage: 70, threshold: 70, reason: 'Context usage (70%) is below the minimum threshold (70%). Compaction is not needed yet.' } });
  assert.equal(evidence.compaction_outcome_kind, 'threshold_rejected_measured');
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.match(evidence.verdict_reason, /measured below-threshold rejection/);
});

test('N2 control: a usage reported above the threshold on a threshold rejection stays inconsistent', async () => {
  const { evidence, verdict } = await fire({ compaction: { status: 'rejected', guard: 'context_threshold', contextUsage: 71, threshold: 70, reason: 'x' } });
  assert.equal(evidence.compaction_outcome_kind, 'invalid');
  assert.equal(verdict, 'PARTIAL-candidate');
});

// N11: the plural variable is the switch; the singular one set to false alone does not disable.
test('N11: the refusal names OPENCLAW_CREATE_DISPOSABLE_SESSIONS, the variable that disables the disposable session', async () => {
  const sends = [];
  const { evidence } = await fire({ sends }, { OPENCLAW_CREATE_DISPOSABLE_SESSIONS: 'false' });
  assert.deepEqual(sends, []);
  assert.match(evidence.fill_stop_reason, /OPENCLAW_CREATE_DISPOSABLE_SESSIONS=false/);
});

test('N11 control: OPENCLAW_CREATE_DISPOSABLE_SESSION=false alone still runs in a created disposable session', async () => {
  const sends = [];
  const { evidence } = await fire({ sends }, { OPENCLAW_CREATE_DISPOSABLE_SESSION: 'false' });
  assert.equal(evidence.session_created, true);
  assert.ok(sends.length > 0 && sends.every((key) => key === SESSION));
});
