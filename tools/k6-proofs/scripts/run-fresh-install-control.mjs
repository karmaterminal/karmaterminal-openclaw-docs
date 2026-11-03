#!/usr/bin/env node
/**
 * run-fresh-install-control.mjs — the disposable fresh-install control for R-CD-FRESH-INSTALL
 * (🌊's ruling, room msg 1567073096706297887: "make fresh install its own j12 corpus row: empty
 * state dir, disposable process, no model turn").
 *
 * One run, one disposable gateway, no model sign-in and no model turn:
 *
 *   1. refuse, before anything starts: a non-empty state directory, one under (or over) a live
 *      ~/.openclaw, a port already in use (or a live gateway's), a stage whose
 *      dist/build-info.json commit is not the candidate, and any model credential in the
 *      environment (each refusal is named in refusal.json);
 *   2. create the fresh state directory and prove it empty, write the minimal config (0600) and an
 *      empty gateway HOME in the private directory;
 *   3. start `node <stage>/dist/index.js gateway --port <port>` with a cleared environment and wait
 *      until it owns the listener, /readyz and /startupz pass and hello-ok answers;
 *   4. sessions.create (no message, no title source: no model turn), then session.visibility.set to
 *      `suggest`, which advances (creates) the session_recipient_authority epoch; read the agent and
 *      state databases read-only from outside the gateway: schema version, schema_meta, the
 *      authority table's columns, the epoch rows, the migration journal, the auth profiles;
 *   5. run `openclaw config validate --json` on the fresh config;
 *   6. stop the gateway with SIGTERM and require a clean exit; then remove the disposable state, the
 *      gateway HOME and the config, and confirm nothing of the run remains;
 *   7. grade the record, sign it with a launcher-held observer key and write the public receipt.
 *      Only counts and SHA-256s leave the databases; raw process output stays in
 *      <artifact-dir>.private.
 *
 * It never reads OPENCLAW_GATEWAY_TOKEN/WS from the environment, never touches a live gateway or a
 * live state directory, and never signals a process it did not start. The product path and its j12
 * anchors are in scenarios/r-cd-fresh-install.js.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  environKeysOf,
  environValueOf,
  gatewayRpc,
  httpProbe,
  listenInodes,
  parseJson,
  parseTrailingJson,
  procEnvironHas,
  processesWithMarker,
  procStat,
  socketInodesOf,
} from '../lib/disposable-gateway-probes.mjs';
import {
  FIC_AGENT_SCHEMA_VERSION,
  FIC_AUTHORITY_TABLE,
  FIC_REFUSAL_SCHEMA,
  FIC_ROW,
  FIC_SCHEMA,
  authorityProjection,
  classifyMigrationRuns,
  configKeyPaths,
  evaluateFreshInstallTarget,
  gradeFreshInstallControl,
  isModelCredentialKey,
  isSha40,
  liveStateDirs,
  minimalFreshConfig,
  observerKeyFingerprint,
  planFreshInstall,
  projectionSha256,
  sealObserverReceipt,
  sha256,
  verifyObserverReceipt,
} from '../lib/fresh-install-control.mjs';
import { publicSafetyLeaks, redactText, textCapture } from '../lib/return-covenant-restart-control.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLIENT = Object.freeze({ id: 'cli', mode: 'cli', version: 'k6-proof-fic-v1', platform: 'node' });
// --gateway-env is an allowlist: a denylist cannot fail closed. Allowed: the two settings a proof
// gateway may need, and the scripted test gateway's FIC_SCRIPT_* switches, which the product ignores.
const GATEWAY_ENV_ALLOWED = /^(?:NODE_OPTIONS|OPENCLAW_CODEX_APP_SERVER_BIN|FIC_SCRIPT_[A-Z0-9_]+)$/u;
const NODE_OPTIONS_ALLOWED = /^(?:--max-old-space-size=\d+|--inspect=127\.0\.0\.1:\d{4,5})$/u;
const MARKER_KEY = 'OPENCLAW_PROOF_FIC_RUN';
// The product's own line when a stop misses its shutdown deadline (src/cli/gateway-cli/run-loop.ts:626-628).
const SHUTDOWN_DEADLINE_LINE = /shutdown deadline reached before stop; pending close steps:/u;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The live gateway of the current run, so an interrupted CLI can still stop what it started.
const liveRuns = new Set();

/* ------------------------------------------------------------------------------------ */
/* Read-only storage observation                                                         */
/* ------------------------------------------------------------------------------------ */

function withReadOnlyDatabase(file, read) {
  if (!existsSync(file)) return { present: false, error: 'no-database' };
  let database;
  try {
    database = new DatabaseSync(file, { readOnly: true, timeout: 2000 });
    return { present: true, ...read(database) };
  } catch (error) {
    return { present: false, error: String(error?.code ?? error?.message ?? 'error').slice(0, 80) };
  } finally {
    try {
      database?.close();
    } catch {
      // A failed open has nothing to close.
    }
  }
}

