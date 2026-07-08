#!/usr/bin/env node
/**
 * run-accepted-compaction-fixture.mjs — fail-closed planner/live scaffold for
 * the Project 81 accepted request_compaction fixture.
 *
 * This implementation keeps the PASS seam blocked until the fixture can drive a
 * real accepted request_compaction lifecycle. It now does the next concrete
 * live step safely: create an isolated temp profile, allocate/validate a unique
 * loopback port, write a temp config, attempt to start a temp Gateway, probe
 * readiness, and always emit cleanup receipts proving the temp process was
 * stopped (or never touched production if startup failed).
 */
import { spawn } from 'node:child_process';
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import {
  NON_PASS_OUTCOMES,
  PRODUCTION_PATH_MARKERS,
  DEFAULT_OPENCLAW_SOURCE_DIR,
  buildRedactedConfig,
  makeUnimplementedLiveSteps,
  startFixtureMockProvider,
  normalizeSafePath as sharedNormalizeSafePath,
  runOrchestration,
} from './lib/accepted-compaction-orchestrator.mjs';

const DEFAULT_CONTEXT_TOKENS = 12_000;
const DEFAULT_KEEP_RECENT_TOKENS = 1_000;
const DEFAULT_RESERVE_TOKENS = 2_000;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_PORT = 0;
const DEFAULT_MODEL = 'fixture/openai-compatible-local';
const DEFAULT_PROVIDER_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_GATEWAY_PROBE_TIMEOUT_MS = 15_000;
const DEFAULT_GATEWAY_STOP_TIMEOUT_MS = 10_000;
const NON_PASS_EXIT_CODE = 3;
const VALID_LIVE_OUTCOMES = new Set([
  'HONEST-LIMIT-local-model-unavailable',
  'BLOCKED-temp-gateway-start',
  'BLOCKED-context-budget-not-forced',
  'FAIL-request-compaction-rejected',
  'FAIL-request-compaction-already-pending',
  'FAIL-compaction-timeout',
  'FAIL-lifeboat-missing',
  'FAIL-sentinel-missing',
  'FAIL-cleanup',
]);


function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs --plan [options]

Options:
  --plan, --dry-run                Emit a redacted plan artifact and exit 0.
  --run                           Attempt isolated temp-Gateway startup, then fail closed until the accepted compaction seam is implemented.
  --artifact-dir <path>            Directory for emitted artifacts.
  --tmpdir <path>                  Temp root for fixture config/state/workspace/logs.
  --candidate-sha <sha>            Candidate SHA under test (40-char hex when supplied).
  --model <provider/model>         Fixture model id (default: ${DEFAULT_MODEL}).
  --context-tokens <n>             Effective context cap (default: ${DEFAULT_CONTEXT_TOKENS}).
  --keep-recent-tokens <n>         Compaction keepRecentTokens (default: ${DEFAULT_KEEP_RECENT_TOKENS}).
  --reserve-tokens <n>             Compaction reserveTokens/floor (default: ${DEFAULT_RESERVE_TOKENS}).
  --timeout-ms <n>                 Lifecycle timeout (default: ${DEFAULT_TIMEOUT_MS}).
  --port <n>                       Temp Gateway port, 0 = choose/free port later.
  --retain-tmp                    Mark temp root retained in cleanup plan.
  --json                          Print machine-readable result.
  --help                          Show this help.

