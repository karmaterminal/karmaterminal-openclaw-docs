#!/usr/bin/env node
/**
 * Bring up, verify and tear down one isolated gateway on the exact deployed
 * build of the seat this job runs on (#587). Codifies the 2026-10-16 isolated
 * baseline recipe:
 *
 *   resolve-build  read <install>/dist/build-info.json; that commit is the SHA
 *                  under test, never a branch tip
 *   up             fresh config/state/HOME/workspace, loopback port, ephemeral
 *                  token, no channels, diagnostics-otel on; start it as a
 *                  transient systemd --user unit from the seat's own dist; wait
 *                  for health; prove runtime SHA, applied == persisted config,
 *                  and isolation through its own authenticated config.get
 *   down           stop the unit, prove the port closed and the live gateway
 *                  untouched, delete the temp root
 *
 * Public receipts go to --out. The token, paths and env file go to
 * --private-dir only (0600) and must never be uploaded.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectTarget, gatewayUrlFingerprint } from './target-readiness.mjs';
import {
  BUILD_SCHEMA,
  DEFAULT_INSTALL_DIR_CANDIDATES,
  LIVE_GATEWAY_UNIT,
  RECEIPT_SCHEMA,
  TEARDOWN_SCHEMA,
  configDigest,
  environmentFile,
  evaluateBuildInfo,
  evaluateIsolation,
  expandHome,
  publicConfigSummary,
  renderIsolatedConfig,
  serviceName,
  systemdRunArgs,
  unitName,
  validateProfile,
} from '../lib/isolated-gateway.mjs';

const SESSION_KEY = 'agent:main:main';
const STATE_FILE = 'isolated-gateway.state.json';
const ENV_FILE = 'isolated-gateway.env';

function defaultExec(cmd, args) {
  try {
    const stdout = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: error.status ?? 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') };
  }
}

function allocateLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function portAcceptsConnections(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000, () => done(true));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

export const realDeps = {
  exec: defaultExec,
  fetch: (...args) => globalThis.fetch(...args),
  inspectTarget,
  allocatePort: allocateLoopbackPort,
  portOpen: portAcceptsConnections,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
  randomToken: () => randomBytes(32).toString('hex'),
  home: homedir(),
};

function writePrivate(file, text) {
  writeFileSync(file, text, { mode: 0o600 });
  chmodSync(file, 0o600);
}

function writeJson(file, value, { private: isPrivate = false } = {}) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (isPrivate) writePrivate(file, text);
  else writeFileSync(file, text);
}

function publicInstallDir(dir, home) {
  return home && dir.startsWith(`${home}/`) ? `~/${dir.slice(home.length + 1)}` : dir;
}

/** Resolve the install dir and its build identity. Does not start anything. */
export function resolveBuild({ installDir } = {}, deps = realDeps) {
  const candidates = installDir ? [installDir] : DEFAULT_INSTALL_DIR_CANDIDATES;
  for (const candidate of candidates) {
    const dir = expandHome(candidate, deps.home);
    const buildInfoPath = path.join(dir, 'dist', 'build-info.json');
    if (!existsSync(buildInfoPath)) continue;
    let buildInfo = null;
    try {
      buildInfo = JSON.parse(readFileSync(buildInfoPath, 'utf8'));
    } catch {
      buildInfo = null;
    }
    const packagesDir = path.join(dir, 'packages');
    const packageDistCount = existsSync(packagesDir)
      ? readdirSync(packagesDir).filter((name) => existsSync(path.join(packagesDir, name, 'dist'))).length
      : 0;
    const otelDistPresent = existsSync(path.join(dir, 'extensions', 'diagnostics-otel', 'dist'));
    const entryPresent = existsSync(path.join(dir, 'openclaw.mjs'));
    const evaluated = evaluateBuildInfo(buildInfo, { packageDistCount, otelDistPresent });
    if (!entryPresent) evaluated.notes.push('openclaw-entry-missing');
    return {
      schema: BUILD_SCHEMA,
      installDir: publicInstallDir(dir, deps.home),
      ...evaluated,
      ok: evaluated.notes.length === 0,
      privateInstallDir: dir,
    };
  }
  return {
    schema: BUILD_SCHEMA,
    installDir: null,
    ok: false,
    commit: null,
    notes: ['build-info-not-found'],
    privateInstallDir: null,
  };
}

