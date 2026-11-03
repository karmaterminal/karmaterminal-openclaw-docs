// R-CD-RETURN-COVENANT-AUTHORITY: the disposable real-restart control, driven end to end
// against a scripted gateway process (helpers/return-covenant-scripted-gateway.mjs). The
// control, its process supervision, /proc fingerprints, HTTP probes, WebSocket client and
// read-only SQLite observer are the real code; only the gateway is scripted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
// A namespace import, so a symbol a tree does not export yet fails only the test that reads it.
import * as rcc from '../../lib/return-covenant-restart-control.mjs';
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
// The spawned branch waits on the child's bind retries and the readiness wait's stopped-free
// exit before the original process restarts in-process, so its window is longer.
const SPAWNED_PLAN = Object.freeze({
  sampleIntervalMs: 40,
  preTriggerSamples: 3,
  bootTimeoutMs: 10_000,
  transitionDeadlineMs: 3_000,
  readinessDeadlineMs: 6_000,
  observationWindowMs: 7_000,
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

// 🌊's ruling: a generation is usable only while it owns the listener, /readyz passes and
// hello-ok answers. Recompute that from the raw sample fields, independently of the control.
function observedServing(sample) {
  const owner = sample.listener?.owner;
  return ['old', 'replacement'].includes(owner) &&
    sample.readyz?.status === 200 &&
    sample.readyz?.ready === true &&
    sample.hello?.ok === true
    ? owner
    : null;
}

// Strip hello-ok from the chosen samples, so they keep the listener and /readyz but stop serving.
function withoutHello(record, pick) {
  const copy = structuredClone(record);
  for (const sample of copy.observation.samples) {
    if (!pick(sample, copy)) continue;
    sample.hello = { ok: false, bootIdSha256: null, error: 'connect-failed' };
    sample.servingGeneration = null;
  }
  return copy;
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

  // The authority generation is the same at every sample, including the outage.
  for (const sample of record.observation.samples) {
    assert.equal(sample.authority.state, 'present');
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
  }
  // Usable means serving, observed per sample; no sample carries an observer-assigned
  // "last usable" label, and a serving listener belongs to that generation's exact process.
  for (const sample of record.observation.samples) {
    assert.equal('lastUsableGeneration' in sample, false, 'samples must not carry a last-usable label');
    assert.equal(sample.servingGeneration, observedServing(sample), JSON.stringify(sample));
    if (sample.servingGeneration) {
      const generation = record.generations[sample.servingGeneration];
      assert.equal(sample.listener.ownerPid, generation.pid);
      assert.equal(sample.listener.ownerStartTicks, generation.startTicks);
      assert.match(sample.hello.bootIdSha256, /^[0-9a-f]{64}$/u);
    }
  }
  // The outage: last serving old sample -> first serving replacement sample. Nothing serves in
  // between, though the epoch is unchanged there; the epoch alone is not usability.
  const outage = grade.outageInterval;
  assert.equal(outage.observed, true, JSON.stringify(outage));
  assert.equal(outage.lastServingBefore.generation, 'old');
  assert.equal(outage.firstServingAfter.generation, 'replacement');
  assert.equal(outage.open, false);
  assert.equal(outage.ms, outage.firstServingAfter.atMs - outage.lastServingBefore.atMs);
  assert.ok(outage.ms > 0);
  assert.equal(outage.resolutionMs, FAST_PLAN.sampleIntervalMs);
  const gap = record.observation.samples.filter((sample) =>
    sample.atMs > outage.lastServingBefore.atMs && sample.atMs < outage.firstServingAfter.atMs);
  assert.ok(gap.length > 0, 'the matrix must observe the outage between generations');
  assert.equal(outage.unservedSamples, gap.length);
  for (const sample of gap) {
    assert.equal(sample.servingGeneration, null);
    assert.equal(sample.phase, 'outage');
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
  }
  assert.ok(record.observation.endAtMs - record.observation.triggerAtMs >= FAST_PLAN.observationWindowMs);

  // Cleanup stopped every generation and released the port.
  assert.equal(record.cleanup.completed, true);
  assert.ok(processGone(old.pid) && processGone(replacement.pid));
  assert.equal(await portFree(layout.port), true);

  // The public receipt is signed with the observer key and carries no private value.
  const receipt = JSON.parse(await readFile(path.join(layout.artifactDir, 'observer-receipt.json'), 'utf8'));
  assert.equal(verifyObserverReceipt(receipt, OBSERVER_KEY), true);
  assert.deepEqual(receipt.grade.outageInterval, outage, 'the signed receipt reports the outage interval');
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

// 🌻's negative: a supervised replacement that never serves (the row's own negative).
let supervisedNegativeRun;
async function supervisedNegative() {
  if (!supervisedNegativeRun) {
    const layout = await disposableLayout();
    supervisedNegativeRun = {
      layout,
      result: await runRestartControl(controlOptions(layout, { caseKind: 'negative-replacement-never-usable' }), testPlatform),
    };
  }
  return supervisedNegativeRun;
}

test('negative: a replacement that never becomes usable keeps the old authority and the failure body and is not PASS', async () => {
  const { layout, result } = await supervisedNegative();
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
  assert.match(replacement.stderr.tail, /another gateway instance is already listening on ws:\/\/127\.0\.0\.1:\d+/u);
  assert.ok(positiveIntegers(replacement.pid, replacement.startTicks));
  // The old generation's fingerprint and the authority epoch survive to the end of the window,
  // but nothing is usable after the old generation exits: this supervised branch has no
  // in-process fallback, so the outage never closes.
  assert.ok(positiveIntegers(old.pid, old.startTicks, old.listen.inode));
  for (const sample of postTrigger(record)) {
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
    assert.notEqual(sample.listener.owner, 'replacement');
  }
  const afterExit = record.observation.samples.filter((sample) => sample.atMs > old.exitedAtMs);
  assert.ok(afterExit.length > 0);
  assert.ok(afterExit.every((sample) => sample.servingGeneration === null));
  assert.equal(grade.outageInterval.lastServingBefore.generation, 'old');
  assert.equal(grade.outageInterval.firstServingAfter, null);
  assert.equal(grade.outageInterval.open, true);
  assert.equal(grade.outageInterval.ms, null);
  assert.equal(grade.negativeControl.noFallback, true);
  assert.equal(grade.fallback.branch, 'none-on-supervised-branch');
  assert.ok(record.transition.httpBodies.lastObservedNotReady);
  assert.equal(record.cleanup.completed, true);
  assert.equal(record.cleanup.blockerClosed, true);
  assert.ok(processGone(replacement.pid));
  assert.equal(await portFree(layout.port), true);
});

function positiveIntegers(...values) {
  return values.every((value) => Number.isSafeInteger(value) && value > 0);
}

/* ---------------------------------------------------------------------------------- */
/* Update-respawn controls: update.run on an unmanaged gateway (the spawned branch).    */
/* 🌊's final ruling: a distinct control, never evidence for the fleet restart claim.    */
/* ---------------------------------------------------------------------------------- */

const SUPERVISOR_HINTS = ['OPENCLAW_SUPERVISOR_MODE', 'OPENCLAW_SYSTEMD_UNIT', 'INVOCATION_ID', 'SYSTEMD_EXEC_PID', 'JOURNAL_STREAM', 'OPENCLAW_SERVICE_MARKER', 'OPENCLAW_SERVICE_KIND', 'OPENCLAW_NO_RESPAWN'];

let spawnedRun;
async function spawnedFallback() {
  if (!spawnedRun) {
    const layout = await disposableLayout();
    spawnedRun = {
      layout,
      result: await runRestartControl(controlOptions(layout, { caseKind: 'control-update-respawn-fallback', plan: SPAWNED_PLAN }), testPlatform),
    };
  }
  return spawnedRun;
}

test('control-update-respawn-fallback: an unmanaged gateway restarted with update.run takes the spawned branch', async () => {
  const { result } = await spawnedFallback();
  assert.equal(result.status, 'completed', JSON.stringify(result.refusals ?? null));
  const { record } = result;
  // Neither OPENCLAW_SUPERVISOR_MODE nor any systemd hint, read back from the running old
  // generation's /proc environ (keys only), and the update-process reason on the request.
  assert.equal(record.target.supervisorMode, 'unmanaged');
  assert.equal(record.target.restartBranch, 'spawned');
  assert.deepEqual(record.generations.old.supervisorHints, []);
  assert.deepEqual(record.target.supervisorHintKeys, SUPERVISOR_HINTS);
  assert.equal(record.transition.request.params.reason, 'update.run');
  assert.equal(record.transition.response.ok, true);
  // The product spawned a child of the old generation, not the control.
  const child = record.fallback.child;
  assert.ok(positiveIntegers(child.pid, child.startTicks), JSON.stringify(child));
  assert.equal(child.pidSource, 'proc');
  assert.equal(child.ppid, record.generations.old.pid);
  assert.notEqual(child.pid, record.generations.old.pid);
  assert.equal(record.generations.replacement.spawnedBy, 'product');
  assert.equal(record.generations.replacement.pid, child.pid);
  assert.equal(record.fallback.outputChannel, 'inherited-by-old-generation');
});

test('control-update-respawn-fallback: the child never serves, the diagnostic and frame survive, the original process serves again, non-PASS', async () => {
  const { layout, result } = await spawnedFallback();
  const { record, grade } = result;
  const { old } = record.generations;
  const child = record.fallback.child;
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'replacement-never-usable'));
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));
  assert.equal(grade.fallback.branch, 'restored');
  assert.equal(grade.fallback.class, 'old-process-restoration');
  assert.equal(grade.receipts['generation-fingerprints'], 'present');
  assert.equal(grade.receipts['replacement-process-output'], 'present');

  // The control held the port from the old listener's close until the child was gone.
  const blocker = record.fallback.blocker;
  assert.equal(blocker.bound, true);
  assert.ok(blocker.boundAtMs >= record.fallback.oldListenerClosedAtMs);
  assert.equal(blocker.releasedOn, 'replacement-exited');
  assert.ok(blocker.releasedAtMs >= child.goneAtMs);
  assert.ok(record.observation.samples.every((sample) => sample.servingGeneration !== 'replacement'));

  // Failure diagnostic: the product's own line, naming the child, plus the child's bind
  // failure and the restart frame body.
  const lines = record.fallback.diagnostics.map((entry) => entry.line);
  assert.ok(lines.some((line) => line.includes(`update respawn child did not become healthy (${child.pid}); falling back to in-process restart`)), JSON.stringify(lines));
  assert.ok(lines.some((line) => /another gateway instance is already listening on ws:\/\/127\.0\.0\.1:\d+/u.test(line)));
  assert.equal(record.transition.response.frame.payload.status, 'scheduled');

  // The original PID and start ticks own the listener again, /readyz and hello-ok pass, on a
  // new socket, and keep doing so to the end of the window.
  assert.equal(old.restored.sameProcess, true);
  assert.equal(old.restored.listen.port, layout.port);
  assert.notEqual(old.restored.listen.inode, old.listen.inode);
  assert.match(old.restored.bootIdSha256, /^[0-9a-f]{64}$/u);
  const outage = grade.outageInterval;
  assert.equal(outage.lastServingBefore.generation, 'old');
  assert.equal(outage.firstServingAfter.generation, 'old');
  assert.equal(outage.firstServingAfter.ownerPid, old.pid);
  assert.equal(outage.open, false);
  assert.ok(outage.ms > 0);
  assert.equal(outage.ms, outage.firstServingAfter.atMs - outage.lastServingBefore.atMs);
  const servingAgain = record.observation.samples.filter((sample) => sample.atMs >= outage.firstServingAfter.atMs);
  assert.ok(servingAgain.length > 0);
  for (const sample of servingAgain) {
    assert.equal(sample.servingGeneration, 'old');
    assert.equal(sample.listener.ownerPid, old.pid);
    assert.equal(sample.listener.ownerStartTicks, old.startTicks);
    assert.equal(sample.listener.inode, old.restored.listen.inode);
    assert.equal(sample.readyz.status, 200);
    assert.equal(sample.hello.ok, true);
  }
  // The epoch is the same at every sample, through the outage too.
  for (const sample of record.observation.samples) {
    assert.equal(sample.authority.state, 'present');
    assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
  }
  // Restoration is not a fresh successor: the old generation never exited during the window.
  assert.equal(old.exitedAtMs, null);
  assert.equal(old.stoppedByCleanup, true);
});

