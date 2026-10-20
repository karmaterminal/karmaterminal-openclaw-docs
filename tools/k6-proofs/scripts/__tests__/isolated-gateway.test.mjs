import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  PROFILE_SCHEMA,
  environmentFile,
  evaluateBuildInfo,
  evaluateIsolation,
  publicConfigSummary,
  renderIsolatedConfig,
  systemdRunArgs,
  unitName,
  validateProfile,
} from '../../lib/isolated-gateway.mjs';
import { down, up } from '../isolated-gateway.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const cli = path.join(repoRoot, 'tools/k6-proofs/scripts/isolated-gateway.mjs');
const SHA = '7d8a1a91c6724367e5cd6f6d6ca0248af59c8ac0';
const PROVIDER_URL = 'http://10.11.12.13:8000/v1';

function profile(overrides = {}) {
  return {
    schema: PROFILE_SCHEMA,
    model: 'local/test-model',
    altModel: 'local/alt-model',
    models: { providers: { local: { baseUrl: PROVIDER_URL, api: 'openai-completions', apiKey: 'provider-secret-value', models: [] } } },
    continuation: { maxChainLength: 10, maxDelegatesPerTurn: 5, costCapTokens: 500000 },
    maxSpawnDepth: 2,
    otel: { endpoint: 'http://otel.example.invalid:4318' },
    ...overrides,
  };
}

function seatFixture({ buildId = `2026.10.3-${SHA.slice(0, 12)}-2026-10-15T10-00-00.000Z`, otel = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'k6-iso-test-'));
  const install = path.join(root, 'install');
  mkdirSync(path.join(install, 'dist'), { recursive: true });
  mkdirSync(path.join(install, 'packages', 'core', 'dist'), { recursive: true });
  if (otel) mkdirSync(path.join(install, 'extensions', 'diagnostics-otel', 'dist'), { recursive: true });
  writeFileSync(path.join(install, 'openclaw.mjs'), '// entry\n');
  writeFileSync(path.join(install, 'dist', 'build-info.json'), JSON.stringify({ version: '2026.10.3', commit: SHA, buildId, builtAt: '2026-10-15T10:00:00.000Z' }));
  const profilePath = path.join(root, 'profile.json');
  writeFileSync(profilePath, JSON.stringify(profile()));
  chmodSync(profilePath, 0o600);
  return { root, install, profilePath, out: path.join(root, 'out'), privateDir: path.join(root, 'private'), tmpRoot: path.join(root, 'tmp') };
}

/** A fake systemd user manager plus a fake gateway that serves the config it was given. */
function fakeSeat({ peers = [], serverBuildId = (sha) => `2026.10.3-${sha.slice(0, 12)}-x`, liveRestartDuringRun = false, mutateConfig = null } = {}) {
  const calls = [];
  const units = new Map();
  let live = { LoadState: 'loaded', ActiveState: 'active', MainPID: '4242', ActiveEnterTimestamp: 'Fri 2026-10-09 10:00:00 UTC', NRestarts: '0' };
  let envFile = null;
  const show = (fields) => ({ code: 0, stdout: Object.entries(fields).map(([k, v]) => `${k}=${v}`).join('\n') });
  const deps = {
    calls,
    home: '/nonexistent-home',
    exec(cmd, args) {
      calls.push([cmd, ...args]);
      if (cmd === 'systemd-run') {
        const unit = args.find((a) => a.startsWith('--unit=')).slice(7);
        envFile = args.find((a) => a.startsWith('--property=EnvironmentFile=')).slice(27);
        units.set(unit, 'active');
        if (liveRestartDuringRun) live = { ...live, MainPID: '5555', NRestarts: '1' };
        return { code: 0, stdout: '', stderr: '' };
      }
      const [, verb, unit] = args;
      if (verb === 'list-units') {
        return { code: 0, stdout: peers.map((p) => `${p} loaded active running proof`).join('\n') };
      }
      if (verb === 'show') {
        if (unit === 'openclaw-gateway.service') return show(live);
        const state = units.get(unit);
        return show({ LoadState: state ? 'loaded' : 'not-found', ActiveState: state ?? 'inactive', MainPID: state === 'active' ? '777' : '0', ActiveEnterTimestamp: '', NRestarts: '0' });
      }
      if (verb === 'stop') units.set(unit, 'inactive');
      return { code: 0, stdout: '', stderr: '' };
    },
    async fetch() {
      return { ok: [...units.values()].includes('active'), status: 200 };
    },
    async inspectTarget(ws, token) {
      const env = Object.fromEntries(readFileSync(envFile, 'utf8').trim().split('\n').map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 2, -1)];
      }));
      const cfg = JSON.parse(readFileSync(env.OPENCLAW_CONFIG_PATH, 'utf8'));
      if (token !== cfg.gateway.auth.token || ws !== `ws://127.0.0.1:${cfg.gateway.port}`) return { authenticated: false, error: 'gateway-auth-rejected' };
      const effective = mutateConfig ? mutateConfig(structuredClone(cfg)) : cfg;
      return {
        authenticated: true,
        config: { valid: true, config: effective, sourceConfig: cfg },
        responseIdentity: { buildId: serverBuildId(SHA), configRevisionHash: 'rev', appliedConfigHash: 'rev' },
      };
    },
    allocatePort: async () => 41234,
    portOpen: async () => [...units.values()].includes('active'),
    sleep: async () => {},
    now: () => new Date('2026-10-20T02:17:00Z'),
    randomToken: () => 'f'.repeat(64),
  };
  return deps;
}

