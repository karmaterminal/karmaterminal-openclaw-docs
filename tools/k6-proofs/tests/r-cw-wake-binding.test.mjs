// continue_work schedule-and-wake binding for R-CW-1/2/3/4 (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (F′ f15237ec92): R-CW-1/2/3 put "on continuation wake reply exactly
// CW*-WOKE <nonce>" inside the continue_work reason. The reason reaches a
// subscriber in the agent's own tool call and again, quoted twice, in the wake
// input (src/auto-reply/continuation/work-dispatch-execution.ts:165-226), and
// the scenarios credited any event carrying the sentinel. R-CW-3's canonical
// run matched CW3-WOKE 5.3 s after scheduling with a 5 s delay: the wake input,
// not the woken agent. R-CW-4's hop sentinels were credited from any event.
//
// Each scenario test fires the real scenario (k6 runtime stubbed) against a
// scripted gateway whose rows follow openclaw f15237ec92: the tool call with
// its arguments verbatim, the toolResult JSON, the wake input as a user row.
// The echo tests use a reason that still carries the wake sentinel (the F′
// shape) and import nothing added with the fix, so they run against the
// pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'agent:main:r-cw-disposable';
const scratch = mkdtempSync(path.join(tmpdir(), 'r-cw-wake-binding-'));

const ROWS = {
  'R-CW-1': { scenario: 'r-cw-1-tool-schedule-wake.js', manifest: 'r-cw-1.json', scheduled: 'CW-SCHEDULED', woke: 'CW-WOKE', wokeField: 'work_woke_event', scheduledField: 'continue_work_tool_result_scheduled', f1Reason: 'k6-proof-R-CW-1-{{nonce}} -- on continuation wake reply exactly CW-WOKE {{nonce}}' },
  'R-CW-2': { scenario: 'r-cw-2-immediate-wake.js', manifest: 'r-cw-2.json', scheduled: 'CW2-SCHEDULED', woke: 'CW2-WOKE', wokeField: 'immediate_wake_observed', scheduledField: 'scheduled_sentinel', f1Reason: 'k6-proof-R-CW-2-immediate-{{nonce}} -- on continuation wake reply exactly CW2-WOKE {{nonce}}' },
  'R-CW-3': { scenario: 'r-cw-3-reason-telemetry.js', manifest: 'r-cw-3.json', scheduled: 'CW3-SCHEDULED', woke: 'CW3-WOKE', wokeField: 'wake_observed', scheduledField: 'scheduled_sentinel', f1Reason: 'k6-proof-R-CW-3-redaction RAW-RCW3-{{nonce}}; on continuation wake reply exactly CW3-WOKE {{nonce}}' },
};

/** A manifest copy: optional F′-shaped reason, delay 0 so no clock gate hides an echo. */
function manifestFor(row, { f1Reason = false } = {}) {
  const spec = ROWS[row];
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifests', spec.manifest), 'utf8'));
  manifest.invocation = { ...manifest.invocation, delaySeconds: 0 };
  if (f1Reason) manifest.invocation.reason = spec.f1Reason;
  const file = path.join(scratch, `${row}-${f1Reason ? 'f1' : 'current'}.json`);
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const call = (id, reason, runId) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'continue_work', arguments: { reason, delaySeconds: 0 } }], __openclaw: { runId } });
const scheduled = (id, runId) => ({ role: 'toolResult', toolCallId: id, toolName: 'continue_work', content: [{ type: 'text', text: JSON.stringify({ status: 'scheduled', delaySeconds: 0 }, null, 2) }], __openclaw: { runId } });
const wake = (reason, hop) => user(`[continuation:wake] Turn ${hop}/200. The agent elected to continue working. Prior reason: ${JSON.stringify(reason)} [provenance] Disposition: granted Prior reason: ${JSON.stringify(reason)}`);
const reasonFrom = (message) => /reason=("(?:[^"\\]|\\.)*")/.exec(message)?.[1] ? JSON.parse(/reason=("(?:[^"\\]|\\.)*")/.exec(message)[1]) : /Supplied reason: ("(?:[^"\\]|\\.)*")/.exec(message)?.[1] ? JSON.parse(/Supplied reason: ("(?:[^"\\]|\\.)*")/.exec(message)[1]) : null;

/**
 * One-hop gateway. The dispatch turn calls continue_work and says the
 * scheduled sentinel; the wake input (quoting the reason) follows. With
 * `wakeReply`, the woken run answers the wake sentinel; without it the only
 * wake-sentinel text anywhere is the agent's own call and the wake input.
 */
