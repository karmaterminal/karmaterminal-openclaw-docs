// R-CD-3 sentinel echo and the measured compaction path (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (F′ f15237ec92, emeric isolated gateway, run
// 20261030T013104Z-r-cd-3-44aa4c89): the lifeboat task carried
// "reply exactly RCD3-LIFEBOAT-RECEIVED <nonce>", the agent's own
// continue_delegate call carried that task, and the scenario matched the
// sentinel in any requester event without the harness marker. It recorded a
// lifeboat return at 5.1 s; the session transcript shows request_compaction
// answering "Context usage is unknown for this session" and nothing released.
//
// Each test fires the real scenario (k6 runtime stubbed, see
// helpers/k6-node-runtime.mjs) against a scripted gateway whose event shapes
// follow openclaw f15237ec92: tool calls arrive with their arguments verbatim
// in session.message (chat-display-projection.sanitize.ts:182-183), the
// tool-start agent item carries the task (tool-display-config.ts:393), toolResult
// content is the JSON payload (tool-results.ts:10-12), rows carry
// __openclaw.runId, and the released lifeboat's spawn task starts with
// "[continuation:post-compaction]" (post-compaction-delegate-delivery.ts:497-539).
// No live gateway is used.
//
// The echo test imports nothing added with the fix, so the same file runs
// against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIO = path.join(root, 'scenarios', 'r-cd-3-post-compaction.js');
const MANIFEST = path.join(root, 'manifests', 'r-cd-3.json');
const SESSION = 'agent:main:r-cd-3-disposable';
const LIFEBOAT = 'agent:main:subagent:continuation-lifeboat01';
const MINTED = 'k7q2m9x4p1w8';

const UNKNOWN = {
  status: 'rejected',
  guard: 'context_threshold',
  reason: 'Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths.',
};
const MEASURED_BELOW = {
  status: 'rejected',
  guard: 'context_threshold',
  contextUsage: 41,
  threshold: 70,
  reason: 'Context usage (41%) is below the minimum threshold (70%). Compaction is not needed yet.',
};
const ACCEPTED = {
  status: 'compaction_requested',
  compactionRequestId: 'diag-r-cd-3',
  trigger: 'volitional',
  contextUsage: 76,
  reason: 'R-CD-3 k6 proof',
  note: 'Compaction will run after this turn.',
};

function event(name, payload) {
  return { type: 'event', event: name, payload };
}

function sessionMessage(message, runId) {
  return event('session.message', { sessionKey: SESSION, message: { ...message, __openclaw: { runId } }, runId });
}

function lifecycleEnd(runId) {
  return event('agent', { runId, sessionKey: SESSION, stream: 'lifecycle', data: { phase: 'end', aborted: false } });
}

