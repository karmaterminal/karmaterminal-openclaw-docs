import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Behavioural regression for the Project 86 same-session serialization contract.
 *
 * PR #452 review, HIGH: the corrected plan's primary command called
 * `live-run-guard.mjs --json`, which only prints lock metadata. No lock was
 * taken, no lock file was created, and the guard's exit status did not gate the
 * following `run-proofs.sh`. These tests execute the emitted command for real
 * (with `run-proofs.sh` swapped for a sentinel-writing stub) and require that a
 * held lock actually prevents a second row execution.
 */

const repoRoot = new URL('../../../../', import.meta.url).pathname;
const guard = join(repoRoot, 'tools/k6-proofs/scripts/live-run-guard.mjs');
const correctedPlanPath = join(repoRoot, 'analysis/project86-proof-issue-plan.corrected.json');
const TEST_SHA = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
const SERIALIZED_ROWS = 18;

let planPromise;
function loadPlan() {
  planPromise ??= readFile(correctedPlanPath, 'utf8').then(JSON.parse);
  return planPromise;
}

function rowBody(plan, rowId) {
  const row = plan.rows.find((r) => r.row_id === rowId);
  assert.ok(row, `row ${rowId} is absent from the corrected plan`);
  return row.body;
}

/** The primary command fence, i.e. the one under "Run the committed automation first". */
function primaryFence(body) {
  const marker = '## Run the committed automation first';
  const start = body.indexOf(marker);
  assert.notEqual(start, -1, 'row body has no primary command section');
  const open = body.indexOf('```bash\n', start);
  assert.notEqual(open, -1, 'primary command section has no bash fence');
  const close = body.indexOf('\n```', open);
  assert.notEqual(close, -1, 'primary command fence is unterminated');
  return body.slice(open + '```bash\n'.length, close);
}

function serializedRowIds(plan) {
  return plan.rows
    .filter((r) => r.body.includes('flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH"'))
    .map((r) => r.row_id);
}

/**
 * Instantiate the operator command: resolve the plan placeholders and redirect
 * the runner to a stub, so no proof is ever fired by this test.
 */
function instantiate(fence, { sessionKey, stub }) {
  const script = fence
    .split('<FINAL_CANDIDATE_SHA>').join(TEST_SHA)
    .split('<SEAT>').join('project86-lock-test')
    .split('<SESSION_KEY>').join(sessionKey)
    .split('./scripts/run-proofs.sh').join(stub);
  assert.ok(!script.includes('./scripts/run-proofs.sh'), 'the real runner must never be reachable from this test');
  assert.ok(!script.includes('<'), `unresolved placeholder in instantiated command: ${script}`);
  return script;
}

