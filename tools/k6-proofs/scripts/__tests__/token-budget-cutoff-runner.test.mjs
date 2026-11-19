// The token budget's cutoff at the row-list runner boundary: run-proofs.sh
// --live with a budget, a stub gateway and a k6 stub. No live seat, no model.
//
// 🌊's ruling (Discord 1573086211386384495): at the trip, sessions.abort only
// the sessions the run provably owns (the disposable sessions its rows created,
// and their descendants), fail closed on ambiguous ownership, never touch a
// prince session, keep metering through the drain and report the actual
// overshoot. It is a cutoff, not a hard ceiling. 🌫's additions
// (1573086236497678419): a queued continuation can fire after the abort, the
// observed overshoot is reported apart from the maximum possible one, and a
// quiet polling window is not proof the drain completed. 🌿's carried review
// items: delayed usage and two concurrent requests landing after the trip.
//
// Each row's k6 stub creates its sessions over a real WebSocket through the
// harness's own RequestTracker (lib/gateway-ws.js), so the ownership records the
// cutoff reads are the ones a row's k6 logs. The stub gateway answers
// sessions.create the way openclaw ab5a30ea does, adopting an existing key
// (src/gateway/session-create-service.ts:711-713), and sessions.abort with
// { ok, abortedRunId, status } (src/gateway/server-methods/sessions-abort.ts:69-76)
// or a refusal. Usage grows per read while a session is active.
//
// These tests import nothing added with the cutoff, so they run unchanged
// against the budget lane's runner (7afa1e87) as its negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  BUDGET_CONFIGURED_SESSION,
  runBudgetMatrix as runMatrix,
  usagePoint,
} from './helpers/token-budget-runner-fixture.mjs';

