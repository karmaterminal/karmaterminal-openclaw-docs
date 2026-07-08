import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = path.resolve('tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs');
const runNode = promisify(execFile);

async function fixtureRunDir() {
  const root = await mkdtemp(path.join(tmpdir(), 'r-cw-3-review-'));
  const runDir = path.join(root, 'run');
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, 'evidence.jsonl'), `${JSON.stringify({
    row: 'R-CW-3',
    nonce: 'R-CW-3-abc',
    trace_id: '0123456789abcdef',
    dispatch_accepted: true,
    scheduled_sentinel: true,
    wake_observed: true,
    public_artifact_raw_reason_absent: true,
  })}\n`);
  return { root, runDir };
}

const safeTrace = {
  batches: [{
    scopeSpans: [{
      spans: [{
        name: 'continuation.work',
        attributes: [
          { key: 'reason.present', value: { boolValue: true } },
          { key: 'reason.length', value: { intValue: '83' } },
          { key: 'reason.hash', value: { stringValue: 'abc123' } },
        ],
      }],
    }],
  }],
};

test('passes when wake evidence and safe reason attrs are present and raw reason is absent', async () => {
  const { root, runDir } = await fixtureRunDir();
  try {
    const tracePath = path.join(runDir, 'tempo-trace-0123456789ab.json');
    const out = path.join(runDir, 'review.json');
    await writeFile(tracePath, `${JSON.stringify(safeTrace)}\n`);
    const run = await runNode(process.execPath, [script, '--run-dir', runDir, '--out', out], { encoding: 'utf8' });
    assert.match(run.stdout, /reason-telemetry-redaction-review-passed/);
    const receipt = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(receipt.checks.safeReasonAttrsPresent.ok, true);
    assert.equal(receipt.checks.rawReasonAbsentFromTempo.ok, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails closed when Tempo contains the raw R-CW-3 reason sentinel', async () => {
  const { root, runDir } = await fixtureRunDir();
  try {
    const tracePath = path.join(runDir, 'tempo.json');
    await writeFile(tracePath, `${JSON.stringify({
      ...safeTrace,
      raw: 'k6-proof-R-CW-3-redaction RAW-RCW3-R-CW-3-abc-secret',
    })}\n`);
    await assert.rejects(
      runNode(process.execPath, [script, '--run-dir', runDir, '--tempo-trace', tracePath], { encoding: 'utf8' }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /review-pending/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
