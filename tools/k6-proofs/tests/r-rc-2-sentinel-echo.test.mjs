// R-RC-2 child reports come only from the child's own transcript
// (karmaterminal/openclaw-bootstrap#1727).
//
// Live trap (F′ f15237ec92, run 20261030T014846Z-r-rc-2-44aa4c89): the measured
// toolResult receipt was real (contextUsage 13, threshold 70, read from the
// child transcript), but the HONEST-LIMIT's child-report half was set by the
// parent-stream "auxiliary" path at 18:49:29 with context=unknown
// threshold=unknown. That is what the regex returns on the child task's
// `<contextUsage>` placeholder: the parent's own continue_delegate call (and
// the return's `task:` line) carries every REQUEST_COMPACTION_* sentinel. The
// child-transcript report never bound (child_report_source absent).
//
// Each test fires the real scenario (k6 runtime stubbed) against a scripted
// gateway with openclaw f15237ec92 shapes. The echo test imports nothing added
// with the fix and runs against the pre-fix tree as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROW_METHODS } from '../lib/child-observer.mjs';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = 'agent:main:r-rc-2-parent';
const CHILD = 'agent:main:subagent:continuation-r-rc-2-child';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const call = (id, name, args, runId) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], __openclaw: { runId } });
const result = (id, name, payload, runId) => ({ role: 'toolResult', toolCallId: id, toolName: name, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false, __openclaw: { runId } });

/**
 * world:
 *   compaction: 'measured' | 'accepted'
 *   childReport: true when the child's own transcript carries its report
 */
function gatewayFor(world) {
  let task = null;
  let nonce = null;
  const childTranscript = () => {
    const rows = [
      user(`[Subagent Task]\n\n${task}`),
      say(`RRC2-CHILD-READY ${nonce}`, 'run-c1'),
      call('cw-1', 'continue_work', { delaySeconds: 5, reason: `R-RC-2 measured wake nonce ${nonce}` }, 'run-c1'),
      result('cw-1', 'continue_work', { status: 'scheduled' }, 'run-c1'),
      user(`[continuation:wake] Turn 1/200. Prior reason: ${JSON.stringify(`R-RC-2 measured wake nonce ${nonce}`)}`),
      call('rc-1', 'request_compaction', { reason: `R-RC-2 delegated request_compaction nonce ${nonce}` }, 'run-c2'),
      result('rc-1', 'request_compaction', world.compaction === 'accepted'
        ? { status: 'compaction_requested', compactionRequestId: 'd', trigger: 'volitional', contextUsage: 81, reason: 'x', note: 'n' }
        : { status: 'rejected', guard: 'context_threshold', contextUsage: 13, threshold: 70, reason: 'below' }, 'run-c2'),
    ];
    if (world.childReport && world.compaction !== 'accepted') rows.push(say(`REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD ${nonce} CONTEXT 13 THRESHOLD 70`, 'run-c2'));
    if (world.compaction === 'accepted') {
      rows.push(say(`REQUEST_COMPACTION_ACCEPTED ${nonce}`, 'run-c2'));
      if (world.childReport) rows.push(say(`REQUEST_COMPACTION_POST_COMPACTION ${nonce}`, 'run-c3'));
    }
    return rows;
  };
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [...ROW_METHODS['R-RC-2']] } });
      case 'sessions.create': return ok({ key: PARENT });
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': {
        const message = String(frame.params?.message || '');
        // The instruction quotes the task raw (it holds its own quoted reasons), so
        // take everything up to the instruction's closing sentence.
        task = /task="([\s\S]*)"\. No other action\./.exec(message)[1];
        nonce = /R-RC-2 nonce (\S+)\./.exec(message)[1];
        const delegateCall = call('cd-1', 'continue_delegate', { mode: 'normal', delaySeconds: 1, task }, 'run-p');
        return [
          ...ok({ runId: 'run-p' }),
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: delegateCall, runId: 'run-p' } },
          { type: 'event', event: 'session.message', payload: { sessionKey: PARENT, message: result('cd-1', 'continue_delegate', { status: 'scheduled', mode: 'normal' }, 'run-p'), runId: 'run-p' } },
          // The F′ echo: the child task (with every REQUEST_COMPACTION_* sentinel) on the parent stream.
          { type: 'event', event: 'agent', payload: { runId: 'run-p', sessionKey: PARENT, stream: 'item', data: { name: 'continue_delegate', meta: { task } } } },
        ];
      }
      case 'sessions.list':
        return ok({ sessions: frame.params?.spawnedBy === PARENT && task ? [{ key: CHILD, spawnedBy: PARENT, status: 'done' }] : [], hasMore: false });
      case 'chat.history':
        return ok({ messages: frame.params?.sessionKey === CHILD && task ? childTranscript() : [], hasMore: false });
      default:
        return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(world) {
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-rc-2-delegate-request-compaction.js'),
    gateway: gatewayFor(world),
    env: {
      OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-rc-2.json'),
      OPENCLAW_GATEWAY_TOKEN: 'r-rc-2-sentinel-echo-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9',
      OPENCLAW_SEAT_NAME: 'emeric-proof',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
    },
  });
  const records = extractEvidence(log);
  assert.equal(records.length, 1, `one R-RC-2 evidence record:\n${log}`);
  return { evidence: records[0], verdict: /\[R-RC-2\] VERDICT: ([A-Z-]+-candidate)/.exec(log)?.[1] };
}

test('F′ echo: the child task on the parent stream never stands in for the child\'s own report', async () => {
  const { evidence, verdict } = await fire({ compaction: 'measured', childReport: false });
  assert.equal(evidence.request_compaction_context_measured, true, 'the measured receipt itself is real');
  assert.notEqual(evidence.delegate_child_report_observed, true);
  assert.notEqual(evidence.child_reported_context_threshold, true);
  assert.notEqual(verdict, 'HONEST-LIMIT-candidate', 'HONEST-LIMIT needs the child\'s own report');
});

test('the child\'s own report after the measured receipt is the HONEST-LIMIT', async () => {
  const { evidence, verdict } = await fire({ compaction: 'measured', childReport: true });
  assert.equal(evidence.child_reported_context_threshold, true);
  assert.match(evidence.child_report_source, /child chat\.history/);
  assert.equal(evidence.reported_context_usage, 13);
  assert.equal(verdict, 'HONEST-LIMIT-candidate');
});

test('an accepted compaction with only a parent-stream post-compaction echo is not PASS', async () => {
  const { evidence, verdict } = await fire({ compaction: 'accepted', childReport: false });
  assert.equal(evidence.request_compaction_accepted, true);
  assert.notEqual(evidence.post_compaction_path_observed, true);
  assert.equal(evidence.parent_stream_post_compaction_text_seen, true);
  assert.notEqual(verdict, 'PASS-candidate');
});

test('the child\'s own post-compaction report in a later run passes', async () => {
  const { evidence, verdict } = await fire({ compaction: 'accepted', childReport: true });
  assert.equal(evidence.post_compaction_path_observed, true);
  assert.equal(verdict, 'PASS-candidate');
});