function upOptions(fx, extra = {}) {
  return { seat: 'ronan', runId: '123-1', profilePath: fx.profilePath, outDir: fx.out, privateDir: fx.privateDir, installDir: fx.install, tmpRoot: fx.tmpRoot, node: '/usr/bin/node', peerWaitMs: 0, ...extra };
}

test('build identity: commit must be 40-hex and present in buildId', () => {
  assert.deepEqual(evaluateBuildInfo({ commit: SHA, buildId: `v-${SHA.slice(0, 12)}` }).notes, []);
  assert.deepEqual(evaluateBuildInfo({ commit: 'main', buildId: 'x' }).notes, ['build-info-commit-invalid']);
  assert.deepEqual(evaluateBuildInfo({ commit: SHA, buildId: 'custom-build' }).notes, ['build-info-buildid-lacks-commit']);
  assert.deepEqual(
    evaluateBuildInfo({ commit: SHA }, { packageDistCount: 0, otelDistPresent: false }).notes,
    ['package-dists-missing', 'diagnostics-otel-dist-missing'],
  );
});

test('profile: channels are refused and spawn depth must allow chained rows', () => {
  assert.deepEqual(validateProfile(profile()), []);
  const example = JSON.parse(readFileSync(path.join(repoRoot, 'tools/k6-proofs/examples/isolated-gateway-profile.example.json'), 'utf8'));
  assert.deepEqual(validateProfile(example), [], 'the documented example profile is valid');
  assert.ok(validateProfile(profile({ channels: { discord: {} } })).includes('profile-must-not-configure-channels'));
  assert.ok(validateProfile(profile({ maxSpawnDepth: 1 })).includes('profile-max-spawn-depth-invalid'));
  assert.ok(validateProfile(profile({ model: 'no-provider' })).includes('profile-model-invalid'));
});

test('isolated config has no channels, enables diagnostics-otel, and publishes nothing private', () => {
  const config = renderIsolatedConfig(profile(), { port: 41234, token: 't0ken-value', workspaceDir: '/tmp/x/workspace', seat: 'ronan' });
  assert.equal(config.channels, undefined);
  assert.equal(config.gateway.bind, 'loopback');
  assert.equal(config.plugins.entries['diagnostics-otel'].enabled, true);
  assert.equal(config.diagnostics.otel.serviceName, 'ronan-k6-isolated');
  const summary = JSON.stringify(publicConfigSummary(config));
  for (const secret of ['t0ken-value', 'provider-secret-value', PROVIDER_URL, 'otel.example.invalid', '/tmp/x']) {
    assert.ok(!summary.includes(secret), `summary leaks ${secret}`);
  }
  assert.match(summary, /"channels":"none"/u);
});

test('isolation check fails closed on a wrong build, enabled channels or disabled otel', () => {
  const config = renderIsolatedConfig(profile(), { port: 1, token: 't', workspaceDir: '/w', seat: 'ronan' });
  const rpc = (effective, buildId = `x-${SHA.slice(0, 12)}`) => ({
    authenticated: true,
    config: { config: effective, sourceConfig: config },
    responseIdentity: { buildId, configRevisionHash: 'a', appliedConfigHash: 'a' },
  });
  const expect = { expectedSha: SHA, expectedServiceName: 'ronan-k6-isolated', expectedDepth: 2 };
  assert.deepEqual(evaluateIsolation({ rpc: rpc(config), ...expect }).notes, []);
  assert.deepEqual(evaluateIsolation({ rpc: rpc(config, 'unknown'), ...expect }).notes, ['runtime-sha-not-observed']);
  assert.deepEqual(
    evaluateIsolation({ rpc: rpc({ ...config, channels: { discord: { enabled: true } } }), ...expect }).notes,
    ['channels-enabled:discord'],
  );
  const noOtel = structuredClone(config);
  noOtel.diagnostics.otel.enabled = false;
  assert.ok(evaluateIsolation({ rpc: rpc(noOtel), ...expect }).notes.includes('diagnostics-otel-config-disabled'));
  assert.deepEqual(evaluateIsolation({ rpc: { authenticated: false, error: 'config-get-rejected' }, ...expect }).notes, ['config-get-rejected']);
});

