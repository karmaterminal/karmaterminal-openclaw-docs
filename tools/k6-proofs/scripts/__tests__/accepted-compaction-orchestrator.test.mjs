import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  NON_PASS_OUTCOMES,
  PRODUCTION_PATH_MARKERS,
  allocateFreePort,
  assertNotProductionPath,
  buildRedactedConfig,
  makeUnimplementedLiveSteps,
  normalizeSafePath,
  resolveOpenClawDir,
  runOrchestration,
} from '../lib/accepted-compaction-orchestrator.mjs';

test('NON_PASS_OUTCOMES exposes the review-gate and preflight-only markers', () => {
  assert.equal(NON_PASS_OUTCOMES.REVIEW_GATE, 'HONEST-LIMIT-live-orchestration-review-gate');
  assert.equal(NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED, 'HONEST-LIMIT-live-orchestration-preflight-only');
  assert.equal(NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING, 'BLOCKED-openclaw-dir-missing');
});

test('assertNotProductionPath refuses production markers', () => {
  for (const marker of PRODUCTION_PATH_MARKERS) {
    assert.throws(() => assertNotProductionPath('label', marker), /production path/);
    assert.throws(() => assertNotProductionPath('label', `${marker}/sub`), /production path/);
  }
});

test('normalizeSafePath returns absolute path for non-production input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-orch-safe-'));
  try {
    const resolved = normalizeSafePath('label', dir);
    assert.equal(resolved, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveOpenClawDir returns OPENCLAW_DIR_MISSING when candidate is empty or missing', () => {
  const empty = resolveOpenClawDir('');
  assert.equal(empty.ok, false);
  assert.equal(empty.outcome, NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING);

  const missing = resolveOpenClawDir('/nonexistent/openclaw-checkout-xyz');
  assert.equal(missing.ok, false);
  assert.equal(missing.outcome, NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING);
});