// TOKEN_BUDGET_FIXTURE_RECEIPTS_DIR (unset in normal runs) keeps each case's
// public receipt, the runner's cutoff log lines and the stub's abort calls.
const RECEIPTS_DIR = process.env.TOKEN_BUDGET_FIXTURE_RECEIPTS_DIR;
async function runBudgetMatrix(repo, { label, ...options }) {
  const fixture = await runMatrix(repo, options);
  if (RECEIPTS_DIR && label) {
    await mkdir(RECEIPTS_DIR, { recursive: true });
    if (fixture.receiptText) await writeFile(path.join(RECEIPTS_DIR, `${label}.token-budget-receipt.json`), fixture.receiptText);
    const cutoffLines = `${fixture.result.stdout}\n${fixture.result.stderr}`.split('\n').filter((line) => /TOKEN BUDGET|NOT-RUN \(budget\)/u.test(line));
    await writeFile(path.join(RECEIPTS_DIR, `${label}.runner.log`), `exit ${fixture.result.code}, ${fixture.result.elapsedMs} ms\n${cutoffLines.join('\n')}\n`);
    await writeFile(path.join(RECEIPTS_DIR, `${label}.stub-abort-calls.json`), `${JSON.stringify(fixture.abortCalls.map(({ params, scopes }) => ({ params, scopes })), null, 2)}\n`);
  }
  return fixture;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const BUDGET_ABORT_EXIT = 79;
const LONG_ROW = { 'r-config-defaults.js': 60 };
const GUARD = 'cutoff, not a hard ceiling';
const UNBOUNDED = 'unknown / unbounded by this guard';
const DRAIN_NOTE = 'a quiet polling window is not proof that the drain has completed';
const ACK_NOTE = 'an abort acknowledgement does not prove that future wakes or provider work have stopped';
const ROOT = 'agent:main:r-config-defaults-owned';
const CHILD = 'agent:main:subagent:owned-child';

/** The 12-hex public id the meter and the cutoff publish for a session. */
const publicIdOf = (key, sessionId) => createHash('sha256').update(`${/^agent:([^:]+):/u.exec(key)[1]}:${sessionId}`).digest('hex').slice(0, 12);

const rowStatuses = (receipt) => Object.fromEntries(receipt.rows.map((entry) => [entry.row, entry.status]));

/**
 * A stub gateway world. `baseline` sessions exist before the run; a
 * sessions.create adds `agent:main:<key>` (or adopts an existing one), then
 * `onCreate` may add more (children). A session grows by `grow(session)`
 * tokens per usage read. sessions.abort marks it aborted and answers
 * `abort(params, session)`.
 */
function world({ baseline = [], onCreate = () => {}, abort = () => ({ ok: true, payload: { ok: true, abortedRunId: 'run-fixture', status: 'aborted' } }) } = {}) {
  const sessions = new Map();
  const add = (session) => {
    sessions.set(session.key, { tokens: 0, grow: () => 0, aborted: false, abortedAt: null, ...session });
    return sessions.get(session.key);
  };
  for (const session of baseline) add(session);
  const methods = {
    'sessions.create': (params) => {
      const key = String(params.key).startsWith('agent:') ? params.key : `agent:main:${params.key}`;
      const session = sessions.get(key) ?? add({ key, sessionId: `sid-${params.key}`, label: params.label, grow: (s) => (s.aborted ? 0 : 300) });
      onCreate(session, { add, sessions });
      const sessionId = session.answerSessionId ?? session.sessionId;
      return { ok: true, payload: { ok: true, key, sessionId, entry: { sessionId }, runStarted: false } };
    },
    'sessions.list': () => ({
      ok: true,
      payload: {
        sessions: [...sessions.values()].map(({ key, sessionId, label, spawnedBy, parentSessionKey, controlOwnerSessionKey }) => ({
          key, sessionId, label, spawnedBy, parentSessionKey, controlOwnerSessionKey,
        })),
        hasMore: false,
        nextOffset: null,
      },
    }),
    'sessions.usage.timeseries': ({ key }) => {
      const session = sessions.get(key);
      if (!session) return { ok: false, error: { code: 'INVALID_REQUEST', message: `No transcript found for session: ${key}` } };
      session.tokens += session.grow(session);
      return usagePoint(session.sessionId, session.tokens);
    },
    'sessions.abort': (params) => {
      const session = sessions.get(params.key);
      const answer = abort(params, session);
      if (session && answer?.ok === true) {
        session.aborted = true;
        session.abortedAt = Date.now();
      }
      return answer;
    },
  };
  return { methods, sessions };
}

const prince = (overrides = {}) => ({ key: BUDGET_CONFIGURED_SESSION, sessionId: 'configured', tokens: 5000, ...overrides });
const ownedChild = (root, { add }) => {
  if (root.key === ROOT) add({ key: CHILD, sessionId: 'owned-child', spawnedBy: ROOT, controlOwnerSessionKey: ROOT, grow: (s) => (s.aborted ? 0 : 100) });
};
const CREATE_ROOT = { 'r-config-defaults.js': [{ key: 'r-config-defaults-owned', label: 'k6 R-CONFIG-DEFAULTS owned' }] };

function assertPublicSafe(fixture, secrets) {
  for (const secret of ['token-budget-runner-fixture-token', ...secrets]) {
    assert.ok(!fixture.receiptText.includes(secret), `the receipt must not carry ${secret}`);
  }
  assert.doesNotMatch(fixture.receiptText, /\b[0-9a-f]{32}\b/u, 'the ownership tag never reaches the receipt');
}

function assertCutoffLabels(receipt) {
  assert.equal(receipt.guard, GUARD, 'the receipt labels the guard a cutoff, not a hard ceiling');
  assert.match(receipt.verdictText, /^BUDGET-ABORT \(cutoff, not a hard ceiling\): /u);
  assert.match(receipt.verdictText, /maximum possible overshoot unknown \/ unbounded by this guard$/u);
  assert.equal(receipt.overshoot.guard, GUARD);
  assert.equal(receipt.overshoot.maxPossible, UNBOUNDED);
  assert.equal(receipt.overshoot.drain.complete, 'unproven');
  assert.equal(receipt.overshoot.drain.note, DRAIN_NOTE);
}

const abortedKeys = (fixture) => fixture.abortCalls.map((call) => call.params.key);

test('cutoff (1): an owned disposable session and its child are both aborted, once each, and the drain is metered', async () => {
  const gateway = world({ baseline: [prince()], onCreate: ownedChild });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '1-owned-session-and-child',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '1' },
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT, CHILD], 'the root first, then its child, each exactly once');
    for (const call of fixture.abortCalls) {
      assert.deepEqual(call.params, { key: call.params.key, clearQueued: true });
      assert.ok(call.scopes.includes('operator.write'), 'sessions.abort is sent on an operator.write connection');
    }
    assert.ok(!abortedKeys(fixture).includes(BUDGET_CONFIGURED_SESSION), 'the configured prince session is never aborted');
    assert.ok(fixture.calls.filter((call) => call.scopes?.length === 1).every((call) => call.method !== 'sessions.abort'), 'the read-only meter never aborts');

    assert.equal(receipt.schema, 'openclaw.k6.token-budget-receipt.v2');
    assert.equal(receipt.verdict, 'BUDGET-ABORT');
    assert.deepEqual(rowStatuses(receipt), { PREFLIGHT: 'completed', 'R-CONFIG-DEFAULTS': 'budget-stopped', 'R-CONFIG-INTERSESSION': 'not-run (budget)' });
    assert.equal(receipt.abort.attempted, true);
    assert.equal(receipt.abort.abortCalls, 2);
    assert.equal(receipt.abort.retries, 0);
    assert.deepEqual(receipt.abort.counts, { owned: 2, aborted: 2, noActiveRun: 0, acknowledged: 0, refused: 0, failed: 0, notAttempted: 0, skipped: 0, ambiguous: 0 });
    assert.deepEqual(receipt.abort.sessions.map(({ id, role, depth, outcome }) => ({ id, role, depth, outcome })), [
      { id: publicIdOf(ROOT, 'sid-r-config-defaults-owned'), role: 'root', depth: 0, outcome: 'aborted' },
      { id: publicIdOf(CHILD, 'owned-child'), role: 'descendant', depth: 1, outcome: 'aborted' },
    ]);
    assert.equal(receipt.abort.ownership.records, 1, 'one ownership record, from the row that created the root');
    assert.equal(receipt.abort.untouched.preExisting, 1, 'the prince session is untouched');

    // Metering continued after the abort, through the drain window.
    const abortedAt = Date.parse(receipt.abort.completedAt);
    assert.ok(receipt.readings.filter((reading) => Date.parse(reading.at) > abortedAt).length >= 2, 'readings continue after the abort');
    assert.equal(receipt.readings.at(-1).final, true);
    assert.equal(receipt.overshoot.drain.metered, true);
    assert.equal(receipt.overshoot.drain.windowSeconds, 1);
    assert.ok(Date.parse(receipt.overshoot.drain.endedAt) - Date.parse(receipt.overshoot.drain.startedAt) >= 1000, 'the drain window is held');
    assert.ok(receipt.overshoot.observed.readingsAfterAbort >= 2);
    assert.equal(receipt.overshoot.observed.postAbortTokens, 0, 'nothing grew once both were aborted');
    assert.equal(receipt.overshoot.observed.finalCumulative, receipt.cumulative);
    assert.equal(receipt.overshoot.observed.pastBudgetTokens, Math.max(0, receipt.cumulative - 1000));
    assert.equal(receipt.overshoot.observed.postTripTokens, receipt.cumulative - receipt.trip.cumulative);
    assert.ok(receipt.overshoot.maxPossibleReasons.includes(ACK_NOTE));
    assertCutoffLabels(receipt);
    assertPublicSafe(fixture, [ROOT, CHILD, 'owned-child', 'sid-r-config-defaults-owned', 'r-config-defaults-owned']);

    assert.match(result.stderr, /TOKEN BUDGET CUTOFF: 2 owned session\(s\): 2 aborted, 0 no-active-run, 0 refused, 0 failed, 0 not attempted, 0 skipped; 2 abort call\(s\), no retry\./u);
    // The stopped row's public k6 log keeps the record's place but not its contents.
    const k6Log = await readFile(path.join(fixture.runDirs['R-CONFIG-DEFAULTS'], 'k6.log'), 'utf8');
    assert.match(k6Log, /\[k6-owned-session\] <redacted-ownership-record>/u);
    for (const secret of ['r-config-defaults-owned', 'sid-r-config-defaults']) assert.ok(!k6Log.includes(secret), `the public k6.log must not carry ${secret}`);
    assert.doesNotMatch(k6Log, /\b[0-9a-f]{32}\b/u, 'nor the ownership tag');
  } finally {
    await fixture.cleanup();
  }
});