Environment defaults:
  OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true   Required for --run only.
  OPENCLAW_ACCEPTED_COMPACTION_TMPDIR=<tmp>   Fixture temp root.
  OPENCLAW_CANDIDATE_SHA=<sha>
  OPENCLAW_ACCEPTED_COMPACTION_MODEL=<provider/model>
  OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_PORT=<n>
  OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP=true
  OPENCLAW_ACCEPTED_COMPACTION_PROVIDER_BASE_URL=<url>
  OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON='["openclaw","gateway"]'`;
}

function parsePositiveInteger(value, label, { allowZero = false, max = null } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < (allowZero ? 0 : 1) || (max !== null && parsed > max)) {
    const floor = allowZero ? 'a non-negative' : 'a positive';
    const ceiling = max === null ? '' : ` <= ${max}`;
    throw new Error(`${label} must be ${floor} integer${ceiling}`);
  }
  return parsed;
}

function parseArgs(argv, env = process.env) {
  if (argv.slice(2).includes('--help')) return { help: true };
  const args = {
    mode: null,
    json: false,
    retainTmp: env.OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP === 'true',
    enableLiveOrchestration: env.OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE === 'true',
    candidateSha: env.OPENCLAW_CANDIDATE_SHA || '',
    model: env.OPENCLAW_ACCEPTED_COMPACTION_MODEL || DEFAULT_MODEL,
    contextTokens: parsePositiveInteger(env.OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS || DEFAULT_CONTEXT_TOKENS, 'context tokens'),
    keepRecentTokens: parsePositiveInteger(env.OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS || DEFAULT_KEEP_RECENT_TOKENS, 'keep recent tokens'),
    reserveTokens: parsePositiveInteger(env.OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS || DEFAULT_RESERVE_TOKENS, 'reserve tokens'),
    timeoutMs: parsePositiveInteger(env.OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS, 'timeout ms'),
    port: parsePositiveInteger(env.OPENCLAW_ACCEPTED_COMPACTION_PORT || DEFAULT_PORT, 'port', { allowZero: true, max: 65_535 }),
    tmpdir: env.OPENCLAW_ACCEPTED_COMPACTION_TMPDIR || '',
    artifactDir: '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') return { ...args, help: true };
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--plan' || arg === '--dry-run') {
      if (args.mode && args.mode !== 'plan') throw new Error('choose only one mode');
      args.mode = 'plan';
      continue;
    }
    if (arg === '--run') {
      if (args.mode && args.mode !== 'run') throw new Error('choose only one mode');
      args.mode = 'run';
      continue;
    }
    if (arg === '--retain-tmp') {
      args.retainTmp = true;
      continue;
    }
    if (arg === '--enable-live-orchestration') {
      args.enableLiveOrchestration = true;
      continue;
    }
    if (arg === '--enable-live-orchestration') {
      args.enableLiveOrchestration = true;
      continue;
    }
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--tmpdir') args.tmpdir = next();
    else if (arg === '--openclaw-dir') args.openclawDir = next();
    else if (arg === '--candidate-sha') args.candidateSha = next();
    else if (arg === '--model') args.model = next();
    else if (arg === '--context-tokens') args.contextTokens = parsePositiveInteger(next(), 'context tokens');
    else if (arg === '--keep-recent-tokens') args.keepRecentTokens = parsePositiveInteger(next(), 'keep recent tokens');
    else if (arg === '--reserve-tokens') args.reserveTokens = parsePositiveInteger(next(), 'reserve tokens');
    else if (arg === '--timeout-ms') args.timeoutMs = parsePositiveInteger(next(), 'timeout ms');
    else if (arg === '--port') args.port = parsePositiveInteger(next(), 'port', { allowZero: true, max: 65_535 });
    else throw new Error(`unexpected argument: ${arg}`);
  }

  if (!args.mode) args.mode = 'plan';
  return args;
}

function existingRealpathWithSuffix(resolved) {
  const suffix = [];
  let cursor = resolved;
  while (!existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return resolved;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  const realExisting = realpathSync.native(cursor);
  return suffix.length ? path.join(realExisting, ...suffix) : realExisting;
}

function productionPathCandidates() {
  const candidates = new Set();
  for (const marker of PRODUCTION_PATH_MARKERS) {
    const resolved = path.resolve(marker);
    candidates.add(resolved);
    if (existsSync(resolved)) candidates.add(realpathSync.native(resolved));
  }
  return [...candidates];
}

function assertNotProductionPath(label, candidate) {
  if (candidate === path.parse(candidate).root) throw new Error(`${label} must not be filesystem root`);
  if (candidate === homedir()) throw new Error(`${label} must not be the user home directory`);
  for (const production of productionPathCandidates()) {
    if (candidate === production || candidate.startsWith(`${production}${path.sep}`)) {
      throw new Error(`${label} points inside production path ${production}`);
    }
  }
}

function normalizeSafePath(label, value) {
  if (!value) return '';
  const resolved = path.resolve(value);
  const realResolved = existingRealpathWithSuffix(resolved);
  assertNotProductionPath(label, resolved);
  assertNotProductionPath(label, realResolved);
  return resolved;
}

async function preparePaths(args) {
  const nonce = randomBytes(6).toString('hex');
  const root = args.tmpdir
    ? normalizeSafePath('OPENCLAW_ACCEPTED_COMPACTION_TMPDIR/tmpdir', args.tmpdir)
    : await mkdtemp(path.join(tmpdir(), 'openclaw-accepted-compaction-'));
  const artifactDir = args.artifactDir
    ? normalizeSafePath('artifact dir', args.artifactDir)
    : path.join(root, 'artifacts', `plan-${nonce}`);

  const paths = {
    root,
    artifactDir,
    configPath: normalizeSafePath('config path', path.join(root, 'config', 'openclaw.json')),
    stateDir: normalizeSafePath('state dir', path.join(root, 'state')),
    workspaceDir: normalizeSafePath('workspace dir', path.join(root, 'workspace')),
    logsDir: normalizeSafePath('logs dir', path.join(root, 'logs')),
  };

  for (const dir of [paths.artifactDir, path.dirname(paths.configPath), paths.stateDir, paths.workspaceDir, paths.logsDir]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return paths;
}

function validateArgs(args) {
  if (args.candidateSha && !/^[0-9a-f]{40}$/u.test(args.candidateSha)) {
    throw new Error('candidate SHA must be a 40-character lowercase hex SHA when supplied');
  }
  if (args.contextTokens < 4_000) throw new Error('context tokens must be at least 4000 for a meaningful compaction fixture');
  if (args.keepRecentTokens + args.reserveTokens >= args.contextTokens) {
    throw new Error('keepRecentTokens + reserveTokens must be below contextTokens');
  }
  if (args.mode === 'run') {
    if (process.env.OPENCLAW_ACCEPTED_COMPACTION_FIXTURE !== 'true') {
      throw new Error('refusing --run: set OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true after review to opt into live fixture execution');
    }
    if (!args.candidateSha) throw new Error('refusing --run: OPENCLAW_CANDIDATE_SHA or --candidate-sha is required');
  }
}

function generateFixtureToken() {
  return randomBytes(24).toString('base64url');
}

function isPathInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function renderConfig(args, paths, runtime, { redactSecrets }) {
  const [provider, ...modelParts] = args.model.split('/');
  const providerId = provider || 'fixture';
  const modelName = modelParts.join('/') || 'default';
  const gatewayToken = redactSecrets ? '<REDACTED-fixture-token>' : runtime.gatewayToken;
  const providerBaseUrl = runtime.mockProviderPort ? `http://127.0.0.1:${runtime.mockProviderPort}` : (process.env.OPENCLAW_ACCEPTED_COMPACTION_PROVIDER_BASE_URL || DEFAULT_PROVIDER_BASE_URL);

  return {
    gateway: {
      mode: 'local',
      bind: 'loopback',
      port: runtime.port,
      mockProviderPort: runtime.mockProviderPort,
      auth: {
        mode: 'token',
        token: gatewayToken,
      },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
          responses: { enabled: true },
        },
      },
    },
    agents: {
      defaults: {
        model: args.model,
        workspace: paths.workspaceDir,
        continuation: {
          enabled: true,
          contextPressureThreshold: 0.7,
          maxChainLength: 4,
          maxDelegatesPerTurn: 4,
          costCapTokens: args.contextTokens * 4,
        },
        compaction: {
          mode: 'safeguard',
          keepRecentTokens: args.keepRecentTokens,
          reserveTokens: args.reserveTokens,
          reserveTokensFloor: args.reserveTokens,
          truncateAfterCompaction: true,
          notifyUser: false,
        },
      },
    },
    models: {
      providers: {
        [providerId]: {
          baseUrl: providerBaseUrl,
          api: 'openai-completions',
          auth: 'token',
          apiKey: redactSecrets ? '<REDACTED-provider-secret>' : 'fixture-local-provider-token',
          contextTokens: args.contextTokens,
          models: [
            {
              id: modelName,
              name: modelName,
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: args.contextTokens,
              contextTokens: args.contextTokens,
              maxTokens: Math.max(512, args.reserveTokens),
            },
          ],
        },
      },
    },
    tools: {
      profile: 'coding',
    },
  };
}

