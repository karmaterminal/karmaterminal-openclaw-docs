import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sanitizeEvidenceRecords, sanitizeServiceLog } from '../sanitize-k6-artifacts.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../sanitize-k6-artifacts.mjs');

function k6Line(message) {
  return `time="2026-07-12T19:42:00Z" level=info msg=${JSON.stringify(message)} source=console`;
}

test('removes identity fields and scrubs their values recursively', () => {
  const nonce = 'R-CD-1-1783882863334-sensitive';
  const sessionKey = `agent:main:r-cd-1-${nonce}`;
  const runId = `run-${nonce}`;
  const flowId = `flow-${nonce}`;
  const taskId = `task-${nonce}`;
  const toolCallId = `tool-call-${nonce}`;
  const record = {
    row: 'R-CD-1',
    nonce,
    sessionKey,
    requestedSessionKey: 'main',
    run_id: runId,
    flow_id: flowId,
    task_id: taskId,
    tool_call_id: toolCallId,
    expected_task: `Proof nonce ${nonce}: reply exactly`,
    expected_return_sentinel: `CD1-DONE ${nonce}`,
    child_session: sessionKey,
    reason_hash: 'adfa6bb5a86112ed',
    reason_length: 139,
    wake_runs: {
      [runId]: {
        diagnostic: `${flowId} ${taskId} ${toolCallId}`,
      },
    },
    redacted_events: [{ data: { sessionKey, message: `Proof nonce ${nonce}` } }],
  };

  const { sanitized } = sanitizeEvidenceRecords([record]);
  const serialized = JSON.stringify(sanitized[0]);
  assert.equal(sanitized[0].reason_hash, 'adfa6bb5a86112ed');
  assert.equal(sanitized[0].reason_length, 139);
  assert.equal('nonce' in sanitized[0], false);
  assert.equal('sessionKey' in sanitized[0], false);
  assert.equal('run_id' in sanitized[0], false);
  assert.equal('redacted_events' in sanitized[0], false);
  assert.doesNotMatch(serialized, new RegExp(nonce));
  assert.doesNotMatch(serialized, new RegExp(sessionKey));
  assert.doesNotMatch(serialized, new RegExp(runId));
  assert.doesNotMatch(serialized, new RegExp(flowId));
  assert.doesNotMatch(serialized, new RegExp(taskId));
  assert.doesNotMatch(serialized, new RegExp(toolCallId));
  assert.equal(Object.keys(sanitized[0].wake_runs).some((key) => key.includes(runId)), false);
  assert.match(sanitized[0].expected_return_sentinel, /<redacted-nonce>/);
});

