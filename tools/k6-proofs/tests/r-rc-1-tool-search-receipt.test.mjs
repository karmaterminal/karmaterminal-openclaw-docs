// R-RC-1 on a Tool Search seat (openclaw/openclaw#129388; lane proof-rows-adjudicate-10
// finding H1, run 44245772142).
//
// Live: emeric (openclaw ab5a30ea79, Tool Search on) answered R-RC-1's
// request_compaction through dispatch_action. The scenario's sessions.get read
// took the row's details first, which on a dispatcher row are the dispatcher's
// { tool: <catalog entry>, result } (tool-search.ts:421). Its k6 log printed
// that receipt, starting {"tool":{"id":"openclaw:core:request_compaction",
// "source":"openclaw","sourceName":"core","name":"request_compaction","label":...,
// and the row recorded tool_result_status "invalid": no top-level status.
// The live-event signal that fetches the transcript also ignored the
// dispatcher's row (no toolCallId to bind it), so only the assistant sentinel
// could trigger the read.
//
// Each test fires the real scenario (k6 runtime stubbed) against a gateway
// scripted on those shapes; viaToolSearch re-shapes its rows the way a Tool
// Search seat records them. sessions.get rows keep details, as the live log shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';
import { jsonResult, viaToolSearch } from './helpers/tool-search-envelope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'agent:main:r-rc-1-tool-search';
const MEASURED = { status: 'rejected', guard: 'context_threshold', contextUsage: 4, threshold: 70, reason: 'Context usage 4% is below the 70% compaction threshold.' };
// request-compaction-tool.ts:212-223 at ab5a: a fresh session's first turn has no fresh totals (H4).
const UNMEASURED = { status: 'rejected', guard: 'context_unmeasured', cause: 'no_fresh_usage', reason: 'Context usage is not measured yet.' };

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });

/** world.answer: the tool's answer; world.sentinel: whether the agent writes RC1-RESULT-OBSERVED. */
function gatewayFor({ answer = MEASURED, sentinel = true } = {}) {
  let transcript = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    const ev = (message) => ({ type: 'event', event: 'session.message', payload: { sessionKey: SESSION, message } });
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: SESSION });
      case 'tools.effective': return ok({ groups: [{ id: 'core', tools: [{ id: 'request_compaction' }, { id: 'message' }] }] });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const reason = JSON.parse(/reason=("(?:[^"\\]|\\.)*")/.exec(message)[1]);
        const nonce = /RC1-RESULT-OBSERVED (R-RC-1-\S+?)\./.exec(message)[1];
        const call = { role: 'assistant', content: [{ type: 'toolCall', id: 'call_rc1', name: 'request_compaction', arguments: { reason } }], __openclaw: { runId: 'run-d' } };
        const result = { role: 'toolResult', toolCallId: 'call_rc1', toolName: 'request_compaction', isError: false, ...jsonResult(answer), __openclaw: { runId: 'run-d' } };
        transcript = [user(message), call, result, ...(sentinel ? [say(`RC1-RESULT-OBSERVED ${nonce}`, 'run-d')] : [])];
        return [...ok({ runId: 'run-d' }), ...transcript.slice(1).map(ev)];
      }
      case 'sessions.get': return ok({ key: SESSION, messages: transcript });
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world, wrap = (gateway) => gateway) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-rc-1-threshold-reject.js'),
    gateway: wrap(gatewayFor(world)),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-rc-1.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-rc-1-tool-search-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-RC-1 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-RC-1\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1], log };
}

test('direct: the measured below-threshold rejection is the authoritative receipt', async () => {
  const { evidence, verdict } = await fire({});
  assert.equal(evidence.tool_result_status, 'rejected');
  assert.equal(evidence.guard, 'context_threshold');
  assert.equal(evidence.tool_call_nonce_bound, true);
  assert.equal(verdict, 'PASS-candidate');
});

test('through Tool Search: the dispatched request_compaction answer is the receipt, not the dispatcher\'s details', async () => {
  const { evidence, verdict, log } = await fire({}, viaToolSearch);
  assert.equal(evidence.tool_result_status, 'rejected', 'run 44245772142 recorded "invalid" here');
  assert.equal(evidence.guard, 'context_threshold');
  assert.equal(evidence.context_usage, 4);
  assert.equal(evidence.tool_call_nonce_bound, true);
  assert.doesNotMatch(log, /\\"receipt\\":\{\\"tool\\":/, 'the catalog entry is never logged as the receipt');
  assert.equal(verdict, 'PASS-candidate');
});

test('through Tool Search with no assistant sentinel: the dispatcher\'s result event still fetches the transcript', async () => {
  const { evidence, verdict } = await fire({ sentinel: false }, viaToolSearch);
  assert.equal(evidence.history_requested, true, 'the dispatched result event signals the transcript read');
  assert.equal(evidence.guard, 'context_threshold');
  assert.equal(verdict, 'PASS-candidate');
});

test('through Tool Search, first-turn unmeasured usage (H4): the true answer reads, and it is no threshold receipt', async () => {
  const { evidence, verdict, log } = await fire({ answer: UNMEASURED }, viaToolSearch);
  assert.equal(evidence.tool_result_status, 'rejected');
  assert.equal(evidence.tool_invoke_rejected, false);
  assert.match(log, /\\"guard\\":\\"context_unmeasured\\"/, 'the next blocker after H1 is visible in the k6 log');
  assert.equal(verdict, 'PARTIAL-candidate');
});

test('through Tool Search: an envelope naming another tool is no receipt', async () => {
  const { evidence, verdict } = await fire({}, (gateway) => viaToolSearch(gateway, { envelope: () => ({ name: 'sessions_spawn', id: 'openclaw:core:sessions_spawn' }) }));
  assert.notEqual(evidence.guard, 'context_threshold');
  assert.equal(evidence.tool_invoke_rejected, false);
  assert.notEqual(verdict, 'PASS-candidate');
});