function quotedAfter(text, key) {
  const match = new RegExp(`${key}=("(?:[^"\\\\]|\\\\.)*")`).exec(text);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * A scripted gateway. `world` decides what the product does:
 *   window, perTurnTokens: measured usage after each fill turn
 *   compaction: the request_compaction payload
 *   lifeboat: release a lifeboat child (spawn task with the product prefix) that mints MINTED
 *   lifeboatTaskPrefix: override the spawn task prefix (an ordinary child when '')
 *   parentReturnRun: the run that reproduces the token ('wake' | 'dispatch' | null)
 *   extraEchoes(task, nonce): more requester events on the proof turn
 */
function gatewayFor(world) {
  const state = { fills: 0, total: 0, proof: null, task: null, nonce: null };
  const window = world.window ?? 200_000;
  const perTurn = world.perTurnTokens ?? 40_000;
  const toolCall = (id, name, args) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }] });
  const toolResult = (id, name, payload) => ({ role: 'toolResult', toolCallId: id, toolName: name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false });
  const say = (text, extra = {}) => ({ role: 'assistant', content: [{ type: 'text', text }], ...extra });

  function proofRows() {
    const reason = state.proof.reason;
    return [
      { role: 'user', content: [{ type: 'text', text: state.proof.message }] },
      { ...toolCall('cd-1', 'continue_delegate', { mode: 'post-compaction', delaySeconds: 0, task: state.task }), __openclaw: { runId: 'run-proof' } },
      { ...toolResult('cd-1', 'continue_delegate', { status: 'queued-for-compaction', mode: 'post-compaction', delegateIndex: 0, delegatesThisTurn: 1 }), __openclaw: { runId: 'run-proof' } },
      { ...toolCall('rc-1', 'request_compaction', { reason }), __openclaw: { runId: 'run-proof' } },
      { ...toolResult('rc-1', 'request_compaction', world.compaction), __openclaw: { runId: 'run-proof' } },
    ];
  }

  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect':
        return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-CD-3']] } });
      case 'sessions.create':
        return ok({ key: SESSION });
      case 'sessions.messages.subscribe':
        return ok({ subscribed: true, key: frame.params?.key });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        if (/context fill \d+/.test(message)) {
          state.fills += 1;
          const runId = `run-fill-${state.fills}`;
          state.total = world.compactDuringFill && state.fills === 2 ? 12_000 : state.total + perTurn;
          return [...ok({ runId }), lifecycleEnd(runId)];
        }
        state.nonce = /R-CD-3 nonce (\S+)\./.exec(message)?.[1] || null;
        state.task = quotedAfter(message, 'task');
        state.proof = { message, reason: quotedAfter(message, 'reason') };
        const rows = proofRows();
        return [
          ...ok({ runId: 'run-proof' }),
          // The harness prompt echo, the agent's own call (with its task), the
          // tool-start item meta, and the tool results, as the product sends them.
          sessionMessage(rows[0], 'run-proof'),
          event('agent', { runId: 'run-proof', sessionKey: SESSION, stream: 'item', data: { kind: 'tool', name: 'continue_delegate', meta: { task: state.task, mode: 'post-compaction' } } }),
          sessionMessage(rows[1], 'run-proof'),
          sessionMessage(rows[2], 'run-proof'),
          sessionMessage(rows[3], 'run-proof'),
          sessionMessage(rows[4], 'run-proof'),
          ...(world.extraEchoes ? world.extraEchoes(state.task, state.nonce) : []),
          sessionMessage(say(`continue_delegate: queued-for-compaction; request_compaction: ${world.compaction.status}`), 'run-proof'),
          lifecycleEnd('run-proof'),
        ];
      }
      case 'sessions.describe':
        return ok({ session: { key: SESSION, totalTokens: state.total, totalTokensFresh: state.fills > 0, contextTokens: state.fills > 0 ? window : undefined } });
      case 'sessions.list': {
        const released = world.lifeboat && world.compaction.status === 'compaction_requested' && frame.params?.spawnedBy === SESSION;
        return ok({ sessions: released ? [{ key: LIFEBOAT, spawnedBy: SESSION, status: 'done', label: null }] : [], hasMore: false });
      }
      case 'chat.history': {
        if (frame.params?.sessionKey === LIFEBOAT) {
          const prefix = world.lifeboatTaskPrefix ?? '[continuation:post-compaction] [continuation:chain-hop:1] Compaction just completed. Carry this working state to the post-compaction session: ';
          return ok({
            messages: [
              { role: 'user', content: [{ type: 'text', text: `${prefix}${state.task}` }], timestamp: 5_000 },
              say(`RCD3-LIFEBOAT ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId: 'run-lifeboat' }, timestamp: 6_000 }),
            ],
            hasMore: false,
          });
        }
        const messages = state.proof ? proofRows().map((row) => ({ ...row, timestamp: 1_000 })) : [];
        if (world.parentReturnRun && state.nonce) {
          const runId = world.parentReturnRun === 'wake' ? 'run-wake' : 'run-proof';
          messages.push(say(`RCD3-PARENT-RETURN ${state.nonce} TOKEN ${MINTED}`, { __openclaw: { runId }, timestamp: 7_000 }));
        }
        return ok({ messages, hasMore: false });
      }
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world, env = {}) {
  const { log, frames } = await runK6Scenario({
    scenarioPath: process.env.RCD3_SCENARIO_UNDER_TEST || SCENARIO,
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: process.env.RCD3_MANIFEST_UNDER_TEST || MANIFEST,
      OPENCLAW_GATEWAY_TOKEN: 'r-cd-3-sentinel-echo-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      ...env,
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-CD-3 evidence record:\n${log}`);
  const verdict = /\[R-CD-3\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1];
  return { evidence: records[0], verdict, log, frames };
}

test('F′ echo: the requester\'s own continue_delegate call never satisfies the lifeboat return', async () => {
  // The F′ shape: a first-turn session, unknown usage, and the lifeboat task
  // (with its return sentinel) riding the requester's own call and item meta.
  const { evidence, verdict } = await fire({
    window: 200_000,
    perTurnTokens: 160_000,
    compaction: UNKNOWN,
    lifeboat: false,
    extraEchoes: (task, nonce) => [
      // The pre-fix template's sentinel, and a restatement of the new one, in requester rows.
      sessionMessage({ role: 'assistant', content: [{ type: 'thinking', thinking: `I will reply RCD3-LIFEBOAT-RECEIVED ${nonce} later.` }, { type: 'text', text: `Staged: RCD3-LIFEBOAT-RECEIVED ${nonce}` }] }, 'run-proof'),
      event('chat', { runId: 'run-proof', sessionKey: SESSION, state: 'delta', message: { role: 'assistant', content: [{ type: 'text', text: `${task}` }] } }),
    ],
  });
  assert.notEqual(verdict, 'PASS-candidate', 'the requester\'s own outbound text must not produce a lifeboat PASS');
  assert.notEqual(evidence.verdict, 'PASS-candidate');
});

test('unknown usage after a measured fill is PARTIAL with its own reason, never PASS', async () => {
  const { evidence, verdict } = await fire({ window: 200_000, perTurnTokens: 160_000, compaction: UNKNOWN, lifeboat: false });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.fill_reached, true);
  assert.equal(evidence.compaction_outcome_kind, 'context_unknown');
  assert.match(evidence.verdict_reason, /context unknown/);
  assert.doesNotMatch(evidence.verdict_reason, /measured below-threshold/);
  assert.equal(evidence.staging_receipt_observed, true);
  assert.equal(evidence.lifeboat_report_bound, false);
});

test('a measured below-threshold rejection is a separate PARTIAL reason', async () => {
  const { evidence, verdict } = await fire({ window: 200_000, perTurnTokens: 160_000, compaction: MEASURED_BELOW, lifeboat: false });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.compaction_outcome_kind, 'threshold_rejected_measured');
  assert.equal(evidence.compaction_context_usage, 41);
  assert.equal(evidence.compaction_threshold, 70);
  assert.match(evidence.verdict_reason, /measured below-threshold rejection \(contextUsage 41% < threshold 70%\)/);
  assert.doesNotMatch(evidence.verdict_reason, /context unknown/);
});

test('the true chain passes: accepted compaction, released lifeboat, minted token, return in a woken run', async () => {
  const { evidence, verdict, frames } = await fire({
    window: 200_000,
    perTurnTokens: 40_000,
    compaction: ACCEPTED,
    lifeboat: true,
    parentReturnRun: 'wake',
  });
  assert.equal(verdict, 'PASS-candidate', evidence.verdict_reason);
  assert.equal(evidence.fill_reached, true);
  assert.ok(evidence.fill_turns.length >= 2, 'the fill took real prior turns');
  assert.ok(evidence.fill_measured_usage >= 0.7);
  assert.equal(evidence.staging_receipt_observed, true);
  assert.equal(evidence.compaction_outcome_kind, 'accepted');
  assert.equal(evidence.lifeboat_child_observed, true);
  assert.equal(evidence.lifeboat_report_bound, true);
  assert.equal(evidence.parent_return_bound, true);
  // No threshold or config call: only reads, the fill turns and the proof turn.
  const methods = new Set(frames.map((frame) => frame.method));
  for (const method of methods) {
    assert.ok(['connect', 'sessions.create', 'sessions.messages.subscribe', 'sessions.send', 'sessions.describe', 'sessions.list', 'chat.history'].includes(method), method);
  }
  // The minted token never leaves the run in clear.
  assert.ok(!JSON.stringify(evidence).includes(MINTED));
});

test('a token reproduced only in the dispatch run does not bind the return', async () => {
  const { evidence, verdict } = await fire({ window: 200_000, perTurnTokens: 40_000, compaction: ACCEPTED, lifeboat: true, parentReturnRun: 'dispatch' });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.lifeboat_report_bound, true);
  assert.equal(evidence.parent_return_bound, false);
  assert.match(evidence.verdict_reason, /return is not bound/);
});

test('a requester-stream echo of the lifeboat report shape binds nothing without the lifeboat\'s own transcript', async () => {
  const { evidence, verdict } = await fire({
    window: 200_000,
    perTurnTokens: 40_000,
    compaction: ACCEPTED,
    lifeboat: false,
    parentReturnRun: 'wake',
    extraEchoes: (_task, nonce) => [
      sessionMessage({ role: 'assistant', content: [{ type: 'text', text: `RCD3-LIFEBOAT ${nonce} TOKEN ${MINTED}` }] }, 'run-proof'),
    ],
  });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.lifeboat_child_observed, false);
  assert.equal(evidence.lifeboat_report_bound, false);
  assert.match(evidence.verdict_reason, /no released lifeboat child/);
});

