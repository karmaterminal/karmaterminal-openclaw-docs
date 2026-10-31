// R-CD-RETURN-COVENANT-AUTHORITY: the disposable real-restart control, driven end to end
// against a scripted gateway process (helpers/return-covenant-scripted-gateway.mjs). The
// control, its process supervision, /proc fingerprints, HTTP probes, WebSocket client and
// read-only SQLite observer are the real code; only the gateway is scripted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RCC_RECEIPTS,
  gradeRestartControl,
  verifyObserverReceipt,
} from '../../lib/return-covenant-restart-control.mjs';
import { runRestartControl } from '../run-return-covenant-restart-control.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptedGateway = path.join(here, 'helpers', 'return-covenant-scripted-gateway.mjs');
const CANDIDATE = 'f15237ec921879d918482cdf372b0718d4c1aab9';
const DOCS = 'f17d784debae6eb1866d5c60c9518d06f49a3632';
const OBSERVER_KEY = 'rcc-test-observer-key-0123456789abcdef0123456789';
const TOKEN = 'rcc-test-gateway-token-abcdefghijklmnop';
const FAST_PLAN = Object.freeze({
  sampleIntervalMs: 40,
  preTriggerSamples: 3,
  bootTimeoutMs: 10_000,
  transitionDeadlineMs: 4_000,
  readinessDeadlineMs: 3_000,
  observationWindowMs: 4_500,
});

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function disposableLayout({ port, config = {}, identity = {}, buildInfo = {}, withKey = true } = {}) {
  const home = await mkdtemp(path.join(os.tmpdir(), 'rcc-home-'));
  const sha8 = CANDIDATE.slice(0, 8);
  const dir = path.join(home, 'proof-gw', `comp-${sha8}`);
  const resolvedPort = port ?? await freePort();
  await mkdir(path.join(dir, 'state'), { recursive: true, mode: 0o700 });
  await mkdir(path.join(dir, 'receipts'), { recursive: true });
  await writeFile(path.join(dir, 'receipts', 'identity.json'), JSON.stringify({
    pure_candidate_P: CANDIDATE,
    composite_runtime_C: CANDIDATE,
    unit: `openclaw-proof-comp-${sha8}`,
    port: resolvedPort,
    service: `test-proof-comp-${sha8}`,
    alt_model: 'openai/gpt-test',
    ...identity,
  }));
  await writeFile(path.join(dir, 'openclaw.json'), JSON.stringify({
    gateway: { mode: 'local', port: resolvedPort, bind: 'loopback', auth: { mode: 'token', token: TOKEN } },
    ...config,
  }));
  await chmod(path.join(dir, 'openclaw.json'), 0o600);
  const stage = path.join(home, 'stage');
  await mkdir(path.join(stage, 'dist'), { recursive: true });
  await copyFile(scriptedGateway, path.join(stage, 'dist', 'index.js'));
  await writeFile(path.join(stage, 'dist', 'build-info.json'), JSON.stringify({
    commit: CANDIDATE,
    buildId: 'rcc-test-build-id',
    ...buildInfo,
  }));
  const keyFile = path.join(home, 'observer.key');
  if (withKey) {
    await writeFile(keyFile, OBSERVER_KEY);
    await chmod(keyFile, 0o600);
  }
  return { home, dir, stage, keyFile, port: resolvedPort, artifactDir: path.join(home, 'artifacts', 'run') };
}

function controlOptions(layout, overrides = {}) {
  return {
    proofGwDir: layout.dir,
    stageDir: layout.stage,
    candidateSha: CANDIDATE,
    docsSha: DOCS,
    caseKind: 'positive',
    artifactDir: layout.artifactDir,
    observerKeyFile: layout.keyFile,
    home: layout.home,
    node: process.execPath,
    plan: FAST_PLAN,
    ...overrides,
  };
}

const testPlatform = Object.freeze({
  unitState: () => 'inactive',
  docsIdentity: () => ({ sha: DOCS, clean: true }),
});