function runScript(script, env) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', script], {
      cwd: repoRoot,
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: 'lock-test-token-not-printed', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function withStub(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p86-lock-'));
  const stub = join(dir, 'run-proofs-stub.sh');
  const sentinel = join(dir, 'executions.log');
  await writeFile(
    stub,
    '#!/usr/bin/env bash\n'
      + 'set -euo pipefail\n'
      + 'echo "EXEC ${RUN_TAG:-untagged}" >> "$SENTINEL"\n'
      + 'sleep "${HOLD_SECONDS:-0}"\n',
    { mode: 0o755 },
  );
  try {
    return await fn({ dir, stub, sentinel });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ask the canonical guard for a row's lock identity, and remember it for cleanup. */
const createdLocks = new Set();
function guardLocks(manifest, sessionKey) {
  const run = spawnSync(
    process.execPath,
    [guard, '--manifest', `tools/k6-proofs/manifests/${manifest}`, '--json', '--require-lock'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: 'lock-test-token-not-printed',
        OPENCLAW_CANDIDATE_SHA: TEST_SHA,
        OPENCLAW_SESSION_KEY: sessionKey,
      },
    },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout);
  for (const path of [parsed.lockPath, parsed.sessionLockPath]) if (path) createdLocks.add(path);
  return parsed;
}

after(() => {
  for (const path of createdLocks) rmSync(path, { force: true });
});

async function readSentinel(path) {
  return existsSync(path) ? readFile(path, 'utf8') : '';
}

test('a held same-session lock prevents a second execution of the same row', async () => {
  const plan = await loadPlan();
  const fence = primaryFence(rowBody(plan, 'R-CD-1'));
  const sessionKey = `agent:main:p86-lock-${process.pid}-${Date.now()}`;

  const { lockPath } = guardLocks('r-cd-1.json', sessionKey);
  assert.match(lockPath, /^\/tmp\/openclaw-k6-proof-[0-9a-f]{24}\.lock$/);

  await withStub(async ({ stub, sentinel }) => {
    const script = instantiate(fence, { sessionKey, stub });
    const env = { SENTINEL: sentinel };

    const first = runScript(script, { ...env, RUN_TAG: 'first', HOLD_SECONDS: '4' });
    await sleep(1500);

    assert.ok(existsSync(lockPath), 'the first run did not create the lock file it claims to hold');
    assert.match(await readSentinel(sentinel), /EXEC first/, 'the first run never reached the runner');

    const second = await runScript(script, { ...env, RUN_TAG: 'second', HOLD_SECONDS: '0' });
    assert.equal(second.code, 75, `overlapping run was not refused: ${second.stdout}${second.stderr}`);
    assert.doesNotMatch(
      await readSentinel(sentinel),
      /EXEC second/,
      'the overlapping run executed the row anyway; the lock is not held across execution',
    );

    const firstResult = await first;
    assert.equal(firstResult.code, 0, `${firstResult.stdout}${firstResult.stderr}`);

    const third = await runScript(script, { ...env, RUN_TAG: 'third', HOLD_SECONDS: '0' });
    assert.equal(third.code, 0, `${third.stdout}${third.stderr}`);
    assert.match(await readSentinel(sentinel), /EXEC third/, 'the lock was not released after the run finished');

    assert.doesNotMatch(firstResult.stdout + firstResult.stderr, /lock-test-token-not-printed/);
  });
});

test('the superseded metadata-only guard form does NOT serialize (the defect this replaces)', async () => {
  const plan = await loadPlan();
  const fence = primaryFence(rowBody(plan, 'R-CD-1'));
  const sessionKey = `agent:main:p86-nolock-${process.pid}-${Date.now()}`;

  // Reconstruct the reviewed ca3034dd shape: report lock metadata, then run anyway.
  guardLocks('r-cd-1.json', sessionKey);
  const unguarded = fence
    .replace(/^command -v flock[\s\S]*?\[ -n "\$\{K6_PROOF_SESSION_LOCK_PATH:-\}" \] &&\n/m, '')
    .replace(
      'flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \\\n'
        + '  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \\\n'
        + '    ./scripts/run-proofs.sh',
      './scripts/run-proofs.sh',
    );
  assert.ok(!unguarded.includes('command -v flock'), 'failed to strip the lock preamble');
  assert.ok(!unguarded.includes('flock --nonblock'), 'failed to strip the flock wrapper');

  await withStub(async ({ stub, sentinel }) => {
    const script = instantiate(unguarded, { sessionKey, stub });
    const env = { SENTINEL: sentinel };
    const first = runScript(script, { ...env, RUN_TAG: 'first', HOLD_SECONDS: '3' });
    await sleep(1200);
    const second = await runScript(script, { ...env, RUN_TAG: 'second', HOLD_SECONDS: '0' });
    await first;

    assert.equal(second.code, 0);
    assert.match(
      await readSentinel(sentinel),
      /EXEC second/,
      'expected the unguarded form to overlap; if it no longer does, this regression has lost its teeth',
    );
  });
});

test('every serialized row holds its own manifest lock across the primary run', async () => {
  const plan = await loadPlan();
  const rows = serializedRowIds(plan);
  assert.equal(rows.length, SERIALIZED_ROWS);

  for (const rowId of rows) {
    const body = rowBody(plan, rowId);
    const declared = /^- Manifest: `([^`]+)`$/m.exec(body);
    assert.ok(declared, `${rowId} does not declare a manifest`);
    const manifestPath = declared[1];
    assert.ok(existsSync(join(repoRoot, manifestPath)), `${rowId} declares a missing manifest ${manifestPath}`);

    const manifest = JSON.parse(await readFile(join(repoRoot, manifestPath), 'utf8'));
    assert.equal(manifest.rowId, rowId, `${rowId} locks on a manifest belonging to ${manifest.rowId}`);

    const fence = primaryFence(body);
    assert.ok(
      fence.includes(`--manifest ${manifestPath} --shell --require-lock)" &&`),
      `${rowId} does not resolve its lock from its own manifest, fail-closed`,
    );
    assert.ok(!fence.includes('--json'), `${rowId} still uses the metadata-only --json guard call`);
    assert.ok(!fence.includes('<row>.json'), `${rowId} still carries an unresolved <row>.json lock target`);
    assert.ok(
      fence.includes(
        'flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \\\n'
          + '  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \\\n'
          + '    ./scripts/run-proofs.sh --live ',
      ),
      `${rowId} does not hold both locks across run-proofs.sh`,
    );
    assert.equal(
      fence.split('./scripts/run-proofs.sh').length - 1,
      1,
      `${rowId} has more than one primary runner invocation`,
    );
  }
});

