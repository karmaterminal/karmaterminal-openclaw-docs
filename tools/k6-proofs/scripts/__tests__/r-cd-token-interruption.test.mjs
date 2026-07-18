import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../write-interrupted-run-result.mjs');
const sha = 'a'.repeat(40);

function run(dir) {
  return spawnSync(process.execPath, [script,
    '--run-dir', dir, '--row', 'R-CD-TOKEN', '--candidate-sha', sha, '--runtime-sha', sha,
    '--attempt-hash', '1'.repeat(16), '--nonce-hash', '2'.repeat(16),
    '--phase', 'k6-running', '--cause', 'signal-term',
  ], { encoding: 'utf8' });
}

test('writes a structured non-PASS, non-retriable interruption packet', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'r-cd-token-interrupt-'));
  await writeFile(path.join(dir, 'attempt-state.json'), `${JSON.stringify({
    schema: 'openclaw.k6.r-cd-token.attempt-state.v1',
    row: 'R-CD-TOKEN',
    terminal: false,
    automaticRetryAllowed: false,
  })}\n`);
  const result = run(dir);
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(await readFile(path.join(dir, 'interruption-receipt.json'), 'utf8'));
  const runResult = JSON.parse(await readFile(path.join(dir, 'run-result.json'), 'utf8'));
  const attemptState = JSON.parse(await readFile(path.join(dir, 'attempt-state.json'), 'utf8'));
  assert.equal(attemptState.phase, 'interrupted');
  assert.equal(attemptState.proofTerminal, false);
  assert.equal(attemptState.terminal, false);
  assert.equal(attemptState.consumptionState, 'unknown-possibly-consumed');
  assert.equal(attemptState.automaticRetryAllowed, false);
  assert.equal(receipt.consumptionState, 'unknown-possibly-consumed');
  assert.equal(receipt.automaticRetryAllowed, false);
  assert.equal(receipt.proofTerminal, false);
  assert.equal(runResult.verdict, 'PARTIAL-candidate');
  assert.equal(runResult.effectiveExitCode, 130);
  assert.equal(runResult.review.status, 'review-pending');
  assert.equal(runResult.terminal, false);
});

test('supersedes a premature pass-shaped run-result while the attempt is still active', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'r-cd-token-existing-'));
  await writeFile(path.join(dir, 'run-result.json'), '{"verdict":"PASS-candidate"}\n');
  const result = run(dir);
  assert.equal(result.status, 0, result.stderr);
  const runResult = JSON.parse(await readFile(path.join(dir, 'run-result.json'), 'utf8'));
  const receipt = JSON.parse(await readFile(path.join(dir, 'interruption-receipt.json'), 'utf8'));
  assert.equal(runResult.verdict, 'PARTIAL-candidate');
  assert.equal(runResult.terminal, false);
  assert.equal(receipt.candidateOutcome, 'PARTIAL-candidate');
});

test('rejects malformed identity fingerprints', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'r-cd-token-invalid-'));
  const result = spawnSync(process.execPath, [script,
    '--run-dir', dir, '--row', 'R-CD-TOKEN', '--candidate-sha', sha, '--runtime-sha', sha,
    '--attempt-hash', 'raw-attempt', '--nonce-hash', '2'.repeat(16), '--phase', 'prepared', '--cause', 'exit',
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fingerprints/);
});
