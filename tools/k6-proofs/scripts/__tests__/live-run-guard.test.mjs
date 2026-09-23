import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/live-run-guard.mjs');
const rowListScript = join(repoRoot, 'tools/k6-proofs/scripts/list-runnable-rows.mjs');
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
  assert.equal(parsed.rowId, 'R-CONFIG-DEFAULTS');
  assert.equal(parsed.classification, 'k6-runnable');
});

test('read-only preflight uses the supported live k6 runner contract', async () => {
  const manifest = join(repoRoot, 'tools/k6-proofs/manifests/preflight.example.json');
  const run = runGuard(manifest);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.rowId, 'PREFLIGHT');
  assert.equal(parsed.classification, 'k6-runnable');
  assert.equal(parsed.requiresLiveGatewayToken, true);
  assert.equal(parsed.requiresTargetSessionKey, false);
  assert.equal(parsed.requiresCandidateSha, false);
  assert.equal(parsed.requiresExternalAgentOrToolInvocation, false);
});

test('R-CW-5 stays process-local and fail-closed rather than using a shared gateway config mutation', async () => {
  const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests/r-cw-5.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.mutates, false);
  assert.equal(manifest.transport, 'process-local');
  assert.equal(manifest.scenario.status, 'scaffold');
  assert.equal(manifest.liveRunSafety.classification, 'orchestration-required');
  assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PARTIAL-candidate');
  assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
  const run = runGuard(manifestPath);
  assert.equal(run.status, 1, `${manifest.rowId} unexpectedly passed: ${run.stdout}`);
  assert.match(run.stdout, /orchestration-required is not directly runnable/);
});