const active = (tokens) => (session) => (session.aborted ? 0 : tokens);
const terminated = (gateway, scenario = 'r-config-defaults.js') => Boolean(gateway.markers) && existsSync(path.join(gateway.markers, `${scenario}.terminated`));
const ambiguousById = (receipt) => Object.fromEntries(receipt.abort.ambiguous.map((entry) => [entry.id, entry.reason]));

test('cutoff (2): ambiguous ownership is never aborted and each case is logged, while the owned session still is', async () => {
  const MISMATCH = 'agent:main:r-config-defaults-mismatch';
  const UNRECORDED = 'agent:main:r-config-defaults-unrecorded';
  const ORPHAN = 'agent:main:subagent:orphan';
  const MIXED = 'agent:main:subagent:mixed';
  const THREAD = 'agent:main:discord:channel:thread';
  const gateway = world({
    baseline: [prince()],
    onCreate: (session, { add }) => {
      if (session.key === ROOT) {
        // A k6-labelled session no record names: the disposable-session selector matches it.
        add({ key: UNRECORDED, sessionId: 'unrecorded', label: 'k6 R-CONFIG-DEFAULTS unrecorded', grow: active(200) });
        // A child whose parent is not listed anywhere.
        add({ key: ORPHAN, sessionId: 'orphan', spawnedBy: 'agent:main:subagent:gone', grow: active(200) });
        // Spawned by the owned root, but its lineage names the prince session.
        add({ key: MIXED, sessionId: 'mixed', spawnedBy: ROOT, parentSessionKey: BUDGET_CONFIGURED_SESSION, grow: active(200) });
        // A channel thread new since the baseline that an adopting create re-parented onto the root.
        add({ key: THREAD, sessionId: 'thread', parentSessionKey: ROOT, grow: active(200) });
      }
      // The create answer names a session id the listing does not show.
      if (session.key === MISMATCH) session.answerSessionId = 'sid-answered';
    },
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '2-ambiguous-ownership',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: { 'r-config-defaults.js': [...CREATE_ROOT['r-config-defaults.js'], { key: 'r-config-defaults-mismatch', label: 'k6 R-CONFIG-DEFAULTS mismatch' }] },
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT], 'only the provably owned session is aborted');
    assert.deepEqual(ambiguousById(receipt), {
      [publicIdOf(MISMATCH, 'sid-r-config-defaults-mismatch')]: 'recorded-session-id-mismatch',
      [publicIdOf(UNRECORDED, 'unrecorded')]: 'selector-match-without-record',
      [publicIdOf(ORPHAN, 'orphan')]: 'unknown-parent',
      [publicIdOf(MIXED, 'mixed')]: 'conflicting-ancestry',
      [publicIdOf(THREAD, 'thread')]: 'lineage-only-parent',
    });
    assert.equal(gateway.sessions.get(THREAD).aborted, false);
    assert.equal(receipt.abort.ambiguous.find((entry) => entry.reason === 'selector-match-without-record').labelled, true);
    assert.equal(receipt.abort.counts.ambiguous, 5);
    assert.equal(receipt.abort.counts.aborted, 1);
    for (const [id, reason] of Object.entries(ambiguousById(receipt))) {
      assert.ok(result.stderr.includes(`TOKEN BUDGET CUTOFF: session ${id} not aborted: ambiguous ownership (${reason}).`), `logged: ${id} ${reason}`);
    }
    // The harness still stops.
    assert.deepEqual(rowStatuses(receipt), { PREFLIGHT: 'completed', 'R-CONFIG-DEFAULTS': 'budget-stopped', 'R-CONFIG-INTERSESSION': 'not-run (budget)' });
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('5 session(s) of ambiguous ownership were not aborted'));
    const growing = new Set(receipt.overshoot.observed.sessionsGrowingAfterAbort.filter((entry) => !entry.owned).map((entry) => entry.id));
    assert.ok(growing.has(publicIdOf(UNRECORDED, 'unrecorded')), 'work left in an ambiguous session keeps being metered');
    assertCutoffLabels(receipt);
    assertPublicSafe(fixture, [MISMATCH, UNRECORDED, ORPHAN, MIXED, THREAD, 'sid-answered']);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (3a): an active prince session that matches every broad selector is left alone', async () => {
  const HEARTBEAT = 'agent:main:heartbeat';
  // Configured (so in the meter's scope), k6-labelled, growing on every read.
  const gateway = world({
    baseline: [
      prince({ label: 'k6 R-CONFIG-DEFAULTS from an earlier run', grow: () => 50 }),
      { key: HEARTBEAT, sessionId: 'heartbeat', label: 'k6 heartbeat', grow: () => 50 },
    ],
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '3a-active-prince-untouched',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT], 'the disposable session is aborted; no prince session is');
    assert.equal(gateway.sessions.get(BUDGET_CONFIGURED_SESSION).aborted, false);
    assert.equal(gateway.sessions.get(HEARTBEAT).aborted, false);
    assert.deepEqual(receipt.abort.untouched, { preExisting: 2, configured: 0, notOwned: 0 });
    assert.deepEqual(receipt.abort.ambiguous, []);
    const prince = receipt.overshoot.observed.sessionsGrowingAfterAbort.find((entry) => entry.id === publicIdOf(BUDGET_CONFIGURED_SESSION, 'configured'));
    assert.ok(prince && prince.owned === false && prince.tokens > 0, 'the prince session keeps working, and keeps being metered');
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('configured sessions the rows use are in the meter\'s scope and are never aborted'));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (3b): a prince session is left alone even when a record names it: an adopted create and a forged line', async () => {
  const HEARTBEAT = 'agent:main:heartbeat';
  const gateway = world({
    baseline: [
      prince({ label: 'k6 R-CONFIG-DEFAULTS from an earlier run', grow: () => 50 }),
      { key: HEARTBEAT, sessionId: 'heartbeat', grow: () => 50 },
    ],
  });
  const forged = (message) => `time="2026-11-19T00:00:00.000Z" level=info msg=${JSON.stringify(message)} source=console`;
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '3b-prince-adopted-and-forged-record',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    // The second create names the configured session; the gateway adopts it and
    // answers its real key and session id, so the run's own tagged record names it.
    creates: { 'r-config-defaults.js': [...CREATE_ROOT['r-config-defaults.js'], { key: 'token-budget-fixture', label: 'k6 R-CONFIG-DEFAULTS adopt' }] },
    logLines: {
      'r-config-defaults.js': [
        // A record with a tag that is not this run's.
        forged(`[k6-owned-session] ${'0'.repeat(32)} {"key":"${HEARTBEAT}","sessionId":"heartbeat"}`),
        // Reply text that only mentions the marker is not a record at all.
        forged(`assistant: [k6-owned-session] ${'1'.repeat(32)} {"key":"${HEARTBEAT}","sessionId":"heartbeat"}`),
      ],
    },
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT]);
    assert.equal(gateway.sessions.get(BUDGET_CONFIGURED_SESSION).aborted, false);
    assert.equal(gateway.sessions.get(HEARTBEAT).aborted, false);
    assert.equal(receipt.abort.ownership.records, 2, 'both creates were recorded, the adopted one included');
    assert.equal(receipt.abort.ownership.recordsRejected, 1, 'the forged record is rejected');
    assert.deepEqual(ambiguousById(receipt), { [publicIdOf(BUDGET_CONFIGURED_SESSION, 'configured')]: 'recorded-session-present-at-baseline' });
    assert.equal(receipt.abort.untouched.preExisting, 1);
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (4a): a refused abort is recorded and never retried; the harness still stops', async () => {
  const gateway = world({
    baseline: [prince()],
    onCreate: ownedChild,
    abort: () => ({ ok: false, error: { code: 'INVALID_REQUEST', message: 'unauthorized' } }),
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '4a-abort-refused',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT, CHILD], 'one call per owned session, no second try');
    assert.equal(receipt.abort.abortCalls, 2);
    assert.equal(receipt.abort.retries, 0);
    assert.deepEqual(receipt.abort.sessions.map(({ outcome, error, refusal }) => ({ outcome, error, refusal })), [
      { outcome: 'refused', error: 'sessions-abort:INVALID_REQUEST', refusal: 'unauthorized' },
      { outcome: 'refused', error: 'sessions-abort:INVALID_REQUEST', refusal: 'unauthorized' },
    ]);
    assert.equal(receipt.abort.counts.refused, 2);
    assert.match(result.stderr, /TOKEN BUDGET CUTOFF: session [0-9a-f]{12} \(root\) refused \(unauthorized\); not retried\./u);
    assert.deepEqual(rowStatuses(receipt), { PREFLIGHT: 'completed', 'R-CONFIG-DEFAULTS': 'budget-stopped', 'R-CONFIG-INTERSESSION': 'not-run (budget)' });
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('2 owned session(s) were refused, failed or not attempted, and nothing is retried'));
    assert.match(receipt.verdictText, /the cutoff aborted 0 of 2 owned session\(s\) \(2 refused\)/u, 'the verdict text says what the cutoff did, not what it meant to');
    assert.doesNotMatch(receipt.verdictText, /aborted the sessions it could prove/u);
    const growing = receipt.overshoot.observed.sessionsGrowingAfterAbort.filter((entry) => entry.owned);
    assert.deepEqual(growing.map((entry) => entry.abortOutcome), ['refused', 'refused'], 'refused sessions keep consuming, and the receipt shows it');
    assertCutoffLabels(receipt);
    assert.ok(!fixture.receiptText.includes('unauthorized: '), 'no gateway message text is published');
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (4b): an abort that loses its connection is failed, the rest not attempted, with no reconnect', async () => {
  const gateway = world({ baseline: [prince()], onCreate: ownedChild, abort: () => ({ close: true }) });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '4b-abort-connection-lost',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT], 'the child is never tried on a second connection');
    // A dropped socket reads as a close or a socket error, whichever the client sees first.
    const [root, child] = receipt.abort.sessions;
    assert.ok(['gateway-closed', 'gateway-socket-error'].includes(root.error), root.error);
    assert.deepEqual(receipt.abort.sessions.map(({ role, outcome, reason }) => ({ role, outcome, reason })), [
      { role: 'root', outcome: 'failed', reason: undefined },
      { role: 'descendant', outcome: 'not-attempted', reason: 'abort-connection-failed' },
    ]);
    assert.equal(child.error, undefined);
    assert.equal(receipt.abort.error, `abort-connection-lost: ${root.error}`);
    assert.equal(receipt.abort.abortCalls, 1);
    assert.match(receipt.verdictText, /the cutoff aborted 0 of 2 owned session\(s\) \(1 failed, 1 not attempted\); the cutoff stopped early: abort-connection-lost: /u);
    assert.equal(rowStatuses(receipt)['R-CONFIG-INTERSESSION'], 'not-run (budget)');
    assert.ok(receipt.overshoot.maxPossibleReasons.includes(`the abort pass stopped early: abort-connection-lost: ${root.error}`));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (5): a queued continuation that fires after an acknowledged abort is metered, and the drain is not called complete', async () => {
  // The root's abort is acknowledged, then a continue_work wake scheduled before
  // it fires 300 ms later and runs one more model turn (openclaw ab5a: abort does
  // not cancel a scheduled wake).
  const gateway = world({
    baseline: [prince()],
    onCreate: (root) => {
      root.grow = (session) => {
        if (!session.aborted) return 300;
        if (!session.woke && Date.now() - session.abortedAt > 300) {
          session.woke = true;
          return 700;
        }
        return 0;
      };
    },
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '5-continuation-after-abort',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '2' },
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.equal(gateway.sessions.get(ROOT).woke, true, 'the wake fired after the abort');
    assert.deepEqual(receipt.abort.sessions.map((entry) => entry.outcome), ['aborted'], 'the abort was acknowledged');
    const { observed } = receipt.overshoot;
    assert.ok(observed.postAbortTokens >= 700, `post-abort tokens ${observed.postAbortTokens}`);
    assert.deepEqual(observed.sessionsGrowingAfterAbort.filter((entry) => entry.owned), [
      { id: publicIdOf(ROOT, 'sid-r-config-defaults-owned'), tokens: observed.sessionsGrowingAfterAbort.find((entry) => entry.owned).tokens, owned: true, abortOutcome: 'aborted' },
    ]);
    assert.ok(observed.sessionsGrowingAfterAbort.find((entry) => entry.owned).tokens >= 700);
    assert.ok(observed.quietReadingsAtEnd >= 1, 'the readings went quiet again after the wake');
    assert.equal(receipt.overshoot.drain.complete, 'unproven', 'and still the drain is not called complete');
    assert.ok(receipt.overshoot.maxPossibleReasons.includes(ACK_NOTE));
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('usage grew after the abort in 1 session(s)'));
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('sessions.abort does not cancel a continue_work wake that was already scheduled (openclaw ab5a30ea, by code reading)'));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (6): usage of a request that finished before the trip lands after it, and is reported as post-trip overshoot', async () => {
  const gateway = world({
    baseline: [prince()],
    onCreate: (root) => {
      // 300 per read until the row is stopped at the trip; then the transcript
      // write for a call that had already finished lands once, 500 tokens.
      root.grow = (session) => {
        if (!terminated(gateway)) return 300;
        if (!session.landed) {
          session.landed = true;
          return 500;
        }
        return 0;
      };
    },
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '6-delayed-usage',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '1' },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    const tripAt = Date.parse(receipt.trip.at);
    // What the meter records: the late 500 in a reading after the trip.
    assert.ok(receipt.overshoot, 'the receipt carries the overshoot');
    const late = receipt.readings.filter((reading) => Date.parse(reading.at) > tripAt && reading.increment >= 500);
    assert.equal(late.length, 1, JSON.stringify(receipt.readings.map(({ at, increment }) => ({ at, increment }))));
    // What the receipt reports: post-trip overshoot, attributed to when it became visible.
    const { observed } = receipt.overshoot;
    assert.ok(observed.postTripTokens >= 500, `post-trip tokens ${observed.postTripTokens}`);
    assert.equal(observed.pastBudgetTokens, Math.max(0, receipt.cumulative - 1000));
    const root = observed.sessionsGrowingAfterTrip.find((entry) => entry.id === publicIdOf(ROOT, 'sid-r-config-defaults-owned'));
    assert.ok(root && root.tokens >= 500);
    assert.match(observed.attribution, /when its model call completes and is written to the transcript, not when the request was sent/u);
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (7): two concurrent requests that both complete after the trip are each counted, and both sessions aborted', async () => {
  const SECOND = 'agent:main:r-config-defaults-second';
  // 4000 per late landing: far more than the 150-per-read growth between the
  // trip and the row's stop could add, so each session's post-trip figure can
  // only reach it through its own landing.
  const lateLanding = (session) => {
    if (!terminated(gateway)) return 150;
    if (!session.landed) {
      session.landed = true;
      return 4000;
    }
    return 0;
  };
  const gateway = world({ baseline: [prince()], onCreate: (session) => { session.grow = lateLanding; } });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '7-concurrent-requests',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: { 'r-config-defaults.js': [...CREATE_ROOT['r-config-defaults.js'], { key: 'r-config-defaults-second', label: 'k6 R-CONFIG-DEFAULTS second' }] },
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '1' },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(new Set(abortedKeys(fixture)), new Set([ROOT, SECOND]));
    assert.equal(fixture.abortCalls.length, 2);
    assert.equal(gateway.sessions.get(ROOT).landed, true);
    assert.equal(gateway.sessions.get(SECOND).landed, true);
    const { observed } = receipt.overshoot;
    assert.ok(observed.postTripTokens >= 8000, `both late landings are counted: ${observed.postTripTokens}`);
    const lateBySession = Object.fromEntries(observed.sessionsGrowingAfterTrip.map((entry) => [entry.id, entry.tokens]));
    assert.ok(lateBySession[publicIdOf(ROOT, 'sid-r-config-defaults-owned')] >= 4000, JSON.stringify(lateBySession));
    assert.ok(lateBySession[publicIdOf(SECOND, 'sid-r-config-defaults-second')] >= 4000, JSON.stringify(lateBySession));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

