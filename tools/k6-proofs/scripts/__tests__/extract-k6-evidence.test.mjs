import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../extract-k6-evidence.mjs';

const execFileAsync = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../extract-k6-evidence.mjs');

function k6Line(message) {
  return `time="2026-07-12T22:15:52Z" level=info msg=${JSON.stringify(message)} source=console`;
}

test('extracts banner-followed multiline k6 evidence', () => {
  const evidence = {
    row: 'R-CD-1',
    nonce: 'R-CD-1-example',
    trace_id: null,
    parent_return_event: true,
  };
  const log = [
    k6Line('\n--- R-CD-1 EVIDENCE SUMMARY ---'),
    k6Line(JSON.stringify(evidence, null, 2)),
    k6Line('--- END EVIDENCE ---'),
  ].join('\n');

  assert.deepEqual(extractEvidence(log), [evidence]);
});

test('extracts existing inline evidence records', () => {
  const evidence = { row: 'R-CD-2', nonce: 'R-CD-2-example', parent_wake_observed: true };
  const log = k6Line(`RCD2_EVIDENCE ${JSON.stringify(evidence)}`);

  assert.deepEqual(extractEvidence(log), [evidence]);
});

test('deduplicates identical inline and summary evidence records', () => {
  const evidence = { row: 'R-CD-2', nonce: 'R-CD-2-example', parent_wake_observed: true };
  const log = [
    k6Line(`RCD2_EVIDENCE ${JSON.stringify(evidence)}`),
    k6Line('\n--- R-CD-2 EVIDENCE SUMMARY ---'),
    k6Line(JSON.stringify(evidence, null, 2)),
    k6Line('--- END EVIDENCE ---'),
  ].join('\n');

  assert.deepEqual(extractEvidence(log), [evidence]);
});

test('preserves distinct evidence records so ambiguous runs still fail closed', () => {
  const first = { row: 'R-CD-2', nonce: 'R-CD-2-example', parent_wake_observed: false };
  const second = { ...first, parent_wake_observed: true };
  const log = [
    k6Line(`RCD2_EVIDENCE ${JSON.stringify(first)}`),
    k6Line(`RCD2_EVIDENCE ${JSON.stringify(second)}`),
  ].join('\n');

  assert.deepEqual(extractEvidence(log), [first, second]);
});

test('does not mistake unrelated JSON logs for evidence', () => {
  const log = k6Line(JSON.stringify({ method: 'sessions.send', ok: true }));
  assert.deepEqual(extractEvidence(log), []);
});

test('writes complete selected evidence lines through the CLI', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'extract-evidence-test-'));
  const input = path.join(dir, 'k6.log');
  const output = path.join(dir, 'evidence.jsonl');
  const linesOutput = path.join(dir, 'evidence-lines.log');
  const evidence = { row: 'R-CD-1', nonce: 'cli-example' };
  const banner = k6Line('\n--- R-CD-1 EVIDENCE SUMMARY ---');
  const record = k6Line(JSON.stringify(evidence, null, 2));
  await writeFile(input, `${banner}\n${record}\n`);

  try {
    await execFileAsync(process.execPath, [
      script,
      '--input', input,
      '--out', output,
      '--lines-out', linesOutput,
    ]);
    assert.deepEqual(JSON.parse((await readFile(output, 'utf8')).trim()), evidence);
    assert.equal(await readFile(linesOutput, 'utf8'), `${banner}\n${record}\n`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