test('control-update-respawn-fallback: cleanup stops the restored original process and leaves no child, port or orphan behind', async () => {
  const { layout, result } = await spawnedFallback();
  const { record } = result;
  assert.equal(record.cleanup.completed, true);
  assert.equal(record.cleanup.blockerClosed, true);
  assert.deepEqual(record.cleanup.orphansTerminated, []);
  assert.deepEqual(record.cleanup.residualPids, []);
  assert.ok(processGone(record.generations.old.pid));
  assert.ok(processGone(record.fallback.child.pid));
  assert.equal(await portFree(layout.port), true);
  const receipt = JSON.parse(await readFile(path.join(layout.artifactDir, 'observer-receipt.json'), 'utf8'));
  assert.equal(verifyObserverReceipt(receipt, OBSERVER_KEY), true);
  assert.equal(receipt.grade.fallback.branch, 'restored');
  assert.equal(receipt.grade.negativeControl.holds, true);
  assert.deepEqual(receipt.grade.outageInterval, result.grade.outageInterval);
  const text = JSON.stringify(receipt);
  for (const forbidden of [TOKEN, OBSERVER_KEY, layout.home, layout.dir]) {
    assert.equal(text.includes(forbidden), false, `public receipt leaks ${forbidden}`);
  }
});

test('control-update-respawn-fallback: a helper child of the old generation is not mistaken for the respawned gateway', async () => {
  // The product's gateway starts helpers (the codex app server, plugin workers) that inherit its
  // environment, run marker included. Only the respawned gateway invocation is the replacement.
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { caseKind: 'control-update-respawn-fallback', plan: SPAWNED_PLAN, gatewayEnv: { RCC_SCRIPT_HELPER: '1' } }),
    testPlatform,
  );
  const { record, grade } = result;
  const child = record.fallback.child;
  assert.equal(child.invocation, 'gateway', JSON.stringify(child));
  assert.equal(child.reportedPid, String(child.pid), 'the tracked child is the one the product names');
  assert.equal(record.fallback.blocker.releasedOn, 'replacement-exited', JSON.stringify(record.fallback.blocker));
  assert.equal(grade.fallback.branch, 'restored', JSON.stringify(grade.fallback));
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));
  assert.deepEqual(record.cleanup.orphansTerminated, []);
  assert.equal(await portFree(layout.port), true);
});