function oneHopGateway(spec, { wakeReply }) {
  const transcript = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    const ev = (message, runId) => ({ type: 'event', event: 'session.message', payload: { sessionKey: SESSION, message, runId } });
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: SESSION });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const nonce = /(R-CW-\d-\d+-[a-z0-9]+)/.exec(message)?.[1];
        const reason = reasonFrom(message);
        const rows = [user(message), call('cw-1', reason, 'run-d'), scheduled('cw-1', 'run-d'), say(`${spec.scheduled} ${nonce}`, 'run-d'), wake(reason, 1)];
        if (wakeReply) rows.push(say(`${spec.woke} ${nonce}`, 'run-w'));
        transcript.push(...rows);
        return [
          ...ok({ runId: 'run-d' }),
          ...rows.slice(1).map((row) => ev(row, row.__openclaw?.runId)),
          { type: 'event', event: 'agent', payload: { runId: 'run-d', sessionKey: SESSION, stream: 'item', data: { name: 'continue_work', meta: { reason } } } },
        ];
      }
      case 'chat.history': return ok({ messages: transcript, hasMore: false });
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(row, { manifest, gateway }) {
  const spec = ROWS[row] || { scenario: 'r-cw-4-chain-depth.js' };
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', spec.scenario),
    gateway,
    env: {
      OPENCLAW_ROW_MANIFEST: manifest,
      OPENCLAW_GATEWAY_TOKEN: 'r-cw-wake-binding-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:subagent:continuation-r-cw-wake',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
    },
  });
  const records = extractEvidence(log);
  assert.ok(records.length >= 1, `an evidence record:\n${log}`);
  return { evidence: records[records.length - 1], log };
}

for (const row of Object.keys(ROWS)) {
  const spec = ROWS[row];
  test(`${row} F′ echo: the reason echo in the call and the wake input never counts as the woken agent`, async () => {
    const { evidence } = await fire(row, { manifest: manifestFor(row, { f1Reason: true }), gateway: oneHopGateway(spec, { wakeReply: false }) });
    assert.notEqual(evidence[spec.wokeField], true, `${row}: the wake sentinel came only from the agent's own reason and the wake input`);
  });

  test(`${row}: the woken turn's own answer binds the wake`, async () => {
    const { evidence, log } = await fire(row, { manifest: manifestFor(row), gateway: oneHopGateway(spec, { wakeReply: true }) });
    assert.equal(evidence[spec.scheduledField], true, log);
    assert.equal(evidence[spec.wokeField], true, evidence.chain_reason);
    if (row !== 'R-CW-3') assert.match(log, new RegExp(`\\[${row}\\] VERDICT: PASS-candidate`));
  });

  test(`${row}: the shipped reason carries no wake sentinel`, () => {
    const manifest = JSON.parse(readFileSync(path.join(root, 'manifests', spec.manifest), 'utf8'));
    assert.doesNotMatch(manifest.invocation.reason, new RegExp(spec.woke));
    assert.match(manifest.invocation.reason, /\{\{nonce\}\}/);
  });
}

// --- R-CW-4 -----------------------------------------------------------------

function chainGateway({ withTranscript }) {
  const transcript = [];
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return ok({ key: SESSION });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        const nonce = /R-CW-4 proof nonce (\S+)\./.exec(message)?.[1];
        const reasons = [...message.matchAll(/reason="([^"]+)"/g)].map((m) => m[1]);
        if (withTranscript) {
          transcript.push(user(message));
          reasons.forEach((reason, i) => {
            const run = `run-${i}`;
            transcript.push(call(`cw-${i}`, reason, run), scheduled(`cw-${i}`, run), say(`CW4-HOP${i + 1}-SCHEDULED ${nonce}`, run), wake(reason, i + 1));
          });
          transcript.push(say(`CW4-DONE ${nonce}`, 'run-3'));
        }
        // The stream the pre-fix scenario credited: every sentinel as agent text.
        return [
          ...ok({ runId: 'run-0' }),
          ...['CW4-HOP1-SCHEDULED', 'CW4-HOP2-SCHEDULED', 'CW4-HOP3-SCHEDULED', 'CW4-DONE'].map((marker) => ({
            type: 'event', event: 'agent', payload: { runId: 'run-0', stream: 'assistant', data: { text: `${marker} ${nonce}` } },
          })),
          { type: 'event', event: 'session.message', payload: { sessionKey: SESSION, message: say('noise', 'run-0') } },
        ];
      }
      case 'chat.history': return ok({ messages: transcript, hasMore: false });
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

test('R-CW-4: hop sentinels on the event stream alone never bind a hop', async () => {
  const { evidence } = await fire('R-CW-4', { manifest: path.join(root, 'manifests', 'r-cw-4.json'), gateway: chainGateway({ withTranscript: false }) });
  assert.notEqual(evidence.final_done, true);
  assert.notEqual(evidence.hop1_scheduled, true);
});

test('R-CW-4: three transcript-bound hops and CW4-DONE in the third wake turn pass', async () => {
  const { evidence, log } = await fire('R-CW-4', { manifest: path.join(root, 'manifests', 'r-cw-4.json'), gateway: chainGateway({ withTranscript: true }) });
  assert.equal(evidence.hop1_scheduled, true, evidence.chain_reason);
  assert.equal(evidence.hop2_scheduled, true);
  assert.equal(evidence.hop3_scheduled, true);
  assert.equal(evidence.final_done, true);
  assert.match(log, /\[R-CW-4\] VERDICT: PASS-candidate/);
});
