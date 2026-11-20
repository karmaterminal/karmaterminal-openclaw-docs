// The token budget's cutoff decisions on their own (lib/token-budget-cutoff.mjs)
// and the abort step's fail-closed paths (scripts/token-budget-abort.mjs).
//
// 🌊's ruling (Discord 1573086211386384495): abort only sessions the run
// provably owns, fail closed on ambiguous ownership, never touch a prince
// session. 🌫's additions (1573086236497678419): the observed overshoot apart
// from the maximum possible one, which is unknown when unbounded, and no
// quiet window called a finished drain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ABORT_ACK_NOTE,
  ABORT_BOUNDARY_NOTE,
  AMBIGUITY_REASONS,
  CUTOFF_GUARD,
  DRAIN_NOTE,
  MAX_POSSIBLE_UNBOUNDED,
  computeOvershoot,
  resolveOwnership,
  runAbortPass,
  sessionPublicId,
} from '../../lib/token-budget-cutoff.mjs';
import { cutoff, harvest, readLedger } from '../token-budget-abort.mjs';
import { OWNERSHIP_MARKER } from '../../lib/session-ownership.mjs';

const PRINCE = 'agent:main:main';
const HEARTBEAT = 'agent:main:heartbeat';
const ROOT = 'agent:main:r-cw-1-nonce';
const baseline = [{ key: PRINCE, sessionId: 'prince' }, { key: HEARTBEAT, sessionId: 'heartbeat' }];
const princeRows = [{ key: PRINCE, sessionId: 'prince', label: 'k6 R-CW-1 earlier' }, { key: HEARTBEAT, sessionId: 'heartbeat' }];

const keysOf = (entries) => entries.map((entry) => entry.key);
const reasons = (decision) => Object.fromEntries(decision.ambiguous.map((entry) => [entry.key, entry.reason]));

test('a recorded root and its descendants by spawnedBy and controlOwnerSessionKey are owned, roots newest first, then by depth', () => {
  const decision = resolveOwnership({
    records: [{ key: 'agent:main:older-root', sessionId: 'older' }, { key: ROOT, sessionId: 'root' }],
    baseline,
    rows: [
      ...princeRows,
      { key: 'agent:main:subagent:grandchild', sessionId: 'g', controlOwnerSessionKey: 'agent:main:subagent:child' },
      { key: 'agent:main:subagent:child', sessionId: 'c', spawnedBy: ROOT, controlOwnerSessionKey: ROOT },
      { key: ROOT, sessionId: 'root', label: 'k6 R-CW-1 nonce' },
      { key: 'agent:main:older-root', sessionId: 'older', label: 'k6 R-CD-1 nonce' },
      { key: 'agent:main:fork', sessionId: 'f', spawnedBy: 'agent:main:older-root', parentSessionKey: 'agent:main:older-root' },
    ],
  });
  assert.deepEqual(decision.owned.map(({ key, role, depth, abortable }) => ({ key, role, depth, abortable })), [
    { key: ROOT, role: 'root', depth: 0, abortable: true },
    { key: 'agent:main:older-root', role: 'root', depth: 0, abortable: true },
    { key: 'agent:main:subagent:child', role: 'descendant', depth: 1, abortable: true },
    { key: 'agent:main:fork', role: 'descendant', depth: 1, abortable: true },
    { key: 'agent:main:subagent:grandchild', role: 'descendant', depth: 2, abortable: true },
  ]);
  assert.deepEqual(decision.ambiguous, []);
  assert.deepEqual(decision.untouched, { preExisting: 2, configured: 0, notOwned: 0 });
});

test('each way ownership can be undecidable is ambiguous, with its own reason, and never owned', () => {
  const decision = resolveOwnership({
    records: [
      { key: 'agent:main:pre-existing', sessionId: 'pre' },
      { key: 'agent:main:mismatch', sessionId: 'recorded' },
      { key: 'agent:main:no-id', sessionId: null },
      { key: 'agent:main:listed-without-id', sessionId: 'x' },
      { key: 'agent:main:twice', sessionId: 'one' },
      { key: 'agent:main:twice', sessionId: 'two' },
      { key: 'agent:main:target', sessionId: 'target' },
      { key: ROOT, sessionId: 'root' },
    ],
    baseline: [...baseline, { key: 'agent:main:pre-existing', sessionId: 'pre' }],
    configuredKeys: ['agent:main:target'],
    rows: [
      ...princeRows,
      { key: 'agent:main:pre-existing', sessionId: 'pre' },
      { key: 'agent:main:mismatch', sessionId: 'listed' },
      { key: 'agent:main:no-id', sessionId: 'n' },
      { key: 'agent:main:listed-without-id' },
      { key: 'agent:main:twice', sessionId: 'one' },
      { key: 'agent:main:target', sessionId: 'target' },
      { key: ROOT, sessionId: 'root' },
      { key: 'agent:main:orphan', sessionId: 'o', spawnedBy: 'agent:main:gone' },
      { key: 'agent:main:child-of-ambiguous', sessionId: 'ca', spawnedBy: 'agent:main:mismatch' },
      { key: 'agent:main:mixed', sessionId: 'm', spawnedBy: ROOT, parentSessionKey: PRINCE },
      { key: 'agent:main:loop-a', sessionId: 'la', spawnedBy: 'agent:main:loop-b' },
      { key: 'agent:main:loop-b', sessionId: 'lb', spawnedBy: 'agent:main:loop-a' },
      { key: 'agent:main:labelled', sessionId: 'l', label: 'k6 R-CW-2 nonce' },
      { key: 'agent:main:new', sessionId: 'n2' },
      { key: 'agent:main:lineage', sessionId: 'ln', parentSessionKey: ROOT },
    ],
  });
  assert.deepEqual(reasons(decision), {
    'agent:main:pre-existing': 'recorded-session-present-at-baseline',
    'agent:main:mismatch': 'recorded-session-id-mismatch',
    'agent:main:no-id': 'recorded-session-id-unverifiable',
    'agent:main:listed-without-id': 'recorded-session-id-unverifiable',
    'agent:main:twice': 'conflicting-records',
    'agent:main:target': 'configured-session',
    'agent:main:orphan': 'unknown-parent',
    'agent:main:child-of-ambiguous': 'ambiguous-parent',
    'agent:main:mixed': 'conflicting-ancestry',
    'agent:main:loop-a': 'ancestry-cycle',
    'agent:main:loop-b': 'ancestry-cycle',
    'agent:main:labelled': 'selector-match-without-record',
    'agent:main:new': 'unrecorded-new-session',
    'agent:main:lineage': 'lineage-only-parent',
  });
  assert.deepEqual(new Set(Object.values(reasons(decision))), new Set(AMBIGUITY_REASONS), 'every named reason is reachable');
  assert.deepEqual(keysOf(decision.owned), [ROOT]);
  assert.equal(decision.ambiguous.find((entry) => entry.key === 'agent:main:labelled').labelled, true);
});