// Sibling paths: a trip between rows, an interrupted drain, a dead meter.

test('cutoff (8): a trip between rows aborts the sessions an earlier row left running', async () => {
  const PREFLIGHT_OWNED = 'agent:main:preflight-owned';
  const gateway = world({
    baseline: [prince({ tokens: 0 })],
    onCreate: (session) => {
      // Residual work after its row ended (a late wake or delegate return).
      session.grow = (s) => (s.aborted || !existsSync(path.join(gateway.markers, 'preflight.js.finished')) ? 0 : 600);
    },
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '8-trip-between-rows',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: { 'preflight.js': [{ key: 'preflight-owned', label: 'k6 PREFLIGHT owned' }] },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [PREFLIGHT_OWNED]);
    assert.equal(receipt.abort.counts.aborted, 1);
    assert.equal(rowStatuses(receipt).PREFLIGHT, 'completed');
    assert.equal(rowStatuses(receipt)['R-CONFIG-INTERSESSION'], 'not-run (budget)');
    assert.equal(receipt.overshoot.drain.metered, true);
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (9): a runner interrupted during the drain keeps the cutoff record and says the drain was cut short', async () => {
  const gateway = world({ baseline: [prince()] });
  gateway.methods['sessions.abort'] = ((abort) => async (params) => {
    const answer = await abort(params);
    // A cancelled workflow: SIGTERM to the runner shortly after the cutoff.
    const runnerPid = Number((await readFile(path.join(gateway.markers, 'runner.pid'), 'utf8')).trim());
    setTimeout(() => process.kill(runnerPid, 'SIGTERM'), 400);
    return answer;
  })(gateway.methods['sessions.abort']);
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '9-interrupted-during-drain',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '30' },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, 143, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.elapsedMs < 25_000, `the 30 s drain is cut short (took ${result.elapsedMs} ms)`);
    assert.equal(receipt.verdict, 'RUN-INTERRUPTED');
    assert.equal(receipt.guard, GUARD);
    assert.match(receipt.verdictText, /a cutoff was made at the trip before the interruption: it aborted 1 of 1 owned session\(s\)/u);
    assert.deepEqual(abortedKeys(fixture), [ROOT]);
    assert.equal(receipt.abort.counts.aborted, 1);
    assert.equal(receipt.overshoot.drain.metered, false);
    assert.equal(receipt.overshoot.drain.reason, 'runner-interrupted');
    assert.equal(fixture.metersLeft, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('cutoff (10): a meter that dies still gets the cutoff, and the receipt says the drain was not metered', async () => {
  const PREFLIGHT_OWNED = 'agent:main:preflight-owned';
  const gateway = world({ baseline: [prince()], onCreate: (session) => { session.grow = () => 10; } });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '10-meter-died',
    budget: '3200000',
    sleepSeconds: { 'r-config-intersession.js': 60 },
    creates: { 'preflight.js': [{ key: 'preflight-owned', label: 'k6 PREFLIGHT owned' }] },
    actions: { 'r-config-intersession.js': 'kill-meter' },
    usage: () => gateway.methods,
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.equal(receipt.runnerTrip.reason, 'meter-exited');
    assert.deepEqual(abortedKeys(fixture), [PREFLIGHT_OWNED], 'a lost counter is a trip: the run\'s sessions are cut off');
    assert.match(receipt.verdictText, /^BUDGET-ABORT \(cutoff, not a hard ceiling\): the run was stopped when its token counter was lost \(meter-exited\); the cutoff aborted 1 of 1 owned session\(s\); /u);
    // F3: nothing was read after the abort, so nothing is claimed about it.
    assert.equal(receipt.overshoot.observed.readingsAfterAbort, 0);
    assert.equal(receipt.overshoot.observed.postAbortTokens, null);
    assert.equal(receipt.overshoot.drain.metered, false);
    assert.equal(receipt.overshoot.drain.reason, 'meter-exited');
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('the drain was not metered: meter-exited'));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('a malformed drain window is refused before any row, naming the setting and never its value', async () => {
  for (const drain of ['-1', '1801', '1e3', 'soon', '0.0001']) {
    const fixture = await runBudgetMatrix(repoRoot, { budget: '3200000', env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: drain } });
    try {
      assert.equal(fixture.result.code, 80, `${drain}: ${fixture.result.stdout}\n${fixture.result.stderr}`);
      assert.equal(fixture.receipt.verdict, 'BUDGET-UNENFORCEABLE');
      assert.equal(fixture.receipt.reason, 'drain-seconds-invalid');
      assert.equal(fixture.k6.PREFLIGHT.started, false);
      assert.deepEqual(fixture.usageCalls, []);
    } finally {
      await fixture.cleanup();
    }
  }
});

// Independent review of b76fedf2: runner-level repairs, each RED on that SHA.

/** The pids of this runner's own processes whose command line matches `pattern`. */
async function runnerDescendants(runnerPid, pattern) {
  const { execFileSync } = await import('node:child_process');
  const rows = execFileSync('ps', ['-e', '-o', 'pid=,ppid=,args='], { encoding: 'utf8' }).split('\n').map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(line)).filter(Boolean)
    .map(([, pid, ppid, args]) => ({ pid: Number(pid), ppid: Number(ppid), args }));
  const parent = new Map(rows.map((row) => [row.pid, row.ppid]));
  const descends = (pid) => {
    for (let at = parent.get(pid), hops = 0; at && hops < 20; at = parent.get(at), hops += 1) if (at === runnerPid) return true;
    return false;
  };
  return rows.filter((row) => pattern.test(row.args) && descends(row.pid)).map((row) => row.pid);
}

const runnerPidOf = async (gateway) => Number((await readFile(path.join(gateway.markers, 'runner.pid'), 'utf8')).trim());

test('review F2: an abort step killed mid-pass leaves its in-progress record, and the verdict says the record is incomplete', async () => {
  const gateway = world({ baseline: [prince()], onCreate: ownedChild });
  gateway.methods['sessions.abort'] = async () => {
    // The abort process dies before it can answer for itself (a cancelled job, an OOM kill).
    for (const pid of await runnerDescendants(await runnerPidOf(gateway), /token-budget-abort\.mjs abort/u)) process.kill(pid, 'SIGKILL');
    return { ok: true, payload: { ok: true, abortedRunId: 'run-fixture', status: 'aborted' } };
  };
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '11-abort-step-killed',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.ok(fixture.abortCalls.length >= 1, 'the abort pass had begun');
    assert.equal(receipt.abort.phase, 'aborting', 'the record written before the first abort call survives');
    assert.equal(receipt.abort.completedAt, null);
    assert.deepEqual(receipt.abort.sessions.map((entry) => entry.outcome), ['pending', 'pending']);
    assert.match(receipt.verdictText, /the cutoff left no complete record \(it stopped while aborting 2 owned session\(s\)\), so sessions may have been aborted/u);
    assert.ok(receipt.overshoot.maxPossibleReasons.includes('the cutoff left no complete record, so sessions may have been aborted'));
    assertCutoffLabels(receipt);
  } finally {
    await fixture.cleanup();
  }
});