test('a bound child without the product post-compaction prefix is not a released lifeboat', async () => {
  const { evidence, verdict } = await fire({ window: 200_000, perTurnTokens: 40_000, compaction: ACCEPTED, lifeboat: true, lifeboatTaskPrefix: '', parentReturnRun: 'wake' });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.lifeboat_child_observed, false);
});

test('a context window too large for the fill budget stops before the proof turn', async () => {
  const { evidence, verdict, frames } = await fire({ window: 1_000_000, perTurnTokens: 20_000, compaction: ACCEPTED, lifeboat: true });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.proof_dispatched, false);
  assert.match(evidence.fill_stop_reason, /over the 300000-token fill budget/);
  assert.ok(!frames.some((frame) => frame.method === 'sessions.send' && /continue_delegate/.test(frame.params?.message || '')));
});

test('a compaction during the fill stops it', async () => {
  const { evidence, verdict } = await fire({ window: 200_000, perTurnTokens: 40_000, compactDuringFill: true, compaction: ACCEPTED, lifeboat: true });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.equal(evidence.proof_dispatched, false);
  assert.match(evidence.fill_stop_reason, /compacted during the fill/);
});

test('the fill refuses a non-disposable session', async () => {
  const { evidence, verdict, frames } = await fire({ compaction: ACCEPTED }, { OPENCLAW_CREATE_DISPOSABLE_SESSIONS: 'false' });
  assert.equal(verdict, 'PARTIAL-candidate');
  assert.match(evidence.fill_stop_reason, /only in a disposable session/);
  assert.ok(!frames.some((frame) => frame.method === 'sessions.send'));
});