test('prince sessions are never owned: listed at the baseline, configured, labelled, or descended from', () => {
  const decision = resolveOwnership({
    records: [{ key: ROOT, sessionId: 'root' }],
    baseline,
    configuredKeys: ['main', 'agent:main:target'],
    rows: [
      ...princeRows,
      { key: ROOT, sessionId: 'root' },
      { key: 'agent:main:target', sessionId: 'target', label: 'k6 R-CD-4 target' },
      { key: 'agent:main:subagent:prince-child', sessionId: 'pc', spawnedBy: PRINCE, controlOwnerSessionKey: PRINCE },
    ],
  });
  assert.deepEqual(keysOf(decision.owned), [ROOT]);
  assert.deepEqual(decision.ambiguous, []);
  assert.deepEqual(decision.untouched, { preExisting: 2, configured: 1, notOwned: 1 });
});

test('an owned session whose cascade would reach a session it cannot prove is its own is not aborted', () => {
  const decision = resolveOwnership({
    records: [{ key: ROOT, sessionId: 'root' }],
    baseline,
    rows: [
      ...princeRows,
      { key: ROOT, sessionId: 'root' },
      // Controlled by the root (the product's cascade rule), spawned by the prince: a proxied spawn.
      { key: 'agent:main:subagent:proxied', sessionId: 'p', spawnedBy: PRINCE, controlOwnerSessionKey: ROOT },
      { key: 'agent:main:subagent:own', sessionId: 'o', spawnedBy: ROOT, controlOwnerSessionKey: ROOT },
    ],
  });
  assert.deepEqual(decision.owned.map(({ key, abortable, skipReason }) => ({ key, abortable, skipReason })), [
    { key: ROOT, abortable: false, skipReason: 'cascade-would-reach-unowned-session' },
    { key: 'agent:main:subagent:own', abortable: true, skipReason: undefined },
  ]);
  assert.deepEqual(reasons(decision), { 'agent:main:subagent:proxied': 'conflicting-ancestry' });
});

test('a record whose session is no longer listed is counted, never guessed at', () => {
  const decision = resolveOwnership({ records: [{ key: ROOT, sessionId: 'root' }], baseline, rows: princeRows });
  assert.deepEqual(decision.owned, []);
  assert.equal(decision.recordedNotListed, 1);
});