function processGone(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

async function portFree(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

function postTrigger(record) {
  return record.observation.samples.filter((sample) => sample.atMs >= record.observation.triggerAtMs);
}

let positiveRun;
async function positive() {
  if (!positiveRun) {
    const layout = await disposableLayout();
    positiveRun = { layout, result: await runRestartControl(controlOptions(layout), testPlatform) };
  }
  return positiveRun;
}

test('positive: a real restart keeps the return authority through the gap and grades PASS-candidate', async () => {
  const { layout, result } = await positive();
  assert.equal(result.status, 'completed', JSON.stringify(result.grade, null, 2));
  const { record, grade } = result;
  assert.equal(grade.verdict, 'PASS-candidate', JSON.stringify(grade, null, 2));
  assert.deepEqual(grade.missingReceipts, []);
  for (const name of RCC_RECEIPTS) assert.equal(grade.receipts[name], 'present', name);

  const { old, replacement } = record.generations;
  assert.notEqual(old.pid, replacement.pid);
  assert.notEqual(old.listen.inode, replacement.listen.inode);
  assert.notEqual(old.bootIdSha256, replacement.bootIdSha256);
  assert.equal(old.listen.port, layout.port);
  assert.equal(replacement.listen.port, layout.port);
  assert.equal(old.exit.code, 0);
  assert.equal(record.transition.handoff.status, 'accepted');
  assert.equal(record.transition.handoff.pid, old.pid);
  assert.equal(record.transition.handoff.supervisorMode, 'external');
  assert.equal(record.transition.response.ok, true);
  assert.equal(record.transition.response.frame.payload.status, 'scheduled');

  // The authority generation is the same at every sample, including the gap with no listener.
  const gap = record.observation.samples.filter((sample) => sample.phase === 'awaiting-replacement');
  assert.ok(gap.length > 0, 'the matrix must observe the gap between generations');
  for (const sample of record.observation.samples) {
    assert.equal(sample.authority.state, 'present');
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
  }
  // The old generation stays the last usable authority until the replacement is ready.
  for (const sample of postTrigger(record)) {
    if (sample.atMs === replacement.readyAtMs) continue;
    assert.equal(sample.lastUsableGeneration, sample.atMs < replacement.readyAtMs ? 'old' : 'replacement');
  }
  assert.ok(record.observation.endAtMs - record.observation.triggerAtMs >= FAST_PLAN.observationWindowMs);

  // Cleanup stopped every generation and released the port.
  assert.equal(record.cleanup.completed, true);
  assert.ok(processGone(old.pid) && processGone(replacement.pid));
  assert.equal(await portFree(layout.port), true);

  // The public receipt is signed with the observer key and carries no private value.
  const receipt = JSON.parse(await readFile(path.join(layout.artifactDir, 'observer-receipt.json'), 'utf8'));
  assert.equal(verifyObserverReceipt(receipt, OBSERVER_KEY), true);
  assert.equal(verifyObserverReceipt({ ...receipt, grade: { ...receipt.grade, verdict: 'FAIL-candidate' } }, OBSERVER_KEY), false);
  assert.equal(verifyObserverReceipt(receipt, 'some-other-key-0123456789abcdef'), false);
  const text = JSON.stringify(receipt);
  for (const forbidden of [TOKEN, OBSERVER_KEY, layout.home, layout.dir, 'agent:main:rcc-']) {
    assert.equal(text.includes(forbidden), false, `public receipt leaks ${forbidden}`);
  }
  assert.ok(receipt.record.generations.replacement.stdout.tail.includes('[gateway] ready'));

  // Raw process output stays private, beside the public directory.
  const privateDir = `${layout.artifactDir}.private`;
  assert.ok(readFileSync(path.join(privateDir, 'replacement.stdout.log'), 'utf8').includes('[gateway] ready'));
  assert.ok(existsSync(path.join(privateDir, 'transition-response.json')));
});

test('negative: a replacement that never becomes usable keeps the old authority and the failure body and is not PASS', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(controlOptions(layout, { caseKind: 'negative-replacement-never-usable' }), testPlatform);
  assert.equal(result.status, 'completed');
  const { record, grade } = result;
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'replacement-never-usable'));
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl));

  const { old, replacement } = record.generations;
  assert.equal(replacement.started, true);
  assert.equal(replacement.readyAtMs, null);
  assert.equal(replacement.failure.kind, 'exited-before-ready');
  assert.equal(replacement.exit.code, 1);
  assert.match(replacement.stderr.tail, /EADDRINUSE/u);
  assert.ok(positiveIntegers(replacement.pid, replacement.startTicks));
  // The old generation's record and the authority survive to the end of the window.
  assert.ok(positiveIntegers(old.pid, old.startTicks, old.listen.inode));
  for (const sample of postTrigger(record)) {
    assert.equal(sample.lastUsableGeneration, 'old');
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
    assert.notEqual(sample.listener.owner, 'replacement');
  }
  assert.ok(record.transition.httpBodies.lastObservedNotReady);
  assert.equal(record.cleanup.completed, true);
  assert.equal(record.cleanup.blockerClosed, true);
  assert.ok(processGone(replacement.pid));
  assert.equal(await portFree(layout.port), true);
});

