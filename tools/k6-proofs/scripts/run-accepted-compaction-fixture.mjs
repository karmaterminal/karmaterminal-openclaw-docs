#!/usr/bin/env node
/**
 * run-accepted-compaction-fixture.mjs — planner + preflight runner for the
 * Project 81 accepted request_compaction fixture (issue #331).
 *
 * Modes:
 *   --plan / --dry-run   Emit a redacted plan artifact (no Gateway started).
 *   --run                Run the reviewed live orchestration state machine.
 *                        Requires FIXTURE opt-in, candidate SHA, AND the
 *                        review gate --enable-live-orchestration flag.
 *                        Without the review gate, --run classifies as
 *                        HONEST-LIMIT-live-orchestration-review-gate and
 *                        does NOT start any subprocess.
 *
 * Live orchestration in this increment implements preflight only (openclaw
 * source dir validation, free port allocation, redacted temp config write)
 * and then classifies the next phase as
 * HONEST-LIMIT-live-orchestration-preflight-only. Downstream phases (mock
 * provider bootstrap, Gateway start, request_compaction RPC, lifecycle wait,
 * successor sentinel) live behind dependency-injected stubs so the
 * follow-up review PR can wire them without a second refactor.
 */
import { chmodSync, createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
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
const DEFAULT_GATEWAY_PROBE_TIMEOUT_MS = 30_000;
const DEFAULT_GATEWAY_STOP_TIMEOUT_MS = 5_000;
const FIXTURE_GATEWAY_TOKEN = '<REDACTED-fixture-token>';


function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs --plan [options]

Options:
  --plan, --dry-run                Emit a redacted plan artifact and exit 0.
  --run                           Run reviewed live orchestration (preflight only in this increment).
  --enable-live-orchestration     Review gate for --run; without this flag --run classifies as HONEST-LIMIT-live-orchestration-review-gate.
  --artifact-dir <path>            Directory for emitted artifacts.
  --tmpdir <path>                  Temp root for fixture config/state/workspace/logs.
  --openclaw-dir <path>            OpenClaw source checkout used to spawn the temp Gateway.
  --candidate-sha <sha>            Candidate SHA under test (40-char hex when supplied).
  --model <provider/model>         Fixture model id (default: ${DEFAULT_MODEL}).
  --context-tokens <n>             Effective context cap (default: ${DEFAULT_CONTEXT_TOKENS}).
  --keep-recent-tokens <n>         Compaction keepRecentTokens (default: ${DEFAULT_KEEP_RECENT_TOKENS}).
  --reserve-tokens <n>             Compaction reserveTokens/floor (default: ${DEFAULT_RESERVE_TOKENS}).
  --timeout-ms <n>                 Lifecycle timeout (default: ${DEFAULT_TIMEOUT_MS}).
  --port <n>                       Temp Gateway port, 0 = allocate free port during preflight.
  OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON  Optional JSON argv template for temp Gateway command. Supports {{ENTRYPOINT}}, {{PORT}}, {{CONFIG_PATH}}, {{STATE_DIR}}, {{WORKSPACE_DIR}}, {{LOGS_DIR}}, {{TMP_ROOT}}.
  --retain-tmp                    Mark temp root retained in cleanup plan.
  --json                          Print machine-readable result.
  --help                          Show this help.

Environment defaults:
  OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true       Required for --run only.
  OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true   Review gate for --run.
  OPENCLAW_ACCEPTED_COMPACTION_TMPDIR=<tmp>       Fixture temp root.
  OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR=<dir> OpenClaw source checkout.
  OPENCLAW_CANDIDATE_SHA=<sha>
  OPENCLAW_ACCEPTED_COMPACTION_MODEL=<provider/model>
  OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS=<n>
  OPENCLAW_ACCEPTED_COMPACTION_PORT=<n>
  OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP=true`;
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
    openclawDir: env.OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR || '',
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

function normalizeSafePath(label, value) {
  return sharedNormalizeSafePath(label, value, PRODUCTION_PATH_MARKERS);
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

function redactedConfig(args, paths) {
  return buildRedactedConfig({
    workspaceDir: paths.workspaceDir,
    model: args.model,
    contextTokens: args.contextTokens,
    keepRecentTokens: args.keepRecentTokens,
    reserveTokens: args.reserveTokens,
    port: args.port,
  });
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

function planOutcome(args) {
  if (args.mode === 'plan') return 'PLAN_ONLY-redacted-dry-run';
  if (!args.enableLiveOrchestration) return NON_PASS_OUTCOMES.REVIEW_GATE;
  return 'LIVE_PREFLIGHT_ONLY';
}

function buildPlan(args, paths) {
  const gatewayWs = `ws://127.0.0.1:${args.port || '<free-port>'}`;
  return {
    schema: 'openclaw.project81.accepted-request-compaction.plan.v1',
    mode: args.mode === 'plan'
      ? 'PLAN_ONLY'
      : args.enableLiveOrchestration ? 'LIVE_PREFLIGHT_ONLY' : 'LIVE_REVIEW_GATE',
    outcome: planOutcome(args),
    candidateSha: args.candidateSha || '<unset-plan-only>',
    model: args.model,
    contextTokens: args.contextTokens,
    keepRecentTokens: args.keepRecentTokens,
    reserveTokens: args.reserveTokens,
    timeoutMs: args.timeoutMs,
    port: args.port,
    gatewayWs,
    openclawDir: args.openclawDir || DEFAULT_OPENCLAW_SOURCE_DIR,
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
      OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE: args.enableLiveOrchestration ? 'true' : 'false',
      OPENCLAW_ACCEPTED_COMPACTION_TMPDIR: paths.root,
      OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR: args.openclawDir || '<unset>',
      OPENCLAW_CONFIG_PATH: paths.configPath,
      OPENCLAW_STATE_DIR: paths.stateDir,
      OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
      OPENCLAW_ACCEPTED_COMPACTION_PORT: String(args.port || '<free-port>'),
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
    nonPassOutcomes: [
      NON_PASS_OUTCOMES.REVIEW_GATE,
      NON_PASS_OUTCOMES.OPENCLAW_DIR_MISSING,
      NON_PASS_OUTCOMES.OPENCLAW_DIR_PRODUCTION,
      NON_PASS_OUTCOMES.OPENCLAW_ENTRYPOINT_MISSING,
      NON_PASS_OUTCOMES.FREE_PORT_ALLOCATION,
      NON_PASS_OUTCOMES.TEMP_GATEWAY_START,
      NON_PASS_OUTCOMES.MOCK_PROVIDER_START,
      NON_PASS_OUTCOMES.CONTEXT_BUDGET,
      NON_PASS_OUTCOMES.REQUEST_COMPACTION_REJECTED,
      NON_PASS_OUTCOMES.REQUEST_COMPACTION_PENDING,
      NON_PASS_OUTCOMES.COMPACTION_TIMEOUT,
      NON_PASS_OUTCOMES.LIFEBOAT_MISSING,
      NON_PASS_OUTCOMES.SENTINEL_MISSING,
      NON_PASS_OUTCOMES.CLEANUP,
      NON_PASS_OUTCOMES.LIVE_SEND_NOT_IMPLEMENTED,
    ],
    guardrails: [
      'no production openclaw.json edits',
      'no production Gateway restart',
      'no lowering live fleet compaction thresholds',
      'no hosted frontier token burn to force pressure',
      'no PASS from threshold rejection',
      'no PASS unless post-compaction delegate fires after the compaction seam',
      'redact fixture token and any provider secrets from artifacts',
      '--run requires --enable-live-orchestration (review gate)',
    ],
  };
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function writeBaseArtifacts(args, paths, plan) {
  const readiness = {
    schema: 'openclaw.project81.accepted-request-compaction.fixture-readiness.v1',
    status: plan.mode,
    candidateSha: plan.candidateSha,
    tempRoot: paths.root,
    port: args.port,
    gatewayPid: null,
    model: args.model,
    contextTokens: args.contextTokens,
    notes: args.mode === 'plan'
      ? ['dry-run only; no Gateway started and no production config touched']
      : args.enableLiveOrchestration
        ? ['live orchestration state machine invoked; deterministic mock provider is wired; temp Gateway remains stubbed']
        : ['live mode requested but review gate --enable-live-orchestration not supplied'],
  };
  writeJson(path.join(paths.artifactDir, 'accepted-compaction-plan.json'), plan);
  writeJson(path.join(paths.artifactDir, 'fixture-readiness.json'), readiness);
  writeJson(path.join(paths.artifactDir, 'temp-config.redacted.json'), redactedConfig(args, paths));
  try {
    chmodSync(paths.artifactDir, 0o700);
  } catch {
    // Best-effort on platforms/filesystems that do not support chmod.
  }
  return readiness;
}

function writePlanOnlyArtifacts(args, paths, plan) {
  writeBaseArtifacts(args, paths, plan);
  const cleanup = {
    schema: 'openclaw.project81.accepted-request-compaction.cleanup.v1',
    status: 'not-started',
    retained: args.retainTmp,
    tempRoot: paths.root,
    productionConfigTouched: false,
    gatewayStopped: null,
  };
  const outcome = {
    schema: 'openclaw.project81.accepted-request-compaction.outcome.v1',
    outcome: plan.outcome,
    pass: false,
    artifactDir: paths.artifactDir,
    requiredForPass: requiredReceipts(),
  };
  writeJson(path.join(paths.artifactDir, 'cleanup.json'), cleanup);
  writeJson(path.join(paths.artifactDir, 'outcome.json'), outcome);
}

function writeReviewGateArtifacts(args, paths, plan) {
  writeBaseArtifacts(args, paths, plan);
  const cleanup = {
    schema: 'openclaw.project81.accepted-request-compaction.cleanup.v1',
    status: 'review-gate-blocked-before-start',
    retained: args.retainTmp,
    tempRoot: paths.root,
    productionConfigTouched: false,
    gatewayStopped: null,
  };
  const outcome = {
    schema: 'openclaw.project81.accepted-request-compaction.outcome.v1',
    outcome: NON_PASS_OUTCOMES.REVIEW_GATE,
    pass: false,
    reason: '--run requires --enable-live-orchestration (or OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true) after review',
    artifactDir: paths.artifactDir,
    requiredForPass: requiredReceipts(),
  };
  writeJson(path.join(paths.artifactDir, 'cleanup.json'), cleanup);
  writeJson(path.join(paths.artifactDir, 'outcome.json'), outcome);
}

function resolveGatewayCommandTemplate() {
  const raw = process.env.OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON;
  if (!raw) return [process.execPath, '{{ENTRYPOINT}}', 'gateway'];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON must be valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((part) => typeof part !== 'string' || part.length === 0)) {
    throw new Error('OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON must be a non-empty JSON array of strings');
  }
  return parsed;
}

