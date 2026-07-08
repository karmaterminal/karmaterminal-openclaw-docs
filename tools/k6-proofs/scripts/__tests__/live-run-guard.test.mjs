import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/live-run-guard.mjs');
const validEnv = {
  ...process.env,
  OPENCLAW_GATEWAY_TOKEN: 'unit-token-not-printed',
  OPENCLAW_CANDIDATE_SHA: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
  OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
};

function runGuard(manifest, extraEnv = {}) {
  return spawnSync(process.execPath, [script, '--manifest', manifest, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...validEnv, ...extraEnv },
  });
}

async function writeManifestFixture(manifest) {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-k6-guard-test-'));
  const file = join(dir, `${manifest.rowId}.json`);
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}
`);
  return { dir, file };
}

function orchestrationRequiredManifest(rowId) {
  return {
    schema: 'openclaw.k6.proof-row-manifest.v1',
    rowId,
    transport: 'websocket',
    toolSurface: 'typed-tool',
    mutates: true,
    scenario: {
      name: `${rowId.toLowerCase()}-fixture`,
      status: 'scaffold',
    },
    expectedReceipts: [
      { name: 'seat-readiness-continuation-enabled', required: true },
      { name: 'original-config-captured', required: true },
      { name: 'failure-safe-restore-armed', required: true },
      { name: 'config-restored', required: true },
    ],
    review: {
      candidateOnly: true,
      foldRequiresReview: true,
    },
    liveRunSafety: {
      classification: 'orchestration-required',
      requiresLiveGatewayToken: true,
      requiresCandidateSha: true,
      requiresExternalAgentOrToolInvocation: true,
      requiresHumanConfirmation: true,
      sameSessionConcurrencySafe: false,
      expectedArtifactClass: 'PARTIAL-candidate',
      requiredReceipts: [
        'seat-readiness-continuation-enabled',
        'original-config-captured',
        'failure-safe-restore-armed',
        'config-restored',
      ],
      foldRequiresReview: true,
    },
  };
}

test('live-run guard fails closed for orchestration-required config-mutating rows', async () => {
  for (const rowId of ['R-CW-COST-CAP-FIXTURE', 'R-CW-CHAIN-CAP-FIXTURE']) {
    const { dir, file } = await writeManifestFixture(orchestrationRequiredManifest(rowId));
    try {
      const run = runGuard(file);
      assert.equal(run.status, 1, `${rowId} unexpectedly passed: ${run.stdout}`);
      const parsed = JSON.parse(run.stdout);
      assert.equal(parsed.ok, false);
      assert.ok(
        parsed.errors.some((error) => error.includes('orchestration-required is not directly runnable')),
        `${rowId} errors did not include orchestration-required fail-closed guard: ${run.stdout}`,
      );
      assert.doesNotMatch(run.stdout, /unit-token-not-printed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test('live-run guard still permits ordinary k6-runnable manifests with required env present', async () => {
  const manifest = join(repoRoot, 'tools/k6-proofs/manifests/r-config-defaults.json');
  const run = runGuard(manifest);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rowId, 'R-CONFIG-defaults');
  assert.equal(parsed.classification, 'k6-runnable');
});

test('live-run guard still permits static preflight manifests without live candidate env', async () => {
  const manifest = join(repoRoot, 'tools/k6-proofs/manifests/preflight.example.json');
  const run = runGuard(manifest, {
    OPENCLAW_GATEWAY_TOKEN: '',
    OPENCLAW_CANDIDATE_SHA: '',
    OPENCLAW_SESSION_KEY: '',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rowId, 'preflight');
  assert.equal(parsed.classification, 'static-preflight-only');
});

test('static corpus validator rows are read-only broad-suite rows', async () => {
  for (const manifestName of ['r-cw-5.json', 'r-cw-6.json']) {
    const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests', manifestName);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.mutates, false);
    assert.equal(manifest.transport, 'offline');
    assert.equal(manifest.toolSurface, 'read-only');
    assert.equal(manifest.scenario.status, 'runnable');
    assert.equal(manifest.scenario.name, 'static-corpus-row-validator');
    assert.equal(manifest.liveRunSafety.classification, 'k6-runnable');
    assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
    assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
    assert.equal(manifest.liveRunSafety.foldRequiresReview, true);
  }
});