function publicBuild(build) {
  const { privateInstallDir, ...rest } = build;
  return rest;
}

function systemctlShow(deps, unit) {
  const result = deps.exec('systemctl', [
    '--user',
    'show',
    unit,
    '--property=LoadState,ActiveState,MainPID,ActiveEnterTimestamp,NRestarts',
  ]);
  if (result.code !== 0) return null;
  return Object.fromEntries(
    result.stdout
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

function activePeerUnits(deps, seat) {
  const result = deps.exec('systemctl', [
    '--user',
    'list-units',
    '--all',
    '--plain',
    '--no-legend',
    `openclaw-k6-iso-${seat}-*`,
  ]);
  if (result.code !== 0) return [];
  return result.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .filter((cols) => cols[0]?.endsWith('.service') && ['active', 'activating', 'deactivating'].includes(cols[2]))
    .map((cols) => cols[0]);
}

async function waitForHealth({ port, deadlineMs, unit }, deps) {
  const started = Date.now();
  let lastError = 'not-probed';
  while (Date.now() - started < deadlineMs) {
    const state = systemctlShow(deps, unit);
    if (state && ['failed', 'inactive'].includes(state.ActiveState) && Date.now() - started > 2000) {
      return { ok: false, lastError: `unit-${state.ActiveState}` };
    }
    try {
      const response = await deps.fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return { ok: true, lastError: null };
      lastError = `health-${response.status}`;
    } catch (error) {
      lastError = error?.cause?.code || error?.code || 'health-unreachable';
    }
    await deps.sleep(500);
  }
  return { ok: false, lastError: `health-timeout:${lastError}` };
}

/**
 * Start the isolated gateway. Returns { code, receipt }. On any failure after
 * the unit was started it is torn down before returning.
 */
export async function up(options, deps = realDeps) {
  const {
    seat,
    runId,
    profilePath,
    outDir,
    privateDir,
    installDir,
    expectedSha,
    runtimeMaxSec = 7200,
    healthTimeoutMs = 120000,
    peerWaitMs = 60 * 60 * 1000,
    node = process.execPath,
  } = options;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const notes = [];
  const receipt = {
    schema: RECEIPT_SCHEMA,
    generatedAt: deps.now().toISOString(),
    outcome: 'NOT-READY',
    seat,
    unit: null,
    sessionKey: SESSION_KEY,
    build: null,
    config: null,
    isolation: null,
    liveGatewayObserved: null,
    notes,
  };
  const finish = (code) => {
    receipt.notes = [...new Set(notes)];
    writeJson(path.join(outDir, 'isolated-gateway.json'), receipt);
    return { code, receipt };
  };

  const build = resolveBuild({ installDir }, deps);
  receipt.build = publicBuild(build);
  if (!build.ok) {
    notes.push(...build.notes);
    return finish(2);
  }
  if (expectedSha && build.commit !== expectedSha) {
    notes.push('build-info-commit-changed-since-resolve');
    return finish(2);
  }

  let profile;
  try {
    // The profile carries provider credentials; refuse it before anything starts.
    if ((statSync(profilePath).mode & 0o077) !== 0) {
      notes.push('profile-readable-by-group-or-world');
      return finish(2);
    }
    profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch {
    notes.push('profile-unreadable');
    return finish(2);
  }
  const profileErrors = validateProfile(profile);
  if (profileErrors.length > 0) {
    notes.push(...profileErrors);
    return finish(2);
  }

  const unit = unitName({ seat, runId });
  receipt.unit = unit;
  // Serial per seat at the host, whatever the Actions concurrency groups and
  // runner count are: wait for any other isolated baseline on this seat.
  const peerDeadline = Date.now() + peerWaitMs;
  let peers = activePeerUnits(deps, seat);
  while (peers.length > 0 && Date.now() < peerDeadline) {
    await deps.sleep(15000);
    peers = activePeerUnits(deps, seat);
  }
  if (peers.length > 0) {
    notes.push(peers.includes(unit) ? 'isolated-unit-already-active' : 'another-isolated-baseline-active');
    return finish(2);
  }

  // Under RUNNER_TEMP by default, so the runner's own job cleanup is a second net.
  const tmpRoot = options.tmpRoot ?? process.env.RUNNER_TEMP ?? tmpdir();
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(path.join(tmpRoot, 'openclaw-k6-iso-'));
  chmodSync(root, 0o700);
  const paths = {
    root,
    configPath: path.join(root, 'config', 'openclaw.json'),
    stateDir: path.join(root, 'state'),
    homeDir: path.join(root, 'home'),
    workspaceDir: path.join(root, 'workspace'),
    envFile: path.join(root, 'gateway.env'),
  };
  for (const dir of [path.dirname(paths.configPath), paths.stateDir, paths.homeDir, paths.workspaceDir]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  // A fresh, empty state dir is what makes agent:main:main disposable here.
  if (readdirSync(paths.stateDir).length !== 0) {
    notes.push('state-dir-not-fresh');
    rmSync(root, { recursive: true, force: true });
    return finish(2);
  }

  const port = await deps.allocatePort();
  const token = deps.randomToken();
  const config = renderIsolatedConfig(profile, { port, token, workspaceDir: paths.workspaceDir, seat });
  writeJson(paths.configPath, config, { private: true });
  const persistedDigest = configDigest(JSON.parse(readFileSync(paths.configPath, 'utf8')));
  writeJson(path.join(outDir, 'isolated-config.summary.json'), publicConfigSummary(config));
  receipt.config = {
    digest: configDigest(config),
    persistedDigest,
    renderedEqualsPersisted: persistedDigest === configDigest(config),
    channelsConfigured: false,
    diagnosticsOtel: true,
    maxSpawnDepth: profile.maxSpawnDepth,
    serviceName: serviceName(seat),
  };

  writePrivate(paths.envFile, environmentFile({
    HOME: paths.homeDir,
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_GATEWAY_PORT: port,
  }));

  // Kept private: the public receipt only says whether a live gateway exists.
  const liveGatewayBefore = systemctlShow(deps, LIVE_GATEWAY_UNIT);
  receipt.liveGatewayObserved = liveGatewayBefore?.LoadState === 'loaded';
  const gatewayWs = `ws://127.0.0.1:${port}`;
  const state = {
    unit,
    port,
    root,
    seat,
    token,
    liveGatewayBefore,
    startedAt: deps.now().toISOString(),
  };
  writeJson(path.join(privateDir, STATE_FILE), state, { private: true });

  const start = deps.exec('systemd-run', systemdRunArgs({
    unit,
    envFile: paths.envFile,
    extraEnvFile: profile.environmentFile ? expandHome(profile.environmentFile, deps.home) : null,
    rootDir: root,
    node,
    entry: path.join(build.privateInstallDir, 'openclaw.mjs'),
    port,
    runtimeMaxSec,
  }));
  if (start.code !== 0) {
    notes.push('systemd-run-failed');
    await down({ privateDir, outDir }, deps);
    return finish(2);
  }

  const health = await waitForHealth({ port, deadlineMs: healthTimeoutMs, unit }, deps);
  if (!health.ok) {
    notes.push(health.lastError);
    await down({ privateDir, outDir }, deps);
    return finish(2);
  }

  const rpc = await deps.inspectTarget(gatewayWs, token);
  const isolation = evaluateIsolation({
    rpc,
    expectedSha: build.commit,
    expectedServiceName: serviceName(seat),
    expectedDepth: profile.maxSpawnDepth,
  });
  receipt.isolation = {
    gatewayUrlFingerprint: gatewayUrlFingerprint(gatewayWs),
    serverBuildId: rpc?.responseIdentity?.buildId ?? null,
    configRevisionHash: rpc?.responseIdentity?.configRevisionHash ?? null,
    appliedConfigHash: rpc?.responseIdentity?.appliedConfigHash ?? null,
    channels: isolation.channels,
    notes: isolation.notes,
  };
  notes.push(...isolation.notes);

  // A deploy that lands while we start would put different bytes under test.
  const after = resolveBuild({ installDir: build.privateInstallDir }, deps);
  if (after.commit !== build.commit) notes.push('build-info-changed-during-start');
  if (configDigest(JSON.parse(readFileSync(paths.configPath, 'utf8'))) !== persistedDigest) {
    notes.push('config-file-rewritten-by-gateway');
  }

  if (notes.length > 0) {
    await down({ privateDir, outDir }, deps);
    return finish(2);
  }

  writePrivate(path.join(privateDir, ENV_FILE), environmentFile({
    OPENCLAW_GATEWAY_WS: gatewayWs,
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_GATEWAY_UNIT: unit,
    OPENCLAW_PROOFS_GATEWAY_UNIT: unit,
    OPENCLAW_GATEWAY_RESTART_CMD: `systemctl --user restart ${unit}`,
    OPENCLAW_CANDIDATE_SHA: build.commit,
    OPENCLAW_RUNTIME_SHA: build.commit,
    OPENCLAW_RUNTIME_BUILD_SHA: build.commit,
    OPENCLAW_SESSION_KEY: SESSION_KEY,
    OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: 2,
    OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: profile.maxSpawnDepth,
    OPENCLAW_PROOFS_SERVICE_NAME: serviceName(seat),
    OPENCLAW_ALT_MODEL: profile.altModel ?? '',
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
  }));
  receipt.outcome = 'READY';
  return finish(0);
}

/** Stop the isolated unit and prove the seat is as it was. Idempotent. */
export async function down({ privateDir, outDir, retain = false }, deps = realDeps) {
  mkdirSync(outDir, { recursive: true });
  const stateFile = path.join(privateDir, STATE_FILE);
  const receipt = {
    schema: TEARDOWN_SCHEMA,
    generatedAt: deps.now().toISOString(),
    outcome: 'CLEAN',
    unit: null,
    unitStopped: null,
    portClosed: null,
    liveGatewayUntouched: null,
    tempRootDeleted: null,
    notes: [],
  };
  const receiptFile = path.join(outDir, 'isolated-gateway-teardown.json');
  if (!existsSync(stateFile)) {
    // up() already tore down on its failure path: report that receipt, never
    // overwrite a DIRTY one with "nothing to do".
    if (existsSync(receiptFile)) {
      const prior = JSON.parse(readFileSync(receiptFile, 'utf8'));
      return { code: prior.outcome === 'DIRTY' ? 3 : 0, receipt: prior };
    }
    receipt.outcome = 'NOTHING-TO-TEAR-DOWN';
    writeJson(receiptFile, receipt);
    return { code: 0, receipt };
  }
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  receipt.unit = state.unit;

  deps.exec('systemctl', ['--user', 'stop', state.unit]);
  let unitState = systemctlShow(deps, state.unit);
  for (let i = 0; i < 60 && unitState && ['active', 'deactivating', 'activating'].includes(unitState.ActiveState); i += 1) {
    await deps.sleep(500);
    unitState = systemctlShow(deps, state.unit);
  }
  deps.exec('systemctl', ['--user', 'reset-failed', state.unit]);
  receipt.unitStopped = !unitState || !['active', 'deactivating', 'activating'].includes(unitState.ActiveState);
  if (!receipt.unitStopped) receipt.notes.push('isolated-unit-still-active');

  receipt.portClosed = !(await deps.portOpen(state.port));
  if (!receipt.portClosed) receipt.notes.push('isolated-port-still-open');

  const liveAfter = systemctlShow(deps, LIVE_GATEWAY_UNIT);
  const before = state.liveGatewayBefore;
  receipt.liveGatewayUntouched =
    (before === null && liveAfter === null) ||
    (before !== null && liveAfter !== null &&
      before.MainPID === liveAfter.MainPID &&
      before.ActiveEnterTimestamp === liveAfter.ActiveEnterTimestamp &&
      before.NRestarts === liveAfter.NRestarts);
  if (!receipt.liveGatewayUntouched) receipt.notes.push('live-gateway-changed-during-run');

  if (retain) {
    receipt.tempRootDeleted = false;
  } else {
    rmSync(state.root, { recursive: true, force: true });
    receipt.tempRootDeleted = !existsSync(state.root);
  }
  rmSync(stateFile, { force: true });
  rmSync(path.join(privateDir, ENV_FILE), { force: true });

  if (receipt.notes.length > 0) receipt.outcome = 'DIRTY';
  writeJson(receiptFile, receipt);
  return { code: receipt.notes.length > 0 ? 3 : 0, receipt };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      const next = rest[++i];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === '--seat') options.seat = value();
    else if (arg === '--run-id') options.runId = value();
    else if (arg === '--profile') options.profilePath = value();
    else if (arg === '--out') options.outDir = value();
    else if (arg === '--private-dir') options.privateDir = value();
    else if (arg === '--install-dir') options.installDir = value();
    else if (arg === '--expected-sha') options.expectedSha = value();
    else if (arg === '--runtime-max-sec') options.runtimeMaxSec = Number(value());
    else if (arg === '--health-timeout-ms') options.healthTimeoutMs = Number(value());
    else if (arg === '--peer-wait-ms') options.peerWaitMs = Number(value());
    else if (arg === '--tmp-root') options.tmpRoot = value();
    else if (arg === '--retain') options.retain = true;
    else throw new Error(`unknown arg: ${arg}`);
  }
  return options;
}

function usage() {
  console.error([
    'Usage:',
    '  isolated-gateway.mjs resolve-build [--install-dir DIR]',
    '  isolated-gateway.mjs up --seat SEAT --run-id ID --profile FILE --out DIR --private-dir DIR',
    '                          [--install-dir DIR] [--expected-sha SHA] [--runtime-max-sec N]',
    '  isolated-gateway.mjs down --private-dir DIR --out DIR [--retain]',
  ].join('\n'));
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.command === 'resolve-build') {
    const build = resolveBuild(options);
    console.log(JSON.stringify(publicBuild(build), null, 2));
    return build.ok ? 0 : 2;
  }
  if (options.command === 'up') {
    for (const key of ['seat', 'runId', 'profilePath', 'outDir', 'privateDir']) {
      if (!options[key]) throw new Error(`up requires --${key.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`).replace('-path', '')}`);
    }
    const { code, receipt } = await up(options);
    console.log(`isolated gateway: ${receipt.outcome} unit=${receipt.unit ?? 'none'} sha=${receipt.build?.commit ?? 'unknown'}`);
    for (const note of receipt.notes) console.log(`note: ${note}`);
    return code;
  }
  if (options.command === 'down') {
    if (!options.privateDir || !options.outDir) throw new Error('down requires --private-dir and --out');
    const { code, receipt } = await down(options);
    console.log(`isolated gateway teardown: ${receipt.outcome} unit=${receipt.unit ?? 'none'}`);
    for (const note of receipt.notes) console.log(`note: ${note}`);
    return code;
  }
  usage();
  return 64;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`isolated-gateway: ${error.message}`);
      process.exit(1);
    });
}