function interpolateCommandParts(template, replacements) {
  return template.map((part) => part.replace(/\{\{([A-Z_]+)\}\}/gu, (_match, key) => replacements[key] ?? _match));
}

function resolveGatewayCommand({ openclaw, paths, port }) {
  const parts = interpolateCommandParts(resolveGatewayCommandTemplate(), {
    ENTRYPOINT: openclaw.entrypoint,
    PORT: String(port),
    CONFIG_PATH: paths.configPath,
    STATE_DIR: paths.stateDir,
    WORKSPACE_DIR: paths.workspaceDir,
    LOGS_DIR: paths.logsDir,
    TMP_ROOT: paths.root,
  });
  const withPort = parts.some((part) => part === '--port') ? parts : [...parts, '--port', String(port)];
  return { command: withPort[0], args: withPort.slice(1), display: withPort.join(' ') };
}

function createExitTracker(child) {
  const tracker = { result: null, promise: null };
  tracker.promise = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      tracker.result = { code, signal };
      resolve(tracker.result);
    });
  });
  return tracker;
}

async function waitForExit(child, exitTracker) {
  if (exitTracker?.result) return exitTracker.result;
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return exitTracker?.promise ?? new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
}

async function probeGateway(port) {
  const headers = { authorization: `Bearer ${FIXTURE_GATEWAY_TOKEN}` };
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
  return { ok, healthStatus, statusStatus, lastError };
}

