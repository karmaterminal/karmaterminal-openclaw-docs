import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs');
const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';

function runFixture(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENCLAW_GATEWAY_TOKEN: 'secret-token-must-not-print',
      OPENAI_API_KEY: 'openai-secret-must-not-print',
      OPENCLAW_CANDIDATE_SHA: candidateSha,
      ...env,
    },
  });
}

test('plan mode emits redacted artifacts without starting a gateway', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-test-'));
  const artifactDir = join(dir, 'artifacts');
  try {
    const run = runFixture(['--plan', '--artifact-dir', artifactDir, '--tmpdir', join(dir, 'fixture'), '--json']);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.doesNotMatch(run.stdout, /secret-token-must-not-print/);
    const result = JSON.parse(run.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'PLAN_ONLY');
    assert.equal(result.artifactDir, artifactDir);

    const plan = JSON.parse(await readFile(join(artifactDir, 'accepted-compaction-plan.json'), 'utf8'));
    const config = JSON.parse(await readFile(join(artifactDir, 'temp-config.redacted.json'), 'utf8'));
    const readiness = JSON.parse(await readFile(join(artifactDir, 'fixture-readiness.json'), 'utf8'));
    const cleanup = JSON.parse(await readFile(join(artifactDir, 'cleanup.json'), 'utf8'));

    assert.equal(plan.outcome, 'PLAN_ONLY-redacted-dry-run');
    assert.equal(plan.env.OPENCLAW_GATEWAY_TOKEN, '<REDACTED-fixture-token>');
    assert.equal(config.gateway.auth.mode, 'none');
    assert.equal(readiness.gatewayPid, null);
    assert.equal(cleanup.productionConfigTouched, false);
    assert.doesNotMatch(JSON.stringify({ plan, config, readiness, cleanup }), /secret-token-must-not-print/);
    assert.doesNotMatch(JSON.stringify({ plan, config, readiness, cleanup }), /openai-secret-must-not-print/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run mode fails closed without explicit opt-in and does not leak token', () => {
  const run = runFixture(['--run', '--json'], {
    OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: '',
  });
  assert.equal(run.status, 2);
  assert.doesNotMatch(run.stdout, /secret-token-must-not-print/);
  assert.doesNotMatch(run.stderr, /secret-token-must-not-print/);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /refusing --run/);
});

test('production paths are refused before artifact emission', () => {
  const run = runFixture(['--plan', '--tmpdir', join(process.env.HOME || '/home/figs', '.openclaw'), '--json']);
  assert.equal(run.status, 2);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /production path/);
});

test('artifact directory production paths are refused', () => {
  const run = runFixture(['--plan', '--artifact-dir', join(process.env.HOME || '/home/figs', '.openclaw', 'artifact'), '--json']);
  assert.equal(run.status, 2);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /production path/);
});

test('symlinked production paths are refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-symlink-test-'));
  const link = join(dir, 'link-to-openclaw');
  try {
    await symlink(join(process.env.HOME || '/home/figs', '.openclaw'), link, 'dir');
    const run = runFixture(['--plan', '--tmpdir', link, '--json']);
    assert.equal(run.status, 2);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /production path/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run mode with fixture opt-in but no --enable-live-orchestration classifies as review gate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-run-test-'));
  try {
    const run = runFixture(['--run', '--tmpdir', join(dir, 'fixture'), '--artifact-dir', join(dir, 'artifacts'), '--json'], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'HONEST-LIMIT-live-orchestration-review-gate');
    const outcome = JSON.parse(await readFile(join(dir, 'artifacts', 'outcome.json'), 'utf8'));
    assert.equal(outcome.pass, false);
    assert.equal(outcome.outcome, 'HONEST-LIMIT-live-orchestration-review-gate');
    assert.doesNotMatch(JSON.stringify(outcome), /secret-token-must-not-print/);
    // No preflight artifact expected when the review gate blocks before orchestration runs.
    await assert.rejects(readFile(join(dir, 'artifacts', 'preflight-context.json'), 'utf8'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('compaction token budget invariants fail closed', () => {
  const run = runFixture(['--plan', '--context-tokens', '4000', '--keep-recent-tokens', '2000', '--reserve-tokens', '2000', '--json']);
  assert.equal(run.status, 2);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /keepRecentTokens \+ reserveTokens/);
});

test('help is available even with invalid numeric env defaults', () => {
  const run = runFixture(['--help'], {
    OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS: 'not-a-number',
  });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Usage:/);
});

test('invalid ports are rejected', () => {
  const run = runFixture(['--plan', '--port', '99999', '--json']);
  assert.equal(run.status, 2);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /port/);
});

test('invalid candidate SHA is rejected when supplied', () => {
  const run = runFixture(['--plan', '--candidate-sha', 'not-a-sha', '--json']);
  assert.equal(run.status, 2);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /candidate SHA/);
});