test('over many random gateways, nothing at the baseline, configured or unrecorded-without-owned-ancestry is ever owned', () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let round = 0; round < 300; round += 1) {
    const keys = Array.from({ length: 8 }, (_, index) => `agent:main:s${index}`);
    const atBaseline = new Set(keys.filter(() => random() < 0.3));
    const pick = () => (random() < 0.5 ? keys[Math.floor(random() * keys.length)] : (random() < 0.2 ? 'agent:main:gone' : undefined));
    const rows = keys.filter(() => random() < 0.9).map((key) => ({
      key,
      sessionId: random() < 0.95 ? `id-${key}` : undefined,
      spawnedBy: pick(),
      parentSessionKey: random() < 0.3 ? pick() : undefined,
      controlOwnerSessionKey: random() < 0.3 ? pick() : undefined,
      label: random() < 0.5 ? 'k6 R-X nonce' : undefined,
    }));
    const records = keys.filter(() => random() < 0.3).map((key) => ({ key, sessionId: random() < 0.9 ? `id-${key}` : 'other' }));
    const configuredKeys = random() < 0.5 ? [keys[0]] : [];
    const decision = resolveOwnership({ records, baseline: [...atBaseline].map((key) => ({ key, sessionId: `id-${key}` })), rows, configuredKeys });
    const owned = new Set(keysOf(decision.owned));
    const recorded = new Set(records.map((record) => record.key));
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const entry of decision.owned) {
      assert.ok(!atBaseline.has(entry.key), `round ${round}: ${entry.key} was at the baseline`);
      assert.ok(!configuredKeys.includes(entry.key), `round ${round}: ${entry.key} is configured`);
      const row = byKey.get(entry.key);
      if (entry.role === 'root') {
        assert.ok(recorded.has(entry.key));
        assert.ok(records.filter((record) => record.key === entry.key).every((record) => record.sessionId === row.sessionId));
      } else {
        const parents = [row.spawnedBy, row.parentSessionKey, row.controlOwnerSessionKey].filter((parent) => parent && parent !== row.key);
        assert.ok(parents.length > 0 && parents.every((parent) => owned.has(parent)), `round ${round}: ${entry.key} has an unowned parent`);
        assert.ok([row.spawnedBy, row.controlOwnerSessionKey].some((parent) => parent && owned.has(parent)), `round ${round}: ${entry.key} is linked by lineage alone`);
      }
    }
    for (const entry of decision.owned.filter((item) => item.abortable)) {
      const reach = new Set();
      const stack = [entry.key];
      while (stack.length) {
        const controller = stack.pop();
        for (const row of rows.filter((candidate) => candidate.controlOwnerSessionKey === controller && !reach.has(candidate.key))) {
          reach.add(row.key);
          stack.push(row.key);
        }
      }
      assert.ok([...reach].every((key) => owned.has(key)), `round ${round}: ${entry.key}'s cascade reaches an unowned session`);
    }
  }
});

// ---------------------------------------------------------------------------
// The abort pass
// ---------------------------------------------------------------------------

const owned = (key, extra = {}) => ({ key, sessionId: `id-${key}`, role: 'root', depth: 0, abortable: true, ...extra });

test('each abortable owned session gets exactly one sessions.abort, in order; a skipped one gets none', async () => {
  const calls = [];
  const { results, calls: count } = await runAbortPass({
    rpc: async (method, params) => {
      calls.push({ method, params });
      return { ok: true, payload: { ok: true, abortedRunId: params.key === 'b' ? null : 'run', status: params.key === 'b' ? 'no-active-run' : 'aborted' } };
    },
    owned: [owned('a'), owned('skip', { abortable: false, skipReason: 'cascade-would-reach-unowned-session' }), owned('b'), owned('c')],
    deadline: Date.now() + 10_000,
  });
  assert.deepEqual(calls, ['a', 'b', 'c'].map((key) => ({ method: 'sessions.abort', params: { key, clearQueued: true } })));
  assert.equal(count, 3);
  assert.deepEqual(results.map(({ key, outcome, reason }) => ({ key, outcome, reason })), [
    { key: 'a', outcome: 'aborted', reason: undefined },
    { key: 'skip', outcome: 'skipped', reason: 'cascade-would-reach-unowned-session' },
    { key: 'b', outcome: 'no-active-run', reason: undefined },
    { key: 'c', outcome: 'aborted', reason: undefined },
  ]);
});

test('refusals are recorded by a fixed vocabulary and never retried; an unknown status is only acknowledged; a stopped session with incomplete descendants is partial', async () => {
  const answers = {
    unauthorized: { ok: false, error: { code: 'INVALID_REQUEST', message: 'unauthorized' } },
    partial: { ok: false, error: { code: 'UNAVAILABLE', message: 'Session stopped, but descendant cancellation was incomplete: agent:main:secret' } },
    missing: { ok: false, error: { code: 'INVALID_REQUEST', message: 'agent "main" not found' } },
    other: { ok: false, error: { code: 'weird code!', message: 'agent:main:secret' } },
    odd: { ok: true, payload: { status: 'pending' } },
  };
  const calls = [];
  const { results } = await runAbortPass({
    rpc: async (method, params) => {
      calls.push(params.key);
      return answers[params.key];
    },
    owned: Object.keys(answers).map((key) => owned(key)),
    deadline: Date.now() + 10_000,
  });
  assert.deepEqual(calls, Object.keys(answers), 'one call each, no retry');
  assert.deepEqual(results.map(({ outcome, error, refusal, status }) => ({ outcome, error, refusal, status })), [
    { outcome: 'refused', error: 'sessions-abort:INVALID_REQUEST', refusal: 'unauthorized', status: undefined },
    { outcome: 'partial', error: 'sessions-abort:UNAVAILABLE', refusal: 'descendants-incomplete', status: undefined },
    { outcome: 'refused', error: 'sessions-abort:INVALID_REQUEST', refusal: 'not-found', status: undefined },
    { outcome: 'refused', error: 'sessions-abort:ERROR', refusal: 'other', status: undefined },
    { outcome: 'acknowledged', error: undefined, refusal: undefined, status: 'unrecognized' },
  ]);
  assert.ok(!JSON.stringify(results.map(({ key, sessionId, ...rest }) => rest)).includes('secret'), 'no gateway message text is kept');
});