function positiveIntegers(...values) {
  return values.every((value) => Number.isSafeInteger(value) && value > 0);
}

function withoutReceipt(record, name) {
  const copy = structuredClone(record);
  if (name === 'transition-http-body') delete copy.transition.response;
  if (name === 'replacement-process-output') delete copy.generations.replacement.stderr;
  if (name === 'generation-fingerprints') copy.generations.old.startTicks = null;
  if (name === 'observation-record') copy.observation.samples = [];
  if (name === 'signed-cleanup-receipt') copy.observerKey = { available: false };
  return copy;
}

for (const name of RCC_RECEIPTS) {
  test(`missing receipt ${name}: grades PARTIAL or MISSING, never PASS`, async () => {
    const { result } = await positive();
    const grade = gradeRestartControl(withoutReceipt(result.record, name));
    assert.notEqual(grade.verdict, 'PASS-candidate');
    assert.ok(grade.missingReceipts.includes(name), JSON.stringify(grade.missingReceipts));
    // Without the window and matrix there is no claim to judge; any other lost receipt
    // leaves an observed, uncontradicted restart that is incomplete.
    assert.equal(
      grade.verdict,
      name === 'observation-record' ? 'MISSING-candidate' : 'PARTIAL-candidate',
      JSON.stringify(grade, null, 2),
    );
    assert.deepEqual(grade.failures, []);
  });
}

test('missing signing key end to end: the cleanup receipt is unsigned and the row is PARTIAL-candidate', async () => {
  const layout = await disposableLayout({ withKey: false });
  const result = await runRestartControl(controlOptions(layout, { observerKeyFile: undefined }), testPlatform);
  assert.equal(result.status, 'completed');
  assert.equal(result.grade.verdict, 'PARTIAL-candidate', JSON.stringify(result.grade, null, 2));
  assert.deepEqual(result.grade.missingReceipts, ['signed-cleanup-receipt']);
  const receipt = JSON.parse(await readFile(path.join(layout.artifactDir, 'observer-receipt.json'), 'utf8'));
  assert.equal(receipt.integrity, undefined);
});

test('rejected base: an observer that clears the current generation before the replacement is ready grades FAIL', async () => {
  const { result } = await positive();
  const record = structuredClone(result.record);
  const readyAt = record.generations.replacement.readyAtMs;
  let cleared = 0;
  for (const sample of record.observation.samples) {
    if (sample.atMs >= record.observation.triggerAtMs && sample.atMs < readyAt && sample.phase === 'awaiting-replacement') {
      sample.lastUsableGeneration = null;
      cleared += 1;
    }
  }
  assert.ok(cleared > 0);
  const grade = gradeRestartControl(record);
  assert.equal(grade.verdict, 'FAIL-candidate');
  assert.ok(grade.failures.some((entry) => entry.code === 'current-generation-cleared-before-replacement-ready'));
});