function tableExists(database, name) {
  return Boolean(database.prepare("SELECT 1 AS found FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name));
}

function countRows(database, table) {
  return Number(database.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n);
}

/** Authority rows in the fresh agent database: total, and the one bound to the created key. */
function readAuthorityRows(file, keys = []) {
  if (!existsSync(file)) return { database: 'absent', rows: 0, keyRow: null };
  const read = withReadOnlyDatabase(file, (database) => {
    if (!tableExists(database, FIC_AUTHORITY_TABLE)) return { table: false, rows: 0, keyRow: null };
    const statement = database.prepare(`SELECT session_key, epoch FROM ${FIC_AUTHORITY_TABLE} WHERE session_key = ?`);
    let keyRow = null;
    for (const key of keys) {
      const row = statement.get(key);
      if (row && typeof row.epoch === 'string') {
        keyRow = { key: row.session_key, epoch: row.epoch };
        break;
      }
    }
    return { table: true, rows: countRows(database, FIC_AUTHORITY_TABLE), keyRow };
  });
  return read.present ? { database: 'present', ...read } : { database: 'unreadable', error: read.error, rows: null, keyRow: null };
}

/** What the fresh agent database is: counts, versions and the authority table's shape only. */
function readAgentStorage(file, agentId) {
  return withReadOnlyDatabase(file, (database) => {
    const userVersion = Number(database.prepare('PRAGMA user_version').get().user_version);
    const meta = tableExists(database, 'schema_meta')
      ? database.prepare("SELECT role, schema_version, agent_id, created_at, updated_at FROM schema_meta WHERE meta_key = 'primary'").get()
      : null;
    let authorityTable;
    if (tableExists(database, FIC_AUTHORITY_TABLE)) {
      const columns = database.prepare(`PRAGMA table_xinfo(${FIC_AUTHORITY_TABLE})`).all();
      const [listed] = database.prepare(`PRAGMA table_list(${FIC_AUTHORITY_TABLE})`).all();
      const projection = authorityProjection(columns, { strict: listed?.strict === 1, withoutRowid: listed?.wr === 1 });
      authorityTable = { present: true, columns: projection.columns.length, strict: projection.strict, columnsSha256: projectionSha256(projection) };
    } else {
      authorityTable = { present: false };
    }
    return {
      userVersion,
      schemaMeta: meta
        ? {
            present: true,
            role: meta.role,
            schemaVersion: Number(meta.schema_version),
            agentIdMatches: meta.agent_id === agentId,
            createdEqualsUpdated: Number(meta.created_at) === Number(meta.updated_at),
          }
        : { present: false },
      authorityTable,
      authProfileRows: tableExists(database, 'auth_profile_store') ? countRows(database, 'auth_profile_store') : null,
    };
  });
}

/** The state database's migration journal and agent registry: counts and hashes only. */
function readStateStorage(file, agentId) {
  return withReadOnlyDatabase(file, (database) => {
    const required = ['migration_runs', 'migration_sources', 'backup_runs', 'agent_databases'];
    const absent = required.filter((name) => !tableExists(database, name));
    if (absent.length) throw new Error(`missing tables: ${absent.join(',')}`);
    const runs = database.prepare('SELECT id, status, report_json AS report FROM migration_runs').all()
      .map((row) => ({ id: row.id, status: row.status, report: row.report }));
    const registry = database.prepare('SELECT schema_version FROM agent_databases WHERE agent_id = ?').all(agentId);
    return {
      userVersion: Number(database.prepare('PRAGMA user_version').get().user_version),
      migrationRuns: classifyMigrationRuns(runs),
      migrationSources: countRows(database, 'migration_sources'),
      backupRuns: countRows(database, 'backup_runs'),
      agentRegistry: {
        rows: registry.length,
        mismatched: registry.filter((row) => Number(row.schema_version) !== FIC_AGENT_SCHEMA_VERSION).length,
      },
    };
  });
}

/* ------------------------------------------------------------------------------------ */
/* Platform (injectable for tests)                                                      */
/* ------------------------------------------------------------------------------------ */

export function defaultPlatform() {
  return {
    spawnGateway: ({ node, args, env, cwd }) => spawn(node, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true }),
    runCli: ({ node, args, env, cwd, timeoutMs }) => new Promise((resolve) => {
      const child = spawn(node, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout = [];
      const stderr = [];
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.stdout.on('data', (chunk) => stdout.push(chunk));
      child.stderr.on('data', (chunk) => stderr.push(chunk));
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ code: null, signal: null, stdout: Buffer.concat(stdout), stderr: Buffer.from(String(error.message)) });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      });
    }),
    docsIdentity: (root) => {
      const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10_000 });
      const head = git('rev-parse', 'HEAD');
      const tracked = git('status', '--porcelain', '--untracked-files=no');
      const harness = git('status', '--porcelain', '--', 'tools/k6-proofs');
      return {
        sha: head.status === 0 ? head.stdout.trim() : null,
        clean: tracked.status === 0 && harness.status === 0 && !tracked.stdout.trim() && !harness.stdout.trim(),
      };
    },
    portListening: (port) => listenInodes(port).length > 0,
    now: () => Date.now(),
  };
}

/* ------------------------------------------------------------------------------------ */
/* Arguments                                                                             */
/* ------------------------------------------------------------------------------------ */

const PLAN_FLAGS = {
  '--boot-timeout-ms': 'bootTimeoutMs',
  '--stop-grace-ms': 'stopGraceMs',
  '--config-validate-timeout-ms': 'configValidateTimeoutMs',
};