function requiredReceipts() {
  return [
    'fixture-readiness.json',
    'temp-config.redacted.json',
    'preflight-context.json',
    'turn-transcript-excerpt.jsonl',
    'request-compaction-accepted.json',
    'compaction-lifecycle.json',
    'post-compaction-lifeboat.json',
    'successor-sentinel.json',
    'cleanup.json',
    'trace-<id>.json or trace-unavailable.json',
  ];
}

function buildPlan(args, paths, runtime) {
  const gatewayWs = `ws://127.0.0.1:${runtime.port}`;
  return {
    schema: 'openclaw.project81.accepted-request-compaction.plan.v1',
    mode: args.mode === 'plan' ? 'PLAN_ONLY' : 'LIVE_ISOLATED_GATEWAY_ONLY',
    outcome: args.mode === 'plan' ? 'PLAN_ONLY-redacted-dry-run' : 'BLOCKED-context-budget-not-forced',
    candidateSha: args.candidateSha || '<unset-plan-only>',
    model: args.model,
    contextTokens: args.contextTokens,
    keepRecentTokens: args.keepRecentTokens,
    reserveTokens: args.reserveTokens,
    timeoutMs: args.timeoutMs,
    requestedPort: args.port,
    allocatedPort: runtime.port,
    gatewayWs,
    paths: {
      tempRoot: paths.root,
      configPath: paths.configPath,
      stateDir: paths.stateDir,
      workspaceDir: paths.workspaceDir,
      logsDir: paths.logsDir,
      artifactDir: paths.artifactDir,
    },
    env: {
      OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: args.mode === 'run' ? 'true' : '<not-required-for-plan>',
      OPENCLAW_ACCEPTED_COMPACTION_TMPDIR: paths.root,
      OPENCLAW_CONFIG_PATH: paths.configPath,
      OPENCLAW_STATE_DIR: paths.stateDir,
      OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
      OPENCLAW_ACCEPTED_COMPACTION_PORT: String(runtime.port),
      OPENCLAW_ACCEPTED_COMPACTION_PORT: String(runtime.port),
      OPENCLAW_GATEWAY_PORT: String(runtime.port),
      OPENCLAW_GATEWAY_WS: gatewayWs,
      OPENCLAW_GATEWAY_TOKEN: '<REDACTED-fixture-token>',
      OPENCLAW_CANDIDATE_SHA: args.candidateSha || '<unset-plan-only>',
      OPENCLAW_ACCEPTED_COMPACTION_MODEL: args.model,
      OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS: String(args.contextTokens),
      OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS: String(args.keepRecentTokens),
      OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS: String(args.reserveTokens),
      OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS: String(args.timeoutMs),
      OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP: args.retainTmp ? 'true' : 'false',
    },
    proofFlow: [
      'start isolated temp Gateway with the redacted config shape',
      'create disposable proof session in temp state',
      'prove fresh known context usage >= 0.70 before request_compaction',
      'stage continue_delegate(mode="post-compaction") before request_compaction()',
      'capture accepted request_compaction tool result with compactionRequestId',
      'wait for compaction lifecycle start and completion receipts',
      'verify post-compaction delegate dispatch/return occurs after lifecycle completion',
      'verify successor session consumes an impossible-before-compaction sentinel',
      'stop temp Gateway and write cleanup receipt',
    ],
    passReceipts: requiredReceipts(),
    nonPassOutcomes: [...VALID_LIVE_OUTCOMES],
    guardrails: [
      'no production openclaw.json edits',
      'no production Gateway restart',
      'no lowering live fleet compaction thresholds',
      'no hosted frontier token burn to force pressure',
      'no PASS from threshold rejection',
      'no PASS unless post-compaction delegate fires after the compaction seam',
      'redact fixture token and any provider secrets from artifacts',
    ],
  };
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function buildArtifactState(args, paths, plan, runtime) {
  const logPaths = {
    stdout: path.join(paths.logsDir, 'gateway.stdout.log'),
    stderr: path.join(paths.logsDir, 'gateway.stderr.log'),
  };
  return {
    readiness: {
      schema: 'openclaw.project81.accepted-request-compaction.fixture-readiness.v1',
      status: args.mode === 'plan' ? 'plan-only' : 'pending-start',
      candidateSha: plan.candidateSha,
      docsSourceSha: process.env.OPENCLAW_DOCS_SOURCE_SHA || '5912c114e75a2f2d0ebde205cdcb9f9d8324da04',
      tempRoot: paths.root,
      port: runtime.port,
      mockProviderPort: runtime.mockProviderPort,
      gatewayPid: null,
      model: args.model,
      contextTokens: args.contextTokens,
      configPath: paths.configPath,
      stateDir: paths.stateDir,
      workspaceDir: paths.workspaceDir,
      logsDir: paths.logsDir,
      probe: {
        health: null,
        status: null,
        lastError: null,
      },
      logs: logPaths,
      notes: args.mode === 'plan'
        ? ['dry-run only; no Gateway started and no production config touched']
        : args.enableLiveOrchestration
          ? ['live mode requested; deterministic mock provider and temp Gateway startup/probe are attempted before the accepted compaction seam remains fail-closed']
          : ['live mode requested but review gate --enable-live-orchestration not supplied'],
    },
    cleanup: {
      schema: 'openclaw.project81.accepted-request-compaction.cleanup.v1',
      status: args.mode === 'plan' ? 'not-started' : 'pending',
      retained: args.retainTmp,
      tempRoot: paths.root,
      productionConfigTouched: false,
      mockProviderPort: runtime.mockProviderPort,
      gatewayPid: null,
      gatewayStopped: null,
      mockProviderStopped: null,
      stopSignal: null,
      stopForced: false,
      observedExit: null,
      tempRootDeleted: null,
      tempRootDeleteReason: null,
      logs: logPaths,
    },
    outcome: {
      schema: 'openclaw.project81.accepted-request-compaction.outcome.v1',
      outcome: plan.outcome,
      pass: false,
      artifactDir: paths.artifactDir,
      requiredForPass: requiredReceipts(),
      gatewayStarted: false,
      gatewayReady: false,
      remainingBlocker: args.mode === 'plan' ? 'plan-only' : 'temp-gateway-startup-not-attempted',
      notes: [],
    },
  };
}

function persistArtifacts(paths, plan, runtime, artifacts, args) {
  writeJson(path.join(paths.artifactDir, 'accepted-compaction-plan.json'), plan);
  writeJson(path.join(paths.artifactDir, 'fixture-readiness.json'), artifacts.readiness);
  writeJson(path.join(paths.artifactDir, 'temp-config.redacted.json'), renderConfig(args, paths, runtime, { redactSecrets: true }));
  writeJson(path.join(paths.artifactDir, 'cleanup.json'), artifacts.cleanup);
  writeJson(path.join(paths.artifactDir, 'outcome.json'), artifacts.outcome);
  try {
    chmodSync(paths.artifactDir, 0o700);
  } catch {
    // Best-effort on platforms/filesystems that do not support chmod.
  }
}

function resolveGatewayCommandTemplate() {
  const raw = process.env.OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON;
  if (!raw) return ['openclaw', 'gateway'];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON must be valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error('OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON must be a non-empty JSON array of strings');
  }
  return parsed;
}

