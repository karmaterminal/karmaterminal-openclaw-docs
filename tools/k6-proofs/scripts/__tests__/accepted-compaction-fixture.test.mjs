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

test('run mode with opt-in still fails closed until orchestration is implemented', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-accepted-compaction-run-test-'));
  try {
    const run = runFixture(['--run', '--tmpdir', join(dir, 'fixture'), '--artifact-dir', join(dir, 'artifacts'), '--json'], {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const parsed = JSON.parse(run.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.outcome, 'BLOCKED-live-orchestration-not-implemented');
    const outcome = JSON.parse(await readFile(join(dir, 'artifacts', 'outcome.json'), 'utf8'));
    assert.equal(outcome.pass, false);
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
