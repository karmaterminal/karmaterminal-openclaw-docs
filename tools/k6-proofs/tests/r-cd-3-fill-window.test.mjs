// R-CD-3's context-fill budget follows the seat model's real context window.
//
// Live run 44245772142 (emeric, runtime ab5a30ea79, docs#625's per-row
// analysis) stopped with "context fill stopped before the proof turn: reaching
// 75% of a 922000-token window needs about 663127 filler tokens, over the
// 300000-token fill budget". The fixed 300k budget and six-turn allowance came
// with the measured fill itself (fb48f7f2, docs PR #617) and were sized for a
// window near 200k. At 922k neither reaches the compaction the row proves.
//
// The window is the one the fill already reads: the disposable session's
// sessions.describe contextTokens (openclaw ab5a30ea79
// src/gateway/session-utils-row.ts:180-262, which projects
// src/config/sessions/context-token-provenance.ts:80-110 from the selected
// model's catalog or configured window).
//
// The scenario tests fire the real scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a scripted gateway whose session total
// grows with the filler actually sent: a system prompt on the first turn, then
// message characters x tokensPerChar on every turn, with the window on the
// describe row once a turn has ended. They import nothing added with the fix,
// so this file runs unchanged against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { automaticCompactionLine, measuredSessionUsage, planFillStep } from '../lib/r-cd-3-lifeboat.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'agent:main:r-cd-3-fill-window';
const LIFEBOAT = 'agent:main:subagent:continuation-fill-window-lifeboat';
const MINTED = 'w4n7c2q9z5r1';
const RELEASE = '[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ';
const ACCEPTED = { status: 'compaction_requested', compactionRequestId: 'diag-fill-window', trigger: 'volitional', contextUsage: 76, reason: 'R-CD-3 k6 proof', note: 'Compaction will run after this turn.' };
/** Run 44245772142's first measured total: 75% + 2% of 922,000 (709,940) less the 653,127 it still needed. */
const EMERIC_FIRST_TOTAL = 56_813;

