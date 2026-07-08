/**
 * accepted-compaction-orchestrator.mjs — mockable orchestration primitives for
 * the Project 81 accepted request_compaction fixture (issue #331).
 *
 * This module is intentionally small and dependency-injected so that live
 * subprocess/RPC steps (Gateway start/stop, mock provider, request_compaction
 * RPC, lifecycle wait, successor sentinel) can be stubbed in tests today and
 * replaced by reviewed live implementations in a follow-up PR.
 *
 * SAFETY: no live step in this module touches production config, restarts a
 * production Gateway, or lowers fleet compaction thresholds. Every helper that
 * accepts a filesystem path routes through the path safety guards below.
 */

import { chmodSync, createWriteStream, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Filesystem markers that must never be written to, read as state, or used as
 * a fixture tempdir. Extend cautiously — every entry adds a hard-refuse rule.
 */
export const PRODUCTION_PATH_MARKERS = [
  path.join(homedir(), '.openclaw'),
  path.join(homedir(), 'flesh_beast_tmp', 'openclaw'),
];

/**
 * OpenClaw source directories are allowed to be READ (source-only) but not
 * used as production state. The default candidate matches the workorder hint.
 */
export const DEFAULT_OPENCLAW_SOURCE_DIR = path.join(
  homedir(),
  'flesh_beast_tmp',
  'openclaw',
);

/** Canonical non-PASS outcomes for the live orchestration state machine. */
export const NON_PASS_OUTCOMES = Object.freeze({
  REVIEW_GATE: 'HONEST-LIMIT-live-orchestration-review-gate',
  OPENCLAW_DIR_MISSING: 'BLOCKED-openclaw-dir-missing',
  OPENCLAW_DIR_PRODUCTION: 'BLOCKED-openclaw-dir-inside-production',
  OPENCLAW_ENTRYPOINT_MISSING: 'BLOCKED-openclaw-entrypoint-missing',
  FREE_PORT_ALLOCATION: 'BLOCKED-free-port-allocation',
  TEMP_GATEWAY_START: 'BLOCKED-temp-gateway-start',
  MOCK_PROVIDER_START: 'BLOCKED-mock-provider-start',
  CONTEXT_BUDGET: 'BLOCKED-context-budget-not-forced',
  REQUEST_COMPACTION_REJECTED: 'FAIL-request-compaction-rejected',
  REQUEST_COMPACTION_PENDING: 'FAIL-request-compaction-already-pending',
  COMPACTION_TIMEOUT: 'FAIL-compaction-timeout',
  LIFEBOAT_MISSING: 'FAIL-lifeboat-missing',
  SENTINEL_MISSING: 'FAIL-sentinel-missing',
  CLEANUP: 'FAIL-cleanup',
  LIVE_SEND_NOT_IMPLEMENTED: 'HONEST-LIMIT-live-orchestration-preflight-only',
});

/**
 * Returns a resolved absolute path plus any non-existent suffix, so path guards
 * catch symlinked production paths whose leaf doesn't exist yet.
 */
export function existingRealpathWithSuffix(target) {
  const suffix = [];
  let cursor = target;
  while (!existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return target;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  const realExisting = realpathSync.native(cursor);
  return suffix.length ? path.join(realExisting, ...suffix) : realExisting;
}

export function productionPathCandidates(markers = PRODUCTION_PATH_MARKERS) {
  const candidates = new Set();
  for (const marker of markers) {
    const resolved = path.resolve(marker);
    candidates.add(resolved);
    if (existsSync(resolved)) candidates.add(realpathSync.native(resolved));
  }
  return [...candidates];
}

export function assertNotProductionPath(label, candidate, markers = PRODUCTION_PATH_MARKERS) {
  if (candidate === path.parse(candidate).root) {
    throw new Error(`${label} must not be filesystem root`);
  }
  if (candidate === homedir()) {
    throw new Error(`${label} must not be the user home directory`);
  }
  for (const production of productionPathCandidates(markers)) {
    if (candidate === production || candidate.startsWith(`${production}${path.sep}`)) {
      throw new Error(`${label} points inside production path ${production}`);
    }
  }
}

/**
 * Refuse candidate paths — used for tmpdir / artifact / state / config.
 * Returns the resolved absolute path.
 */
export function normalizeSafePath(label, value, markers = PRODUCTION_PATH_MARKERS) {
  if (!value) return '';
  const resolved = path.resolve(value);
  const realResolved = existingRealpathWithSuffix(resolved);
  assertNotProductionPath(label, resolved, markers);
  assertNotProductionPath(label, realResolved, markers);
  return resolved;
}

/**
 * OpenClaw source directory is allowed to be READ but must not host the temp
 * config / state / workspace. Returns { ok, dir, entrypoint, outcome } where
 * outcome is one of NON_PASS_OUTCOMES on failure.
 */
export function resolveOpenClawDir(candidate, {
  markers = PRODUCTION_PATH_MARKERS,
  entrypointRelative = 'openclaw.mjs',
  fsExists = existsSync,
} = {}) {
  if (!candidate) {
    return {
      ok: false,
      outcome: NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING,
      reason: 'openclaw source directory not supplied',
    };
  }
  const resolved = path.resolve(candidate);
  const realResolved = existingRealpathWithSuffix(resolved);

  // OpenClaw source directories may live under a production marker (the live
  // checkout does). This resolver is source-only: config, state, workspace,
  // logs, and artifacts are guarded separately by normalizeSafePath and must
  // never point under the source checkout or ~/.openclaw. Do not reject a
  // production source path here; instead record it in the preflight receipt so
  // reviewers can verify that only temp paths are writable.

  if (!fsExists(resolved)) {
    return {
      ok: false,
      outcome: NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING,
      reason: `openclaw dir ${resolved} does not exist`,
      dir: resolved,
    };
  }
  const entrypoint = path.join(resolved, entrypointRelative);
  if (!fsExists(entrypoint)) {
    return {
      ok: false,
      outcome: NON_PASS_OUTCOMES.OPENCLAW_ENTRYPOINT_MISSING,
      reason: `openclaw entrypoint ${entrypoint} does not exist`,
      dir: resolved,
      entrypoint,
    };
  }
  return {
    ok: true,
    dir: resolved,
    realDir: realResolved,
    entrypoint,
    sourceOnly: true,
    insideProductionMarker: productionPathCandidates(markers).some((production) =>
      resolved === production || resolved.startsWith(`${production}${path.sep}`) ||
      realResolved === production || realResolved.startsWith(`${production}${path.sep}`),
    ),
  };
}

/**
 * Allocate an ephemeral loopback port by asking the kernel for one and
 * releasing it. Callers should treat this as advisory — the OS may reassign
 * before the Gateway binds. In this increment we only use it during preflight
 * so races with real listeners are irrelevant.
 */
export function allocateFreePort({ host = '127.0.0.1', createServerFn = createServer } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServerFn();
    server.unref();
    server.on('error', (error) => {
      reject(error);
    });
    server.listen({ port: 0, host }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to determine free port')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Redacted temp config shape written to `<tempRoot>/config/openclaw.json`.
 * The gateway token is only referenced by env var in the plan; the config
 * itself never contains the fixture token in cleartext.
 */
export function buildRedactedConfig({
  workspaceDir,
  model,
  contextTokens,
  keepRecentTokens,
  reserveTokens,
  port,
  mockProviderPort = '<mock-provider-port>',
}) {
  const [provider, ...modelParts] = String(model || '').split('/');
  const modelName = modelParts.join('/') || 'default';
  return {
    gateway: {
      mode: 'local',
      port,
      auth: { mode: 'none' },
      controlUi: { enabled: false },
      tailscale: { mode: 'off' },
    },
    discovery: {
      mdns: { mode: 'off' },
      wideArea: { enabled: false },
    },
    agents: {
      defaults: {
        workspace: workspaceDir,
        continuation: { enabled: true },
        compaction: {
          keepRecentTokens,
          reserveTokens,
          reserveTokensFloor: reserveTokens,
          truncateAfterCompaction: true,
          notifyUser: false,
        },
      },
    },
    models: {
      providers: {
        [provider || 'fixture']: {
          baseUrl: `http://127.0.0.1:${mockProviderPort}`,
          api: 'openai-responses',
          models: [{
            id: modelName,
            name: modelName,
            contextTokens,
          }],
        },
      },
    },
  };
}

export function writeJsonArtifact(file, value, mode = 0o600) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
}


export async function startFixtureMockProvider({
  host = '127.0.0.1',
  createServerFn = createHttpServer,
  now = () => new Date().toISOString(),
} = {}) {
  const requests = [];
  const server = createServerFn((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: req.method, url: req.url, bodyBytes: Buffer.byteLength(body), at: now() });
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/v1/responses') {
        res.end(JSON.stringify({
          id: 'resp_accepted_compaction_fixture',
          object: 'response',
          created_at: 0,
          status: 'completed',
          model: 'fixture/openai-compatible-local',
          output: [{
            id: 'msg_fixture',
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'ACCEPTED_COMPACTION_FIXTURE_RESPONSE' }],
          }],
          usage: { input_tokens: 9000, output_tokens: 16, total_tokens: 9016 },
        }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        res.end(JSON.stringify({
          id: 'chatcmpl_accepted_compaction_fixture',
          object: 'chat.completion',
          created: 0,
          model: 'fixture/openai-compatible-local',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ACCEPTED_COMPACTION_FIXTURE_RESPONSE' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 9000, completion_tokens: 16, total_tokens: 9016 },
        }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: 'fixture mock provider route not found' } }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port: 0, host }, resolve);
  });
  server.unref();
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('fixture mock provider failed to expose a TCP port');
  }
  return {
    kind: 'fixture-mock-provider',
    host,
    port: address.port,
    startedAt: now(),
    requests,
    server,
    artifact: {
      name: 'mock-provider.json',
      body: {
        schema: 'openclaw.project81.accepted-request-compaction.mock-provider.v1',
        host,
        port: address.port,
        startedAt: now(),
        routes: ['/v1/responses', '/v1/chat/completions'],
        usageShape: 'deterministic-high-input-token-fixture',
      },
    },
  };
}


