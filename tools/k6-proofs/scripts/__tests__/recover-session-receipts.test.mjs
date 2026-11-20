// Supplemental session-receipt recovery on a Tool Search seat (openclaw/openclaw#129388 H1).
//
// recover-session-receipts.mjs read every toolResult row's first JSON object with
// no tool binding, so on a Tool Search seat the `gateway` tool's config.get answer
// (R-CONFIG-DEFAULTS) and continue_work's answer (R-CW-1's delaySeconds) came back
// as the dispatcher's { tool, result } envelope. It now reads each through
// unwrapToolResult for the tool it expects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../recover-session-receipts.mjs';
import { dispatchedCallPart, resultRow } from '../../tests/helpers/tool-search-envelope.mjs';

const N = 'R-CONFIG-DEFAULTS-1794981360000-abcd1234';
const CONFIG = { enabled: true, maxChainLength: 10, maxDelegatesPerTurn: 3, costCapTokens: 500000 };
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const MISMATCH = { name: 'sessions_spawn', id: 'openclaw:core:sessions_spawn' };

function call(id, tool, args, via) {
  return { role: 'assistant', content: [via === 'direct' ? { type: 'toolCall', id, name: tool, arguments: args } : dispatchedCallPart(id, tool, args)] };
}

function configRows(via, envelope) {
  const args = { action: 'config.get', path: 'agents.defaults.continuation' };
  return [
    user(`[k6-proof-harness] ${N}`),
    call('gw-1', 'gateway', args, via),
    resultRow({ toolCallId: 'gw-1', tool: 'gateway', payload: { ok: true, result: { path: 'agents.defaults.continuation', config: CONFIG } }, via, envelope }),
    say(`CONFIG-DEFAULTS ${N} ENABLED true MAXCHAIN 10 MAXDELEGATES 3 COSTCAP 500000`),
  ];
}

const byName = (receipts) => Object.fromEntries(receipts.map((r) => [r.name, r]));

for (const via of ['direct', 'dispatch']) {
  test(`R-CONFIG-DEFAULTS recovery reads the gateway tool's config.get answer (${via})`, () => {
    const receipts = byName(evaluate('R-CONFIG-DEFAULTS', N, configRows(via)));
    assert.equal(receipts['config-read-tool-call'].status, 'present');
    assert.equal(receipts['config-read-tool-result'].status, 'present');
    assert.equal(receipts['config-read-tool-result'].maxChainLength, 10);
  });
}

test('R-CONFIG-DEFAULTS recovery: an envelope naming another tool is no config result', () => {
  const receipts = byName(evaluate('R-CONFIG-DEFAULTS', N, configRows('dispatch', MISMATCH)));
  assert.equal(receipts['config-read-tool-result'].status, 'missing');
});

function cwRows(via, envelope) {
  const nonce = 'R-CW-1-1794981360000-abcd1234';
  const reason = `k6-proof-R-CW-1-${nonce}`;
  return {
    nonce,
    rows: [
      user(`[k6-proof-harness] Call continue_work with reason="${reason}" and delaySeconds=5. ${nonce}`),
      { ...call('cw-1', 'continue_work', { reason, delaySeconds: 5 }, via), __openclaw: { runId: 'run-d' } },
      resultRow({ toolCallId: 'cw-1', tool: 'continue_work', payload: { status: 'scheduled', delaySeconds: 5 }, via, envelope, runId: 'run-d' }),
      { ...say(`CW-SCHEDULED ${nonce}`), __openclaw: { runId: 'run-d' } },
      user(`[continuation:wake] Turn 1/200. Prior reason: "${reason}"`),
      { ...say(`CW-WOKE ${nonce}`), __openclaw: { runId: 'run-w' } },
    ],
  };
}

for (const via of ['direct', 'dispatch']) {
  test(`R-CW-1 recovery binds the scheduled hop and reads its delaySeconds (${via})`, () => {
    const { nonce, rows } = cwRows(via);
    const receipts = byName(evaluate('R-CW-1', nonce, rows));
    assert.equal(receipts['continue-work-tool-result-scheduled'].status, 'present');
    assert.equal(receipts['continue-work-tool-result-scheduled'].delaySeconds, 5);
    assert.equal(receipts['work-woke-event'].status, 'present');
  });
}

test('R-CW-1 recovery: an envelope naming another tool schedules nothing', () => {
  const { nonce, rows } = cwRows('dispatch', MISMATCH);
  const receipts = byName(evaluate('R-CW-1', nonce, rows));
  assert.equal(receipts['continue-work-tool-result-scheduled'].status, 'missing');
  assert.equal(receipts['continue-work-tool-result-scheduled'].delaySeconds, undefined);
});