test('resolveOpenClawDir returns OPENCLAW_ENTRYPOINT_MISSING when dir exists without entrypoint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-orch-entry-'));
  try {
    const result = resolveOpenClawDir(dir);
    assert.equal(result.ok, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.OPENCLAW_ENTRYPOINT_MISSING);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveOpenClawDir accepts dir with entrypoint outside production paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-orch-ok-'));
  try {
    await writeFile(join(dir, 'openclaw.mjs'), '// stub\n');
    const result = resolveOpenClawDir(dir);
    assert.equal(result.ok, true);
    assert.equal(result.dir, dir);
    assert.equal(result.entrypoint, join(dir, 'openclaw.mjs'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveOpenClawDir allows production-marker source dirs as source-only', async () => {
  // Simulate a fake production marker under a tmp dir and use custom markers.
  const root = await mkdtemp(join(tmpdir(), 'openclaw-orch-prod-'));
  try {
    const fakeProduction = join(root, 'flesh_beast_tmp', 'openclaw');
    await mkdir(fakeProduction, { recursive: true });
    await writeFile(join(fakeProduction, 'openclaw.mjs'), '// stub\n');
    const result = resolveOpenClawDir(fakeProduction, { markers: [fakeProduction] });
    assert.equal(result.ok, true);
    assert.equal(result.sourceOnly, true);
    assert.equal(result.insideProductionMarker, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('allocateFreePort returns a positive TCP port and releases it', async () => {
  const port = await allocateFreePort();
  assert.equal(typeof port, 'number');
  assert.ok(port > 0 && port < 65_536);
});

test('buildRedactedConfig never emits provider or gateway secrets in cleartext', () => {
  const cfg = buildRedactedConfig({
    workspaceDir: '/tmp/workspace',
    model: 'anthropic/claude-fixture',
    contextTokens: 12000,
    keepRecentTokens: 1000,
    reserveTokens: 2000,
    port: 12345,
  });
  const serialized = JSON.stringify(cfg);
  assert.equal(cfg.gateway.auth.mode, 'none');
  assert.doesNotMatch(serialized, /sk-[a-zA-Z0-9]+/);
  assert.doesNotMatch(serialized, /api[_-]?key/i);
});

test('makeUnimplementedLiveSteps stubs throw LIVE_NOT_IMPLEMENTED with step name', async () => {
  const steps = makeUnimplementedLiveSteps();
  await assert.rejects(
    async () => steps.startMockProvider({}),
    (error) => {
      assert.equal(error.code, 'LIVE_NOT_IMPLEMENTED');
      assert.equal(error.step, 'startMockProvider');
      return true;
    },
  );
  await assert.rejects(
    async () => steps.requestCompaction({}),
    (error) => {
      assert.equal(error.step, 'requestCompaction');
      return true;
    },
  );
});

async function makeOrchestrationFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'openclaw-orch-run-'));
  const openclawDir = join(dir, 'openclaw-source');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.mjs'), '// stub\n');
  const paths = {
    root: join(dir, 'root'),
    artifactDir: join(dir, 'root', 'artifacts'),
    configPath: join(dir, 'root', 'config', 'openclaw.json'),
    stateDir: join(dir, 'root', 'state'),
    workspaceDir: join(dir, 'root', 'workspace'),
    logsDir: join(dir, 'root', 'logs'),
  };
  await mkdir(paths.artifactDir, { recursive: true });
  await mkdir(join(paths.root, 'config'), { recursive: true });
  await mkdir(paths.stateDir, { recursive: true });
  await mkdir(paths.workspaceDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });
  const args = {
    mode: 'run',
    enableLiveOrchestration: true,
    candidateSha: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
    model: 'fixture/openai-compatible-local',
    contextTokens: 12000,
    keepRecentTokens: 1000,
    reserveTokens: 2000,
    timeoutMs: 180000,
    port: 0,
    tmpdir: '',
    artifactDir: '',
    openclawDir,
    retainTmp: false,
  };
  return { dir, args, paths };
}

test('runOrchestration classifies BLOCKED-temp-gateway-start when startTempGateway rejects', async () => {
  const { dir, args, paths } = await makeOrchestrationFixture();
  try {
    const liveSteps = makeUnimplementedLiveSteps();
    // Mock provider succeeds; gateway start fails.
    liveSteps.startMockProvider = async () => ({ pid: 4242, port: 65000 });
    liveSteps.startTempGateway = async () => {
      throw new Error('bind loopback failed');
    };
    const result = await runOrchestration({ args, paths, liveSteps });
    assert.equal(result.pass, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.TEMP_GATEWAY_START);
    assert.equal(result.phase, 'temp-gateway-start');
    const outcome = JSON.parse(await readFile(join(paths.artifactDir, 'outcome.json'), 'utf8'));
    assert.equal(outcome.outcome, NON_PASS_OUTCOMES.TEMP_GATEWAY_START);
    const cleanup = JSON.parse(await readFile(join(paths.artifactDir, 'cleanup.json'), 'utf8'));
    assert.equal(cleanup.productionConfigTouched, false);
    const phaseErr = JSON.parse(await readFile(join(paths.artifactDir, 'temp-gateway-start-error.json'), 'utf8'));
    assert.match(phaseErr.reason, /bind loopback failed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runOrchestration stops at HONEST-LIMIT when startMockProvider is unimplemented', async () => {
  const { dir, args, paths } = await makeOrchestrationFixture();
  try {
    const result = await runOrchestration({ args, paths });
    assert.equal(result.pass, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED);
    assert.equal(result.phase, 'mock-provider-start');
    const preflight = JSON.parse(await readFile(join(paths.artifactDir, 'preflight-context.json'), 'utf8'));
    assert.equal(preflight.openclawEntrypoint, join(args.openclawDir, 'openclaw.mjs'));
    assert.ok(preflight.portCandidate > 0);
    const honest = JSON.parse(await readFile(
      join(paths.artifactDir, 'live-orchestration-not-yet-implemented.json'),
      'utf8',
    ));
    assert.equal(honest.step, 'startMockProvider');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runOrchestration propagates classified free-port failure', async () => {
  const { dir, args, paths } = await makeOrchestrationFixture();
  try {
    const result = await runOrchestration({
      args,
      paths,
      allocateFreePortFn: async () => {
        throw new Error('EACCES: cannot bind');
      },
    });
    assert.equal(result.pass, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.FREE_PORT_ALLOCATION);
    assert.equal(result.phase, 'allocate-free-port');
    const preflight = JSON.parse(await readFile(join(paths.artifactDir, 'preflight-context.json'), 'utf8'));
    assert.match(preflight.error, /EACCES/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runOrchestration reaches request-compaction phase and classifies FAIL when RPC rejects', async () => {
  const { dir, args, paths } = await makeOrchestrationFixture();
  try {
    const liveSteps = makeUnimplementedLiveSteps();
    liveSteps.startMockProvider = async () => ({ pid: 1, port: 65001 });
    liveSteps.startTempGateway = async () => ({ pid: 2, port: 65002 });
    liveSteps.forceContextBudget = async () => ({ effectiveFraction: 0.82 });
    liveSteps.stageLifeboat = async () => ({ delegateId: 'delegate-abc' });
    liveSteps.requestCompaction = async () => {
      throw new Error('gateway responded status:"rejected", reason:"threshold not exceeded"');
    };
    const result = await runOrchestration({ args, paths, liveSteps });
    assert.equal(result.pass, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.REQUEST_COMPACTION_REJECTED);
    assert.equal(result.phase, 'request-compaction');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('startFixtureMockProvider serves deterministic OpenAI-compatible responses and stops cleanly', async () => {
  const { startFixtureMockProvider, stopFixtureMockProvider } = await import('../lib/accepted-compaction-orchestrator.mjs');
  const receipt = await startFixtureMockProvider();
  try {
    assert.equal(receipt.kind, 'fixture-mock-provider');
    assert.ok(receipt.port > 0 && receipt.port < 65_536);
    const response = await fetch(`http://127.0.0.1:${receipt.port}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'fixture/openai-compatible-local', input: 'hello' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'completed');
    assert.equal(body.usage.total_tokens, 9016);
    assert.equal(receipt.requests.length, 1);
  } finally {
    const stopped = await stopFixtureMockProvider(receipt);
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.requestCount, 1);
  }
});

test('runOrchestration with fixture mock provider advances blocker to temp gateway start', async () => {
  const { dir, args, paths } = await makeOrchestrationFixture();
  const { startFixtureMockProvider } = await import('../lib/accepted-compaction-orchestrator.mjs');
  try {
    const liveSteps = makeUnimplementedLiveSteps();
    liveSteps.startMockProvider = startFixtureMockProvider;
    const result = await runOrchestration({ args, paths, liveSteps });
    assert.equal(result.pass, false);
    assert.equal(result.outcome, NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED);
    assert.equal(result.phase, 'temp-gateway-start');
    const preflight = JSON.parse(await readFile(join(paths.artifactDir, 'preflight-context.json'), 'utf8'));
    assert.ok(preflight.mockProvider.port > 0);
    const config = JSON.parse(await readFile(join(paths.configPath), 'utf8'));
    assert.match(config.models.providers.fixture.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    const mock = JSON.parse(await readFile(join(paths.artifactDir, 'mock-provider.json'), 'utf8'));
    assert.equal(mock.usageShape, 'deterministic-high-input-token-fixture');
    const stop = JSON.parse(await readFile(join(paths.artifactDir, 'mock-provider-stop.json'), 'utf8'));
    assert.equal(stop.stopped, true);
    const outcome = JSON.parse(await readFile(join(paths.artifactDir, 'outcome.json'), 'utf8'));
    assert.equal(outcome.phase, 'temp-gateway-start');
    assert.equal(outcome.pass, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
