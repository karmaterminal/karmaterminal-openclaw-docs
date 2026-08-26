import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sanitizeEvidenceRecords } from '../sanitize-k6-artifacts.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../sanitize-k6-artifacts.mjs');

function k6Line(message) {
  return `time="2026-07-12T19:42:00Z" level=info msg=${JSON.stringify(message)} source=console`;
}

test('removes identity fields and scrubs their values recursively', () => {
  const nonce = 'R-CD-1-1783882863334-sensitive';
  const sessionKey = `agent:main:r-cd-1-${nonce}`;
  const record = {
    row: 'R-CD-1',
    nonce,
    sessionKey,
    requestedSessionKey: 'main',
    run_id: `run-${nonce}`,
    expected_task: `Proof nonce ${nonce}: reply exactly`,
    expected_return_sentinel: `CD1-DONE ${nonce}`,
    child_session: sessionKey,
    reason_hash: 'adfa6bb5a86112ed',
    reason_length: 139,
    redacted_events: [{
      ts: 1783882863334,
      kind: 'event',
      method: null,
      event: 'agent',
      ok: true,
      data: {
        sessionKey,
        taskId: 'private-task-id',
        message: `Proof nonce ${nonce}`,
        reason: 'private chain task text',
      },
    }],
  };

  const { sanitized } = sanitizeEvidenceRecords([record]);
  const serialized = JSON.stringify(sanitized[0]);
  assert.equal(sanitized[0].reason_hash, 'adfa6bb5a86112ed');
  assert.equal(sanitized[0].reason_length, 139);
  assert.equal('nonce' in sanitized[0], false);
  assert.equal('sessionKey' in sanitized[0], false);
  assert.equal('run_id' in sanitized[0], false);
  assert.equal('redacted_events' in sanitized[0], false);
  assert.deepEqual(sanitized[0].gatewayEventReceipts, [{
    ts: 1783882863334,
    kind: 'event',
    method: null,
    event: 'agent',
    ok: true,
  }]);
  assert.doesNotMatch(serialized, new RegExp(nonce));
  assert.doesNotMatch(serialized, new RegExp(sessionKey));
  assert.doesNotMatch(serialized, /private-task-id|private chain task text/);
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
    redacted_events: [{
      ts: 1783882863334,
      kind: 'response',
      method: 'sessions.send',
      event: null,
      ok: true,
      data: { sessionKey, message: `Proof nonce ${nonce}` },
    }],
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
    `Jul 12 19:42:02 host openclaw[123]: continuation:delegate-spawned task=Proof nonce ${nonce}: read your runtime context/current model identity`,
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
    const publicEvidence = JSON.parse((await readFile(output, 'utf8')).trim());
    assert.deepEqual(publicEvidence.gatewayEventReceipts, [{
      ts: 1783882863334,
      kind: 'response',
      method: 'sessions.send',
      event: null,
      ok: true,
    }]);
    const serviceLog = await readFile(serviceLogOutput, 'utf8');
    assert.match(serviceLog, /Model override "github-copilot\/claude-sonnet-4\.6" is not allowed/);
    assert.match(serviceLog, /OPENCLAW_GATEWAY_TOKEN=<redacted-secret>/);
    assert.match(serviceLog, /delegate-spawned task=<redacted-payload>/);
    assert.doesNotMatch(serviceLog, /super-secret-gateway-token/);
    assert.doesNotMatch(serviceLog, /read your runtime context/);
    assert.doesNotMatch(serviceLog, /unrelated routine heartbeat/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