test('control-update-respawn-fallback: without the product fallback diagnostic the negative does not hold', async () => {
  const { result } = await spawnedFallback();
  const record = structuredClone(result.record);
  record.fallback.diagnostics = record.fallback.diagnostics.filter((entry) => !/did not become healthy/u.test(entry.line));
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.negativeControl.failureDiagnosticRetained, false);
  assert.equal(grade.negativeControl.holds, false);
});

/* ---------------------------------------------------------------------------------- */
/* Named non-PASS branches: each blocks the fallback and grades failure or limit        */
/* ---------------------------------------------------------------------------------- */

// The branches the control cannot induce on a disposable gateway, driven through the scripted
// gateway with the product's diagnostic and exit code (run-loop.ts:266-360).
const SCRIPTED_BRANCHES = [
  { branch: 'require-fresh-process', class: 'limit', exitCode: 1 },
  { branch: 'foreground-closed', class: 'limit', exitCode: 1 },
  { branch: 'installation-replaced', class: 'limit', exitCode: 1 },
  { branch: 'lock-reacquire-failed', class: 'failure', exitCode: 1 },
  { branch: 'resources-retained', class: 'limit', exitCode: 0 },
];

for (const expected of SCRIPTED_BRANCHES) {
  test(`fallback blocked by ${expected.branch}: graded ${expected.class}, never PASS, and the original process does not serve again`, async () => {
    const layout = await disposableLayout();
    const result = await runRestartControl(
      controlOptions(layout, { caseKind: 'control-update-respawn-fallback', plan: SPAWNED_PLAN, gatewayEnv: { RCC_SCRIPT_FALLBACK_BLOCK: expected.branch } }),
      testPlatform,
    );
    assert.equal(result.status, 'completed', JSON.stringify(result.refusals ?? null));
    const { record, grade } = result;
    assert.notEqual(grade.verdict, 'PASS-candidate');
    assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
    assert.equal(grade.fallback.branch, expected.branch, JSON.stringify(grade.fallback));
    assert.equal(grade.fallback.class, expected.class);
    const bucket = expected.class === 'limit' ? grade.limits : grade.failures;
    assert.ok(bucket.some((entry) => entry.code === `fallback-${expected.branch}`), JSON.stringify({ limits: grade.limits, failures: grade.failures }));
    assert.equal(grade.negativeControl.originalProcessServesAgain, false);
    assert.equal(grade.negativeControl.holds, false);
    assert.equal(grade.outageInterval.open, true);
    assert.equal(record.generations.old.exit.code, expected.exitCode);
    assert.ok(Number.isFinite(record.generations.old.exitedAtMs));
    assert.equal(record.cleanup.completed, true);
    assert.deepEqual(record.cleanup.orphansTerminated, []);
    assert.equal(await portFree(layout.port), true);
  });
}

let runtimeUnavailableRun;
async function runtimeUnavailable() {
  if (!runtimeUnavailableRun) {
    const layout = await disposableLayout();
    runtimeUnavailableRun = {
      layout,
      result: await runRestartControl(
        controlOptions(layout, { caseKind: 'control-update-respawn-runtime-unavailable', plan: SPAWNED_PLAN }),
        testPlatform,
      ),
    };
  }
  return runtimeUnavailableRun;
}

test('control-update-respawn-runtime-unavailable: the control removes its own runtime copy, the product names the branch, and it grades a limit', async () => {
  const { layout, result } = await runtimeUnavailable();
  assert.equal(result.status, 'completed', JSON.stringify(result.refusals ?? null));
  const { record, grade } = result;
  const runtime = record.fallback.runtime;
  assert.equal(runtime.copied, true);
  assert.match(runtime.sha256, /^[0-9a-f]{64}$/u);
  // The copy is gone before the trigger time is read (possibly in the same millisecond).
  assert.ok(runtime.unlinkedAtMs <= record.observation.triggerAtMs);
  assert.equal(existsSync(path.join(`${layout.artifactDir}.private`, 'runtime', 'node')), false);
  assert.deepEqual(record.generations.old.supervisorHints, []);
  assert.equal(record.fallback.child.reportedPid, 'unknown');
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.equal(grade.fallback.branch, 'child-runtime-unavailable');
  assert.equal(grade.fallback.class, 'limit');
  assert.ok(grade.limits.some((entry) => entry.code === 'fallback-child-runtime-unavailable'));
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));
  assert.equal(record.generations.old.exit.code, 1);
  assert.equal(grade.outageInterval.open, true);
  assert.equal(grade.outageInterval.lastServingBefore.generation, 'old');
  const lines = record.fallback.diagnostics.map((entry) => entry.line);
  assert.ok(lines.some((line) => line.includes('update respawn child did not become healthy (unknown); falling back to in-process restart')), JSON.stringify(lines));
  assert.ok(lines.some((line) => line.includes('Fresh-process restart failed; the unavailable child runtime cannot recover in-process')));
  for (const sample of record.observation.samples) assert.equal(sample.authority.epochSha256, record.authority.epochSha256);
  assert.equal(await portFree(layout.port), true);
});

test('a restart that never reaches the spawned branch is not the fallback proof: in-process restart grades not-exercised, never PASS', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { caseKind: 'control-update-respawn-fallback', plan: SPAWNED_PLAN, gatewayEnv: { RCC_SCRIPT_IGNORE_UPDATE_REASON: '1' } }),
    testPlatform,
  );
  const { grade } = result;
  assert.equal(grade.fallback.branch, 'in-process-restart', JSON.stringify(grade.fallback));
  assert.equal(grade.fallback.class, 'not-exercised');
  assert.equal(grade.verdict, 'MISSING-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.missingBehaviour.some((entry) => entry.code === 'negative-not-exercised'));
  assert.equal(grade.negativeControl.holds, false);
  assert.equal(grade.negativeControl.spawnedBranchTaken, false);
});

test('every named branch grades failure or limit from its product diagnostic alone, never PASS', async () => {
  const { result } = await spawnedFallback();
  const lines = {
    'require-fresh-process': 'Fresh-process restart failed; the unsettled native worker cannot recover in-process. Exiting through the verified service owner.',
    'child-runtime-unavailable': 'Fresh-process restart failed; the unavailable child runtime cannot recover in-process. Restart through the service owner after repairing its runtime.',
    'foreground-closed': 'update respawn child did not become healthy (4242); shutdown pending; retaining the replacement until it closes; inspect its startup logs',
    'installation-replaced': 'update respawn child did not become healthy (4242); the replaced runtime cannot resume',
    'lock-reacquire-failed': 'failed to reacquire gateway lock for in-process restart: failed to acquire gateway state ownership',
    'resources-retained': 'shutdown resources remain; refusing in-process restart and exiting',
  };
  assert.deepEqual(rcc.RCC_FALLBACK_BRANCHES.map((entry) => entry.branch).sort(), Object.keys(lines).sort());
  for (const named of rcc.RCC_FALLBACK_BRANCHES) {
    const record = structuredClone(result.record);
    record.fallback.diagnostics.push({ stream: 'stderr', line: `[gateway] ${lines[named.branch]}` });
    const grade = gradeRestartControl(record);
    assert.notEqual(grade.verdict, 'PASS-candidate', named.branch);
    assert.equal(grade.fallback.branch, named.branch);
    assert.equal(grade.fallback.class, named.class);
    assert.ok(['limit', 'failure'].includes(named.class));
    assert.match(named.anchor, /^src\/cli\/gateway-cli\/run-loop\.ts:\d+/u);
    const bucket = named.class === 'limit' ? grade.limits : grade.failures;
    assert.ok(bucket.some((entry) => entry.code === `fallback-${named.branch}`), named.branch);
    assert.equal(grade.negativeControl.holds, false, named.branch);
  }
  // Only lock-reacquire is the fallback itself failing; the rest are the product declining an
  // in-process recovery its preconditions do not allow (the runtime is not viable, or replaced).
  assert.deepEqual(rcc.RCC_FALLBACK_BRANCHES.filter((entry) => entry.class === 'failure').map((entry) => entry.branch), ['lock-reacquire-failed']);
});