test('--require-lock escalates a manifest that declares itself concurrency safe, and only escalates', async () => {
  const env = {
    ...process.env,
    OPENCLAW_GATEWAY_TOKEN: 'lock-test-token-not-printed',
    OPENCLAW_CANDIDATE_SHA: TEST_SHA,
    OPENCLAW_SESSION_KEY: 'agent:main:p86-require-lock',
  };
  const call = (manifest, ...extra) => spawnSync(
    process.execPath,
    [guard, '--manifest', `tools/k6-proofs/manifests/${manifest}`, '--json', ...extra],
    { cwd: repoRoot, encoding: 'utf8', env },
  );

  // R-RC-2's manifest says concurrency-safe; MC-07 overrides it to serialized.
  const plain = call('r-rc-2.json');
  assert.equal(plain.status, 0, plain.stderr);
  const plainJson = JSON.parse(plain.stdout);
  assert.equal(plainJson.lockRequired, false);
  assert.equal(plainJson.lockRequiredReason, 'none');
  assert.equal(plainJson.lockPath, '');

  const escalated = JSON.parse(call('r-rc-2.json', '--require-lock').stdout);
  assert.equal(escalated.lockRequired, true);
  assert.equal(escalated.lockRequiredReason, 'caller-override');
  assert.match(escalated.lockPath, /^\/tmp\/openclaw-k6-proof-[0-9a-f]{24}\.lock$/);

  // A manifest that already demands the lock keeps its own provenance.
  const declared = JSON.parse(call('r-cd-1.json', '--require-lock').stdout);
  assert.equal(declared.lockRequired, true);
  assert.equal(declared.lockRequiredReason, 'manifest-declared');

  // The flag can never remove a lock requirement.
  const withoutFlag = JSON.parse(call('r-cd-1.json').stdout);
  assert.equal(withoutFlag.lockRequired, true);
  assert.equal(withoutFlag.lockPath, declared.lockPath);

  // Row locks are per (row, session); the session lock is per session only, and
  // the two namespaces are disjoint so they can never alias.
  assert.match(declared.sessionLockPath, /^\/tmp\/openclaw-k6-session-[0-9a-f]{24}\.lock$/);
  assert.equal(escalated.sessionLockPath, declared.sessionLockPath);
  assert.notEqual(escalated.lockPath, declared.lockPath);
  assert.equal(plainJson.sessionLockPath, '');
});

test('two different continuation rows cannot run against the same target session', async () => {
  const plan = await loadPlan();
  const sessionKey = `agent:main:p86-cross-${process.pid}-${Date.now()}`;
  const first = primaryFence(rowBody(plan, 'R-CD-1'));
  const second = primaryFence(rowBody(plan, 'R-CW-1'));
  for (const key of [sessionKey, `${sessionKey}-other`]) {
    guardLocks('r-cd-1.json', key);
    guardLocks('r-cw-1.json', key);
  }

  await withStub(async ({ stub, sentinel }) => {
    const env = { SENTINEL: sentinel };
    const holding = runScript(instantiate(first, { sessionKey, stub }), {
      ...env, RUN_TAG: 'r-cd-1', HOLD_SECONDS: '4',
    });
    await sleep(1500);
    assert.match(await readSentinel(sentinel), /EXEC r-cd-1/, 'the holding row never started');

    const blocked = await runScript(instantiate(second, { sessionKey, stub }), {
      ...env, RUN_TAG: 'r-cw-1', HOLD_SECONDS: '0',
    });
    assert.equal(blocked.code, 75, `a different row overlapped the same session: ${blocked.stdout}${blocked.stderr}`);
    assert.doesNotMatch(
      await readSentinel(sentinel),
      /EXEC r-cw-1/,
      'a different continuation row executed against a session already under proof',
    );

    // Still under contention: a DIFFERENT target session must not be blocked at all.
    // This runs while the holder is live, otherwise it would not prove the session
    // lock is scoped per session rather than globally.
    const other = await runScript(
      instantiate(second, { sessionKey: `${sessionKey}-other`, stub }),
      { ...env, RUN_TAG: 'other-session', HOLD_SECONDS: '0' },
    );
    assert.equal(other.code, 0, `a different target session was blocked: ${other.stdout}${other.stderr}`);
    assert.match(await readSentinel(sentinel), /EXEC other-session/);

    const held = await holding;
    assert.equal(held.code, 0, `${held.stdout}${held.stderr}`);

    // Once released, the previously blocked row proceeds.
    const retry = await runScript(instantiate(second, { sessionKey, stub }), {
      ...env, RUN_TAG: 'r-cw-1-retry', HOLD_SECONDS: '0',
    });
    assert.equal(retry.code, 0, `${retry.stdout}${retry.stderr}`);
    assert.match(await readSentinel(sentinel), /EXEC r-cw-1-retry/);
  });
});