test('env file refuses values a shell or systemd would expand', () => {
  assert.equal(environmentFile({ A: 'x y', B: 2 }), 'A="x y"\nB="2"\n');
  for (const bad of ['$HOME', 'a`b`', 'a"b', 'a\\b', 'a\nb']) {
    assert.throws(() => environmentFile({ A: bad }));
  }
});

test('systemd-run argv: loopback, no token on the command line, RuntimeMaxSec backstop, channel env stripped', () => {
  const args = systemdRunArgs({ unit: 'u.service', envFile: '/p/env', rootDir: '/p', node: '/n', entry: '/i/openclaw.mjs', port: 9, runtimeMaxSec: 7200 });
  assert.ok(args.includes('--property=RuntimeMaxSec=7200'));
  assert.ok(args.some((a) => a.startsWith('--property=UnsetEnvironment=') && a.includes('DISCORD_BOT_TOKEN')));
  assert.deepEqual(args.slice(-8), ['/n', '/i/openclaw.mjs', 'gateway', 'run', '--port', '9', '--bind', 'loopback']);
  assert.ok(!args.some((a) => a.includes('--token')));
  assert.equal(unitName({ seat: 'ronan', runId: '123-1' }), 'openclaw-k6-iso-ronan-1231.service');
  assert.throws(() => unitName({ seat: 'Bad Seat', runId: '1' }));
});