function interpolateCommandParts(template, replacements) {
  return template.map((part) => part.replace(/\{\{([A-Z_]+)\}\}/gu, (_match, key) => replacements[key] ?? _match));
}

function resolveGatewayCommand(paths, runtime) {
  const template = resolveGatewayCommandTemplate();
  const parts = interpolateCommandParts(template, {
    PORT: String(runtime.port),
    CONFIG_PATH: paths.configPath,
    STATE_DIR: paths.stateDir,
    WORKSPACE_DIR: paths.workspaceDir,
    LOGS_DIR: paths.logsDir,
    TMP_ROOT: paths.root,
  });
  const withPort = parts.some((part) => part === '--port')
    ? parts
    : [...parts, '--port', String(runtime.port)];
  return {
    command: withPort[0],
    args: withPort.slice(1),
    display: withPort.join(' '),
  };
}

function allocateLoopbackPort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (error) => {
      reject(new Error(preferredPort === 0
        ? `failed to allocate a free loopback port: ${error.message}`
        : `requested temp Gateway port ${preferredPort} is unavailable: ${error.message}`));
    });
    server.listen({ host: '127.0.0.1', port: preferredPort }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to resolve allocated loopback port')));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function buildGatewayEnv(paths, runtime) {
  return {
    ...process.env,
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
    OPENCLAW_GATEWAY_PORT: String(runtime.port),
    OPENCLAW_GATEWAY_TOKEN: runtime.gatewayToken,
    OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    OPENCLAW_ACCEPTED_COMPACTION_TMPDIR: paths.root,
  };
}

