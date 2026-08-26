import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  evaluateContinuationDepth,
  resolveContinuationDepthRequirements,
  validateManifestContinuationRequirements,
} from '../../lib/continuation-depth-contract.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const manifestsDir = path.join(repoRoot, 'tools/k6-proofs/manifests');
const provisioner = path.join(
  repoRoot,
  'tools/k6-proofs/scripts/provision-isolated-proof-config.mjs',
);

async function withTmp(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'p81-continuation-depth-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('row manifests resolve nested requirements while ordinary rows retain product depth 1', () => {
  const nested = resolveContinuationDepthRequirements({
    rows: 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
    manifestsDir,
  });
  assert.equal(nested.requiredMaxSpawnDepth, 2);
  assert.deepEqual(nested.nestedRows, [
    'R-CD-CHAINED-DEPTH-2',
    'R-CD-TOKEN',
  ]);
  assert.ok(nested.rowRequirements.every((entry) => entry.declared));

  const ordinary = resolveContinuationDepthRequirements({
    rows: 'R-CD-2',
    manifestsDir,
  });
  assert.equal(ordinary.requiredMaxSpawnDepth, 1);
  assert.deepEqual(ordinary.nestedRows, []);
  assert.equal(ordinary.rowRequirements[0].declared, false);
});

test('exact rejected config shape resolves product default 1 and fails both selected nested rows', () => {
  const requirements = resolveContinuationDepthRequirements({
    rows: 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
    manifestsDir,
  });
  const depth = evaluateContinuationDepth({
    config: {
      agents: {
        defaults: {
          continuation: {
            enabled: true,
            maxChainLength: 200,
            maxDelegatesPerTurn: 500,
            costCapTokens: 500000,
          },
        },
      },
    },
    requirements,
  });
  assert.equal(depth.configuredMaxSpawnDepth, null);
  assert.equal(depth.effectiveMaxSpawnDepth, 1);
  assert.equal(depth.requiredMaxSpawnDepth, 2);
  assert.equal(depth.sufficient, false);
  assert.equal(depth.reason, 'effective-depth-insufficient');
});

test('isolated provisioner writes depth 5 and a public-safe configured/effective/required receipt', async () => {
  await withTmp(async (root) => {
    const privateDir = path.join(root, 'private');
    const publicDir = path.join(root, 'public');
    await Promise.all([
      mkdir(privateDir, { recursive: true }),
      mkdir(publicDir, { recursive: true }),
    ]);
    const base = path.join(privateDir, 'base.json');
    const output = path.join(privateDir, 'openclaw.json');
    const receipt = path.join(publicDir, 'isolated-proof-config.json');
    const privateToken = 'PRIVATE-GATEWAY-TOKEN-MUST-NOT-REACH-RECEIPT';
    const privateWorkspace = '/private/fixture/workspace/must-not-reach-receipt';
    await writeFile(base, `${JSON.stringify({
      gateway: { auth: { token: privateToken } },
      agents: {
        defaults: {
          workspace: privateWorkspace,
          continuation: {
            enabled: true,
            maxChainLength: 200,
            maxDelegatesPerTurn: 500,
            costCapTokens: 500000,
          },
        },
      },
    }, null, 2)}\n`);

    const run = spawnSync(process.execPath, [
      provisioner,
      '--base-config', base,
      '--output', output,
      '--receipt', receipt,
      '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
    ], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    const generated = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(generated.agents.defaults.subagents.maxSpawnDepth, 5);
    assert.equal(generated.gateway.auth.token, privateToken);
    assert.equal(generated.agents.defaults.workspace, privateWorkspace);
    assert.equal((await stat(output)).mode & 0o777, 0o600);

    const publicReceiptText = await readFile(receipt, 'utf8');
    assert.doesNotMatch(publicReceiptText, new RegExp(privateToken));
    assert.doesNotMatch(publicReceiptText, /private\/fixture\/workspace/);
    assert.ok(!publicReceiptText.includes(root));
    const publicReceipt = JSON.parse(publicReceiptText);
    assert.equal(publicReceipt.schema, 'openclaw.k6.isolated-proof-config.v1');
    assert.equal(publicReceipt.outcome, 'PASS-candidate');
    assert.equal(publicReceipt.configuredMaxSpawnDepth, 5);
    assert.equal(publicReceipt.effectiveMaxSpawnDepth, 5);
    assert.equal(publicReceipt.requiredMaxSpawnDepth, 2);
    assert.equal(publicReceipt.proofProfileMaxSpawnDepth, 5);
    assert.equal(publicReceipt.explicitProfileApplied, true);
    assert.equal(publicReceipt.publicSafe, true);
  });
});

test('provisioning and manifest contracts reject malformed or unknown depth declarations', async (t) => {
  assert.deepEqual(
    validateManifestContinuationRequirements({
      continuationRequirements: { requiredSpawnDepth: '2' },
    }),
    ['continuationRequirements.requiredSpawnDepth must be an integer from 1 through 5'],
  );
  assert.deepEqual(
    validateManifestContinuationRequirements({
      continuationRequirements: { requiredSpawnDepth: 6 },
    }),
    ['continuationRequirements.requiredSpawnDepth must be an integer from 1 through 5'],
  );

  await t.test('malformed configured depth is not silently replaced', async () => {
    await withTmp(async (root) => {
      const base = path.join(root, 'base.json');
      const output = path.join(root, 'openclaw.json');
      const receipt = path.join(root, 'receipt.json');
      await writeFile(base, `${JSON.stringify({
        agents: { defaults: { subagents: { maxSpawnDepth: 'unknown' } } },
      })}\n`);
      const run = spawnSync(process.execPath, [
        provisioner,
        '--base-config', base,
        '--output', output,
        '--receipt', receipt,
        '--rows', 'R-CD-TOKEN',
      ], { cwd: repoRoot, encoding: 'utf8' });
      assert.notEqual(run.status, 0);
      assert.match(run.stderr, /malformed agents\.defaults\.subagents\.maxSpawnDepth/);
      await assert.rejects(readFile(output, 'utf8'), /ENOENT/);
      await assert.rejects(readFile(receipt, 'utf8'), /ENOENT/);
    });
  });

  await t.test('unknown selected row fails instead of resolving to depth 1', async () => {
    assert.throws(
      () => resolveContinuationDepthRequirements({
        rows: 'R-CD-UNKNOWN-NESTED',
        manifestsDir,
      }),
      (error) => error.code === 'unknown-selected-row',
    );
  });
});