test('a call with no answer fails, and every later session is not attempted: no reconnect, no retry', async () => {
  const calls = [];
  const { results, calls: count, connectionError } = await runAbortPass({
    rpc: async (method, params) => {
      calls.push(params.key);
      if (params.key === 'b') throw new Error('gateway-rpc-timeout');
      return { ok: true, payload: { status: 'aborted' } };
    },
    owned: [owned('a'), owned('b'), owned('c'), owned('d', { abortable: false, skipReason: 'cascade-would-reach-unowned-session' })],
    deadline: Date.now() + 10_000,
  });
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(count, 2);
  assert.equal(connectionError, 'gateway-rpc-timeout');
  assert.deepEqual(results.map(({ outcome, error, reason }) => ({ outcome, error, reason })), [
    { outcome: 'aborted', error: undefined, reason: undefined },
    { outcome: 'failed', error: 'gateway-rpc-timeout', reason: undefined },
    { outcome: 'not-attempted', error: undefined, reason: 'abort-connection-failed' },
    { outcome: 'skipped', error: undefined, reason: 'cascade-would-reach-unowned-session' },
  ]);
  const thrown = await runAbortPass({ rpc: async () => { throw new Error('Something with agent:main:secret'); }, owned: [owned('a')], deadline: Date.now() + 1000 });
  assert.equal(thrown.results[0].error, 'rpc-error', 'an unexpected error text is never published');
});

test('sessions left when the deadline passes are not attempted', async () => {
  let now = 0;
  const { results } = await runAbortPass({
    rpc: async () => {
      now += 600;
      return { ok: true, payload: { status: 'aborted' } };
    },
    owned: [owned('a'), owned('b'), owned('c')],
    deadline: 1000,
    clock: () => now,
  });
  assert.deepEqual(results.map((result) => result.outcome), ['aborted', 'aborted', 'not-attempted']);
  assert.equal(results[2].reason, 'abort-deadline');
});

// ---------------------------------------------------------------------------
// The overshoot
// ---------------------------------------------------------------------------

const reading = (at, cumulative, increment, extra = {}) => ({ at: `2026-11-19T00:00:${String(at).padStart(2, '0')}.000Z`, readable: true, cumulative, increment, ...extra });

function stateFor() {
  return {
    budget: 1000,
    cumulative: 2100,
    trip: { reason: 'projected-exceed', at: '2026-11-19T00:00:03.000Z', cumulative: 900 },
    baseline: { scope: { byReason: { configured: 1 } } },
    tripSessions: [{ id: 'aaaaaaaaaaaa', lastTokens: 600 }, { id: 'bbbbbbbbbbbb', lastTokens: 300 }],
    // What the last reading before the abort pass finished left (reading 4).
    abortSessions: { markedAt: '2026-11-19T00:00:04.500Z', cumulative: 1200, sessions: [{ id: 'aaaaaaaaaaaa', lastTokens: 900 }, { id: 'bbbbbbbbbbbb', lastTokens: 300 }] },
    sessions: [
      { id: 'aaaaaaaaaaaa', baselineTokens: 0, lastTokens: 1600, state: 'live' },
      { id: 'bbbbbbbbbbbb', baselineTokens: 0, lastTokens: 300, state: 'live' },
      { id: 'cccccccccccc', baselineTokens: 0, lastTokens: 200, state: 'live' },
    ],
    readings: [
      reading(1, 300, 300),
      reading(2, 600, 300),
      reading(3, 900, 300),
      { at: '2026-11-19T00:00:03.500Z', readable: false, error: 'discovery: x', cumulative: 900, increment: null, discovery: true },
      reading(4, 1200, 300),
      reading(5, 1900, 700),
      reading(6, 2100, 200),
      reading(7, 2100, 0),
      reading(8, 2100, 0, { final: true }),
    ],
  };
}

const abortDoc = (extra = {}) => ({
  attempted: true,
  completedAt: '2026-11-19T00:00:04.500Z',
  error: null,
  sessions: [{ id: 'aaaaaaaaaaaa', outcome: 'aborted' }, { id: 'bbbbbbbbbbbb', outcome: 'refused' }],
  ambiguous: [{ id: 'dddddddddddd', reason: 'unknown-parent' }],
  ...extra,
});

test('the observed overshoot is measured from the readings; the maximum possible one is never claimed', () => {
  const overshoot = computeOvershoot({ state: stateFor(), abort: abortDoc(), drain: { metered: true, startedAt: 'x', endedAt: 'y', windowSeconds: 1 } });
  assert.equal(overshoot.guard, CUTOFF_GUARD);
  assert.deepEqual({ ...overshoot.observed, attribution: undefined }, {
    budget: 1000,
    finalCumulative: 2100,
    pastBudgetTokens: 1100,
    postTripTokens: 1200,
    postAbortTokens: 900,
    readingsAfterTrip: 5,
    readingsAfterAbort: 4,
    readingsStraddlingAbort: 0,
    unreadableReadingsAfterAbort: 0,
    lastGrowthAt: '2026-11-19T00:00:06.000Z',
    quietReadingsAtEnd: 2,
    sessionsGrowingAfterTrip: [{ id: 'aaaaaaaaaaaa', tokens: 1000 }, { id: 'cccccccccccc', tokens: 200 }],
    sessionsGrowingAfterAbort: [
      { id: 'aaaaaaaaaaaa', tokens: 700, owned: true, abortOutcome: 'aborted' },
      { id: 'cccccccccccc', tokens: 200, owned: false },
    ],
    attribution: undefined,
    abortBoundary: ABORT_BOUNDARY_NOTE,
  });
  assert.equal(overshoot.maxPossible, MAX_POSSIBLE_UNBOUNDED);
  assert.deepEqual(overshoot.drain, { metered: true, startedAt: 'x', endedAt: 'y', windowSeconds: 1, complete: 'unproven', note: DRAIN_NOTE });
  for (const reason of [
    ABORT_ACK_NOTE,
    'sessions.abort does not cancel a continue_work wake that was already scheduled (openclaw ab5a30ea, by code reading)',
    '1 owned session(s) were refused, failed or not attempted, and nothing is retried',
    '1 session(s) of ambiguous ownership were not aborted',
    'configured sessions the rows use are in the meter\'s scope and are never aborted',
    'usage grew after the abort in 2 session(s)',
    'compaction model calls and detached memory-flush runs are counted by no usage surface',
  ]) assert.ok(overshoot.maxPossibleReasons.includes(reason), reason);
});