test('a replacement that advances the recipient authority at boot grades FAIL-candidate', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_ADVANCE_ON_BOOT: '2' } }),
    testPlatform,
  );
  assert.equal(result.status, 'completed');
  assert.equal(result.grade.verdict, 'FAIL-candidate', JSON.stringify(result.grade, null, 2));
  assert.ok(result.grade.failures.some((entry) => entry.code === 'authority-cleared-or-advanced'));
});

test('an old generation that exits without a restart handoff grades FAIL-candidate', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_NO_HANDOFF: '1' } }),
    testPlatform,
  );
  assert.equal(result.grade.verdict, 'FAIL-candidate', JSON.stringify(result.grade, null, 2));
  assert.ok(result.grade.failures.some((entry) => entry.code === 'restart-handoff-missing'));
  assert.equal(result.record.transition.handoff.status, 'none');
});

test('a replacement that listens but never reports ready grades FAIL and is stopped at cleanup', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_NEVER_READY_ON_BOOT: '2' } }),
    testPlatform,
  );
  const { record, grade } = result;
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'replacement-never-usable'));
  assert.equal(record.generations.replacement.failure.kind, 'not-ready-by-deadline');
  assert.equal(record.generations.replacement.failure.lastProbe.readyz.status, 503);
  assert.equal(record.generations.replacement.stoppedByCleanup, true);
  assert.ok(postTrigger(record).every((sample) => sample.lastUsableGeneration === 'old'));
  assert.ok(processGone(record.generations.replacement.pid));
  assert.equal(await portFree(layout.port), true);
});

test('an old generation that leaves a descendant behind is cleaned up and grades FAIL', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_ORPHAN: '1' } }),
    testPlatform,
  );
  const { record, grade } = result;
  assert.equal(record.cleanup.orphansTerminated.length, 1, JSON.stringify(record.cleanup));
  assert.deepEqual(record.cleanup.residualPids, []);
  assert.ok(processGone(record.cleanup.orphansTerminated[0]));
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'resource-retention'));
});

test('a restart whose response body is lost is still followed and grades PARTIAL-candidate', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_DROP_RESTART_RESPONSE: '1' } }),
    testPlatform,
  );
  const { record, grade } = result;
  assert.equal(record.transition.response, undefined);
  assert.match(record.transition.error, /closed-before-response|transport-error/u);
  assert.equal(record.transition.handoff.status, 'accepted');
  assert.ok(record.generations.replacement.readyAtMs);
  assert.equal(grade.verdict, 'PARTIAL-candidate', JSON.stringify(grade, null, 2));
  assert.deepEqual(grade.missingReceipts, ['transition-http-body']);
  assert.deepEqual(grade.failures, []);
});

test('a home reached through a symlink is still accepted', async () => {
  const layout = await disposableLayout();
  const linkedHome = `${layout.home}-link`;
  await symlink(layout.home, linkedHome);
  let spawned = 0;
  const result = await runRestartControl(
    controlOptions(layout, {
      home: linkedHome,
      proofGwDir: path.join(linkedHome, 'proof-gw', path.basename(layout.dir)),
      artifactDir: path.join(layout.home, 'artifacts', 'linked'),
    }),
    {
      ...testPlatform,
      spawnGateway: () => {
        spawned += 1;
        throw new Error('stop after the guard');
      },
    },
  );
  assert.equal(spawned, 1, JSON.stringify(result.refusals ?? result.grade));
  assert.equal(result.status, 'completed');
});

test('a rejected restart request keeps its failure body and grades MISSING-candidate', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_REJECT_RESTART: '1' } }),
    testPlatform,
  );
  assert.equal(result.grade.verdict, 'MISSING-candidate', JSON.stringify(result.grade, null, 2));
  assert.equal(result.record.transition.response.ok, false);
  assert.equal(result.record.transition.response.frame.error.message, 'restart refused by script');
  assert.equal(result.record.generations.replacement.started, false);
  assert.ok(processGone(result.record.generations.old.pid));
});

