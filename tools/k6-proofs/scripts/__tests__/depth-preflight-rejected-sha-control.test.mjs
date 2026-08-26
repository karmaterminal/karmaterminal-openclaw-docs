import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = process.env.SEAT_READINESS_SCRIPT_UNDER_TEST ||
  path.join(repoRoot, 'tools/k6-proofs/scripts/seat-readiness-preflight.mjs');

test('rejected isolated config with omitted maxSpawnDepth cannot pass nested-row preflight', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'p81-rejected-depth-control-'));
  const bin = path.join(root, 'bin');
  await mkdir(bin, { recursive: true });
  const k6 = path.join(bin, 'k6');
  const openclaw = path.join(bin, 'openclaw');
  await writeFile(k6, '#!/bin/sh\nprintf \'%s\\n\' \'k6 v2.0.0\'\n');
  await writeFile(openclaw, `#!/bin/sh
case "$3" in
  agents.defaults.continuation)
    printf '%s\\n' '{"enabled":true,"maxChainLength":200,"maxDelegatesPerTurn":500,"costCapTokens":500000}'
    ;;
  agents.defaults)
    printf '%s\\n' '{"continuation":{"enabled":true,"maxChainLength":200,"maxDelegatesPerTurn":500,"costCapTokens":500000}}'
    ;;
  *)
    exit 1
    ;;
esac
`);
  await Promise.all([chmod(k6, 0o755), chmod(openclaw, 0o755)]);

  try {
    const result = spawnSync(process.execPath, [script, '--json', '--no-gateway'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        K6_BIN: k6,
        OPENCLAW_GATEWAY_TOKEN: 'negative-control-token',
        OPENCLAW_CANDIDATE_SHA: '0c033c46c6365929c669bb7eff60a58ec914dbdd',
        OPENCLAW_SEAT_NAME: 'rejected-config-control',
        OPENCLAW_SESSION_KEY: 'main',
        OPENCLAW_SELECTED_ROWS: 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
        OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '',
      },
    });
    assert.equal(
      result.status,
      2,
      `rejected config was incorrectly accepted; expected depth preflight failure\n${result.stderr}\n${result.stdout}`,
    );
    const report = JSON.parse(result.stdout);
    assert.equal(report.outcome, 'PARTIAL-candidate');
    assert.equal(report.continuationDepth.configuredMaxSpawnDepth, null);
    assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 1);
    assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
    assert.equal(report.continuationDepth.reason, 'effective-depth-insufficient');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