test('even a clean cutoff with a quiet drain leaves the maximum unbounded and the drain unproven', () => {
  const state = {
    ...stateFor(),
    baseline: { scope: { byReason: {} } },
    readings: [reading(1, 900, 900), reading(4, 900, 0), reading(5, 900, 0, { final: true })],
    cumulative: 900,
    tripSessions: [],
    abortSessions: { markedAt: '2026-11-19T00:00:04.500Z', cumulative: 900, sessions: [] },
    sessions: [],
  };
  const overshoot = computeOvershoot({ state, abort: abortDoc({ sessions: [{ id: 'aaaaaaaaaaaa', outcome: 'aborted' }], ambiguous: [] }), drain: { metered: true } });
  assert.equal(overshoot.observed.postAbortTokens, 0);
  assert.equal(overshoot.observed.quietReadingsAtEnd, 2);
  assert.equal(overshoot.maxPossible, MAX_POSSIBLE_UNBOUNDED);
  assert.equal(overshoot.drain.complete, 'unproven');
  assert.ok(overshoot.maxPossibleReasons.includes(ABORT_ACK_NOTE));
});

test('no cutoff, an unattempted one, or an unrecorded drain are each named', () => {
  assert.equal(computeOvershoot({ state: stateFor() }).drain.reason, 'no-cutoff');
  assert.ok(computeOvershoot({ state: stateFor() }).maxPossibleReasons.includes('no abort was attempted'));
  const unattempted = computeOvershoot({ state: stateFor(), abort: { attempted: false, reason: 'ownership-ledger-unreadable', sessions: [], ambiguous: [] } });
  assert.ok(unattempted.maxPossibleReasons.includes('no abort was attempted: ownership-ledger-unreadable'));
  assert.equal(unattempted.drain.reason, 'drain-unrecorded');
  assert.ok(unattempted.maxPossibleReasons.includes('the drain was not metered: drain-unrecorded'));
  const noTrip = computeOvershoot({ state: { ...stateFor(), trip: null, cumulative: 500 } });
  assert.equal(noTrip.observed.postTripTokens, null);
  assert.equal(noTrip.observed.pastBudgetTokens, 0);
});

// ---------------------------------------------------------------------------
// The abort step: harvest and its fail-closed paths
// ---------------------------------------------------------------------------

const TAG = 'f'.repeat(32);