function createExitTracker(child) {
  const tracker = {
    result: null,
    promise: null,
  };
  tracker.promise = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      tracker.result = { code, signal };
      resolve(tracker.result);
    });
  });
  return tracker;
}

function waitForExit(child, exitTracker) {
  if (exitTracker?.result) {
    return Promise.resolve(exitTracker.result);
  }
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    if (exitTracker?.promise) {
      exitTracker.promise.then(resolve);
      return;
    }
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function probeGateway(port, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const base = `http://127.0.0.1:${port}`;
  const [health, status] = await Promise.allSettled([
    fetch(`${base}/health`, { headers }),
    fetch(`${base}/status`, { headers }),
  ]);
  const healthStatus = health.status === 'fulfilled' ? health.value.status : null;
  const statusStatus = status.status === 'fulfilled' ? status.value.status : null;
  const ok = health.status === 'fulfilled' && health.value.ok && status.status === 'fulfilled' && status.value.ok;
  let lastError = null;
  if (health.status === 'rejected') lastError = health.reason?.message || String(health.reason);
  else if (status.status === 'rejected') lastError = status.reason?.message || String(status.reason);
  else if (!ok) lastError = `unexpected probe status health=${healthStatus} status=${statusStatus}`;
  return {
    ok,
    healthStatus,
    statusStatus,
    lastError,
  };
}

async function waitForGatewayReadiness({ child, exitTracker, port, token, timeoutMs, artifacts }) {
  const deadline = Date.now() + Math.min(timeoutMs, DEFAULT_GATEWAY_PROBE_TIMEOUT_MS);
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const exit = await waitForExit(child, exitTracker);
      throw new Error(`temp Gateway exited before readiness (code=${exit.code ?? 'null'}, signal=${exit.signal ?? 'null'})`);
    }
    const probe = await probeGateway(port, token);
    artifacts.readiness.probe = {
      health: probe.healthStatus,
      status: probe.statusStatus,
      lastError: probe.lastError,
    };
    if (probe.ok) {
      artifacts.readiness.status = 'gateway-ready';
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`temp Gateway did not become ready before timeout (${Math.min(timeoutMs, DEFAULT_GATEWAY_PROBE_TIMEOUT_MS)}ms)`);
}