test('a refusal never writes into the live state or the docs repository', async () => {
  for (const [code, dirFor] of [
    ['artifact-dir-in-target', (layout) => path.join(layout.home, '.openclaw', 'rcc-run')],
    ['artifact-dir-in-repo', () => path.join(here, 'rcc-artifacts-must-not-exist')],
  ]) {
    const layout = await disposableLayout();
    const artifactDir = dirFor(layout);
    const result = await runRestartControl(controlOptions(layout, { artifactDir }), {
      ...testPlatform,
      spawnGateway: () => {
        throw new Error('the guard let a process start');
      },
    });
    assert.equal(result.status, 'refused');
    assert.ok(result.refusals.some((entry) => entry.code === code), JSON.stringify(result.refusals));
    assert.equal(result.refusalWritten, false);
    assert.equal(existsSync(artifactDir), false);
  }
});

test('negative control does not hold when the failure text is empty', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(controlOptions(layout, { caseKind: 'negative-replacement-never-usable' }), testPlatform);
  assert.equal(result.grade.negativeControl.holds, true);
  const record = structuredClone(result.record);
  const empty = { bytes: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', tail: '' };
  record.generations.replacement.stdout = empty;
  record.generations.replacement.stderr = empty;
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.negativeControl.failureBodyRetained, false);
  assert.equal(grade.negativeControl.holds, false);
});

test('a detached descendant left by the old generation is found by its marker, stopped and graded FAIL', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { gatewayEnv: { RCC_SCRIPT_ORPHAN: 'detached' } }),
    testPlatform,
  );
  const { record, grade } = result;
  assert.equal(record.cleanup.orphansTerminated.length, 1, JSON.stringify(record.cleanup));
  assert.deepEqual(record.cleanup.residualPids, []);
  assert.ok(processGone(record.cleanup.orphansTerminated[0]));
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'resource-retention'));
});

/* ---------------------------------------------------------------------------------- */
/* Guard: refuse to run against anything that is not a disposable proof-gw gateway     */
/* ---------------------------------------------------------------------------------- */