async function scratch() {
  const dir = await mkdtemp(path.join(tmpdir(), 'token-budget-cutoff-'));
  return { dir, file: (name) => path.join(dir, name), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('harvest keeps the tagged records of a row, counts the rest, and survives an unreadable log', async () => {
  const s = await scratch();
  try {
    await writeFile(s.file('k6.log'), [
      `${OWNERSHIP_MARKER} ${TAG} {"key":"${ROOT}","sessionId":"root"}`,
      `${OWNERSHIP_MARKER} ${'e'.repeat(32)} {"key":"${PRINCE}","sessionId":"prince"}`,
    ].join('\n'));
    assert.deepEqual(harvest({ log: s.file('k6.log'), row: 'R-CW-1', ledger: s.file('ledger'), tag: TAG }), { records: 1, rejected: 1 });
    assert.deepEqual(harvest({ log: s.file('missing.log'), row: 'R-CW-2', ledger: s.file('ledger'), tag: TAG }), { records: 0, rejected: 0, error: 'log-unreadable' });
    assert.deepEqual(readLedger(s.file('ledger')), { records: [{ key: ROOT, sessionId: 'root' }], rejected: 1, harvestFailures: 1 });
  } finally {
    await s.cleanup();
  }
});

function fakeGateway({ list = () => ({ ok: true, payload: { sessions: [...princeRows, { key: ROOT, sessionId: 'root' }], hasMore: false } }), abort = () => ({ ok: true, payload: { status: 'aborted' } }) } = {}) {
  const calls = [];
  return {
    calls,
    connect: async (scopes) => {
      calls.push({ method: 'connect', scopes });
      return {
        request: async (method, params) => {
          calls.push({ method, params });
          return method === 'sessions.list' ? list() : abort(params);
        },
        close: () => calls.push({ method: 'close' }),
      };
    },
  };
}

async function cutoffFiles({ ledger = `${JSON.stringify({ type: 'record', row: 'R-CW-1', key: ROOT, sessionId: 'root' })}\n`, baselineDoc = { at: 'x', sessions: baseline } } = {}) {
  const s = await scratch();
  if (ledger !== null) await writeFile(s.file('ledger'), ledger);
  if (baselineDoc !== null) await writeFile(s.file('baseline'), typeof baselineDoc === 'string' ? baselineDoc : JSON.stringify(baselineDoc));
  return { ...s, args: { ledgerFile: s.file('ledger'), baselineFile: s.file('baseline'), env: {} } };
}

test('the abort step aborts nothing when its ledger, its baseline or its listing cannot be read', async () => {
  for (const [label, files, gatewayOptions, expected] of [
    ['no ledger', { ledger: null }, {}, { attempted: false, reason: 'ownership-ledger-unreadable', error: null }],
    ['no baseline', { baselineDoc: null }, {}, { attempted: false, reason: 'baseline-sessions-unreadable', error: null }],
    ['a malformed baseline', { baselineDoc: '{"sessions":"nope"}' }, {}, { attempted: false, reason: 'baseline-sessions-unreadable', error: null }],
    ['a refused listing', {}, { list: () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'missing scope: operator.write' } }) }, { attempted: true, reason: null, error: 'listing-failed: sessions-list:FORBIDDEN' }],
  ]) {
    const s = await cutoffFiles(files);
    try {
      const gateway = fakeGateway(gatewayOptions);
      const doc = await cutoff({ ...s.args, connect: gateway.connect });
      assert.deepEqual({ attempted: doc.attempted, reason: doc.reason, error: doc.error }, expected, label);
      assert.equal(gateway.calls.filter((call) => call.method === 'sessions.abort').length, 0, `${label}: no abort`);
      assert.equal(doc.abortCalls, 0);
    } finally {
      await s.cleanup();
    }
  }
  const s = await cutoffFiles();
  try {
    const doc = await cutoff({ ...s.args, connect: async () => { throw new Error('gateway-auth-rejected'); } });
    assert.equal(doc.attempted, true);
    assert.equal(doc.error, 'abort-connection-failed: gateway-auth-rejected');
    assert.deepEqual(doc.sessions, []);
  } finally {
    await s.cleanup();
  }
});