async function startGateway({ args, paths, runtime, artifacts, runtimeState }) {
  const resolved = resolveGatewayCommand(paths, runtime);
  const stdout = createWriteStream(artifacts.readiness.logs.stdout, { flags: 'a', mode: 0o600 });
  const stderr = createWriteStream(artifacts.readiness.logs.stderr, { flags: 'a', mode: 0o600 });
  let child;
  try {
    child = spawn(resolved.command, resolved.args, {
      cwd: paths.root,
      env: buildGatewayEnv(paths, runtime),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    stdout.end();
    stderr.end();
    throw new Error(`failed to spawn temp Gateway command "${resolved.display}": ${error.message}`);
  }

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const exitTracker = createExitTracker(child);
  runtimeState.gateway = { child, exitTracker };

  artifacts.readiness.command = resolved.display;
  artifacts.readiness.gatewayPid = child.pid ?? null;
  artifacts.readiness.status = 'gateway-started';
  artifacts.cleanup.gatewayPid = child.pid ?? null;
  artifacts.outcome.gatewayStarted = true;

  try {
    await waitForGatewayReadiness({
      child,
      exitTracker,
      port: runtime.port,
      token: runtime.gatewayToken,
      timeoutMs: args.timeoutMs,
      artifacts,
    });
    artifacts.outcome.gatewayReady = true;
    return { kind: "temp-gateway-started", pid: child.pid, port: runtime.port };
  } catch (error) {
    artifacts.readiness.status = 'gateway-probe-failed';
    throw error;
  } finally {
    child.once('close', () => {
      stdout.end();
      stderr.end();
    });
  }
}

async function stopGateway(gateway, artifacts) {
  if (!gateway) {
    artifacts.cleanup.gatewayStopped = true;
    artifacts.cleanup.observedExit = { code: null, signal: null };
    return;
  }
  const { child, exitTracker } = gateway;

  if (child.exitCode !== null || child.signalCode !== null) {
    const exit = await waitForExit(child, exitTracker);
    artifacts.cleanup.gatewayStopped = true;
    artifacts.cleanup.observedExit = exit;
    return;
  }

  artifacts.cleanup.stopSignal = 'SIGTERM';
  child.kill('SIGTERM');
  const exit = await Promise.race([
    waitForExit(child, exitTracker),
    new Promise((resolve) => setTimeout(() => resolve(null), DEFAULT_GATEWAY_STOP_TIMEOUT_MS)),
  ]);
  if (exit) {
    artifacts.cleanup.gatewayStopped = true;
    artifacts.cleanup.observedExit = exit;
    return;
  }

  artifacts.cleanup.stopForced = true;
  artifacts.cleanup.stopSignal = 'SIGKILL';
  child.kill('SIGKILL');
  const forcedExit = await waitForExit(child, exitTracker);
  artifacts.cleanup.gatewayStopped = true;
  artifacts.cleanup.observedExit = forcedExit;
}

function cleanupTempRoot(args, paths, artifacts) {
  if (args.mode === 'plan') {
    artifacts.cleanup.tempRootDeleted = false;
    artifacts.cleanup.tempRootDeleteReason = 'plan-mode-no-cleanup';
    return;
  }
  if (args.retainTmp) {
    artifacts.cleanup.tempRootDeleted = false;
    artifacts.cleanup.tempRootDeleteReason = 'retain-tmp-requested';
    return;
  }
  if (isPathInside(paths.artifactDir, paths.root)) {
    artifacts.cleanup.tempRootDeleted = false;
    artifacts.cleanup.tempRootDeleteReason = 'artifact-dir-inside-temp-root';
    return;
  }
  rmSync(paths.root, { recursive: true, force: true });
  artifacts.cleanup.tempRootDeleted = true;
  artifacts.cleanup.tempRootDeleteReason = 'deleted-after-run';
}

function writeActualConfig(args, paths, runtime) {
  writeJson(paths.configPath, renderConfig(args, paths, runtime, { redactSecrets: false }));
}

async function runPlanOnly(args, paths, runtime) {
  const plan = buildPlan(args, paths, runtime);
  const artifacts = buildArtifactState(args, paths, plan, runtime);
  persistArtifacts(paths, plan, runtime, artifacts, args);
  return {
    exitCode: 0,
    plan,
    artifacts,
  };
}

async function runLiveFailClosed(args, paths, runtime) {
  const plan = buildPlan(args, paths, runtime);
  const artifacts = buildArtifactState(args, paths, plan, runtime);
  const runtimeState = { gateway: null };

  let phase = 'preflight';
  let outcome = 'BLOCKED-context-budget-not-forced';

  try {
    const orchestrationInput = (() => {
      const hooks = globalThis.__openclawAcceptedCompactionTestHooks;
      if (hooks && typeof hooks.orchestratorFactory === 'function') {
        return hooks.orchestratorFactory({ args, paths, plan, runtime, artifacts, runtimeState });
      }
      return {
        args: {
          ...args,
          openclawDir: args.openclawDir || DEFAULT_OPENCLAW_SOURCE_DIR,
        },
        paths,
        liveSteps: {
          ...makeUnimplementedLiveSteps(),
          startMockProvider: async (opts) => {
             const receipt = await startFixtureMockProvider(opts);
             runtime.mockProviderPort = receipt?.port || null;
             artifacts.readiness.mockProviderPort = runtime.mockProviderPort;
             return receipt;
          },
          startTempGateway: async (opts) => startGateway({ ...opts, runtime, artifacts, runtimeState }),
        },
      };
    })();
    
    // We write config AFTER preflight resolves because it depends on the allocated mock port
    // but the actual orchestration writes it natively. We'll pre-write it here just in case,
    // and let the state machine overwrite it.
    writeActualConfig(args, paths, runtime);
    persistArtifacts(paths, plan, runtime, artifacts, args);
    
    const orchestrationResult = await runOrchestration(orchestrationInput);
    
    // Merge outcome properties directly to avoid losing error traces
    artifacts.outcome.outcome = orchestrationResult.outcome;
    artifacts.outcome.pass = orchestrationResult.pass;
    phase = orchestrationResult.phase;
    outcome = orchestrationResult.outcome;
    
    if (orchestrationResult.artifacts && orchestrationResult.artifacts.outcome) {
       artifacts.outcome = orchestrationResult.artifacts.outcome;
    }
    if (!artifacts.outcome.remainingBlocker) {
       artifacts.outcome.remainingBlocker = 'gateway-is-ready-but-request-compaction-session-orchestration-is-not-implemented';
    }
    // Pass on the cleanup state so gateway failure properly emits
    if (orchestrationResult.artifacts?.cleanup) {
       Object.assign(artifacts.cleanup, orchestrationResult.artifacts.cleanup);
    }
  } catch (error) {
    artifacts.outcome.outcome = 'BLOCKED-temp-gateway-start';
    artifacts.outcome.remainingBlocker = error.step ? String(error.code) : error.message;
    outcome = 'BLOCKED-temp-gateway-start';
    artifacts.outcome.notes.push(error.message);
    artifacts.readiness.notes.push(`orchestration failed: ${error.message}`);
  } finally {
    try {
      await stopGateway(runtimeState.gateway, artifacts);
      cleanupTempRoot(args, paths, artifacts);
      artifacts.cleanup.status = artifacts.cleanup.gatewayStopped ? 'completed' : 'failed';
    } catch (error) {
      artifacts.cleanup.status = 'failed';
      artifacts.cleanup.gatewayStopped = false;
      artifacts.cleanup.observedExit = {
        code: null,
        signal: null,
        error: error.message,
      };
      artifacts.outcome.outcome = 'FAIL-cleanup';
      artifacts.outcome.remainingBlocker = error.step ? String(error.code) : error.message;
      artifacts.outcome.notes.push(`cleanup failed: ${error.message}`);
      outcome = 'FAIL-cleanup';
    }
    if (!VALID_LIVE_OUTCOMES.has(artifacts.outcome.outcome)) {
      artifacts.outcome.outcome = 'BLOCKED-temp-gateway-start';
      outcome = 'BLOCKED-temp-gateway-start';
    }
    persistArtifacts(paths, plan, runtime, artifacts, args);
  }

  return {
    exitCode: NON_PASS_EXIT_CODE,
    plan,
    artifacts,
    phase,
    outcome
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  validateArgs(args);
  const paths = await preparePaths(args);
  const runtime = {
    port: await allocateLoopbackPort(args.port),
    gatewayToken: generateFixtureToken(),
  };
  let execution;
  if (args.mode === 'plan') {
    execution = await runPlanOnly(args, paths, runtime);
  } else if (!args.enableLiveOrchestration) {
    const plan = buildPlan(args, paths, runtime);
    const artifacts = buildArtifactState(args, paths, plan, runtime);
    artifacts.cleanup.status = 'review-gate-blocked-before-start';
    artifacts.outcome.outcome = NON_PASS_OUTCOMES.REVIEW_GATE;
    artifacts.outcome.reason = '--run requires --enable-live-orchestration (or OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true) after review';
    persistArtifacts(paths, plan, runtime, artifacts, args);
    execution = {
      exitCode: 3,
      plan,
      artifacts,
      outcome: NON_PASS_OUTCOMES.REVIEW_GATE,
      phase: 'preflight'
    };
  } else {
    execution = await runLiveFailClosed(args, paths, runtime);
  }

  const result = {
    ok: execution.exitCode === 0,
    mode: execution.plan.mode,
    outcome: execution.outcome || execution.artifacts?.outcome?.outcome,
    phase: execution.phase,
    pass: execution.artifacts?.outcome?.pass || false,
    artifactDir: paths.artifactDir,
    files: [
      'accepted-compaction-plan.json',
      'fixture-readiness.json',
      'temp-config.redacted.json',
      'cleanup.json',
      'outcome.json',
    ],
  };

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`accepted request_compaction fixture run: ${result.outcome}`);
    if (result.phase) console.log(`phase reached: ${result.phase}`);
    console.log(`artifact dir: ${paths.artifactDir}`);
    if (args.mode !== 'plan') {
       if (!args.enableLiveOrchestration) {
          console.error('review gate: pass --enable-live-orchestration after review to run preflight');
       } else {
          console.error('accepted request_compaction seam remains fail-closed after isolated temp-Gateway startup');
       }
    }
  }
  return execution.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((error) => {
    const json = process.argv.includes('--json');
    if (json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    else {
      console.error(usage());
      console.error(`ERROR: ${error.message}`);
    }
    process.exit(2);
  });
}