/* ---------------------------------------------------------------------------------- */
/* Independent-review findings                                                          */
/* ---------------------------------------------------------------------------------- */

// Splice a transient blip in right after the trigger: the old generation, still on its original
// socket, serves, misses one hello-ok, and serves again before it closes.
function withBlipAfterTrigger(record) {
  const copy = structuredClone(record);
  const triggerAtMs = copy.observation.triggerAtMs;
  const template = [...copy.observation.samples].reverse().find((sample) => sample.atMs < triggerAtMs && sample.servingGeneration === 'old');
  const at = (offset, serving) => {
    const sample = structuredClone(template);
    sample.atMs = triggerAtMs + offset;
    sample.phase = serving ? 'old-serving' : 'outage';
    if (!serving) sample.hello = { ok: false, bootIdSha256: null, error: 'call-timeout' };
    sample.servingGeneration = serving ? 'old' : null;
    return sample;
  };
  copy.observation.samples.push(at(0.25, true), at(0.5, false), at(0.75, true));
  return copy;
}

test('a transient blip while the old generation still serves is not the outage (positive)', async () => {
  const { result } = await positive();
  const record = withBlipAfterTrigger(result.record);
  const grade = gradeRestartControl(record);
  assert.equal(grade.verdict, 'PASS-candidate', JSON.stringify(grade, null, 2));
  assert.equal(grade.outageInterval.firstServingAfter.generation, 'replacement', JSON.stringify(grade.outageInterval));
  assert.equal(grade.outageInterval.lastServingBefore.generation, 'old');
  // The outage starts after the old generation's last serving sample on its original socket.
  assert.ok(grade.outageInterval.lastServingBefore.atMs >= record.observation.triggerAtMs + 0.75);
  assert.equal(grade.outageInterval.firstServingAfter.atMs, gradeRestartControl(result.record).outageInterval.firstServingAfter.atMs);
});

test('a transient blip before the old server closes does not turn the spawned fallback into restoration-unstable', async () => {
  const { result } = await spawnedFallback();
  const grade = gradeRestartControl(withBlipAfterTrigger(result.record));
  assert.equal(grade.fallback.branch, 'restored', JSON.stringify(grade.fallback));
  assert.equal(grade.outageInterval.firstServingAfter.generation, 'old');
  assert.notEqual(grade.outageInterval.firstServingAfter.listenerInode, result.record.generations.old.listen.inode);
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));
});

test('a positive whose first serving generation after the outage is not the replacement is not PASS', async () => {
  const { result } = await positive();
  const record = structuredClone(result.record);
  // The old process serving again on a new socket in the middle of the outage is not a
  // replacement, whatever the replacement does later.
  const { old } = record.generations;
  const outage = gradeRestartControl(record).outageInterval;
  const middle = record.observation.samples.find((sample) => sample.atMs > outage.lastServingBefore.atMs && sample.atMs < outage.firstServingAfter.atMs);
  Object.assign(middle, {
    listener: { ...middle.listener, owner: 'old', inode: old.listen.inode + 1, ownerPid: old.pid, ownerStartTicks: old.startTicks },
    readyz: { ...middle.readyz, status: 200, ready: true },
    hello: { ok: true, bootIdSha256: 'a'.repeat(64), error: null },
    servingGeneration: 'old',
  });
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.outageInterval.firstServingAfter.generation, 'old');
  assert.ok(grade.partials.some((entry) => entry.code === 'outage-misattributed') || grade.failures.length > 0, JSON.stringify(grade, null, 2));
});

test('restoration on the original socket, or without the control\'s same-process check, is not "restored"', async () => {
  const { result } = await spawnedFallback();
  const sameSocket = structuredClone(result.record);
  const outage = gradeRestartControl(sameSocket).outageInterval;
  for (const sample of sameSocket.observation.samples) {
    if (sample.atMs >= outage.firstServingAfter.atMs) sample.listener.inode = sameSocket.generations.old.listen.inode;
  }
  const sameSocketGrade = gradeRestartControl(sameSocket);
  assert.notEqual(sameSocketGrade.fallback.branch, 'restored', JSON.stringify(sameSocketGrade.fallback));
  assert.equal(sameSocketGrade.negativeControl.holds, false);

  const unverified = structuredClone(result.record);
  delete unverified.generations.old.restored;
  const unverifiedGrade = gradeRestartControl(unverified);
  assert.notEqual(unverifiedGrade.fallback.branch, 'restored', JSON.stringify(unverifiedGrade.fallback));
  assert.equal(unverifiedGrade.negativeControl.holds, false);
});

test('a tracked child that is not the child the product named is a mismatch, and the negative does not hold', async () => {
  const { result } = await spawnedFallback();
  const record = structuredClone(result.record);
  record.fallback.child.pid += 1;
  record.generations.replacement.pid = record.fallback.child.pid;
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.ok(grade.partials.some((entry) => entry.code === 'child-identity-mismatch'), JSON.stringify(grade.partials));
  assert.equal(grade.negativeControl.holds, false);
});

test('control-update-respawn-fallback: a gateway-looking helper alive before the trigger is not the respawned child', async () => {
  const layout = await disposableLayout();
  const result = await runRestartControl(
    controlOptions(layout, { caseKind: 'control-update-respawn-fallback', plan: SPAWNED_PLAN, gatewayEnv: { RCC_SCRIPT_HELPER: 'boot' } }),
    testPlatform,
  );
  const { record, grade } = result;
  assert.equal(record.fallback.child.reportedPid, String(record.fallback.child.pid), JSON.stringify(record.fallback.child));
  assert.equal(record.fallback.child.pidSource, 'proc');
  assert.equal(record.fallback.blocker.releasedOn, 'replacement-exited', JSON.stringify(record.fallback.blocker));
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));
  assert.deepEqual(record.cleanup.orphansTerminated, []);
});

test('a negative case never grades PASS: a clean positive record relabelled as a negative is MISSING', async () => {
  const { result } = await positive();
  const record = structuredClone(result.record);
  record.case = 'negative-replacement-never-usable';
  const grade = gradeRestartControl(record);
  assert.equal(grade.verdict, 'MISSING-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.missingBehaviour.some((entry) => entry.code === 'negative-not-exercised'));
  assert.equal(grade.negativeControl.holds, false);
});

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

test('usable means serving: an old generation whose hello-ok never answered did not serve before the transition', async () => {
  const { result } = await positive();
  const record = withoutHello(result.record, (sample, copy) => sample.atMs < copy.observation.triggerAtMs);
  // Listener and /readyz alone still look fine; only hello-ok is gone.
  const pre = record.observation.samples.filter((sample) => sample.atMs < record.observation.triggerAtMs);
  assert.ok(pre.every((sample) => sample.listener.owner === 'old' && sample.readyz.status === 200));
  const grade = gradeRestartControl(record);
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'old-not-serving-before-transition'));
});