test('review F5: a meter that freezes during the drain is not reported as having metered it', async () => {
  const gateway = world({ baseline: [prince()] });
  gateway.methods['sessions.abort'] = ((abort) => async (params) => {
    const answer = await abort(params);
    for (const pid of await runnerDescendants(await runnerPidOf(gateway), /token-budget-meter\.mjs watch/u)) process.kill(pid, 'SIGSTOP');
    return answer;
  })(gateway.methods['sessions.abort']);
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '12-meter-frozen-during-drain',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '30' },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(abortedKeys(fixture), [ROOT]);
    assert.equal(receipt.overshoot.drain.metered, false);
    assert.ok(['meter-stale-during-drain', 'no-readable-reading-after-abort'].includes(receipt.overshoot.drain.reason), receipt.overshoot.drain.reason);
    assert.ok(result.elapsedMs < 45_000, `a frozen meter ends the drain early (took ${result.elapsedMs} ms)`);
    assert.equal(fixture.metersLeft, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('review F5 sibling: a meter that dies during the drain is reported as such', async () => {
  const gateway = world({ baseline: [prince()] });
  gateway.methods['sessions.abort'] = ((abort) => async (params) => {
    const answer = await abort(params);
    setTimeout(async () => {
      for (const pid of await runnerDescendants(await runnerPidOf(gateway), /token-budget-meter\.mjs watch/u)) process.kill(pid, 'SIGKILL');
    }, 300);
    return answer;
  })(gateway.methods['sessions.abort']);
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '12b-meter-died-during-drain',
    budget: '1000',
    sleepSeconds: LONG_ROW,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_DRAIN_SECONDS: '30' },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.equal(receipt.overshoot.drain.metered, false);
    assert.equal(receipt.overshoot.drain.reason, 'meter-exited-during-drain');
    assert.ok(result.elapsedMs < 25_000, `took ${result.elapsedMs} ms`);
  } finally {
    await fixture.cleanup();
  }
});