export function parseArgs(argv) {
  const options = { plan: {}, gatewayEnv: {} };
  const value = (index) => {
    if (index + 1 >= argv.length) throw new Error(`${argv[index]} needs a value`);
    return argv[index + 1];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') {
      options.help = true;
      continue;
    }
    if (flag in PLAN_FLAGS) {
      options.plan[PLAN_FLAGS[flag]] = Number(value(index));
      index += 1;
      continue;
    }
    const simple = {
      '--state-dir': 'stateDir',
      '--stage-dir': 'stageDir',
      '--candidate-sha': 'candidateSha',
      '--docs-sha': 'docsSha',
      '--artifact-dir': 'artifactDir',
      '--observer-key-file': 'observerKeyFile',
      '--node': 'node',
      '--agent-id': 'agentId',
      '--verify': 'verify',
    }[flag];
    if (flag === '--port') {
      options.port = Number(value(index));
      index += 1;
      continue;
    }
    if (simple) {
      options[simple] = value(index);
      index += 1;
      continue;
    }
    if (flag === '--gateway-env') {
      const entry = value(index);
      const separator = entry.indexOf('=');
      if (separator <= 0) throw new Error('--gateway-env takes KEY=VALUE');
      options.gatewayEnv[entry.slice(0, separator)] = entry.slice(separator + 1);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${flag}`);
  }
  return options;
}

const USAGE = `Usage:
  node tools/k6-proofs/scripts/run-fresh-install-control.mjs \\
    --stage-dir <stage-only build dir> --candidate-sha <40-hex> --docs-sha <40-hex> \\
    --state-dir <new or empty dir> --port <free loopback port> \\
    --artifact-dir <new public dir> --observer-key-file <0600 key file> \\
    [--agent-id main] [--node <node>] [--boot-timeout-ms 180000] [--stop-grace-ms 30000] \\
    [--config-validate-timeout-ms 60000] [--gateway-env KEY=VALUE]...
  node tools/k6-proofs/scripts/run-fresh-install-control.mjs \\
    --verify <observer-receipt.json> --observer-key-file <key file>

Run it from a shell with no model credentials (env -i ... is simplest). The receipt's verdict is the
row's candidate verdict; --verify checks the observer signature and re-grades the signed record.`;

/* ------------------------------------------------------------------------------------ */
/* Control                                                                               */
/* ------------------------------------------------------------------------------------ */

function inside(dir, child) {
  const relative = path.relative(dir, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readObserverKey(file, forbiddenDirs, refuse) {
  if (!file) {
    refuse('observer-key-missing', '--observer-key-file is required: the cleanup receipt is signed with a launcher-held key');
    return null;
  }
  try {
    const stat = lstatSync(file);
    if (!stat.isFile()) throw new Error('not a regular file');
    if ((stat.mode & 0o077) !== 0) {
      refuse('observer-key-mode', 'the observer key file must be mode 0600');
      return null;
    }
    const resolved = realpathSync(file);
    if (forbiddenDirs.some((dir) => dir && inside(dir, resolved))) {
      refuse('observer-key-in-target', 'the observer key must not live inside the state directory or the stage');
      return null;
    }
    const key = readFileSync(resolved, 'utf8').trim();
    if (key.length < 32) {
      refuse('observer-key-short', 'the observer key must be at least 32 characters');
      return null;
    }
    return key;
  } catch {
    refuse('observer-key-unreadable', 'the observer key file cannot be read');
    return null;
  }
}

function writeJson(file, value, mode = 0o644) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

function refusalResult({ artifactDir, refusals, options, unwritable }) {
  const refusal = {
    schema: FIC_REFUSAL_SCHEMA,
    row: FIC_ROW,
    candidateSha: isSha40(options.candidateSha) ? options.candidateSha : null,
    refusedAt: new Date().toISOString(),
    processesStarted: 0,
    stateCreated: false,
    refusals: refusals.map(({ code, detail }) => ({ code, detail })),
  };
  // Never create anything inside a directory the guard refused to write to.
  const write = Boolean(artifactDir) && !unwritable;
  if (write) {
    mkdirSync(artifactDir, { recursive: true });
    writeJson(path.join(artifactDir, 'refusal.json'), refusal);
  }
  return { status: 'refused', refusals: refusal.refusals, refusal, refusalWritten: write };
}

/** Run the control once. Returns { status, record, grade, receipt } or a refusal. */
export async function runFreshInstallControl(options, overrides = {}) {
  const platform = { ...defaultPlatform(), ...overrides };
  const home = options.home ?? os.homedir();
  const environment = options.environment ?? process.env;
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  const artifactDir = options.artifactDir ? path.resolve(options.artifactDir) : null;
  const agentId = options.agentId ?? 'main';

  if (!artifactDir) refuse('artifact-dir-missing', '--artifact-dir is required');
  if (!isSha40(options.docsSha)) refuse('docs-sha-invalid', '--docs-sha must be 40 lowercase hex');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(agentId)) refuse('agent-id-invalid', '--agent-id must be a plain agent id');
  for (const [key, value] of Object.entries(options.gatewayEnv ?? {})) {
    if (!GATEWAY_ENV_ALLOWED.test(key) || isModelCredentialKey(key)) {
      refuse('gateway-env-not-allowed', `--gateway-env may set only NODE_OPTIONS or OPENCLAW_CODEX_APP_SERVER_BIN, not ${key}`);
    } else if (key === 'NODE_OPTIONS' && !String(value).trim().split(/\s+/u).every((part) => NODE_OPTIONS_ALLOWED.test(part))) {
      refuse('gateway-env-not-allowed', 'NODE_OPTIONS may carry only --max-old-space-size=<n> and --inspect=127.0.0.1:<port>');
    } else if (key === 'OPENCLAW_CODEX_APP_SERVER_BIN' && !path.isAbsolute(String(value))) {
      refuse('gateway-env-not-allowed', 'OPENCLAW_CODEX_APP_SERVER_BIN must be an absolute path');
    }
  }
  let plan;
  try {
    plan = planFreshInstall(options.plan ?? {});
  } catch (error) {
    refuse('plan-invalid', error.message);
  }

  const { refusals: targetRefusals, target } = evaluateFreshInstallTarget({
    stateDir: options.stateDir ? path.resolve(options.stateDir) : options.stateDir,
    stageDir: options.stageDir ? path.resolve(options.stageDir) : options.stageDir,
    candidateSha: options.candidateSha,
    port: options.port,
    home,
    environment,
    fsApi: { existsSync, readFileSync, realpathSync, lstatSync, readdirSync },
    pathApi: path,
    portListening: platform.portListening,
  });
  refusals.push(...targetRefusals);

  const docs = platform.docsIdentity(repoRoot);
  if (isSha40(options.docsSha) && docs.sha !== options.docsSha) {
    refuse('docs-sha-mismatch', 'the docs SHA is not the harness checkout executing this control');
  }
  let unwritable = false;
  if (artifactDir) {
    const homeReal = (() => {
      try {
        return realpathSync(home);
      } catch {
        return home;
      }
    })();
    const live = liveStateDirs({ home: homeReal, environment, fsApi: { readdirSync }, pathApi: path });
    for (const forbidden of [target.stateDir, target.stageDir, ...live].filter(Boolean)) {
      if (inside(forbidden, artifactDir)) {
        unwritable = true;
        refuse('artifact-dir-in-target', 'the artifact directory must live outside the state directory, the stage and every live state directory');
      }
    }
    // The private sibling keeps raw logs; it must never land in a repository tree.
    if (inside(path.resolve(repoRoot), artifactDir)) {
      unwritable = true;
      refuse('artifact-dir-in-repo', 'write receipts outside the docs repository (for example ~/proof-runs/...); publishing is a separate reviewed step');
    }
    if (target.stateDir && (inside(artifactDir, target.stateDir) || inside(`${artifactDir}.private`, target.stateDir))) {
      refuse('state-dir-in-artifact-dir', 'the state directory must not live inside the artifact directory or its private sibling');
    }
    if (existsSync(path.join(artifactDir, 'observer-receipt.json')) || existsSync(`${artifactDir}.private`)) {
      refuse('artifact-dir-used', 'the artifact directory already holds a control run; use a new one');
    }
  }
  const observerKey = readObserverKey(options.observerKeyFile, [target.stateDir, target.stageDir], refuse);

  if (refusals.length) return refusalResult({ artifactDir, refusals, options, unwritable });
  return await executeControl({ options, platform, plan, target, docs, home, artifactDir, agentId, observerKey });
}

async function executeControl({ options, platform, plan, target, docs, home, artifactDir, agentId, observerKey }) {
  const now = platform.now;
  const startedAtMs = now();
  const node = options.node ?? process.execPath;
  const entry = path.join(target.stageDir, 'dist', 'index.js');
  const privateDir = `${artifactDir}.private`;
  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  chmodSync(privateDir, 0o700);

  const runId = `fic-${randomBytes(16).toString('hex')}`;
  const marker = `${MARKER_KEY}=${runId}`;
  const sessionSlug = `fic-${runId.slice(4, 16)}`;
  const token = randomBytes(24).toString('hex');
  const stateDir = target.stateDir;
  const configDir = path.join(privateDir, 'config');
  const configPath = path.join(configDir, 'openclaw.json');
  const gatewayHome = path.join(privateDir, 'home');
  const agentDatabase = path.join(stateDir, 'agents', agentId, 'agent', 'openclaw-agent.sqlite');
  const stateDatabase = path.join(stateDir, 'state', 'openclaw.sqlite');
  const secrets = [
    { value: token, label: '<gateway-token>' },
    { value: observerKey, label: '<observer-key>' },
    { value: privateDir, label: '<private-dir>' },
    { value: artifactDir, label: '<artifact-dir>' },
    { value: stateDir, label: '<state-dir>' },
    { value: target.stageDir, label: '<stage-dir>' },
    { value: home, label: '~' },
  ];
  const sortSecrets = () => secrets.sort((a, b) => String(b.value ?? '').length - String(a.value ?? '').length);
  const addSecret = (value, label) => {
    if (typeof value === 'string' && value.length >= 4) secrets.push({ value, label });
    sortSecrets();
  };
  sortSecrets();
  const redact = (text) => redactText(text, secrets);

  const record = {
    schema: FIC_SCHEMA,
    row: FIC_ROW,
    runId,
    candidateSha: options.candidateSha,
    docsSha: options.docsSha,
    docs: { sha: docs.sha, clean: docs.clean === true },
    startedAt: new Date(startedAtMs).toISOString(),
    plan,
    target: {
      agentId,
      port: target.port,
      livePortsRefused: target.livePorts,
      stageBuild: target.stageBuild,
      environmentCredentialKeys: target.environmentCredentialKeys,
      guard: 'passed',
    },
    gateway: { started: false },
    storage: {},
    authority: { readOnly: true },
    configValidate: { ran: false },
    stop: {},
    cleanup: { completed: false },
    timings: {},
    observerKey: { available: Boolean(observerKey), algorithmFingerprint: observerKey ? observerKeyFingerprint(observerKey) : null },
    errors: [],
  };

  /* 1. the fresh state directory, the minimal config and an empty gateway HOME */
  const existed = existsSync(stateDir);
  if (!existed) mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const stateStat = lstatSync(stateDir);
  const stateIdentity = { dev: stateStat.dev, ino: stateStat.ino };
  const stateEntries = readdirSync(stateDir).length;
  mkdirSync(configDir, { mode: 0o700 });
  mkdirSync(gatewayHome, { mode: 0o700 });
  const config = minimalFreshConfig({ port: target.port, token });
  const configText = `${JSON.stringify(config, null, 2)}\n`;
  writeFileSync(configPath, configText, { mode: 0o600, flag: 'wx' });
  record.target.stateDir = {
    createdByControl: !existed,
    emptyAtStart: stateEntries === 0,
    entriesAtStart: stateEntries,
    mode: (stateStat.mode & 0o777).toString(8).padStart(4, '0'),
  };
  record.target.home = { controlOwned: true, entriesAtStart: readdirSync(gatewayHome).length };
  record.target.config = {
    sha256: sha256(configText),
    keys: configKeyPaths(config),
    mode: (lstatSync(configPath).mode & 0o777).toString(8).padStart(4, '0'),
    outsideStateDir: !inside(stateDir, configPath),
  };

  // A cleared environment: no operator variable reaches the gateway, and HOME is the empty,
  // control-owned directory, so no CLI credential file can be discovered either.
  const childEnv = {
    HOME: gatewayHome,
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    TZ: process.env.TZ ?? 'UTC',
    LANG: process.env.LANG ?? 'C.UTF-8',
    NO_COLOR: '1',
    ...(options.gatewayEnv ?? {}),
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_PORT: String(target.port),
    [MARKER_KEY]: runId,
  };

  const gateway = { child: null, pid: null, startTicks: null, exited: false, exit: null, exitedAtMs: null, stdout: [], stderr: [], closed: Promise.resolve() };
  const run = { runId, marker, gateway };
  liveRuns.add(run);
  const timings = { startedAtMs };

  const startGateway = () => {
    const logs = {
      stdout: createWriteStream(path.join(privateDir, 'gateway.stdout.log'), { mode: 0o600 }),
      stderr: createWriteStream(path.join(privateDir, 'gateway.stderr.log'), { mode: 0o600 }),
    };
    gateway.logs = logs;
    const child = platform.spawnGateway({ node, args: [entry, 'gateway', '--port', String(target.port)], env: childEnv, cwd: privateDir });
    gateway.child = child;
    gateway.pid = child.pid ?? null;
    timings.spawnedAtMs = now();
    child.stdout?.on('data', (chunk) => {
      gateway.stdout.push(chunk);
      logs.stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      gateway.stderr.push(chunk);
      logs.stderr.write(chunk);
    });
    gateway.closed = new Promise((resolve) => {
      child.on('error', (error) => {
        gateway.stderr.push(Buffer.from(`spawn error: ${error.message}\n`));
        gateway.exited = true;
        gateway.exitedAtMs = now();
        gateway.exit = { code: null, signal: null, error: error.code ?? 'spawn-error' };
        resolve();
      });
      child.on('exit', (code, signal) => {
        gateway.exited = true;
        gateway.exitedAtMs = now();
        gateway.exit = { code, signal };
      });
      child.on('close', () => resolve());
    });
    gateway.startTicks = gateway.pid ? (procStat(gateway.pid)?.startTicks ?? null) : null;
    Object.assign(record.gateway, { started: true, pid: gateway.pid, startTicks: gateway.startTicks });
  };

  /** The listener on the port, owned by a process carrying this run's marker. */
  const ownedListener = () => {
    const inodes = listenInodes(target.port);
    for (const pid of [gateway.pid, ...processesWithMarker(marker)].filter(Boolean)) {
      const owned = socketInodesOf(pid);
      const inode = inodes.find((candidate) => owned.has(candidate));
      if (inode) return { inode, ownerPid: pid, ownerIsGatewayPid: pid === gateway.pid };
    }
    return null;
  };

  const verifyReady = async () => {
    if (gateway.exited) return null;
    const listener = ownedListener();
    if (!listener) return null;
    const [readyz, startupz] = await Promise.all([
      httpProbe(target.port, '/readyz', plan.probeTimeoutMs),
      httpProbe(target.port, '/startupz', plan.probeTimeoutMs),
    ]);
    gateway.lastProbe = { readyz: { status: readyz.status, error: readyz.error }, startupz: { status: startupz.status, error: startupz.error } };
    const ready = parseJson(readyz.body ?? '');
    const startup = parseJson(startupz.body ?? '');
    if (readyz.status !== 200 || ready?.ready !== true || startupz.status !== 200 || startup?.status !== 'started') return null;
    const rpc = await gatewayRpc({ port: target.port, token, scopes: ['operator.read'], calls: [], timeoutMs: plan.probeTimeoutMs * 2, client: CLIENT });
    if (!rpc.hello || typeof rpc.hello.server?.bootId !== 'string') return null;
    return {
      atMs: now(),
      listener,
      readyz: { status: readyz.status, ready: true, bodySha256: sha256(readyz.body) },
      startupz: { status: startupz.status, startup: startup.status, bodySha256: sha256(startupz.body) },
      hello: {
        bootIdSha256: sha256(rpc.hello.server.bootId),
        buildId: typeof rpc.hello.server.buildId === 'string' ? rpc.hello.server.buildId : (startup?.buildId ?? null),
      },
    };
  };

  const waitUntil = async (predicate, deadlineAtMs, stepMs) => {
    while (now() < deadlineAtMs) {
      const value = await predicate();
      if (value) return value;
      await sleep(stepMs);
    }
    return null;
  };

  const observe = async () => {
    /* 2. one disposable gateway on the empty state */
    startGateway();
    const ready = await waitUntil(async () => (gateway.exited ? 'exited' : await verifyReady()), timings.spawnedAtMs + plan.bootTimeoutMs, plan.readyPollMs);
    if (!ready || ready === 'exited') {
      record.gateway.failure = { kind: ready === 'exited' ? 'exited-before-ready' : 'not-ready-by-deadline', exit: gateway.exit, lastProbe: gateway.lastProbe ?? null };
      return;
    }
    timings.readyAtMs = ready.atMs;
    // The precondition at the byte of the running process: which keys its own environ sets (no
    // value leaves /proc but HOME, which is compared, never recorded).
    const environKeys = environKeysOf(gateway.pid);
    Object.assign(record.gateway, {
      readyAtMs: ready.atMs,
      listen: { port: target.port, inode: ready.listener.inode, ownerIsGatewayPid: ready.listener.ownerIsGatewayPid },
      readyz: ready.readyz,
      startupz: ready.startupz,
      hello: ready.hello,
      agentDatabaseAtReady: existsSync(agentDatabase) ? 'present' : 'absent',
      environ: environKeys
        ? {
            keyCount: environKeys.length,
            credentialKeys: environKeys.filter((key) => isModelCredentialKey(key)),
            homeControlOwned: environValueOf(gateway.pid, 'HOME') === gatewayHome,
          }
        : null,
    });

    /* 3. the epoch, then 4. what the fresh install created, read-only. The storage is read
       whether or not the epoch could be established: a fresh install without the authority
       table must grade on that table, not on the failed narrowing it causes. */
    try {
      await establishAuthority();
    } finally {
      record.storage.agentDatabase = readAgentStorage(agentDatabase, agentId);
      record.storage.authorityTable = record.storage.agentDatabase.authorityTable ?? null;
      delete record.storage.agentDatabase.authorityTable;
      record.storage.stateDatabase = readStateStorage(stateDatabase, agentId);
    }
  };

  /** sessions.create (no message, no title source: no model turn), then the narrowing. */
  const establishAuthority = async () => {
    timings.establishStartedAtMs = now();
    const before = readAuthorityRows(agentDatabase);
    record.authority.rowsBeforeCreate = before.rows;
    record.authority.agentDatabaseBeforeCreate = before.database;
    const scopes = ['operator.read', 'operator.write', 'operator.admin'];
    const create = await gatewayRpc({
      port: target.port,
      token,
      scopes,
      calls: [{ method: 'sessions.create', params: { key: sessionSlug, agentId, label: 'fresh-install control' } }],
      timeoutMs: plan.rpcTimeoutMs,
      client: CLIENT,
    });
    const created = create.results[0]?.frame;
    const sessionKey = typeof created?.payload?.key === 'string' ? created.payload.key : null;
    record.authority.createOk = created?.ok === true && sessionKey !== null;
    if (!sessionKey) {
      record.authority.error = redact(JSON.stringify(created?.error ?? create.connectFrame?.error ?? create.error ?? 'sessions.create returned no key')).slice(0, 400);
      return;
    }
    addSecret(sessionKey, '<session-key>');
    const bareKey = sessionKey.startsWith(`agent:${agentId}:`) ? sessionKey.slice(`agent:${agentId}:`.length) : sessionKey;
    record.authority.rowsAfterCreate = readAuthorityRows(agentDatabase).rows;
    const narrow = await gatewayRpc({
      port: target.port,
      token,
      scopes,
      calls: [{ method: 'session.visibility.set', params: { sessionKey, agentId, visibility: 'suggest' } }],
      timeoutMs: plan.rpcTimeoutMs,
      client: CLIENT,
    });
    const narrowFrame = narrow.results[0]?.frame;
    record.authority.visibilityOk = narrowFrame?.ok === true;
    if (!record.authority.visibilityOk) {
      record.authority.error = redact(JSON.stringify(narrowFrame?.error ?? narrow.error ?? 'session.visibility.set failed')).slice(0, 400);
      return;
    }
    // Read-only, from outside the gateway: the committed row becomes visible to a WAL reader.
    const after = await waitUntil(() => {
      const read = readAuthorityRows(agentDatabase, [sessionKey, bareKey]);
      return read.keyRow ? read : null;
    }, now() + 5000, 50) ?? readAuthorityRows(agentDatabase, [sessionKey, bareKey]);
    if (after.keyRow) addSecret(after.keyRow.epoch, '<authority-epoch>');
    Object.assign(record.authority, {
      rowsAfterNarrowing: after.rows,
      keyRow: after.keyRow ? { present: true, keyForm: after.keyRow.key === sessionKey ? 'canonical' : 'bare' } : { present: false },
      sessionKeySha256: after.keyRow ? sha256(after.keyRow.key) : null,
      epochSha256: after.keyRow ? sha256(after.keyRow.epoch) : null,
      method: 'session.visibility.set(suggest) advances session_recipient_authority',
    });
    run.rawEpoch = after.keyRow?.epoch ?? null;
    timings.establishedAtMs = now();
  };

  /** openclaw config validate on the fresh config, with the gateway's own environment. */
  const validateConfig = async () => {
    timings.validateStartedAtMs = now();
    const result = await platform.runCli({
      node,
      args: [entry, 'config', 'validate', '--json'],
      env: childEnv,
      cwd: privateDir,
      timeoutMs: plan.configValidateTimeoutMs,
    });
    timings.validatedAtMs = now();
    const stdout = result.stdout.toString('utf8');
    writeJson(path.join(privateDir, 'config-validate.json'), { code: result.code, signal: result.signal, stdout, stderr: result.stderr.toString('utf8') }, 0o600);
    const body = parseTrailingJson(stdout);
    const resolvedConfig = realpathSync(configPath);
    record.configValidate = {
      ran: true,
      exit: { code: result.code, signal: result.signal },
      valid: body?.valid === true,
      pathMatches: typeof body?.path === 'string' && (() => {
        try {
          return realpathSync(body.path) === resolvedConfig;
        } catch {
          return false;
        }
      })(),
      warnings: Array.isArray(body?.warnings) ? body.warnings.length : null,
      issues: Array.isArray(body?.issues) ? body.issues.length : 0,
      stdoutSha256: sha256(stdout),
      stderrTail: textCapture(result.stderr, secrets).tail,
    };
  };

  /** SIGTERM to the gateway this run started (identity re-verified); SIGKILL only on timeout. */
  const stopGateway = async () => {
    if (!gateway.pid || gateway.exited) {
      record.stop = { signalledAtMs: null, exitedBeforeStop: gateway.exited, exit: gateway.exit };
      return;
    }
    const stat = procStat(gateway.pid);
    if (!stat || stat.startTicks !== gateway.startTicks || !procEnvironHas(gateway.pid, marker)) {
      record.stop = { signalledAtMs: null, identityUnverified: true };
      return;
    }
    const signalledAtMs = now();
    try {
      process.kill(gateway.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
    await Promise.race([gateway.closed, sleep(plan.stopGraceMs)]);
    let escalated = false;
    if (!gateway.exited) {
      escalated = true;
      try {
        process.kill(-gateway.pid, 'SIGKILL');
      } catch {
        try {
          process.kill(gateway.pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
      await Promise.race([gateway.closed, sleep(plan.killGraceMs)]);
    }
    const exitedAtMs = gateway.exitedAtMs;
    // Give the kernel a moment to drop the listening socket of an exited process.
    const released = await waitUntil(() => listenInodes(target.port).length === 0, now() + 2000, 50);
    // The run loop force-exits at its shutdown deadline, with code 0 when its budget allows
    // (src/cli/gateway-cli/run-loop.ts:622-634), so exit 0 alone is not a clean stop.
    const output = Buffer.concat([...gateway.stdout, ...gateway.stderr]).toString('utf8');
    record.stop = {
      signal: 'SIGTERM',
      signalledAtMs,
      exitedAtMs,
      exit: gateway.exit,
      escalatedToSigkill: escalated,
      shutdownDeadlineReached: SHUTDOWN_DEADLINE_LINE.test(output),
      portReleased: Boolean(released),
      // A helper that outlives the gateway's own stop is not a clean stop.
      leftoverProcesses: processesWithMarker(marker).length,
    };
    timings.stopMs = typeof exitedAtMs === 'number' ? exitedAtMs - signalledAtMs : null;
  };

  try {
    await observe();
    if (record.gateway.readyAtMs) await validateConfig();
  } catch (error) {
    record.errors.push({ at: 'control', message: redact(error.stack ?? error.message).slice(0, 2000) });
  }
  try {
    await stopGateway();
  } catch (error) {
    record.errors.push({ at: 'stop', message: redact(error.stack ?? error.message).slice(0, 2000) });
  }
  await cleanup({ record, gateway, marker, target, stateDir, stateIdentity, existed, gatewayHome, configDir, configPath, redact });
  liveRuns.delete(run);
  for (const stream of ['stdout', 'stderr']) {
    if (gateway.logs) await new Promise((resolve) => gateway.logs[stream].end(resolve));
  }
  Object.assign(record.gateway, {
    exit: gateway.exit,
    stdout: textCapture(Buffer.concat(gateway.stdout), secrets),
    stderr: textCapture(Buffer.concat(gateway.stderr), secrets),
  });
  record.timings = {
    bootMs: typeof timings.readyAtMs === 'number' ? timings.readyAtMs - timings.spawnedAtMs : null,
    establishMs: typeof timings.establishedAtMs === 'number' ? timings.establishedAtMs - timings.establishStartedAtMs : null,
    configValidateMs: typeof timings.validatedAtMs === 'number' ? timings.validatedAtMs - timings.validateStartedAtMs : null,
    stopMs: timings.stopMs ?? null,
    totalMs: now() - startedAtMs,
  };
  return finishReceipt({ record, observerKey, artifactDir, secrets, run });
}

/**
 * Remove what the run created, and only that: any process still carrying the run marker, the
 * fresh state directory (re-identified by device and inode; one that pre-existed empty is emptied,
 * not removed), the gateway HOME and the config. The private directory keeps the raw logs.
 */
async function cleanup({ record, gateway, marker, target, stateDir, stateIdentity, existed, gatewayHome, configDir, configPath, redact }) {
  const runMembers = () => {
    const found = new Set(processesWithMarker(marker));
    if (gateway.pid && !gateway.exited) found.add(gateway.pid);
    return [...found].sort((a, b) => a - b);
  };
  // Re-read identity immediately before any signal: the gateway by PID, start ticks and marker,
  // anything else by the marker alone. A PID that fails the check is never signalled.
  const ours = (pid) => {
    if (!procEnvironHas(pid, marker)) return false;
    return pid !== gateway.pid || procStat(pid)?.startTicks === gateway.startTicks;
  };
  const orphans = runMembers();
  const unverified = [];
  for (const [signalName, graceMs] of [['SIGTERM', 10_000], ['SIGKILL', 5_000]]) {
    const live = runMembers();
    if (live.length === 0) break;
    for (const pid of live) {
      if (!ours(pid)) {
        if (procStat(pid) && !unverified.includes(pid)) unverified.push(pid);
        continue;
      }
      try {
        process.kill(pid, signalName);
      } catch {
        // Already gone.
      }
    }
    const deadline = Date.now() + graceMs;
    while (Date.now() < deadline && runMembers().length > 0) await sleep(100);
  }
  await gateway.closed;
  const residual = runMembers();

  const remove = (label, action) => {
    try {
      action();
      return true;
    } catch (error) {
      record.errors.push({ at: `cleanup-${label}`, message: redact(error.message).slice(0, 400) });
      return false;
    }
  };
  let stateRemoved = false;
  let stateEntriesRemoved = null;
  if (residual.length === 0) {
    stateRemoved = remove('state', () => {
      const stat = lstatSync(stateDir);
      if (stat.isSymbolicLink() || stat.dev !== stateIdentity.dev || stat.ino !== stateIdentity.ino) {
        throw new Error('the state directory is no longer the one this run created; left in place');
      }
      stateEntriesRemoved = readdirSync(stateDir).length;
      if (existed) {
        for (const entry of readdirSync(stateDir)) rmSync(path.join(stateDir, entry), { recursive: true, force: true });
      } else {
        rmSync(stateDir, { recursive: true, force: true });
      }
    }) && (existed ? readdirSync(stateDir).length === 0 : !existsSync(stateDir));
  } else {
    record.errors.push({ at: 'cleanup-state', message: 'a run process survived; the disposable state was left for the operator' });
  }
  const homeRemoved = remove('home', () => rmSync(gatewayHome, { recursive: true, force: true })) && !existsSync(gatewayHome);
  const configRemoved = remove('config', () => rmSync(configDir, { recursive: true, force: true })) && !existsSync(configPath);
  record.cleanup = {
    completed: true,
    completedAtMs: Date.now(),
    orphansTerminated: orphans.filter((pid) => pid !== gateway.pid),
    residualPids: residual,
    unverifiedPids: unverified,
    portReleased: listenInodes(target.port).length === 0,
    stateRemoved,
    stateRemovalMode: existed ? 'emptied-pre-existing-directory' : 'removed-created-directory',
    stateEntriesRemoved,
    homeRemoved,
    configRemoved,
  };
}

function finishReceipt({ record, observerKey, artifactDir, secrets, run }) {
  let grade = gradeFreshInstallControl(record);
  const leakSecrets = [...secrets];
  if (run.rawEpoch) leakSecrets.push({ value: run.rawEpoch, label: '<authority-epoch>' });
  const leaks = publicSafetyLeaks(record, leakSecrets);
  let publicRecord = record;
  if (leaks.length) {
    grade = {
      ...grade,
      verdict: 'FAIL-candidate',
      corpusStateCeiling: 'fail',
      failures: [...grade.failures, { code: 'public-artifact-unsafe', detail: `withheld the record: ${leaks.join(', ')}` }],
    };
    publicRecord = null;
  }
  const body = {
    schema: `${FIC_SCHEMA}#observer-receipt`,
    row: FIC_ROW,
    runId: record.runId,
    candidateSha: record.candidateSha,
    docsSha: record.docsSha,
    generatedAt: new Date().toISOString(),
    verdict: grade.verdict,
    grade,
    record: publicRecord,
  };
  const receipt = observerKey ? sealObserverReceipt(body, observerKey) : body;
  writeJson(path.join(artifactDir, 'observer-receipt.json'), receipt);
  return { status: 'completed', record, grade, receipt };
}

/** Verify a receipt's signature and re-grade its signed record. */
export function verifyReceipt(receipt, key) {
  const valid = verifyObserverReceipt(receipt, key);
  const regraded = receipt?.record ? gradeFreshInstallControl(receipt.record).verdict : null;
  return {
    valid,
    verdict: receipt?.verdict ?? null,
    regraded,
    // A withheld record (public-safety failure) can only be FAIL-candidate.
    regradeMatches: receipt?.record ? regraded === receipt?.verdict : receipt?.verdict === 'FAIL-candidate',
  };
}

/* ------------------------------------------------------------------------------------ */
/* CLI                                                                                   */
/* ------------------------------------------------------------------------------------ */

/** On SIGINT/SIGTERM, stop every process this run started, then exit. */
function installInterruptCleanup() {
  const interrupt = (signal) => {
    for (const run of liveRuns) {
      for (const pid of processesWithMarker(run.marker)) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
    }
    console.error(`interrupted by ${signal}; stopped ${liveRuns.size} control run(s); no receipt was written and the disposable state directory was left in place for the operator to remove`);
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.verify) {
    let key = '';
    try {
      key = options.observerKeyFile ? readFileSync(options.observerKeyFile, 'utf8').trim() : '';
    } catch (error) {
      console.error(`cannot read the observer key file: ${error?.code ?? 'unreadable'}`);
      return 2;
    }
    const result = verifyReceipt(JSON.parse(readFileSync(options.verify, 'utf8')), key);
    console.log(JSON.stringify(result));
    return result.valid && result.regradeMatches ? 0 : 1;
  }
  installInterruptCleanup();
  const result = await runFreshInstallControl(options);
  if (result.status === 'refused') {
    console.error(`REFUSED: ${result.refusals.map((entry) => `${entry.code} (${entry.detail})`).join('; ')}`);
    return 2;
  }
  console.log(JSON.stringify({
    row: FIC_ROW,
    verdict: result.grade.verdict,
    missingReceipts: result.grade.missingReceipts,
    failures: result.grade.failures.map((entry) => entry.code),
    missing: result.grade.missing.map((entry) => entry.code),
    partials: result.grade.partials.map((entry) => entry.code),
    namedLimits: result.grade.namedLimits,
  }, null, 2));
  console.log(`VERDICT: ${result.grade.verdict}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }, (error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