test('usable means serving: a replacement whose hello-ok never answered is not a serving successor', async () => {
  const { result } = await positive();
  const record = withoutHello(result.record, (sample) => sample.listener.owner === 'replacement');
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.ok(grade.failures.some((entry) => entry.code === 'replacement-unstable'));
  assert.equal(grade.outageInterval.firstServingAfter, null);
  assert.equal(grade.outageInterval.open, true);
});

test('usable is observed, not labelled: PASS needs no observer-assigned last-usable generation', async () => {
  const { result } = await positive();
  const record = structuredClone(result.record);
  for (const sample of record.observation.samples) delete sample.lastUsableGeneration;
  const grade = gradeRestartControl(record);
  assert.equal(grade.verdict, 'PASS-candidate', JSON.stringify(grade, null, 2));
  // A label claiming the old generation during the outage changes nothing either.
  const labelled = structuredClone(record);
  for (const sample of labelled.observation.samples) sample.lastUsableGeneration = 'old';
  assert.deepEqual(gradeRestartControl(labelled).outageInterval, grade.outageInterval);
});

test('an unchanged epoch through the outage is not usability: the outage interval counts it as unserved', async () => {
  const { result } = await positive();
  const { record } = result;
  const grade = gradeRestartControl(record);
  const outage = grade.outageInterval;
  const during = record.observation.samples.filter((sample) =>
    sample.atMs > outage.lastServingBefore.atMs && sample.atMs < outage.firstServingAfter.atMs);
  assert.ok(during.length > 0);
  assert.ok(during.every((sample) => sample.authority.state === 'present' && sample.authority.epochSha256 === record.authority.epochSha256));
  assert.ok(during.every((sample) => sample.servingGeneration === null));
  // Moving the replacement's first serving sample later lengthens the outage one-for-one.
  const later = structuredClone(record);
  const first = later.observation.samples.find((sample) => sample.atMs === outage.firstServingAfter.atMs);
  first.hello = { ok: false, bootIdSha256: null, error: 'connect-failed' };
  first.servingGeneration = null;
  const next = later.observation.samples.find((sample) => sample.atMs > first.atMs && sample.servingGeneration === 'replacement');
  assert.equal(gradeRestartControl(later).outageInterval.ms, next.atMs - outage.lastServingBefore.atMs);
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
  assert.ok(postTrigger(record).every((sample) => sample.servingGeneration !== 'replacement'));
  assert.equal(grade.outageInterval.open, true);
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
/* The row verdict. 🌊's final scope ruling (Discord msg 1565927316687691777): the row  */
/* claims the supervised branch, graded from positive and negative-replacement-never-   */
/* usable only; the update-respawn controls sit beside it and never feed it.            */
/* ---------------------------------------------------------------------------------- */

// The row verdict without the control receipts reported beside it.
function rowPart(rowGrade) {
  const { controls: _controls, ...row } = rowGrade;
  return row;
}

// The worst case a control can present: the positive's own PASS grade, relabelled as an
// update-respawn control. No real control grades PASS; the row verdict must ignore it anyway.
function passingControl(positiveResult, caseKind, kind = 'update-respawn-control') {
  return { case: caseKind, kind, candidateSha: CANDIDATE, docsSha: DOCS, grade: structuredClone(positiveResult.grade) };
}

async function rowInputs() {
  const pos = (await positive()).result;
  const neg = (await supervisedNegative()).result;
  const fallbackControl = (await spawnedFallback()).result;
  const unavailableControl = (await runtimeUnavailable()).result;
  return { pos, neg, fallbackControl, unavailableControl };
}

test('row verdict: graded from the supervised positive and negative only; the update-respawn controls never change it', async () => {
  const { pos, neg, fallbackControl, unavailableControl } = await rowInputs();
  // A control whose own expectation failed, and one that "passes"; neither may move the row.
  const failingRecord = structuredClone(fallbackControl.record);
  failingRecord.fallback.diagnostics = failingRecord.fallback.diagnostics.filter((entry) => !/did not become healthy/u.test(entry.line));
  const failingControl = { record: failingRecord, grade: gradeRestartControl(failingRecord) };
  assert.equal(failingControl.grade.negativeControl.holds, false);
  const passing = [passingControl(pos, 'control-update-respawn-fallback'), passingControl(pos, 'control-update-respawn-runtime-unavailable')];
  // Controls from another candidate and docs harness stay beside the verdict as well.
  const stale = { ...passingControl(pos, 'control-update-respawn-fallback'), candidateSha: 'c'.repeat(40), docsSha: 'd'.repeat(40) };
  const staleRun = { ...structuredClone(unavailableControl), record: { ...structuredClone(unavailableControl.record), candidateSha: 'c'.repeat(40), docsSha: 'd'.repeat(40) } };
  const controlSets = [
    [fallbackControl, unavailableControl],
    [failingControl],
    passing,
    [stale, staleRun],
    [unavailableControl, ...passing, failingControl, fallbackControl, stale],
  ];
  for (const rowCases of [[pos, neg], [neg, pos], [pos], [neg], []]) {
    const alone = rcc.gradeReturnCovenantRow(rowCases);
    assert.deepEqual(alone.controls, []);
    for (const controls of controlSets) {
      const beside = rcc.gradeReturnCovenantRow([...controls, ...rowCases]);
      assert.deepEqual(rowPart(beside), rowPart(alone), `controls moved the row graded from [${rowCases.map((entry) => entry.record.case)}]`);
      assert.equal(beside.controls.length, controls.length);
    }
  }

  const row = rcc.gradeReturnCovenantRow([pos, neg, fallbackControl, unavailableControl]);
  assert.equal(row.row, 'R-CD-RETURN-COVENANT-AUTHORITY');
  assert.equal(row.verdict, 'PASS-candidate', JSON.stringify(row, null, 2));
  assert.deepEqual(row.gradedFrom, ['positive', 'negative-replacement-never-usable']);
  assert.deepEqual(row.reasons, []);
  assert.deepEqual(row.controls.map((entry) => entry.case), ['control-update-respawn-fallback', 'control-update-respawn-runtime-unavailable']);
  for (const control of row.controls) {
    assert.equal(control.kind, 'update-respawn-control');
    assert.equal(control.feedsRowVerdict, false);
    assert.equal(control.holds, true, JSON.stringify(control));
  }
  // Each case's own record, grade and signed receipt say which kind it is; only the two
  // supervised cases are row evidence.
  for (const [result, kind] of [[pos, 'row-positive'], [neg, 'row-negative'], [fallbackControl, 'update-respawn-control'], [unavailableControl, 'update-respawn-control']]) {
    assert.equal(result.record.kind, kind, result.record.case);
    assert.equal(result.grade.kind, kind, result.record.case);
    assert.equal(result.grade.feedsRowVerdict, kind !== 'update-respawn-control', result.record.case);
    assert.equal(result.receipt.kind, kind, result.record.case);
  }
  // The plain in-process restart is named on its own, outside the row claim and the controls.
  assert.deepEqual(row.namedLimits.map((entry) => entry.name), ['in-process-restart']);
  assert.match(row.namedLimits[0].anchor, /src\/cli\/gateway-cli\/run-loop\.ts:572-580/u);
  assert.equal(rcc.RCC_CASES.includes('in-process-restart'), false);
});

test('row verdict: a passing update-respawn control cannot lift a row whose supervised negative is missing', async () => {
  const { pos, neg, fallbackControl, unavailableControl } = await rowInputs();
  assert.equal(fallbackControl.grade.negativeControl.holds, true, 'the control itself holds');
  const passing = [
    fallbackControl,
    unavailableControl,
    passingControl(pos, 'control-update-respawn-fallback'),
    passingControl(pos, 'control-update-respawn-runtime-unavailable'),
  ];

  const noNegative = rcc.gradeReturnCovenantRow([pos, ...passing]);
  assert.equal(noNegative.verdict, 'PARTIAL-candidate', JSON.stringify(noNegative, null, 2));
  assert.ok(noNegative.reasons.some((entry) => entry.code === 'supervised-negative-missing'));
  assert.equal(noNegative.positive.verdict, 'PASS-candidate');
  assert.equal(noNegative.supervisedNegative.present, false);

  const controlsOnly = rcc.gradeReturnCovenantRow(passing);
  assert.equal(controlsOnly.verdict, 'MISSING-candidate', JSON.stringify(controlsOnly, null, 2));
  assert.ok(controlsOnly.reasons.some((entry) => entry.code === 'positive-missing'));
  assert.ok(controlsOnly.reasons.some((entry) => entry.code === 'supervised-negative-missing'));

  // A control receipt relabelled as either supervised case keeps its control kind and is refused.
  for (const caseKind of ['negative-replacement-never-usable', 'positive']) {
    const posing = passingControl(pos, caseKind);
    const graded = rcc.gradeReturnCovenantRow(caseKind === 'positive' ? [posing, neg] : [pos, posing]);
    assert.notEqual(graded.verdict, 'PASS-candidate', caseKind);
    assert.ok(['MISSING-candidate', 'PARTIAL-candidate'].includes(graded.verdict), JSON.stringify(graded, null, 2));
    assert.ok(graded.reasons.some((entry) => entry.code === 'case-kind-mismatch'), JSON.stringify(graded.reasons));
  }
  // The positive's grade presented as the supervised negative carries kind row-positive: refused.
  const asNegative = { case: 'negative-replacement-never-usable', candidateSha: CANDIDATE, docsSha: DOCS, grade: structuredClone(pos.grade) };
  assert.equal(rcc.gradeReturnCovenantRow([pos, asNegative, ...passing]).verdict, 'PARTIAL-candidate');

  // A supervised negative that does not hold caps the row as well, whatever the controls show.
  const emptyRecord = structuredClone(neg.record);
  const empty = { bytes: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', tail: '' };
  emptyRecord.generations.replacement.stdout = empty;
  emptyRecord.generations.replacement.stderr = empty;
  const weak = { record: emptyRecord, grade: gradeRestartControl(emptyRecord) };
  assert.equal(weak.grade.negativeControl.holds, false);
  const weakRow = rcc.gradeReturnCovenantRow([pos, weak, ...passing]);
  assert.equal(weakRow.verdict, 'PARTIAL-candidate', JSON.stringify(weakRow, null, 2));
  assert.ok(weakRow.reasons.some((entry) => entry.code === 'supervised-negative-not-holding'));
  assert.equal(weakRow.supervisedNegative.failureBodyRetained, false);

  // A supervised negative that grades PASS (impossible from the grader; a forged receipt) means
  // the control could not refuse PASS, so its positive is not evidence.
  const forged = { case: 'negative-replacement-never-usable', kind: 'row-negative', candidateSha: CANDIDATE, docsSha: DOCS, grade: { ...structuredClone(neg.grade), verdict: 'PASS-candidate', kind: 'row-negative' } };
  const forgedRow = rcc.gradeReturnCovenantRow([pos, forged, ...passing]);
  assert.equal(forgedRow.verdict, 'MISSING-candidate', JSON.stringify(forgedRow, null, 2));
  assert.ok(forgedRow.reasons.some((entry) => entry.code === 'supervised-negative-not-refused'));

  // The two supervised cases must come from one candidate and one docs harness.
  const otherCandidate = { ...structuredClone(neg), record: { ...structuredClone(neg.record), candidateSha: 'a'.repeat(40) } };
  const mismatched = rcc.gradeReturnCovenantRow([pos, otherCandidate]);
  assert.equal(mismatched.verdict, 'MISSING-candidate', JSON.stringify(mismatched, null, 2));
  assert.ok(mismatched.reasons.some((entry) => entry.code === 'row-cases-candidate-mismatch'));
  const otherDocs = { ...structuredClone(neg), record: { ...structuredClone(neg.record), docsSha: 'b'.repeat(40) } };
  const docsMismatch = rcc.gradeReturnCovenantRow([pos, otherDocs]);
  assert.equal(docsMismatch.verdict, 'PARTIAL-candidate', JSON.stringify(docsMismatch, null, 2));
  assert.ok(docsMismatch.reasons.some((entry) => entry.code === 'row-cases-docs-mismatch'));

  // A repeated supervised case grades from the worst of its receipts.
  const failedPositive = { record: structuredClone(pos.record), grade: { ...structuredClone(pos.grade), verdict: 'FAIL-candidate' } };
  const repeated = rcc.gradeReturnCovenantRow([pos, failedPositive, neg]);
  assert.equal(repeated.verdict, 'FAIL-candidate', JSON.stringify(repeated, null, 2));
  assert.ok(repeated.reasons.some((entry) => entry.code === 'row-case-repeated'));
});

test('row verdict: the supervised negative grades non-PASS with the observed failure, the outage and noFallback, and claims no fallback', async () => {
  const { pos, neg } = await rowInputs();
  const { record, grade } = neg;
  assert.equal(grade.verdict, 'FAIL-candidate', JSON.stringify(grade, null, 2));
  assert.equal(grade.kind, 'row-negative');
  assert.equal(grade.negativeControl.nonPass, true);
  assert.equal(grade.negativeControl.failureObserved, true);
  assert.equal(grade.negativeControl.outageObserved, true);
  assert.equal(grade.negativeControl.noFallback, true);
  assert.equal(grade.negativeControl.holds, true, JSON.stringify(grade.negativeControl, null, 2));

  const row = rcc.gradeReturnCovenantRow([pos, neg]);
  const negative = row.supervisedNegative;
  assert.equal(negative.present, true);
  assert.equal(negative.case, 'negative-replacement-never-usable');
  assert.equal(negative.verdict, 'FAIL-candidate');
  assert.equal(negative.failure, 'replacement-never-usable');
  assert.equal(negative.failureBodyRetained, true);
  assert.equal(negative.authorityRetained, true);
  assert.equal(negative.noFallback, true);
  assert.equal(negative.fallbackBranch, 'none-on-supervised-branch');
  assert.equal(negative.outageInterval.observed, true);
  assert.equal(negative.outageInterval.lastServingBefore.generation, 'old');
  assert.equal(negative.outageInterval.firstServingAfter, null);
  assert.equal(negative.outageInterval.open, true);
  assert.deepEqual(negative.outageInterval, grade.outageInterval);
  assert.equal(negative.holds, true);
  assert.equal(row.positive.verdict, 'PASS-candidate');
  assert.equal(row.positive.outageInterval.firstServingAfter.generation, 'replacement');

  // No old-process fallback may be claimed on this branch: if the original process served
  // again after it exited, the negative does not hold and the row is not PASS.
  const restored = structuredClone(record);
  const { old } = restored.generations;
  for (const sample of restored.observation.samples) {
    if (sample.atMs <= old.exitedAtMs) continue;
    Object.assign(sample, {
      listener: { ...sample.listener, owner: 'old', inode: old.listen.inode + 1, ownerPid: old.pid, ownerStartTicks: old.startTicks },
      readyz: { ...sample.readyz, status: 200, ready: true },
      hello: { ok: true, bootIdSha256: 'b'.repeat(64), error: null },
      servingGeneration: 'old',
    });
  }
  const restoredGrade = gradeRestartControl(restored);
  assert.notEqual(restoredGrade.verdict, 'PASS-candidate');
  assert.equal(restoredGrade.negativeControl.noFallback, false);
  assert.equal(restoredGrade.negativeControl.outageObserved, false);
  assert.equal(restoredGrade.negativeControl.holds, false);
  const restoredRow = rcc.gradeReturnCovenantRow([pos, { record: restored, grade: restoredGrade }]);
  assert.equal(restoredRow.verdict, 'PARTIAL-candidate', JSON.stringify(restoredRow, null, 2));
  assert.equal(restoredRow.supervisedNegative.noFallback, false);
  assert.ok(restoredRow.reasons.some((entry) => entry.code === 'supervised-negative-not-holding'));
});

test('row verdict from signed receipts: the CLI counts only verified receipts, and controls stay beside the verdict', async () => {
  const { pos, neg, fallbackControl, unavailableControl } = await rowInputs();
  const runs = [await positive(), await supervisedNegative(), await spawnedFallback(), await runtimeUnavailable()];
  const receipts = runs.map((run) => path.join(run.layout.artifactDir, 'observer-receipt.json'));
  const keyFile = runs[0].layout.keyFile;
  const script = path.join(here, '..', 'run-return-covenant-restart-control.mjs');
  const gradeRow = (files, key = keyFile) => spawnSync(process.execPath, [
    script,
    ...files.flatMap((file) => ['--grade-row', file]),
    ...(key ? ['--observer-key-file', key] : []),
  ], { encoding: 'utf8', timeout: 60_000 });
  const parse = (result) => JSON.parse(result.stdout.slice(0, result.stdout.indexOf('\nROW VERDICT: ')));

  const all = gradeRow(receipts);
  assert.equal(all.status, 0, all.stderr);
  const graded = parse(all);
  assert.equal(graded.verdict, 'PASS-candidate', all.stdout);
  assert.match(all.stdout, /\nROW VERDICT: PASS-candidate\nCONTROLS beside the row verdict, never feeding it: control-update-respawn-fallback holds, control-update-respawn-runtime-unavailable holds\n$/u);
  assert.deepEqual(graded.unverifiedReceipts, []);
  assert.deepEqual(graded.controls.map((entry) => [entry.case, entry.feedsRowVerdict]), [
    ['control-update-respawn-fallback', false],
    ['control-update-respawn-runtime-unavailable', false],
  ]);
  assert.deepEqual(rowPart(graded), rowPart(parse(gradeRow(receipts.slice(0, 2)))));
  assert.equal(graded.verdict, rcc.gradeReturnCovenantRow([pos, neg, fallbackControl, unavailableControl]).verdict);

  // A tampered supervised negative does not verify, so it is not counted: the row cannot pass.
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'rcc-row-'));
  const tampered = path.join(scratch, 'negative-tampered.json');
  const negative = JSON.parse(await readFile(receipts[1], 'utf8'));
  negative.grade.negativeControl.holds = !negative.grade.negativeControl.holds;
  await writeFile(tampered, JSON.stringify(negative));
  const withTampered = gradeRow([receipts[0], tampered, receipts[2], receipts[3]]);
  assert.equal(withTampered.status, 1, withTampered.stderr);
  const tamperedRow = parse(withTampered);
  assert.equal(tamperedRow.verdict, 'PARTIAL-candidate', withTampered.stdout);
  assert.deepEqual(tamperedRow.unverifiedReceipts.map((entry) => entry.case), ['negative-replacement-never-usable']);
  assert.ok(tamperedRow.reasons.some((entry) => entry.code === 'supervised-negative-missing'));
  assert.ok(tamperedRow.reasons.some((entry) => entry.code === 'row-receipt-unverified'));

  // An unverifiable extra receipt for a supervised case, or an unreadable file, caps a passing
  // row: the worst of a case's receipts cannot be dodged by a receipt that fails to verify.
  const failedPositive = path.join(scratch, 'positive-failed.json');
  const positiveReceipt = JSON.parse(await readFile(receipts[0], 'utf8'));
  await writeFile(failedPositive, JSON.stringify({ ...positiveReceipt, verdict: 'FAIL-candidate', grade: { ...positiveReceipt.grade, verdict: 'FAIL-candidate' } }));
  const garbage = path.join(scratch, 'garbage.json');
  await writeFile(garbage, 'not json');
  for (const extra of [failedPositive, garbage]) {
    const capped = gradeRow([...receipts, extra]);
    assert.equal(capped.status, 1, capped.stderr);
    const cappedRow = parse(capped);
    assert.equal(cappedRow.verdict, 'PARTIAL-candidate', capped.stdout);
    assert.ok(cappedRow.reasons.some((entry) => entry.code === 'row-receipt-unverified'), capped.stdout);
    assert.equal(cappedRow.unverifiedReceipts.length, 1);
  }
  // An unverifiable control receipt is reported, but stays beside the verdict.
  const tamperedControl = path.join(scratch, 'control-tampered.json');
  const controlReceipt = JSON.parse(await readFile(receipts[2], 'utf8'));
  await writeFile(tamperedControl, JSON.stringify({ ...controlReceipt, verdict: 'PASS-candidate' }));
  const besideControl = gradeRow([receipts[0], receipts[1], tamperedControl]);
  assert.equal(besideControl.status, 1, besideControl.stderr);
  assert.equal(parse(besideControl).verdict, 'PASS-candidate', besideControl.stdout);
  assert.deepEqual(parse(besideControl).unverifiedReceipts.map((entry) => entry.case), ['control-update-respawn-fallback']);

  // Without the observer key nothing can be verified, so the CLI refuses to grade the row.
  const keyless = gradeRow(receipts, null);
  assert.equal(keyless.status, 2, keyless.stdout);
  assert.match(keyless.stderr, /--observer-key-file/u);
  const missingKey = gradeRow(receipts, path.join(scratch, 'no-such.key'));
  assert.equal(missingKey.status, 2, missingKey.stdout);
  assert.match(missingKey.stderr, /observer key file/u);
  assert.doesNotMatch(missingKey.stderr, /\n\s+at /u, 'a missing key file is reported, not a stack trace');
});

test('row verdict: a receipt that cannot be counted for a supervised case lowers the row, never raises it', async () => {
  const { pos, neg, fallbackControl } = await rowInputs();
  assert.equal(rcc.gradeReturnCovenantRow([pos, neg]).verdict, 'PASS-candidate');
  const uncountable = [
    ['case-grade-missing', { case: 'positive', candidateSha: CANDIDATE, docsSha: DOCS, grade: { ...structuredClone(pos.grade), verdict: 'NOT-A-VERDICT' } }],
    ['case-kind-mismatch', { case: 'positive', kind: 'row-negative', candidateSha: CANDIDATE, docsSha: DOCS, grade: structuredClone(pos.grade) }],
    ['case-unknown', { case: 'no-such-case', candidateSha: CANDIDATE, docsSha: DOCS, grade: structuredClone(pos.grade) }],
    ['case-unknown', null],
    ['case-unknown', { grade: structuredClone(pos.grade) }],
    ['case-conflict', { case: 'positive', record: { ...structuredClone(pos.record), case: 'negative-replacement-never-usable' }, grade: structuredClone(pos.grade) }],
    // A "control" named only by its kind, over a positive record, is not a control.
    ['case-kind-mismatch', { kind: 'update-respawn-control', record: { case: 'positive' }, grade: structuredClone(fallbackControl.grade) }],
  ];
  for (const [code, entry] of uncountable) {
    const graded = rcc.gradeReturnCovenantRow([pos, neg, entry]);
    assert.equal(graded.verdict, 'PARTIAL-candidate', `${code}: ${JSON.stringify(graded.reasons)}`);
    assert.ok(graded.reasons.some((reason) => reason.code === code), `${code}: ${JSON.stringify(graded.reasons)}`);
  }

  // A negative whose entry and record disagree on the case is not counted, even with a grade
  // that would hold and no kind to contradict it.
  const holding = structuredClone(neg.grade);
  delete holding.kind;
  const conflicted = { case: 'negative-replacement-never-usable', record: { case: 'control-update-respawn-fallback' }, candidateSha: CANDIDATE, docsSha: DOCS, grade: holding };
  const conflictedRow = rcc.gradeReturnCovenantRow([pos, conflicted]);
  assert.equal(conflictedRow.verdict, 'PARTIAL-candidate', JSON.stringify(conflictedRow, null, 2));
  assert.ok(conflictedRow.reasons.some((reason) => reason.code === 'case-conflict'));
  assert.equal(conflictedRow.supervisedNegative.present, false);

  // Receipts the caller could not verify: a supervised or unknown case caps the row; a control
  // case stays beside it.
  for (const unverified of [{ case: 'positive' }, { case: 'negative-replacement-never-usable' }, { case: null }]) {
    const graded = rcc.gradeReturnCovenantRow([pos, neg], { unverified: [unverified] });
    assert.equal(graded.verdict, 'PARTIAL-candidate', JSON.stringify(unverified));
    assert.ok(graded.reasons.some((reason) => reason.code === 'row-receipt-unverified'));
  }
  const besideOnly = rcc.gradeReturnCovenantRow([pos, neg], { unverified: [{ case: 'control-update-respawn-fallback' }] });
  assert.deepEqual(rowPart(besideOnly), rowPart(rcc.gradeReturnCovenantRow([pos, neg])));

  // The supervised cases must name one real candidate and one real docs harness.
  const bare = (result, candidateSha, docsSha = DOCS) => ({ case: result.record.case, kind: result.record.kind, candidateSha, docsSha, grade: structuredClone(result.grade) });
  for (const sha of [undefined, null, 'not-a-sha']) {
    const unbound = rcc.gradeReturnCovenantRow([bare(pos, sha), bare(neg, sha)]);
    assert.equal(unbound.verdict, 'MISSING-candidate', JSON.stringify(unbound, null, 2));
    assert.ok(unbound.reasons.some((reason) => reason.code === 'row-case-candidate-unbound'));
  }
  const docsUnbound = rcc.gradeReturnCovenantRow([bare(pos, CANDIDATE, null), bare(neg, CANDIDATE, null)]);
  assert.equal(docsUnbound.verdict, 'PARTIAL-candidate', JSON.stringify(docsUnbound, null, 2));
  assert.ok(docsUnbound.reasons.some((reason) => reason.code === 'row-case-docs-unbound'));

  // Malformed input never throws and never passes.
  const malformed = structuredClone(neg.grade);
  malformed.failures = 'replacement-never-usable';
  assert.equal(rcc.gradeReturnCovenantRow([pos, { record: neg.record, grade: malformed }]).verdict, 'PARTIAL-candidate');
  const oddPositive = { record: pos.record, grade: { ...structuredClone(pos.grade), failures: {}, partials: 'x', missingReceipts: 7, missingBehaviour: null } };
  assert.doesNotThrow(() => rcc.gradeReturnCovenantRow([oddPositive, neg]));
  for (const entries of [null, 'x', 7, {}]) {
    assert.equal(rcc.gradeReturnCovenantRow(entries).verdict, 'MISSING-candidate', JSON.stringify(entries));
  }
});

test('row verdict: the row re-checks the supervised negative itself; a receipt that claims holds without each part cannot pass', async () => {
  const { pos, neg } = await rowInputs();
  const mutations = {
    failure: (grade) => {
      grade.failures = grade.failures.filter((entry) => entry.code !== 'replacement-never-usable');
    },
    outageObserved: (grade) => {
      const before = grade.outageInterval.lastServingBefore;
      grade.outageInterval = { ...grade.outageInterval, open: false, firstServingAfter: { ...before, atMs: before.atMs + 1 }, ms: 1 };
    },
    failureBodyRetained: (grade) => {
      grade.negativeControl.failureBodyRetained = false;
    },
    authorityRetained: (grade) => {
      grade.negativeControl.oldAuthorityRetained = false;
    },
    noFallback: (grade) => {
      grade.fallback = { ...grade.fallback, branch: 'restored', class: 'old-process-restoration' };
    },
  };
  for (const [field, mutate] of Object.entries(mutations)) {
    const grade = structuredClone(neg.grade);
    mutate(grade);
    assert.equal(grade.negativeControl.holds, true, `${field}: the receipt still claims the negative holds`);
    assert.equal(grade.verdict, 'FAIL-candidate');
    const row = rcc.gradeReturnCovenantRow([pos, { record: neg.record, grade }]);
    assert.equal(row.verdict, 'PARTIAL-candidate', `${field}: ${JSON.stringify(row.supervisedNegative)}`);
    assert.ok(!row.supervisedNegative[field], field);
    assert.equal(row.supervisedNegative.holds, false, field);
    const notHolding = row.reasons.find((reason) => reason.code === 'supervised-negative-not-holding');
    assert.ok(notHolding?.detail.includes(field), `${field}: ${JSON.stringify(row.reasons)}`);
  }

  // Per case: an old generation that does not exit 0 through the handoff breaks noFallback
  // alone, and the negative does not hold.
  const record = structuredClone(neg.record);
  record.generations.old.exit = { ...record.generations.old.exit, code: 1 };
  const grade = gradeRestartControl(record);
  assert.notEqual(grade.verdict, 'PASS-candidate');
  assert.equal(grade.negativeControl.noFallback, false);
  assert.equal(grade.negativeControl.failureObserved, true);
  assert.equal(grade.negativeControl.outageObserved, true);
  assert.equal(grade.negativeControl.failureBodyRetained, true);
  assert.equal(grade.negativeControl.oldAuthorityRetained, true);
  assert.equal(grade.negativeControl.holds, false);
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