test('review F6: a trip after a row\'s k6 exits on its own is cut off during that row\'s post-processing, not after it', async () => {
  // The root burns only once its row's k6 has finished, and that row's journal
  // capture then takes 2 s: the trip lands mid post-processing.
  const gateway = world({
    baseline: [prince({ tokens: 0 })],
    onCreate: (session) => {
      session.grow = (s) => (s.aborted || !existsSync(path.join(gateway.markers, 'r-config-defaults.js.finished')) ? 0 : 600);
    },
  });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '13-trip-during-post-processing',
    budget: '1000',
    sleepSeconds: { 'r-config-defaults.js': 0.5 },
    creates: CREATE_ROOT,
    journalSleep: { afterScenario: 'r-config-defaults.js', seconds: 2 },
    usage: ({ markers }) => {
      gateway.markers = markers;
      return gateway.methods;
    },
  });
  try {
    const { result, receipt } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(rowStatuses(receipt), { PREFLIGHT: 'completed', 'R-CONFIG-DEFAULTS': 'completed', 'R-CONFIG-INTERSESSION': 'not-run (budget)' });
    assert.deepEqual(abortedKeys(fixture), [ROOT]);
    const { mtimeMs } = await (await import('node:fs/promises')).stat(path.join(fixture.runDirs['R-CONFIG-DEFAULTS'], 'run-result.json'));
    assert.ok(fixture.abortCalls[0].at < mtimeMs, `the abort (${fixture.abortCalls[0].at}) comes before the row's run-result (${Math.round(mtimeMs)})`);
  } finally {
    await fixture.cleanup();
  }
});

test('review F8: an ownership tag inherited from the caller is cleared, so an unbudgeted run logs no record', async () => {
  const gateway = world({ baseline: [prince()] });
  const fixture = await runBudgetMatrix(repoRoot, {
    label: '14-unbudgeted-inherited-tag',
    budget: null,
    creates: CREATE_ROOT,
    env: { OPENCLAW_PROOFS_OWNERSHIP_TAG: 'c'.repeat(32) },
    usage: () => gateway.methods,
  });
  try {
    const { result } = fixture;
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fixture.receipt, null);
    assert.equal(gateway.sessions.has(ROOT), true, 'the row created its session');
    const k6Log = await readFile(path.join(fixture.runDirs['R-CONFIG-DEFAULTS'], 'k6.log'), 'utf8');
    assert.ok(!k6Log.includes('[k6-owned-session]'), 'no ownership record, not even a redacted one');
    assert.deepEqual(fixture.abortCalls, []);
  } finally {
    await fixture.cleanup();
  }
});