test('CLI writes only public-safe evidence and log artifacts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sanitize-k6-test-'));
  const nonce = 'R-CD-1-1783882863334-sensitive';
  const sessionKey = `agent:main:r-cd-1-${nonce}`;
  const evidence = {
    row: 'R-CD-1',
    nonce,
    sessionKey,
    reason_hash: 'adfa6bb5a86112ed',
    reason_length: 139,
    expected_return_sentinel: `CD1-DONE ${nonce}`,
    redacted_events: [{ data: { sessionKey } }],
  };
  const input = path.join(dir, 'private.jsonl');
  const logInput = path.join(dir, 'private.log');
  const output = path.join(dir, 'evidence.jsonl');
  const linesOutput = path.join(dir, 'evidence-lines.log');
  const receiptOutput = path.join(dir, 'evidence-redaction.json');
  const logOutput = path.join(dir, 'k6.log');
  const serviceLogInput = path.join(dir, 'private-gateway.log');
  const serviceLogOutput = path.join(dir, 'gateway-journal.log');
  const serviceLogReceipt = path.join(dir, 'gateway-journal-redaction.json');
  await writeFile(input, `${JSON.stringify(evidence)}\n`);
  await writeFile(logInput, [
    k6Line(`[k6-proof-harness] Call continue_delegate task="Proof nonce ${nonce}" session=${sessionKey}`),
    k6Line('\n--- R-CD-1 EVIDENCE SUMMARY ---'),
    k6Line(JSON.stringify(evidence, null, 2)),
    k6Line('--- END EVIDENCE ---'),
  ].join('\n'));
  await writeFile(serviceLogInput, [
    `Jul 12 19:42:00 host openclaw[123]: continuation dispatch session=${sessionKey}`,
    `Jul 12 19:42:01 host openclaw[123]: Model override "github-copilot/claude-sonnet-4.6" is not allowed for agent "main" nonce=${nonce}`,
    'Jul 12 19:42:02 host openclaw[123]: OPENCLAW_GATEWAY_TOKEN=super-secret-gateway-token failure',
    `Jul 12 19:42:02 host openclaw[123]: continuation:delegate-spawned nonce=${nonce} task=Proof nonce ${nonce}: read your runtime context/current model identity`,
    'Jul 12 19:42:03 host openclaw[123]: unrelated routine heartbeat',
  ].join('\n'));

  try {
    await execFileAsync(process.execPath, [
      script,
      '--input', input,
      '--out', output,
      '--lines-out', linesOutput,
      '--receipt-out', receiptOutput,
      '--log-input', logInput,
      '--log-out', logOutput,
      '--service-log-input', serviceLogInput,
      '--service-log-out', serviceLogOutput,
      '--service-log-receipt-out', serviceLogReceipt,
    ], { env: { ...process.env, OPENCLAW_SESSION_KEY: sessionKey } });

    for (const file of [
      output,
      linesOutput,
      receiptOutput,
      logOutput,
      serviceLogOutput,
      serviceLogReceipt,
    ]) {
      const text = await readFile(file, 'utf8');
      assert.doesNotMatch(text, new RegExp(nonce));
      assert.doesNotMatch(text, new RegExp(sessionKey));
    }
    assert.match(await readFile(logOutput, 'utf8'), /\[k6-proof-harness\] <redacted-dispatch>/);
    assert.match(await readFile(linesOutput, 'utf8'), /PUBLIC_EVIDENCE/);
    const serviceLog = await readFile(serviceLogOutput, 'utf8');
    assert.match(serviceLog, /openclaw\.k6\.public-service-log-record\.v1/);
    assert.doesNotMatch(serviceLog, /OPENCLAW_GATEWAY_TOKEN/);
    assert.match(serviceLog, /nonceFingerprint/);
    assert.doesNotMatch(serviceLog, /Model override|delegate-spawned|task=/);
    assert.doesNotMatch(serviceLog, /super-secret-gateway-token/);
    assert.doesNotMatch(serviceLog, /read your runtime context/);
    assert.doesNotMatch(serviceLog, /unrelated routine heartbeat/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('service log identity must be a supported structured field, not a note or body mention', () => {
  const { orderedTokens } = sanitizeEvidenceRecords([{ run_id: 'row-run-123', nonce: 'row-nonce-123' }]);
  const unrelated = [
    'continuation runId=other-run note=row-run-123 unrelated-private-line',
    'continuation runId=other-run body=row-run-123 unrelated-private-line',
    'continuation runId=other-run note="runId=row-run-123" unrelated-private-line',
    'continuation runId=other-run note=unrelated runId=row-run-123 unrelated-private-line',
    'continuation runId=other-run runId=row-run-123 unrelated-private-line',
    '{"runId":"other-run","note":"row-run-123","body":"unrelated-private-line"}',
    '{"runId":"other-run","body":{"runId":"row-run-123","note":"unrelated-private-line"}}',
    'continuation task=Proof nonce row-nonce-123 unrelated-private-line',
    '{"runId":"row-run-123", invalid unrelated-private-line}',
    'continuation taskId=row-run-123 unrelated-private-line',
  ];
  const positive = [
    'continuation runId=row-run-123 status=ok',
    'continuation run_id="row-run-123" status=ok',
    '{"runId":"row-run-123","status":"ok"}',
    'Sep 05 host gateway[123]: {"fields":{"runId":"row-run-123"},"status":"ok"}',
    'continuation nonce=row-nonce-123 status=ok',
  ];
  const result = sanitizeServiceLog([...unrelated, ...positive].join('\n'), orderedTokens);
  assert.equal(result.retainedLines, positive.length);
  assert.doesNotMatch(result.text, /unrelated-private-line|row-run-123|row-nonce-123/);
});