test('up then down: READY on the exact build, private env stays private, seat left clean', async () => {
  const fx = seatFixture();
  try {
    const deps = fakeSeat();
    const started = await up(upOptions(fx, { expectedSha: SHA }), deps);
    assert.equal(started.code, 0, JSON.stringify(started.receipt.notes));
    assert.equal(started.receipt.outcome, 'READY');
    assert.equal(started.receipt.build.commit, SHA);
    assert.equal(started.receipt.sessionKey, 'agent:main:main');
    assert.equal(started.receipt.config.renderedEqualsPersisted, true);

    const envPath = path.join(fx.privateDir, 'isolated-gateway.env');
    assert.equal(statSync(envPath).mode & 0o777, 0o600);
    const env = readFileSync(envPath, 'utf8');
    assert.match(env, new RegExp(`OPENCLAW_RUNTIME_SHA="${SHA}"`, 'u'));
    assert.match(env, /OPENCLAW_GATEWAY_WS="ws:\/\/127\.0\.0\.1:41234"/u);
    assert.match(env, /OPENCLAW_GATEWAY_RESTART_CMD="systemctl --user restart openclaw-k6-iso-ronan-1231\.service"/u);
    assert.match(env, /OPENCLAW_SESSION_KEY="agent:main:main"/u);

    const published = readFileSync(path.join(fx.out, 'isolated-gateway.json'), 'utf8') +
      readFileSync(path.join(fx.out, 'isolated-config.summary.json'), 'utf8');
    for (const secret of ['f'.repeat(64), 'provider-secret-value', PROVIDER_URL, fx.tmpRoot, '4242']) {
      assert.ok(!published.includes(secret), `public receipt leaks ${secret}`);
    }
    const run = deps.calls.find((c) => c[0] === 'systemd-run');
    assert.ok(run.includes(path.join(fx.install, 'openclaw.mjs')), 'gateway runs from the seat install dir');

    const stopped = await down({ privateDir: fx.privateDir, outDir: fx.out }, deps);
    assert.equal(stopped.code, 0, JSON.stringify(stopped.receipt.notes));
    assert.deepEqual(
      [stopped.receipt.unitStopped, stopped.receipt.portClosed, stopped.receipt.liveGatewayUntouched, stopped.receipt.tempRootDeleted],
      [true, true, true, true],
    );
    assert.ok(!existsSync(envPath), 'private env removed at teardown');
    const again = await down({ privateDir: fx.privateDir, outDir: fx.out }, deps);
    assert.deepEqual([again.code, again.receipt.outcome], [0, 'CLEAN'], 'a second teardown reports the first');
    const fresh = await down({ privateDir: fx.privateDir, outDir: path.join(fx.root, 'other-out') }, deps);
    assert.equal(fresh.receipt.outcome, 'NOTHING-TO-TEAR-DOWN');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('up fails closed and tears down when the runtime SHA is not observed', async () => {
  const fx = seatFixture();
  try {
    const deps = fakeSeat({ serverBuildId: () => 'unknown' });
    const result = await up(upOptions(fx), deps);
    assert.equal(result.code, 2);
    assert.equal(result.receipt.outcome, 'NOT-READY');
    assert.ok(result.receipt.notes.includes('runtime-sha-not-observed'));
    assert.ok(deps.calls.some((c) => c[0] === 'systemctl' && c[2] === 'stop'), 'unit stopped');
    assert.ok(!existsSync(path.join(fx.privateDir, 'isolated-gateway.env')), 'no env handed to the suite');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('up fails closed when the gateway applies channels the profile never set', async () => {
  const fx = seatFixture();
  try {
    const deps = fakeSeat({ mutateConfig: (cfg) => ({ ...cfg, channels: { discord: { enabled: true } } }) });
    const result = await up(upOptions(fx), deps);
    assert.equal(result.code, 2);
    assert.ok(result.receipt.notes.includes('channels-enabled:discord'));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('up refuses before starting anything: missing otel dist, changed SHA, busy seat', async () => {
  const noOtel = seatFixture({ otel: false });
  const fx = seatFixture();
  try {
    let deps = fakeSeat();
    let result = await up(upOptions(noOtel), deps);
    assert.ok(result.receipt.notes.includes('diagnostics-otel-dist-missing'));
    assert.ok(!deps.calls.some((c) => c[0] === 'systemd-run'));

    deps = fakeSeat();
    result = await up(upOptions(fx, { expectedSha: 'a'.repeat(40) }), deps);
    assert.deepEqual(result.receipt.notes, ['build-info-commit-changed-since-resolve']);

    deps = fakeSeat({ peers: ['openclaw-k6-iso-ronan-999.service'] });
    result = await up(upOptions(fx), deps);
    assert.deepEqual(result.receipt.notes, ['another-isolated-baseline-active']);
    assert.ok(!deps.calls.some((c) => c[0] === 'systemd-run'));
  } finally {
    rmSync(noOtel.root, { recursive: true, force: true });
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('down reports DIRTY when the live gateway restarted during the run', async () => {
  const fx = seatFixture();
  try {
    const deps = fakeSeat({ liveRestartDuringRun: true });
    assert.equal((await up(upOptions(fx), deps)).code, 0);
    const result = await down({ privateDir: fx.privateDir, outDir: fx.out }, deps);
    assert.equal(result.code, 3);
    assert.equal(result.receipt.outcome, 'DIRTY');
    assert.deepEqual(result.receipt.notes, ['live-gateway-changed-during-run']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('resolve-build CLI reads the seat dist, never a branch', () => {
  const fx = seatFixture();
  try {
    const ok = spawnSync(process.execPath, [cli, 'resolve-build', '--install-dir', fx.install], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    const build = JSON.parse(ok.stdout);
    assert.equal(build.commit, SHA);
    assert.equal(build.privateInstallDir, undefined);
    const missing = spawnSync(process.execPath, [cli, 'resolve-build', '--install-dir', path.join(fx.root, 'nope')], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
    assert.deepEqual(JSON.parse(missing.stdout).notes, ['build-info-not-found']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a DIRTY teardown from up\'s failure path survives the workflow\'s own teardown step', async () => {
  const fx = seatFixture();
  try {
    const deps = fakeSeat({ liveRestartDuringRun: true, serverBuildId: () => 'unknown' });
    assert.equal((await up(upOptions(fx), deps)).code, 2);
    const result = await down({ privateDir: fx.privateDir, outDir: fx.out }, deps);
    assert.deepEqual([result.code, result.receipt.outcome], [3, 'DIRTY']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('a profile readable by others is refused before anything starts', async () => {
  const fx = seatFixture();
  try {
    chmodSync(fx.profilePath, 0o644);
    const deps = fakeSeat();
    const result = await up(upOptions(fx), deps);
    assert.deepEqual(result.receipt.notes, ['profile-readable-by-group-or-world']);
    assert.ok(!deps.calls.some((c) => c[0] === 'systemd-run'));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
