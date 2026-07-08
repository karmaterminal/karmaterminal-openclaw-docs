import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
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
    assert.equal(config.gateway.token, '<REDACTED-fixture-token>');
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

test('run with --enable-live-orchestration refuses openclaw-dir inside production markers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-live-prod-dir-'));
  try {
    // The workorder hints at /home/figs/flesh_beast_tmp/openclaw as the source
    // location. That path is inside a production marker; the runner must refuse
    // it until reviewed source-only guards land.
    const productionDir = join(process.env.HOME || '/home/figs', 'flesh_beast_tmp', 'openclaw');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', productionDir,
      '--json',
    ], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'BLOCKED-openclaw-dir-inside-production');
    const outcome = JSON.parse(await readFile(join(dir, 'artifacts', 'outcome.json'), 'utf8'));
    assert.equal(outcome.pass, false);
    assert.equal(outcome.outcome, 'BLOCKED-openclaw-dir-inside-production');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run with --enable-live-orchestration starts mock provider, writes preflight-context/temp config, then attempts temp gateway', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-live-preflight-'));
  try {
    // Provide a fake openclaw source dir outside the production markers that
    // contains a stub entrypoint file, so preflight succeeds. The default
    // Gateway command tries to execute that stub and therefore fails readiness.
    const openclawDir = join(dir, 'openclaw-fake');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(openclawDir, { recursive: true });
    await writeFile(join(openclawDir, 'openclaw.mjs'), '// stub\n');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', openclawDir,
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
    assert.equal(config.gateway.token, '<REDACTED-fixture-token>');
    assert.equal(config.gateway.mode, 'local');
    assert.match(config.models.providers.fixture.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.doesNotMatch(JSON.stringify(config), /secret-token-must-not-print/);
    assert.doesNotMatch(JSON.stringify(config), /openai-secret-must-not-print/);

    const phaseError = JSON.parse(await readFile(join(dir, 'artifacts', 'temp-gateway-start-error.json'), 'utf8'));
    assert.equal(phaseError.step, 'startTempGateway');

    const cleanup = JSON.parse(await readFile(join(dir, 'artifacts', 'cleanup.json'), 'utf8'));
    assert.equal(cleanup.productionConfigTouched, false);
    assert.equal(cleanup.gatewayStopped, null, 'gateway did not reach a start receipt');
    assert.equal(cleanup.mockProviderStopped.stopped, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('run with mock temp gateway advances the blocker to context-budget forcing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-mock-gateway-'));
  try {
    const openclawDir = join(dir, 'openclaw-fake');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(openclawDir, { recursive: true });
    await writeFile(join(openclawDir, 'openclaw.mjs'), '// stub\n');
    const mockGateway = join(repoRoot, 'tools/k6-proofs/fixtures/accepted-request-compaction/mock-temp-gateway.mjs');
    const run = runFixture([
      '--run',
      '--enable-live-orchestration',
      '--tmpdir', join(dir, 'fixture'),
      '--artifact-dir', join(dir, 'artifacts'),
      '--openclaw-dir', openclawDir,
      '--json',
    ], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
      OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON: JSON.stringify([process.execPath, mockGateway, '--port', '{{PORT}}']),
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.pass, false);
    assert.equal(parsed.outcome, 'HONEST-LIMIT-live-orchestration-preflight-only');
    assert.equal(parsed.phase, 'force-context-budget');

    const start = JSON.parse(await readFile(join(dir, 'artifacts', 'temp-gateway-start.json'), 'utf8'));
    assert.equal(start.port > 0, true);
    assert.equal(start.probe.healthStatus, 200);
    assert.equal(start.probe.statusStatus, 200);

    const stop = JSON.parse(await readFile(join(dir, 'artifacts', 'temp-gateway-stop.json'), 'utf8'));
    assert.equal(stop.stopped, true);

    const honestLimit = JSON.parse(await readFile(
      join(dir, 'artifacts', 'live-orchestration-not-yet-implemented.json'),
      'utf8',
    ));
    assert.equal(honestLimit.step, 'forceContextBudget');

    const cleanup = JSON.parse(await readFile(join(dir, 'artifacts', 'cleanup.json'), 'utf8'));
    assert.equal(cleanup.productionConfigTouched, false);
    assert.equal(cleanup.gatewayStopped.stopped, true);
    assert.equal(cleanup.mockProviderStopped.stopped, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
