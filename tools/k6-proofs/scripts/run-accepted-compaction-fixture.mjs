#!/usr/bin/env node
/**
 * run-accepted-compaction-fixture.mjs — fail-closed planner/scaffold for the
 * Project 81 accepted request_compaction fixture.
 *
 * This first implementation intentionally exposes only a redacted --plan /
 * --dry-run surface. A future live mode must start an isolated temp Gateway and
 * collect the accepted-compaction receipts described in the emitted plan. Live
 * execution fails closed until that orchestration is implemented and reviewed.
 */
import { chmodSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_CONTEXT_TOKENS = 12_000;
const DEFAULT_KEEP_RECENT_TOKENS = 1_000;
const DEFAULT_RESERVE_TOKENS = 2_000;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_PORT = 0;
const DEFAULT_MODEL = 'fixture/openai-compatible-local';
const PRODUCTION_PATH_MARKERS = [
  path.join(homedir(), '.openclaw'),
  path.join(homedir(), 'flesh_beast_tmp', 'openclaw'),
];

function usage() {
  return `Usage: node tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs --plan [options]

Options:
  --plan, --dry-run                Emit a redacted plan artifact and exit 0.
  --run                           Fail closed until reviewed live orchestration lands.
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
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === '--artifact-dir') args.artifactDir = next();
    else if (arg === '--tmpdir') args.tmpdir = next();
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

function redactedConfig(args, paths) {
  const [provider, ...modelParts] = args.model.split('/');
  const modelName = modelParts.join('/') || 'default';
  return {
    gateway: {
      host: '127.0.0.1',
      port: args.port,
      token: '<REDACTED-fixture-token>',
    },
    agents: {
      defaults: {
        workspace: paths.workspaceDir,
        continuation: { enabled: true },
        compaction: {
          enabled: true,
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
        [provider || 'fixture']: {
          models: {
            [modelName]: {
              contextTokens: args.contextTokens,
            },
          },
        },
      },
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

function buildPlan(args, paths) {
  const gatewayWs = `ws://127.0.0.1:${args.port || '<free-port>'}`;
  return {
    schema: 'openclaw.project81.accepted-request-compaction.plan.v1',
    mode: args.mode === 'plan' ? 'PLAN_ONLY' : 'LIVE_REQUESTED_FAIL_CLOSED',
    outcome: args.mode === 'plan' ? 'PLAN_ONLY-redacted-dry-run' : 'BLOCKED-live-orchestration-not-implemented',
    candidateSha: args.candidateSha || '<unset-plan-only>',
    model: args.model,
    contextTokens: args.contextTokens,
    keepRecentTokens: args.keepRecentTokens,
    reserveTokens: args.reserveTokens,
    timeoutMs: args.timeoutMs,
    port: args.port,
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
      'HONEST-LIMIT-local-model-unavailable',
      'BLOCKED-temp-gateway-start',
      'BLOCKED-context-budget-not-forced',
      'FAIL-request-compaction-rejected',
      'FAIL-request-compaction-already-pending',
      'FAIL-compaction-timeout',
      'FAIL-lifeboat-missing',
      'FAIL-sentinel-missing',
      'FAIL-cleanup',
    ],
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

function writeArtifacts(args, paths, plan) {
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
      : ['live mode requested but not implemented in this reviewed scaffold'],
  };
  const cleanup = {
    schema: 'openclaw.project81.accepted-request-compaction.cleanup.v1',
    status: args.mode === 'plan' ? 'not-started' : 'blocked-before-start',
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

  writeJson(path.join(paths.artifactDir, 'accepted-compaction-plan.json'), plan);
  writeJson(path.join(paths.artifactDir, 'fixture-readiness.json'), readiness);
  writeJson(path.join(paths.artifactDir, 'temp-config.redacted.json'), redactedConfig(args, paths));
  writeJson(path.join(paths.artifactDir, 'cleanup.json'), cleanup);
  writeJson(path.join(paths.artifactDir, 'outcome.json'), outcome);
  try {
    chmodSync(paths.artifactDir, 0o700);
  } catch {
    // Best-effort on platforms/filesystems that do not support chmod.
  }
  return { readiness, cleanup, outcome };
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
  const artifacts = writeArtifacts(args, paths, plan);
  const result = {
    ok: args.mode === 'plan',
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
    if (args.mode !== 'plan') console.error('live orchestration is fail-closed in this scaffold');
  }
  return args.mode === 'plan' ? 0 : 3;
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
