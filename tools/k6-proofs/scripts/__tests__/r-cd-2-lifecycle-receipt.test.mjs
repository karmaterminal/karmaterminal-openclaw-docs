import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('tools/k6-proofs/scripts/validate-r-cd-2-lifecycle.mjs');

async function withTmp(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'r-cd-2-lifecycle-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function validate(correlation, out) {
  const args = [script, '--out', out];
  if (correlation) args.push('--correlation', correlation);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

test('July outer-send plus delayed-generic-event shape is an explicit non-pass without lifecycle correlation', async () => {
  await withTmp(async (dir) => {
    const out = path.join(dir, 'lifecycle.json');
    const run = validate(null, out);
    const receipt = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(run.status, 1);
    assert.equal(receipt.outcome, 'PARTIAL-candidate');
    assert.equal(receipt.lifecycleReceipt, 'missing');
    assert.equal(receipt.failureClass, 'continuation-lifecycle-missing');
    assert.match(receipt.failures.join(' '), /correlation is missing/);
  });
});

test('complete redacted silent-wake typed-tool/dispatch/fire topology can pass', async () => {
  await withTmp(async (dir) => {
    const correlation = path.join(dir, 'continuation-trace-correlation.json');
    const out = path.join(dir, 'lifecycle.json');
    await writeFile(correlation, `${JSON.stringify({
      schema: 'openclaw.k6.continuation-trace-correlation.v1',
      row: 'R-CD-2',
      traceId: '11111111111111111111111111111111',
      chainId: 'chain-safe-example',
      toolSpanIds: ['aaaaaaaaaaaaaaaa'],
      dispatchSpanId: 'bbbbbbbbbbbbbbbb',
      fireSpanId: 'cccccccccccccccc',
      sameTrace: true,
      distinctSpans: true,
      reason: { hash: '1234567890abcdef', length: 42, rawPersisted: false },
      continuation: {
        tool: 'continue_delegate',
        acceptSpan: 'continuation.delegate.dispatch',
        fireSpan: 'continuation.delegate.fire',
      },
      delegate: { mode: 'silent-wake' },
    })}\n`);
    const run = validate(correlation, out);
    const receipt = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(run.status, 0, run.stderr);
    assert.equal(receipt.outcome, 'PASS-candidate');
    assert.equal(receipt.lifecycleReceipt, 'present');
    assert.deepEqual(receipt.failures, []);
    assert.equal(receipt.correlation.mode, 'silent-wake');
    assert.doesNotMatch(JSON.stringify(receipt), /raw task|Proof nonce/i);
  });
});