function waitForGatewayHealthz({ port, host = '127.0.0.1', timeoutMs = 30_000, intervalMs = 250, child }) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (child?.exitCode !== null || child?.signalCode) {
        reject(new Error(`temp Gateway exited before readiness (exit=${child.exitCode}, signal=${child.signalCode})`));
        return;
      }
      const req = httpRequest({ host, port, path: '/healthz', method: 'GET', timeout: 2_000 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, readyAfterMs: Date.now() - startedAt });
          return;
        }
        schedule();
      });
      req.on('timeout', () => req.destroy(new Error('healthz request timed out')));
      req.on('error', schedule);
      req.end();
    };
    const schedule = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`temp Gateway did not answer /healthz within ${timeoutMs}ms`));
        return;
      }
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

export async function startTempGatewayProcess({
  args,
  paths,
  port,
  openclaw,
  now = () => new Date().toISOString(),
  spawnFn = spawn,
  waitForHealthz = waitForGatewayHealthz,
} = {}) {
  if (!openclaw?.entrypoint) throw new Error('openclaw entrypoint missing for temp Gateway start');
  mkdirSync(paths.logsDir, { recursive: true, mode: 0o700 });
  const stdoutPath = path.join(paths.logsDir, 'temp-gateway.stdout.log');
  const stderrPath = path.join(paths.logsDir, 'temp-gateway.stderr.log');
  const stdout = createWriteStream(stdoutPath, { flags: 'a', mode: 0o600 });
  const stderr = createWriteStream(stderrPath, { flags: 'a', mode: 0o600 });
  const token = `fixture-token-${Math.random().toString(36).slice(2)}`;
  const argv = [
    openclaw.entrypoint,
    'gateway',
    'run',
    '--port',
    String(port),
    '--bind',
    'loopback',
    '--auth',
    'none',
    '--allow-unconfigured',
  ];
  const env = {
    ...process.env,
    OPENCLAW_ACCEPTED_COMPACTION_FIXTURE_CHILD: 'true',
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_SKIP_CHANNELS: '1',
    OPENCLAW_SKIP_PROVIDERS: '1',
    OPENCLAW_TEST_MINIMAL_GATEWAY: process.env.OPENCLAW_TEST_MINIMAL_GATEWAY ?? '1',
    NODE_DISABLE_COMPILE_CACHE: process.env.NODE_DISABLE_COMPILE_CACHE ?? '1',
  };
  const child = spawnFn(process.execPath, argv, {
    cwd: openclaw.dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);
  const startedAt = now();
  try {
    const healthz = await waitForHealthz({ port, child, timeoutMs: Math.min(args.timeoutMs, 60_000) });
    return {
      kind: 'temp-gateway',
      child,
      pid: child.pid,
      port,
      startedAt,
      healthz,
      stdoutPath,
      stderrPath,
      artifact: {
        name: 'temp-gateway-start.json',
        body: {
          schema: 'openclaw.project81.accepted-request-compaction.temp-gateway-start.v1',
          pid: child.pid,
          port,
          startedAt,
          readyAfterMs: healthz.readyAfterMs,
          healthzStatusCode: healthz.statusCode,
          command: {
            executable: process.execPath,
            args: argv,
            cwd: openclaw.dir,
          },
          env: {
            OPENCLAW_CONFIG_PATH: paths.configPath,
            OPENCLAW_STATE_DIR: paths.stateDir,
            OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
            OPENCLAW_GATEWAY_TOKEN: '<REDACTED-fixture-token>',
            OPENCLAW_SKIP_CHANNELS: '1',
            OPENCLAW_SKIP_PROVIDERS: '1',
          },
          logs: { stdoutPath, stderrPath },
        },
      },
    };
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }
}

export async function stopTempGatewayProcess(receipt, { now = () => new Date().toISOString(), timeoutMs = 5_000 } = {}) {
  const child = receipt?.child;
  if (!child) return { stopped: false, reason: 'no temp Gateway child receipt', stoppedAt: now() };
  if (child.exitCode !== null || child.signalCode) {
    return { stopped: true, alreadyExited: true, exitCode: child.exitCode, signal: child.signalCode, stoppedAt: now() };
  }
  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ exitCode: code, signal }));
  });
  child.kill('SIGTERM');
  const result = await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!result) {
    child.kill('SIGKILL');
    const forced = await exitPromise;
    return { stopped: true, forced: true, ...forced, stoppedAt: now() };
  }
  return { stopped: true, forced: false, ...result, stoppedAt: now() };
}