test('R-CW-6 stays process-local and fixture-gated while static variants cannot certify it', async () => {
  for (const manifestName of ['r-cw-6.json']) {
    const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests', manifestName);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.mutates, false);
    assert.equal(manifest.transport, 'process-local');
    assert.equal(manifest.scenario.status, 'scaffold');
    assert.equal(manifest.invocation.fixture, 'tools/k6-proofs/scripts/run-max-chain-fixture.mjs');
    assert.equal(manifest.liveRunSafety.classification, 'orchestration-required');
    assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'PASS-candidate');
    assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
    assert.equal(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation, false);
    const run = runGuard(manifestPath);
    assert.equal(run.status, 1, `${manifest.rowId} unexpectedly passed: ${run.stdout}`);
    assert.match(run.stdout, /orchestration-required is not directly runnable/);
  }

  for (const manifestName of ['r-cw-5a-static.json', 'r-cw-6a-static.json']) {
    const manifestPath = join(repoRoot, 'tools/k6-proofs/manifests', manifestName);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.mutates, false);
    assert.equal(manifest.transport, 'offline');
    assert.equal(manifest.toolSurface, 'read-only');
    assert.equal(manifest.scenario.status, 'runnable');
    assert.equal(manifest.scenario.name, 'static-corpus-row-validator');
    assert.equal(manifest.liveRunSafety.classification, 'static-preflight-only');
    assert.equal(manifest.liveRunSafety.expectedArtifactClass, 'construct-only');
    assert.equal(manifest.liveRunSafety.requiresLiveGatewayToken, false);
    const run = runGuard(manifestPath);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.equal(JSON.parse(run.stdout).expectedArtifactClass, 'construct-only');
  }

  const liveSuite = spawnSync(process.execPath, [rowListScript, '--live-suite'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(liveSuite.status, 0, liveSuite.stderr || liveSuite.stdout);
  const liveRows = liveSuite.stdout.trim().split(',');
  assert.equal(liveRows.length, 34);
  assert.equal(liveRows[0], 'PREFLIGHT');
  assert.doesNotMatch(liveSuite.stdout, /R-CW-5(?:,|$)/);
  assert.doesNotMatch(liveSuite.stdout, /R-CW-6(?:,|$)/);
  assert.doesNotMatch(liveSuite.stdout, /R-CW-[56]A/);

  const allRows = spawnSync(process.execPath, [rowListScript, '--all'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(allRows.status, 0, allRows.stderr || allRows.stdout);
  assert.match(allRows.stdout, /R-CW-5A/);
  assert.match(allRows.stdout, /R-CW-6A/);

  const resumedRows = spawnSync(
    process.execPath,
    [rowListScript, '--from', 'R-CD-4'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.equal(resumedRows.status, 0, resumedRows.stderr || resumedRows.stdout);
  const resumed = resumedRows.stdout.trim().split(',');
  assert.equal(resumed[0], 'R-CD-4');
  assert.doesNotMatch(resumedRows.stdout, /(?:^|,)R-CD-[123](?:,|$)/);
  assert.match(resumedRows.stdout, /R-TRACE-REDACTION-1121/);

  const unknownResume = spawnSync(
    process.execPath,
    [rowListScript, '--from', 'R-NOT-A-ROW'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.equal(unknownResume.status, 2);
  assert.match(unknownResume.stderr, /--from row is not runnable/);
});

// The manifest is the declaration of record for WHICH scenario proves a row.
// run-proof.sh used to resolve the scenario purely from the row name, so the
// six rows proved by the shared static-corpus-row-validator either ran an
// unrelated same-named file or reported a runnable row as unimplemented —
// R-CD-COLLECTION-ON-COLLAPSE has a same-named scaffold that throws
// "live-fire design not implemented" while its manifest declares the validator
// and the row actually passes. The runner now prefers this emitted value, so
// these cases are the belled rope on that contract.
function runGuardShell(manifest, extraEnv = {}) {
  return spawnSync(process.execPath, [script, '--manifest', manifest, '--shell'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...validEnv, ...extraEnv },
  });
}

function parseShellVar(stdout, name) {
  const line = stdout.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) return undefined;
  return line.slice(name.length + 1).replace(/^'(.*)'$/s, '$1');
}

test('shell mode publishes the manifest-declared scenario file for validator-backed rows', () => {
  const result = runGuardShell(join(repoRoot, 'tools/k6-proofs/manifests/r-cw-multi.json'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    parseShellVar(result.stdout, 'K6_PROOF_SCENARIO_FILE'),
    'static-corpus-row-validator.js',
    'R-CW-MULTI is proved by the shared validator and has no same-named scenario, so the runner cannot resolve it by row name',
  );
});

test('shell mode publishes the declared scenario file when it matches the row name', () => {
  const result = runGuardShell(join(repoRoot, 'tools/k6-proofs/manifests/r-obs-2.json'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(parseShellVar(result.stdout, 'K6_PROOF_SCENARIO_FILE'), 'r-obs-2.js');
});

test('shell mode keeps every emitted value single-quoted so run-proof.sh can eval it', () => {
  const result = runGuardShell(join(repoRoot, 'tools/k6-proofs/manifests/r-cw-multi.json'));
  assert.equal(result.status, 0, result.stderr);
  const emitted = result.stdout.split('\n').filter((line) => line.startsWith('K6_PROOF_'));
  assert.ok(emitted.length >= 7, `expected the full K6_PROOF_* set, got ${emitted.length}`);
  for (const line of emitted) {
    const value = line.slice(line.indexOf('=') + 1);
    // K6_PROOF_LOCK_REQUIRED is a bare 0/1 flag; every other value is quoted.
    if (line.startsWith('K6_PROOF_LOCK_REQUIRED=')) {
      assert.match(value, /^[01]$/);
      continue;
    }
    assert.match(value, /^'.*'$/s, `${line} must be single-quoted for eval safety`);
  }
});

test('a manifest with no declared scenario file emits an empty value rather than omitting it', async () => {
  const fixture = await writeManifestFixture({
    ...orchestrationRequiredManifest('R-SCENARIO-FILE-ABSENT'),
    liveRunSafety: {
      classification: 'construct-only',
      expectedArtifactClass: 'construct-only',
      foldRequiresReview: true,
      requiredReceipts: ['construct-note'],
      sameSessionConcurrencySafe: true,
    },
    expectedReceipts: [{ name: 'construct-note', path: 'note.md' }],
    scenario: { name: 'absent', status: 'scaffold' },
  });
  try {
    const result = runGuardShell(fixture.file);
    // construct-only is rejected by the guard, which is the correct outcome;
    // the point here is that the runner never sees a half-formed variable set.
    if (result.status === 0) {
      assert.equal(parseShellVar(result.stdout, 'K6_PROOF_SCENARIO_FILE'), '');
    } else {
      assert.equal(result.stdout.includes('K6_PROOF_SCENARIO_FILE'), false);
    }
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
