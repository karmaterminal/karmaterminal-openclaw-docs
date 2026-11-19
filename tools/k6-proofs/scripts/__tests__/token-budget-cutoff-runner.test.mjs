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
import {
  BUDGET_CONFIGURED_SESSION,
  runBudgetMatrix,
  usagePoint,
} from './helpers/token-budget-runner-fixture.mjs';

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
    assert.ok(fixture.calls.filter((call) => call.method.startsWith('sessions.') && call.method !== 'sessions.abort').every((call) => call.method !== 'sessions.abort'));
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