function quotedAfter(text, key) {
  const match = new RegExp(`${key}=("(?:[^"\\\\]|\\\\.)*")`).exec(text);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * world:
 *   window: the describe row's contextTokens once a turn has ended
 *   describeWindow: false keeps contextTokens off every describe row (an unknown window)
 *   windowAfterFill(n): the window after fill n, when it moves
 *   systemTokens: what the first turn adds besides its message (system prompt and tools)
 *   tokensPerChar: tokens each message character adds to the session total
 *   sends: receives every sessions.send key
 */
function gatewayFor(world = {}) {
  const state = { fills: 0, total: 0, proof: null, task: null, nonce: null, describes: 0 };
  const window = world.window ?? 200_000;
  const systemTokens = world.systemTokens ?? 47_000;
  const tokensPerChar = world.tokensPerChar ?? 0.21;
  const say = (text, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], ...extra });
  const event = (name, payload) => ({ type: 'event', event: name, payload });
  const sessionMessage = (message, runId) => event('session.message', { sessionKey: SESSION, message: { ...message, __openclaw: { runId } }, runId });

  function proofRows() {
    const calls = [
      { id: 'cd-1', name: 'continue_delegate', arguments: { mode: 'post-compaction', delaySeconds: 0, task: state.task } },
      { id: 'rc-1', name: 'request_compaction', arguments: { reason: state.proof.reason } },
    ];
    const rows = [{ role: 'user', content: [{ type: 'text', text: state.proof.message }] }];
    for (const call of calls) {
      rows.push({ role: 'assistant', content: [{ type: 'toolCall', ...call }], __openclaw: { runId: 'run-proof' } });
      const payload = call.name === 'continue_delegate' ? { status: 'queued-for-compaction', mode: 'post-compaction' } : ACCEPTED;
      rows.push({ role: 'toolResult', toolCallId: call.id, toolName: call.name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, __openclaw: { runId: 'run-proof' } });
    }
    return rows;
  }

  const gateway = (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-3']] } });
      case 'sessions.create': return ok({ key: SESSION });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (world.sends) world.sends.push(frame.params?.key);
        if (/context fill \d+/.test(message)) {
          state.fills += 1;
          state.total += (state.fills === 1 ? systemTokens : 0) + Math.round(message.length * tokensPerChar);
          const runId = `run-fill-${state.fills}`;
          return [...ok({ runId }), event('agent', { runId, sessionKey: SESSION, stream: 'lifecycle', data: { phase: 'end' } })];
        }
        state.nonce = /R-CD-3 nonce (\S+)\./.exec(message)?.[1] || null;
        state.task = quotedAfter(message, 'task');
        state.proof = { message, reason: quotedAfter(message, 'reason') };
        return [...ok({ runId: 'run-proof' }), ...proofRows().map((row) => sessionMessage(row, 'run-proof'))];
      }
      case 'sessions.describe':
        state.describes += 1;
        return ok({ session: {
          key: SESSION,
          totalTokens: state.total,
          totalTokensFresh: state.fills > 0,
          contextTokens: state.fills > 0 && world.describeWindow !== false ? (world.windowAfterFill ? world.windowAfterFill(state.fills) : window) : undefined,
        } });
      case 'sessions.list':
        return ok({ sessions: state.proof && frame.params?.spawnedBy === SESSION ? [{ key: LIFEBOAT, spawnedBy: SESSION, status: 'done' }] : [], hasMore: false });
      case 'chat.history': {
        if (frame.params?.sessionKey === LIFEBOAT) {
          return ok({ messages: [
            { role: 'user', content: [{ type: 'text', text: `${RELEASE}${state.task}` }], timestamp: 5_000 },
            say(`RCD3-LIFEBOAT ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: 'run-lifeboat' }, timestamp: 6_000 }),
          ], hasMore: false });
        }
        const messages = state.proof ? proofRows().map((row) => ({ ...row, timestamp: 1_000 })) : [];
        if (state.nonce) messages.push(say(`RCD3-PARENT-RETURN ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: 'run-wake' }, timestamp: 7_000 }));
        return ok({ messages, hasMore: false });
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
  return { gateway, state };
}

async function fire(world, env = {}) {
  const { gateway, state } = gatewayFor(world);
  const { log, frames } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cd-3-post-compaction.js'),
    gateway,
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-3.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-3-fill-window-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299',
      OPENCLAW_SEAT_NAME: 'r-cd-3-fill-window-seat',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      ...env,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-3 evidence record:\n${log}`);
  const fillSends = frames.filter((frame) => frame.method === 'sessions.send' && /context fill \d+/.test(frame.params?.message || '')).length;
  const proofSent = frames.some((frame) => frame.method === 'sessions.send' && /continue_delegate/.test(frame.params?.message || ''));
  return { evidence: records[0], verdict: /\[R-CD-3\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1], fillSends, proofSent, describes: state.describes };
}

/** Every measured fill total stays below the automatic-compaction line for its window. */
function assertBelowAutomaticLine(evidence, window) {
  const line = automaticCompactionLine(window);
  for (const turn of evidence.fill_turns) {
    if (turn.total_tokens !== null) assert.ok(turn.total_tokens < line, `fill ${turn.turn} total ${turn.total_tokens} >= automatic-compaction line ${line}`);
  }
}

// ---------------------------------------------------------------------------
// The 922k window (run 44245772142)
// ---------------------------------------------------------------------------

test('922k window: the first fill step after calibration plans filler instead of stopping at a budget', () => {
  // Run 44245772142's numbers: one 40,000-character calibration turn counted as 10,000 filler tokens.
  const measurement = measuredSessionUsage({ totalTokens: EMERIC_FIRST_TOTAL, totalTokensFresh: true, contextTokens: 922_000 });
  const step = planFillStep({ measurement, turnsUsed: 1, filledTokens: 10_000 });
  assert.equal(step.action, 'fill', step.reason);
});

test('922k window: the fill reaches the compaction threshold and the proof turn runs', async () => {
  const { evidence, verdict, proofSent } = await fire({ window: 922_000 });
  assert.equal(evidence.fill_stop_reason, null, `the fill stopped: ${evidence.fill_stop_reason}`);
  assert.equal(evidence.fill_reached, true);
  assert.equal(evidence.fill_context_tokens, 922_000);
  assert.ok(evidence.fill_measured_usage >= 0.75, `measured usage ${evidence.fill_measured_usage}`);
  assert.ok(evidence.fill_turns.length > 6, `${evidence.fill_turns.length} fill turns: a 922k window needs more than the old six`);
  assertBelowAutomaticLine(evidence, 922_000);
  assert.equal(proofSent, true);
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
  // The budget and the turn allowance followed the window.
  assert.equal(evidence.fill_budget_source, 'context-window');
  assert.equal(evidence.fill_budget_tokens, Math.ceil(0.77 * 922_000));
  assert.ok(evidence.fill_max_turns >= evidence.fill_turns.length);
  assert.ok(evidence.fill_budget_tokens <= evidence.fill_budget_ceiling_tokens);
});

test('922k window: a window that moves after the first turn re-sizes the fill to the latest row', async () => {
  // A catalog window on the first row, then the runtime's own 922k: the plan follows the latest one.
  const { evidence, verdict } = await fire({ window: 922_000, windowAfterFill: (n) => (n === 1 ? 1_048_576 : 922_000) });
  assert.equal(evidence.fill_stop_reason, null, `the fill stopped: ${evidence.fill_stop_reason}`);
  assert.equal(evidence.fill_turns[0].context_tokens, 1_048_576);
  assert.equal(evidence.fill_context_tokens, 922_000);
  assert.ok(evidence.fill_measured_usage >= 0.75);
  assertBelowAutomaticLine(evidence, 922_000);
  assert.equal(evidence.fill_budget_tokens, Math.ceil(0.77 * 922_000));
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});

// ---------------------------------------------------------------------------
// A small window still works
// ---------------------------------------------------------------------------

test('small window: a 128k window still fills below its automatic-compaction line and passes', async () => {
  const { evidence, verdict } = await fire({ window: 128_000, systemTokens: 20_000 });
  assert.equal(evidence.fill_stop_reason, null, `the fill stopped: ${evidence.fill_stop_reason}`);
  assert.equal(evidence.fill_reached, true);
  assert.ok(evidence.fill_measured_usage >= 0.75);
  assertBelowAutomaticLine(evidence, 128_000);
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
});

test('small window: the 200k fill keeps its six-turn floor', () => {
  const measurement = measuredSessionUsage({ totalTokens: 50_000, totalTokensFresh: true, contextTokens: 200_000 });
  assert.equal(planFillStep({ measurement, turnsUsed: 5, filledTokens: 40_000 }).action, 'fill');
  const stop = planFillStep({ measurement, turnsUsed: 6, filledTokens: 40_000 });
  assert.equal(stop.action, 'stop');
  assert.match(stop.reason, /after 6 fill turns/);
});

// ---------------------------------------------------------------------------
// An unknown window refuses
// ---------------------------------------------------------------------------

test('unknown window: a describe row with a fresh total and no contextTokens refuses at once with the reason named', async () => {
  const { evidence, verdict, fillSends, proofSent, describes } = await fire({ describeWindow: false });
  assert.match(evidence.fill_stop_reason || '', /context window unknown/);
  assert.match(evidence.fill_stop_reason, /sessions\.describe/);
  assert.equal(fillSends, 1, 'only the fixed calibration turn is sent before the window is known');
  assert.ok(describes <= 3, `${describes} describe reads: the refusal waits for no turn timeout`);
  assert.equal(proofSent, false);
  assert.equal(evidence.proof_dispatched, false);
  assert.equal(verdict, 'PARTIAL-candidate');
});

test('unknown window: the planner refuses rather than guessing', () => {
  const step = planFillStep({ measurement: measuredSessionUsage({ totalTokens: 50_000, totalTokensFresh: true }), turnsUsed: 1, filledTokens: 10_000 });
  assert.equal(step.action, 'stop');
  assert.match(step.reason, /context window unknown/);
});

test('unknown window: an explicit budget does not stand in for the window', async () => {
  const { evidence, proofSent } = await fire({ describeWindow: false }, { OPENCLAW_RCD3_FILL_BUDGET_TOKENS: '150000' });
  assert.match(evidence.fill_stop_reason || '', /context window unknown/);
  assert.equal(proofSent, false);
});

// ---------------------------------------------------------------------------
// The hard ceiling
// ---------------------------------------------------------------------------

test('hard ceiling: a window whose fill would exceed the ceiling refuses after the calibration turn', async () => {
  // 77% of 2,000,000 is 1,540,000 filler tokens, over the 1,000,000 ceiling.
  const { evidence, verdict, fillSends, proofSent } = await fire({ window: 2_000_000 });
  assert.match(evidence.fill_stop_reason || '', /over the 1000000-token hard ceiling/);
  assert.match(evidence.fill_stop_reason, /OPENCLAW_RCD3_FILL_BUDGET_TOKENS/);
  assert.equal(fillSends, 1);
  assert.equal(proofSent, false);
  assert.equal(verdict, 'PARTIAL-candidate');
  // A refused budget is named by the stop reason, never recorded as the budget in force.
  assert.notEqual(evidence.fill_budget_source, 'context-window');
});

test('hard ceiling: the planner refuses a wrong 50M window instead of planning a fill', () => {
  const measurement = measuredSessionUsage({ totalTokens: 50_000, totalTokensFresh: true, contextTokens: 50_000_000 });
  const step = planFillStep({ measurement, turnsUsed: 1, filledTokens: 10_000 });
  assert.equal(step.action, 'stop');
  assert.match(step.reason, /hard ceiling/);
});

// ---------------------------------------------------------------------------
// The overrides win
// ---------------------------------------------------------------------------

test('override: an explicit budget below the window-derived one stops the fill at that budget', async () => {
  const { evidence, proofSent } = await fire({ window: 922_000 }, { OPENCLAW_RCD3_FILL_BUDGET_TOKENS: '300000' });
  assert.match(evidence.fill_stop_reason || '', /over the 300000-token fill budget/);
  assert.equal(proofSent, false);
});

test('override: an explicit budget above the ceiling is honoured for a window past it', async () => {
  const { evidence, verdict } = await fire({ window: 2_000_000 }, { OPENCLAW_RCD3_FILL_BUDGET_TOKENS: '1600000' });
  assert.equal(evidence.fill_stop_reason, null, `the fill stopped: ${evidence.fill_stop_reason}`);
  assert.equal(evidence.fill_reached, true);
  assertBelowAutomaticLine(evidence, 2_000_000);
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
  assert.equal(evidence.fill_budget_source, 'override');
  assert.equal(evidence.fill_budget_tokens, 1_600_000);
});

test('override: an explicit turn allowance wins over the window-derived one', async () => {
  const { evidence, fillSends, proofSent } = await fire({ window: 922_000 }, { OPENCLAW_RCD3_FILL_MAX_TURNS: '3' });
  assert.match(evidence.fill_stop_reason || '', /after 3 fill turns/);
  assert.equal(fillSends, 3);
  assert.equal(proofSent, false);
});

test('override: a malformed budget refuses before anything is sent', async () => {
  const sends = [];
  const { evidence, proofSent } = await fire({ window: 200_000, sends }, { OPENCLAW_RCD3_FILL_BUDGET_TOKENS: '300k' });
  assert.match(evidence.fill_stop_reason || '', /OPENCLAW_RCD3_FILL_BUDGET_TOKENS/);
  assert.deepEqual(sends, []);
  assert.equal(proofSent, false);
});

test('override: a malformed turn allowance refuses before anything is sent', async () => {
  const sends = [];
  const { evidence } = await fire({ window: 200_000, sends }, { OPENCLAW_RCD3_FILL_MAX_TURNS: '0' });
  assert.match(evidence.fill_stop_reason || '', /OPENCLAW_RCD3_FILL_MAX_TURNS/);
  assert.deepEqual(sends, []);
});