test('run with --enable-live-orchestration but missing openclaw-dir classifies as BLOCKED-openclaw-dir-missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-live-dir-missing-'));
  try {
    const missing = join(dir, 'no-such-openclaw-checkout');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', missing,
      '--json',
    ], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'BLOCKED-openclaw-dir-missing');
    const preflight = JSON.parse(await readFile(join(dir, 'artifacts', 'preflight-context.json'), 'utf8'));
    assert.equal(preflight.openclawDir, missing);
    assert.equal(typeof preflight.error, 'string');
    assert.doesNotMatch(JSON.stringify(preflight), /secret-token-must-not-print/);
    assert.doesNotMatch(JSON.stringify(preflight), /openai-secret-must-not-print/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run with --enable-live-orchestration permits openclaw-dir inside production markers as source-only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-live-prod-dir-'));
  try {
    // Source checkouts may live under production markers; temp config/state/workspace
    // paths remain guarded separately. Use the current repo as a custom marker so
    // the test does not depend on the operator's home layout.
    const productionDir = join(dir, 'flesh_beast_tmp', 'openclaw');
    await mkdir(productionDir, { recursive: true });
    await writeFile(join(productionDir, 'openclaw.mjs'), '// stub\n');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', productionDir,
      '--timeout-ms', '1000',
      '--json',
    ], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'BLOCKED-temp-gateway-start');
    const preflight = JSON.parse(await readFile(join(dir, 'artifacts', 'preflight-context.json'), 'utf8'));
    assert.equal(preflight.openclawSourceOnly, true);
    const outcome = JSON.parse(await readFile(join(dir, 'artifacts', 'outcome.json'), 'utf8'));
    assert.equal(outcome.pass, false);
    assert.equal(outcome.outcome, 'BLOCKED-temp-gateway-start');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run with --enable-live-orchestration starts mock provider, writes preflight-context/temp config, then blocks at temp gateway start for invalid source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-live-preflight-'));
  try {
    // Provide a fake openclaw source dir outside the production markers that
    // contains a stub entrypoint file. The runner should attempt the reviewed
    // temp Gateway start, classify the startup failure, and still clean up the
    // mock provider without claiming PASS.
    const openclawDir = join(dir, 'openclaw-fake');
    await mkdir(openclawDir, { recursive: true });
    await writeFile(join(openclawDir, 'openclaw.mjs'), '// stub\n');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', openclawDir,
      '--timeout-ms', '1000',
      '--json',
    ], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'BLOCKED-temp-gateway-start');
    assert.equal(parsed.phase, 'temp-gateway-start');

    const preflight = JSON.parse(await readFile(join(dir, 'artifacts', 'preflight-context.json'), 'utf8'));
    assert.equal(preflight.openclawDir, openclawDir);
    assert.equal(preflight.openclawEntrypoint, join(openclawDir, 'openclaw.mjs'));
    assert.equal(typeof preflight.portCandidate, 'number');
    assert.ok(preflight.portCandidate > 0, 'preflight allocated a positive port');
    assert.ok(preflight.mockProvider.port > 0, 'preflight recorded mock provider port');

    const config = JSON.parse(await readFile(join(dir, 'artifacts', 'temp-config.redacted.json'), 'utf8'));
    assert.equal(config.gateway.auth.mode, 'none');
    assert.equal(config.gateway.mode, 'local');
    assert.match(config.models.providers.fixture.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(config.models.providers.fixture.models[0].id, 'openai-compatible-local');
    assert.equal(config.models.providers.fixture.models[0].name, 'openai-compatible-local');
    assert.doesNotMatch(JSON.stringify(config), /secret-token-must-not-print/);
    assert.doesNotMatch(JSON.stringify(config), /openai-secret-must-not-print/);

    const startError = JSON.parse(await readFile(join(dir, 'artifacts', 'temp-gateway-start-error.json'), 'utf8'));
    assert.equal(startError.phase, 'temp-gateway-start');
    assert.match(startError.reason, /temp Gateway/);

    const cleanup = JSON.parse(await readFile(join(dir, 'artifacts', 'cleanup.json'), 'utf8'));
    assert.equal(cleanup.productionConfigTouched, false);
    assert.equal(cleanup.gatewayStopped, null, 'no gateway reached readiness');
    assert.equal(cleanup.mockProviderStopped.stopped, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