const guardCases = [
  {
    name: 'a directory outside $HOME/proof-gw',
    code: 'proof-gw-dir-outside-root',
    mutate: async (layout) => {
      const elsewhere = path.join(layout.home, 'elsewhere', path.basename(layout.dir));
      await mkdir(path.dirname(elsewhere), { recursive: true });
      await rm(elsewhere, { recursive: true, force: true });
      await copyTree(layout.dir, elsewhere);
      return { proofGwDir: elsewhere };
    },
  },
  {
    name: 'a comp-<sha8> symlink that points at another directory',
    code: 'proof-gw-dir-symlinked',
    mutate: async (layout) => {
      const real = path.join(layout.home, 'elsewhere', 'real-target');
      await mkdir(path.dirname(real), { recursive: true });
      await copyTree(layout.dir, real);
      await rm(layout.dir, { recursive: true });
      await symlink(real, layout.dir);
    },
  },
  {
    name: 'a directory not named comp-<sha8>',
    code: 'proof-gw-dir-name',
    mutate: async (layout) => {
      const renamed = path.join(layout.home, 'proof-gw', 'live');
      await copyTree(layout.dir, renamed);
      return { proofGwDir: renamed };
    },
  },
  {
    name: 'a missing proof-gw identity receipt',
    code: 'identity-missing',
    mutate: async (layout) => {
      await rm(path.join(layout.dir, 'receipts', 'identity.json'));
    },
  },
  {
    name: 'an identity that names another unit',
    code: 'identity-unit-mismatch',
    identity: { unit: 'openclaw-gateway' },
  },
  {
    name: 'the live gateway default port',
    code: 'port-is-live',
    port: 18789,
  },
  {
    name: 'the port named by the live ~/.openclaw config',
    code: 'port-is-live',
    mutate: async (layout) => {
      await mkdir(path.join(layout.home, '.openclaw'), { recursive: true });
      await writeFile(path.join(layout.home, '.openclaw', 'openclaw.json'), JSON.stringify({ gateway: { port: layout.port } }));
    },
  },
  {
    name: 'an isolated state that is the live state',
    code: 'state-dir-overlaps-live',
    mutate: async (layout) => {
      await mkdir(path.join(layout.home, '.openclaw'), { recursive: true });
      await rm(path.join(layout.dir, 'state'), { recursive: true });
      await symlink(path.join(layout.home, '.openclaw'), path.join(layout.dir, 'state'));
    },
  },
  {
    name: 'a port something already listens on',
    code: 'port-in-use',
    occupy: true,
  },
  {
    name: 'a proof-gw unit that is still running',
    code: 'unit-not-stopped',
    platform: { unitState: () => 'active' },
  },
  {
    name: 'a proof-gw unit that is still deactivating',
    code: 'unit-not-stopped',
    platform: { unitState: () => 'deactivating' },
  },
  {
    name: 'a proof-gw unit whose state cannot be read',
    code: 'unit-not-stopped',
    platform: { unitState: () => 'unknown' },
  },
  {
    name: 'a gateway environment that would move the credential store',
    code: 'gateway-env-not-allowed',
    mutate: async (layout) => ({ gatewayEnv: { OPENCLAW_AGENT_DIR: path.join(layout.home, '.openclaw', 'agents', 'main', 'agent') } }),
  },
  {
    name: 'NODE_OPTIONS that preloads code',
    code: 'gateway-env-not-allowed',
    mutate: async () => ({ gatewayEnv: { NODE_OPTIONS: '--max-old-space-size=4096 --require /tmp/x.js' } }),
  },
  {
    name: 'a config that carries channels',
    code: 'config-channels',
    config: { channels: { discord: { enabled: true } } },
  },
  {
    name: 'a non-loopback bind',
    code: 'config-bind-not-loopback',
    mutate: async (layout) => {
      const file = path.join(layout.dir, 'openclaw.json');
      const config = JSON.parse(await readFile(file, 'utf8'));
      config.gateway.bind = 'lan';
      await writeFile(file, JSON.stringify(config));
    },
  },
  {
    name: 'a stage built from another commit',
    code: 'stage-build-mismatch',
    buildInfo: { commit: '0'.repeat(40) },
  },
  {
    name: 'a candidate the proof-gw directory was not set up for',
    code: 'identity-runtime-mismatch',
    identity: { composite_runtime_C: '1'.repeat(40) },
  },
  {
    name: 'a docs SHA that is not the executing harness',
    code: 'docs-sha-mismatch',
    platform: { docsIdentity: () => ({ sha: '2'.repeat(40), clean: true }) },
  },
];

async function copyTree(from, to) {
  const { cp } = await import('node:fs/promises');
  await cp(from, to, { recursive: true });
}

for (const guard of guardCases) {
  test(`guard refuses ${guard.name} before starting any process`, async () => {
    const layout = await disposableLayout({
      port: guard.port,
      identity: guard.identity,
      config: guard.config,
      buildInfo: guard.buildInfo,
    });
    const overrides = (await guard.mutate?.(layout)) ?? {};
    let blocker = null;
    if (guard.occupy) {
      blocker = net.createServer();
      await new Promise((resolve) => blocker.listen(layout.port, '127.0.0.1', resolve));
    }
    let spawned = 0;
    try {
      const result = await runRestartControl(controlOptions(layout, overrides), {
        ...testPlatform,
        ...guard.platform,
        spawnGateway: () => {
          spawned += 1;
          throw new Error('the guard let a process start');
        },
      });
      assert.equal(result.status, 'refused');
      assert.ok(result.refusals.some((entry) => entry.code === guard.code), JSON.stringify(result.refusals));
      assert.equal(spawned, 0);
      const refusal = JSON.parse(await readFile(path.join(layout.artifactDir, 'refusal.json'), 'utf8'));
      assert.equal(refusal.processesStarted, 0);
      assert.equal(existsSync(path.join(layout.artifactDir, 'observer-receipt.json')), false);
      assert.equal(JSON.stringify(refusal).includes(TOKEN), false);
    } finally {
      await new Promise((resolve) => (blocker ? blocker.close(resolve) : resolve()));
    }
  });
}
