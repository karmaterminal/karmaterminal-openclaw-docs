import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/summarize-review-debt.mjs');
const runNode = promisify(execFile);

async function writeResult(root, row, body) {
  const dir = path.join(root, 'candidate-sha', row, 'seat', `run-${row}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'run-result.json'), `${JSON.stringify(body, null, 2)}\n`);
}

test('summarizes trace-missing debt as unfetchable when no trace id exists', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-'));
  try {
    await writeResult(root, 'R-CD-2', {
      observability: { traceStatus: 'missing', traceId: null, tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    await writeResult(root, 'R-CD-4', {
      observability: { traceStatus: 'present', traceId: 'abcdef0123456789', tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    await writeResult(root, 'R-CW-1', {
      observability: { traceStatus: 'unknown', traceId: null, tempoTraceJson: null },
      review: { status: 'ready-for-human-review', pendingReceipts: [] },
    });

    const run = await runNode(process.execPath, [script, '--run-root', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.totalRows, 3);
    assert.equal(summary.pendingRows, 2);
    assert.equal(summary.byClass['tempo-trace-unfetchable'], 1);
    assert.equal(summary.byClass['tempo-trace-fetchable'], 1);
    const unfetchable = summary.pending.find((row) => row.rowId === 'R-CD-2').pending[0];
    assert.equal(unfetchable.fetchable, false);
    assert.match(unfetchable.action, /rerun with trace emission/);
    const fetchable = summary.pending.find((row) => row.rowId === 'R-CD-4').pending[0];
    assert.equal(fetchable.fetchable, true);
    assert.equal(fetchable.traceId, 'abcdef0123456789');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('renders human-readable review debt table', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-debt-text-'));
  try {
    await writeResult(root, 'R-OBS-STATUS', {
      observability: { traceStatus: 'missing', traceId: null, tempoTraceJson: null },
      review: { status: 'review-pending', pendingReceipts: ['tempo-trace-json'] },
    });
    const run = await runNode(process.execPath, [script, '--run-root', root], { encoding: 'utf8' });
    assert.match(run.stdout, /review-pending rows: 1/);
    assert.match(run.stdout, /tempo-trace-unfetchable: 1/);
    assert.match(run.stdout, /R-OBS-STATUS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