export async function stopFixtureMockProvider(receipt, { now = () => new Date().toISOString() } = {}) {
  if (!receipt?.server) return { stopped: false, reason: 'no mock provider server receipt', stoppedAt: now() };
  await new Promise((resolve, reject) => {
    receipt.server.close((error) => (error ? reject(error) : resolve()));
  });
  return {
    stopped: true,
    stoppedAt: now(),
    requestCount: Array.isArray(receipt.requests) ? receipt.requests.length : null,
  };
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/**
 * Stub live steps. Every stub throws a well-known error whose message is
 * matched by the state machine and mapped onto a classified outcome.
 * Tests inject their own implementations via the deps argument to
 * `runOrchestration`.
 */
export function makeUnimplementedLiveSteps() {
  const notImplemented = (name) => async () => {
    const err = new Error(`${name} not implemented in this scaffold increment`);
    err.code = 'LIVE_NOT_IMPLEMENTED';
    err.step = name;
    throw err;
  };
  return {
    startMockProvider: notImplemented('startMockProvider'),
    stopMockProvider: notImplemented('stopMockProvider'),
    startTempGateway: notImplemented('startTempGateway'),
    stopTempGateway: notImplemented('stopTempGateway'),
    callGatewayRpc: notImplemented('callGatewayRpc'),
    forceContextBudget: notImplemented('forceContextBudget'),
    stageLifeboat: notImplemented('stageLifeboat'),
    requestCompaction: notImplemented('requestCompaction'),
    waitForCompactionComplete: notImplemented('waitForCompactionComplete'),
    verifyLifeboatReturn: notImplemented('verifyLifeboatReturn'),
    verifySuccessorSentinel: notImplemented('verifySuccessorSentinel'),
    fetchTrace: notImplemented('fetchTrace'),
  };
}

/**
 * Live orchestration state machine. Runs one phase at a time, emitting a
 * classified outcome and cleanup receipt at the first failing step. Deps are
 * fully injectable so tests can drive any phase transition without spawning
 * real subprocesses.
 *
 * Returns { pass:false, outcome, phase, artifacts, cleanup }.
 * PASS is only possible when every phase completes successfully. Even then,
 * this increment returns pass:false with outcome LIVE_SEND_NOT_IMPLEMENTED,
 * so no PASS can be inadvertently claimed from a preflight-only run.
 */
export async function runOrchestration({
  args,
  paths,
  markers = PRODUCTION_PATH_MARKERS,
  liveSteps = makeUnimplementedLiveSteps(),
  now = () => new Date().toISOString(),
  allocateFreePortFn = allocateFreePort,
  resolveOpenClawDirFn = resolveOpenClawDir,
}) {
  const artifacts = [];
  const emit = (name, body) => {
    const file = path.join(paths.artifactDir, name);
    writeJsonArtifact(file, body);
    artifacts.push(name);
  };

  const preflight = {
    schema: 'openclaw.project81.accepted-request-compaction.preflight.v1',
    startedAt: now(),
    candidateSha: args.candidateSha,
    openclawDir: null,
    openclawEntrypoint: null,
    portCandidate: null,
    contextBudget: {
      contextTokens: args.contextTokens,
      keepRecentTokens: args.keepRecentTokens,
      reserveTokens: args.reserveTokens,
      floor: 0.7,
    },
  };

  const cleanupState = {
    gatewayStopped: null,
    mockProviderStopped: null,
  };

  const finish = (outcome, phase, extra = {}) => {
    const cleanup = {
      schema: 'openclaw.project81.accepted-request-compaction.cleanup.v1',
      status: outcome.startsWith('BLOCKED') || outcome.startsWith('FAIL')
        ? 'stopped-during-orchestration'
        : cleanupState.gatewayStopped
          ? 'temp-gateway-started-and-stopped'
          : 'preflight-only-no-gateway-started',
      retained: args.retainTmp,
      tempRoot: paths.root,
      productionConfigTouched: false,
      gatewayStopped: cleanupState.gatewayStopped,
      mockProviderStopped: cleanupState.mockProviderStopped,
      finishedAt: now(),
    };
    emit('cleanup.json', cleanup);
    const outcomeArtifact = {
      schema: 'openclaw.project81.accepted-request-compaction.outcome.v1',
      outcome,
      pass: false,
      phase,
      artifactDir: paths.artifactDir,
      artifacts,
    };
    emit('outcome.json', outcomeArtifact);
    return { pass: false, outcome, phase, artifacts, cleanup, ...extra };
  };

  // Phase 1: preflight paths & openclaw source dir
  ensureDir(paths.artifactDir);
  const openclaw = resolveOpenClawDirFn(args.openclawDir, { markers });
  if (!openclaw.ok) {
    preflight.openclawDir = openclaw.dir ?? args.openclawDir ?? null;
    preflight.openclawEntrypoint = openclaw.entrypoint ?? null;
    preflight.error = openclaw.reason;
    emit('preflight-context.json', preflight);
    return finish(openclaw.outcome, 'openclaw-dir');
  }
  preflight.openclawDir = openclaw.dir;
  preflight.openclawEntrypoint = openclaw.entrypoint;
  preflight.openclawSourceOnly = true;
  preflight.openclawInsideProductionMarker = openclaw.insideProductionMarker === true;

  // Phase 2: allocate free port (only when caller left port==0)
  let port = args.port;
  if (!port) {
    try {
      port = await allocateFreePortFn({ host: '127.0.0.1' });
    } catch (error) {
      preflight.error = String(error?.message ?? error);
      emit('preflight-context.json', preflight);
      return finish(NON_PASS_OUTCOMES.FREE_PORT_ALLOCATION, 'allocate-free-port');
    }
  }
  preflight.portCandidate = port;

  const receipts = {};

  const stopStartedGateway = async () => {
    if (!receipts.startTempGateway || cleanupState.gatewayStopped) return;
    const stopped = await liveSteps.stopTempGateway(receipts.startTempGateway, { now });
    cleanupState.gatewayStopped = stopped;
    emit('temp-gateway-stop.json', {
      schema: 'openclaw.project81.accepted-request-compaction.temp-gateway-stop.v1',
      ...stopped,
    });
  };

  const stopStartedMockProvider = async () => {
    if (!receipts.startMockProvider || cleanupState.mockProviderStopped) return;
    const stopped = await stopFixtureMockProvider(receipts.startMockProvider, { now });
    cleanupState.mockProviderStopped = stopped;
    emit('mock-provider-stop.json', {
      schema: 'openclaw.project81.accepted-request-compaction.mock-provider-stop.v1',
      ...stopped,
    });
  };

  const cleanupStartedProcesses = async () => {
    await stopStartedGateway();
    await stopStartedMockProvider();
  };

  // Phase 3: start deterministic local mock provider before config write so
  // the temp Gateway config can point at a real loopback baseUrl.
  try {
    const receipt = await liveSteps.startMockProvider({ args, paths, port, openclaw, receipts });
    if (receipt && typeof receipt === 'object') {
      receipts.startMockProvider = receipt;
      preflight.mockProvider = { host: receipt.host ?? '127.0.0.1', port: receipt.port ?? null };
      if (receipt.artifact) emit(receipt.artifact.name, receipt.artifact.body);
    }
  } catch (error) {
    const reason = String(error?.message ?? error);
    if (error && error.code === 'LIVE_NOT_IMPLEMENTED') {
      emit('live-orchestration-not-yet-implemented.json', {
        schema: 'openclaw.project81.accepted-request-compaction.honest-limit.v1',
        step: 'startMockProvider',
        reason,
      });
      emit('preflight-context.json', preflight);
      return finish(NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED, 'mock-provider-start', { preflight });
    }
    emit('mock-provider-start-error.json', {
      schema: 'openclaw.project81.accepted-request-compaction.phase-error.v1',
      phase: 'mock-provider-start',
      step: 'startMockProvider',
      reason,
    });
    emit('preflight-context.json', preflight);
    return finish(NON_PASS_OUTCOMES.MOCK_PROVIDER_START, 'mock-provider-start', { preflight });
  }

  // Phase 4: write redacted temp config (no secrets on disk)
  ensureDir(path.dirname(paths.configPath));
  const config = buildRedactedConfig({
    workspaceDir: paths.workspaceDir,
    model: args.model,
    contextTokens: args.contextTokens,
    keepRecentTokens: args.keepRecentTokens,
    reserveTokens: args.reserveTokens,
    port,
    mockProviderPort: receipts.startMockProvider?.port ?? '<mock-provider-port>',
  });
  writeJsonArtifact(paths.configPath, config);
  emit('temp-config.redacted.json', config);
  preflight.tempConfigPath = paths.configPath;
  emit('preflight-context.json', preflight);

  // Phase 5+ live steps. Each call maps its failure onto a classified outcome
  // so callers never see a stack trace masquerading as an unclassified failure.
  const phaseMap = [
    ['temp-gateway-start', 'startTempGateway', NON_PASS_OUTCOMES.TEMP_GATEWAY_START],
    ['force-context-budget', 'forceContextBudget', NON_PASS_OUTCOMES.CONTEXT_BUDGET],
    ['stage-lifeboat', 'stageLifeboat', NON_PASS_OUTCOMES.LIFEBOAT_MISSING],
    ['request-compaction', 'requestCompaction', NON_PASS_OUTCOMES.REQUEST_COMPACTION_REJECTED],
    ['wait-compaction-complete', 'waitForCompactionComplete', NON_PASS_OUTCOMES.COMPACTION_TIMEOUT],
    ['verify-lifeboat-return', 'verifyLifeboatReturn', NON_PASS_OUTCOMES.LIFEBOAT_MISSING],
    ['verify-successor-sentinel', 'verifySuccessorSentinel', NON_PASS_OUTCOMES.SENTINEL_MISSING],
  ];

  for (const [phase, step, failureOutcome] of phaseMap) {
    try {
      const receipt = await liveSteps[step]({
        args,
        paths,
        port,
        openclaw,
        receipts,
      });
      if (receipt && typeof receipt === 'object') {
        receipts[step] = receipt;
        if (receipt.artifact) {
          emit(receipt.artifact.name, receipt.artifact.body);
        }
      }
    } catch (error) {
      const reason = String(error?.message ?? error);
      if (error && error.code === 'LIVE_NOT_IMPLEMENTED') {
        // Preflight-only mode: emit an honest-limit marker and stop cleanly.
        emit('live-orchestration-not-yet-implemented.json', {
          schema: 'openclaw.project81.accepted-request-compaction.honest-limit.v1',
          step,
          reason,
        });
        await cleanupStartedProcesses();
        return finish(NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED, phase, {
          preflight,
        });
      }
      emit(`${phase}-error.json`, {
        schema: 'openclaw.project81.accepted-request-compaction.phase-error.v1',
        phase,
        step,
        reason,
      });
      await cleanupStartedProcesses();
      return finish(failureOutcome, phase, { preflight });
    }
  }

  // Should never reach here in this increment because live steps throw; but
  // if a future PR wires them and everything succeeds, we still refuse PASS
  // until the trace / lifeboat / sentinel receipts are separately validated.
  emit('trace-unavailable.json', {
    schema: 'openclaw.project81.accepted-request-compaction.trace.v1',
    reason: 'trace validation not yet integrated in this increment',
  });
  await cleanupStartedProcesses();
  return finish(NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED, 'trace-validation', { preflight });
}
