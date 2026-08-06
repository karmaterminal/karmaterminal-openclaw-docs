import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.resolve('tools/k6-proofs/scripts/export-prometheus-metrics.mjs');

test('legacy Prometheus export preserves an explicit no-verdict run', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'k6-proof-legacy-prom-'));
  try {
    const runDir = path.join(root, 'candidate', 'R-CD-MODEL-TOOL', 'cael', 'k6-run-no-verdict');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, 'run-result.json'),
      `${JSON.stringify({
        k6ExitCode: 99,
        verdict: null,
        candidateOnly: true,
        foldRequiresReview: true,
      })}\n`,
    );
    await writeFile(
      path.join(runDir, 'r-cd-model-tool-summary.json'),
      `${JSON.stringify({
        verdict: null,
        summaryAuthority: 'NO-VERDICT',
        metrics: { failures: 1 },
      })}\n`,
    );

    const out = path.join(root, 'metrics.prom');
    const run = spawnSync(process.execPath, [script, '--root', root, '--out', out], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const metrics = await readFile(out, 'utf8');
    assert.match(metrics, /outcome="NO-VERDICT"/);
    assert.match(metrics, /openclaw_proofs_k6_proof_failures_total\{[^\n]*\} 1/);
    assert.doesNotMatch(metrics, /outcome="FAIL-candidate"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