async function waitForGatewayReadiness({ child, exitTracker, port, timeoutMs }) {
  const deadline = Date.now() + Math.min(timeoutMs, DEFAULT_GATEWAY_PROBE_TIMEOUT_MS);
  let lastProbe = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const exit = await waitForExit(child, exitTracker);
      throw new Error(`temp Gateway exited before readiness (code=${exit.code ?? 'null'}, signal=${exit.signal ?? 'null'})`);
    }
    lastProbe = await probeGateway(port);
    if (lastProbe.ok) return lastProbe;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`temp Gateway did not become ready before timeout (${Math.min(timeoutMs, DEFAULT_GATEWAY_PROBE_TIMEOUT_MS)}ms; last=${lastProbe?.lastError ?? 'none'})`);
}

function gatewayEnv({ paths, port }) {
  return {
    ...process.env,
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
    OPENCLAW_GATEWAY_PORT: String(port),
    OPENCLAW_GATEWAY_TOKEN: FIXTURE_GATEWAY_TOKEN,
    OPENCLAW_ACCEPTED_COMPACTION_FIXTURE: 'true',
    OPENCLAW_ACCEPTED_COMPACTION_TMPDIR: paths.root,
  };
}

async function startTempGateway({ args, paths, port, openclaw }) {
  mkdirSync(paths.logsDir, { recursive: true, mode: 0o700 });
  const command = resolveGatewayCommand({ openclaw, paths, port });
  const stdoutPath = path.join(paths.logsDir, 'temp-gateway.stdout.log');
  const stderrPath = path.join(paths.logsDir, 'temp-gateway.stderr.log');
  const stdout = createWriteStream(stdoutPath, { flags: 'a', mode: 0o600 });
  const stderr = createWriteStream(stderrPath, { flags: 'a', mode: 0o600 });
  let child;
  try {
    child = spawn(command.command, command.args, {
      cwd: openclaw.dir,
      env: gatewayEnv({ paths, port }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    stdout.end();
    stderr.end();
    throw new Error(`failed to spawn temp Gateway command "${command.display}": ${error.message}`);
  }
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const exitTracker = createExitTracker(child);
  try {
    const probe = await waitForGatewayReadiness({ child, exitTracker, port, timeoutMs: args.timeoutMs });
    return {
      kind: 'temp-gateway-started',
      pid: child.pid ?? null,
      port,
      child,
      exitTracker,
      logs: { stdout: stdoutPath, stderr: stderrPath },
      artifact: {
        name: 'temp-gateway-start.json',
        body: {
          schema: 'openclaw.project81.accepted-request-compaction.temp-gateway-start.v1',
          pid: child.pid ?? null,
          port,
          command: command.display,
          probe,
          logs: { stdout: stdoutPath, stderr: stderrPath },
        },
      },
    };
  } catch (error) {
    child.kill('SIGTERM');
    stdout.end();
    stderr.end();
    throw error;
  }
}

async function stopTempGateway({ gateway }) {
  if (!gateway?.child) {
    return { stopped: false, reason: 'no temp gateway process receipt' };
  }
  const { child, exitTracker } = gateway;
  if (child.exitCode !== null || child.signalCode !== null) {
    const exit = await waitForExit(child, exitTracker);
    return { stopped: true, alreadyExited: true, observedExit: exit };
  }
  child.kill('SIGTERM');
  const exit = await Promise.race([
    waitForExit(child, exitTracker),
    new Promise((resolve) => setTimeout(() => resolve(null), DEFAULT_GATEWAY_STOP_TIMEOUT_MS)),
  ]);
  if (exit) return { stopped: true, stopSignal: 'SIGTERM', observedExit: exit };
  child.kill('SIGKILL');
  return { stopped: true, stopSignal: 'SIGKILL', stopForced: true, observedExit: await waitForExit(child, exitTracker) };
}


/**
 * Test-only hook: an alternative orchestrator factory may be injected via
 * globalThis.__openclawAcceptedCompactionTestHooks.orchestratorFactory. The
 * factory receives ({ args, paths, plan }) and must return an object shaped
 * like the arguments to runOrchestration, or the promise thereof.
 */
function resolveOrchestratorInvocation({ args, paths, plan }) {
  const hooks = globalThis.__openclawAcceptedCompactionTestHooks;
  if (hooks && typeof hooks.orchestratorFactory === 'function') {
    return hooks.orchestratorFactory({ args, paths, plan });
  }
  return {
    args: {
      ...args,
      openclawDir: args.openclawDir || DEFAULT_OPENCLAW_SOURCE_DIR,
    },
    paths,
    liveSteps: {
      ...makeUnimplementedLiveSteps(),
      startMockProvider: startFixtureMockProvider,
      startTempGateway,
      stopTempGateway,
    },
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
  const plan = buildPlan(args, paths);

  if (args.mode === 'plan') {
    writePlanOnlyArtifacts(args, paths, plan);
    const result = {
      ok: true,
      mode: plan.mode,
      outcome: plan.outcome,
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
      console.log(`accepted request_compaction fixture ${args.mode}: ${plan.outcome}`);
      console.log(`artifact dir: ${paths.artifactDir}`);
    }
    return 0;
  }

  // args.mode === 'run'
  if (!args.enableLiveOrchestration) {
    writeReviewGateArtifacts(args, paths, plan);
    const result = {
      ok: false,
      mode: plan.mode,
      outcome: NON_PASS_OUTCOMES.REVIEW_GATE,
      pass: false,
      artifactDir: paths.artifactDir,
      reason: '--run requires --enable-live-orchestration (or OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true) after review',
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
      console.log(`accepted request_compaction fixture run: ${NON_PASS_OUTCOMES.REVIEW_GATE}`);
      console.log(`artifact dir: ${paths.artifactDir}`);
      console.error('review gate: pass --enable-live-orchestration after review to run preflight');
    }
    return 3;
  }

  // Live orchestration (preflight only in this increment).
  writeBaseArtifacts(args, paths, plan);
  const orchestrationInput = await resolveOrchestratorInvocation({ args, paths, plan });
  const orchestrationResult = await runOrchestration(orchestrationInput);

  const result = {
    ok: false,
    mode: plan.mode,
    outcome: orchestrationResult.outcome,
    phase: orchestrationResult.phase,
    pass: orchestrationResult.pass,
    artifactDir: paths.artifactDir,
    artifacts: orchestrationResult.artifacts,
  };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`accepted request_compaction fixture run: ${orchestrationResult.outcome}`);
    console.log(`phase reached: ${orchestrationResult.phase}`);
    console.log(`artifact dir: ${paths.artifactDir}`);
  }
  return 3;
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