test('the abort document is public-safe: sessions by hash, outcomes, counts, and no key or session id', async () => {
  const rootId = sessionPublicId(ROOT, 'sid-root-7f3a');
  const s = await cutoffFiles({ ledger: `${JSON.stringify({ type: 'record', row: 'R-CW-1', key: ROOT, sessionId: 'sid-root-7f3a' })}\n` });
  try {
    const gateway = fakeGateway({ list: () => ({ ok: true, payload: { sessions: [...princeRows, { key: ROOT, sessionId: 'sid-root-7f3a' }], hasMore: false } }) });
    const doc = await cutoff({ ...s.args, env: { OPENCLAW_SESSION_KEY: PRINCE }, connect: gateway.connect });
    assert.deepEqual(gateway.calls.find((call) => call.method === 'connect').scopes, ['operator.read', 'operator.write']);
    assert.deepEqual(gateway.calls.filter((call) => call.method === 'sessions.abort').map((call) => call.params), [{ key: ROOT, clearQueued: true }]);
    assert.equal(gateway.calls.at(-1).method, 'close');
    assert.deepEqual(doc.sessions, [{ id: rootId, role: 'root', depth: 0, outcome: 'aborted', status: 'aborted' }]);
    assert.equal(doc.guard, CUTOFF_GUARD);
    assert.equal(doc.note, ABORT_ACK_NOTE);
    assert.deepEqual(doc.untouched, { preExisting: 2, configured: 0, notOwned: 0 });
    const text = JSON.stringify(doc);
    for (const secret of [ROOT, 'sid-root-7f3a', PRINCE, 'prince', HEARTBEAT]) assert.ok(!text.includes(secret), `abort document carries ${secret}`);
  } finally {
    await s.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Independent review of b76fedf2: repairs, each RED on that SHA
// ---------------------------------------------------------------------------

test('review F1: a session is not aborted when any session under it, at any depth, is one the run does not own', () => {
  const B = 'agent:main:subagent:owned-b';
  const P = 'agent:main:subagent:prince-controlled-by-b';
  const decision = resolveOwnership({
    records: [{ key: ROOT, sessionId: 'root' }],
    baseline,
    rows: [
      ...princeRows,
      { key: ROOT, sessionId: 'root' },
      { key: B, sessionId: 'b', spawnedBy: ROOT, controlOwnerSessionKey: ROOT },
      // B controls a session the prince spawned: B's abort would cascade into it,
      // and so would the root's, through B (subagent-control-kill.ts:360-363).
      { key: P, sessionId: 'p', spawnedBy: PRINCE, controlOwnerSessionKey: B },
    ],
  });
  assert.deepEqual(decision.owned.map(({ key, abortable, skipReason }) => ({ key, abortable, skipReason })), [
    { key: ROOT, abortable: false, skipReason: 'cascade-would-reach-unowned-session' },
    { key: B, abortable: false, skipReason: 'cascade-would-reach-unowned-session' },
  ]);
});

test('review F4: a link by parentSessionKey alone, which an adopting create can write, proves nothing', () => {
  const decision = resolveOwnership({
    records: [{ key: ROOT, sessionId: 'root' }],
    baseline,
    rows: [
      ...princeRows,
      { key: ROOT, sessionId: 'root' },
      // A session new since the baseline (a fresh channel thread), re-parented onto the root.
      { key: 'agent:main:discord:thread', sessionId: 't', parentSessionKey: ROOT },
      // A spawned child that also carries the lineage is still owned.
      { key: 'agent:main:subagent:child', sessionId: 'c', spawnedBy: ROOT, parentSessionKey: ROOT },
    ],
  });
  assert.deepEqual(keysOf(decision.owned), [ROOT, 'agent:main:subagent:child']);
  assert.deepEqual(reasons(decision), { 'agent:main:discord:thread': 'lineage-only-parent' });
});

test('review F7: a session that stopped while its descendants did not is partial, not refused', async () => {
  const { results } = await runAbortPass({
    rpc: async () => ({ ok: false, error: { code: 'UNAVAILABLE', message: 'Session stopped, but descendant cancellation was incomplete: x' } }),
    owned: [owned('a')],
    deadline: Date.now() + 1000,
  });
  assert.deepEqual(results.map(({ outcome, refusal, error }) => ({ outcome, refusal, error })), [
    { outcome: 'partial', refusal: 'descendants-incomplete', error: 'sessions-abort:UNAVAILABLE' },
  ]);
  const overshoot = computeOvershoot({ state: stateFor(), abort: abortDoc({ sessions: [{ id: 'aaaaaaaaaaaa', outcome: 'partial' }], ambiguous: [] }), drain: { metered: true } });
  assert.ok(overshoot.maxPossibleReasons.includes('1 owned session(s) stopped, but their descendants\' cancellation was incomplete'));
  assert.ok(!overshoot.maxPossibleReasons.some((reason) => reason.includes('refused, failed or not attempted')));
});

test('review F3: with no readable reading after the abort or the trip, those figures are unmeasured, never zero', () => {
  const state = {
    ...stateFor(),
    cumulative: 1200,
    readings: [reading(1, 300, 300), reading(3, 900, 600), reading(4, 1200, 300, { final: true })],
    abortSessions: null,
  };
  const afterAbort = computeOvershoot({ state, abort: abortDoc({ completedAt: '2026-11-19T00:00:04.500Z' }), drain: { metered: false, reason: 'meter-exited' } });
  assert.equal(afterAbort.observed.readingsAfterAbort, 0);
  assert.equal(afterAbort.observed.postAbortTokens, null, 'nothing read after the abort is not a measured zero');
  assert.equal(afterAbort.observed.sessionsGrowingAfterAbort, null);
  const noLaterReading = computeOvershoot({ state: { ...state, trip: { reason: 'budget-reached', at: '2026-11-19T00:00:04.000Z', cumulative: 1200 } }, abort: null });
  assert.equal(noLaterReading.observed.postTripTokens, null);
  assert.equal(noLaterReading.observed.sessionsGrowingAfterTrip, null);
});

test('review F5: a drain with no readable reading after the abort is not metered, whatever the runner saw', () => {
  const state = { ...stateFor(), readings: [...stateFor().readings.slice(0, 5), { at: '2026-11-19T00:00:06.000Z', readable: false, error: 'x', cumulative: 1200, increment: null }], cumulative: 1200 };
  const overshoot = computeOvershoot({ state: { ...state, abortSessions: null }, abort: abortDoc(), drain: { metered: true, windowSeconds: 1 } });
  assert.equal(overshoot.drain.metered, false);
  assert.equal(overshoot.drain.reason, 'no-readable-reading-after-abort');
  assert.equal(overshoot.observed.unreadableReadingsAfterAbort, 1);
});

test('review F2: a cutoff that started but left no record is never reported as no abort', () => {
  const overshoot = computeOvershoot({ state: stateFor(), abort: null, cutoffStarted: true });
  assert.ok(overshoot.maxPossibleReasons.includes('the cutoff left no record, so sessions may have been aborted'));
  assert.ok(!overshoot.maxPossibleReasons.includes('no abort was attempted'));
  assert.equal(overshoot.drain.reason, 'drain-unrecorded');
});

test('review round 2, F3: the record written before the abort calls shows a skipped session as skipped, not pending', async () => {
  const s = await cutoffFiles();
  try {
    const saved = [];
    const gateway = fakeGateway({
      list: () => ({
        ok: true,
        payload: {
          sessions: [
            ...princeRows,
            { key: ROOT, sessionId: 'root' },
            { key: 'agent:main:subagent:proxied', sessionId: 'p', spawnedBy: PRINCE, controlOwnerSessionKey: ROOT },
          ],
          hasMore: false,
        },
      }),
    });
    const doc = await cutoff({ ...s.args, connect: gateway.connect, save: (current) => saved.push(JSON.parse(JSON.stringify(current))) });
    const aborting = saved.find((entry) => entry.phase === 'aborting');
    assert.ok(aborting, 'a record is written before the abort pass');
    assert.deepEqual(aborting.sessions.map(({ role, outcome, reason }) => ({ role, outcome, reason })), [
      { role: 'root', outcome: 'skipped', reason: 'cascade-would-reach-unowned-session' },
    ]);
    assert.deepEqual(saved.map((entry) => entry.phase), ['connecting', 'listing', 'aborting', 'done']);
    assert.equal(doc.abortCalls, 0);
    assert.equal(gateway.calls.filter((call) => call.method === 'sessions.abort').length, 0);
  } finally {
    await s.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Third review of #629 (🪨, Discord 1573378876984266873; 🌫's review at
// b50e22fc): two receipt-accounting repairs, each RED at b50e22fc
// ---------------------------------------------------------------------------

test('review round 3, P2a: a reading begun before the abort and completed after it counts after the abort, and is named straddling', () => {
  // No snapshot from the meter (it was gone), so the readings are split by when each completed.
  const straddled = (extra) => ({
    ...stateFor(),
    abortSessions: null,
    cumulative: 1900,
    readings: [
      reading(1, 300, 300, { completedAt: '2026-11-19T00:00:01.100Z' }),
      reading(3, 900, 600, { completedAt: '2026-11-19T00:00:03.100Z' }),
      // Begun at 04.000, before the abort finished at 04.500; answered at 04.800.
      reading(4, 1200, 300, extra),
      reading(5, 1900, 700, { completedAt: '2026-11-19T00:00:05.100Z', final: true }),
    ],
  });
  for (const [label, extra] of [['completedAt', { completedAt: '2026-11-19T00:00:04.800Z' }], ['readMs', { readMs: 800 }]]) {
    const overshoot = computeOvershoot({ state: straddled(extra), abort: abortDoc({ completedAt: '2026-11-19T00:00:04.500Z' }), drain: { metered: true } });
    assert.equal(overshoot.observed.postAbortTokens, 1000, `${label}: the straddling reading's 300 counts after the abort, with the 700 after it`);
    assert.equal(overshoot.observed.readingsAfterAbort, 2, label);
    assert.equal(overshoot.observed.readingsStraddlingAbort, 1, label);
    assert.match(overshoot.observed.abortBoundary, /straddles the abort and counts after it/u, label);
    assert.equal(overshoot.drain.metered, true, `${label}: a readable reading begun after the abort metered the drain`);
  }
  // A straddling reading alone measures the growth after the abort, but not the drain.
  const alone = straddled({ completedAt: '2026-11-19T00:00:04.800Z', final: true });
  alone.readings.pop();
  alone.cumulative = 1200;
  const overshoot = computeOvershoot({ state: alone, abort: abortDoc({ completedAt: '2026-11-19T00:00:04.500Z' }), drain: { metered: true } });
  assert.equal(overshoot.observed.postAbortTokens, 300);
  assert.equal(overshoot.observed.readingsStraddlingAbort, 1);
  assert.equal(overshoot.drain.metered, false);
  assert.equal(overshoot.drain.reason, 'no-readable-reading-after-abort');
});

test('review round 3, P2b: a session the cutoff aborted while it had no session id keeps its abort outcome when it grows under its own', () => {
  const state = {
    ...stateFor(),
    sessions: [
      ...stateFor().sessions,
      // Listed with no session id at the cutoff (aborted as eeeeeeeeeeee), metered under its own afterwards.
      { id: 'ffffffffffff', abortId: 'eeeeeeeeeeee', baselineTokens: 0, lastTokens: 400, state: 'live' },
    ],
    abortSessions: { ...stateFor().abortSessions, abortIdsRead: 3 },
  };
  const abort = abortDoc({ sessions: [...abortDoc().sessions, { id: 'eeeeeeeeeeee', outcome: 'aborted' }] });
  const growing = computeOvershoot({ state, abort, drain: { metered: true } }).observed.sessionsGrowingAfterAbort;
  assert.deepEqual(growing, [
    { id: 'aaaaaaaaaaaa', tokens: 700, owned: true, abortOutcome: 'aborted' },
    { id: 'cccccccccccc', tokens: 200, owned: false },
    { id: 'ffffffffffff', tokens: 400, owned: true, abortOutcome: 'aborted', abortId: 'eeeeeeeeeeee' },
  ]);
  // A meter that could not read the cutoff's document could not link such a
  // session: one that no abort id names by its own id is of unknown ownership, never unowned.
  const unlinked = { ...state, sessions: stateFor().sessions, abortSessions: { ...state.abortSessions, abortIdsRead: null } };
  assert.deepEqual(computeOvershoot({ state: unlinked, abort, drain: { metered: true } }).observed.sessionsGrowingAfterAbort, [
    { id: 'aaaaaaaaaaaa', tokens: 700, owned: true, abortOutcome: 'aborted' },
    { id: 'cccccccccccc', tokens: 200, owned: null },
  ]);
});

test('review round 3 follow-up: a meter that kept no totals from before the abort claims none; the receipt splits the readings itself and names no session figure', () => {
  const state = {
    ...stateFor(),
    abortSessions: { markedAt: '2026-11-19T00:00:04.500Z', cumulative: null, sessions: null, abortIdsRead: 2 },
  };
  const overshoot = computeOvershoot({ state, abort: abortDoc(), drain: { metered: true } });
  assert.equal(overshoot.observed.postAbortTokens, 900, 'from the readings: 2100 against the 1200 the last reading before the abort left');
  assert.equal(overshoot.observed.sessionsGrowingAfterAbort, null, 'no per-session totals were kept, so none is claimed');
});
