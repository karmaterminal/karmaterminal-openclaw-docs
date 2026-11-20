// The token-budget meter's reading cycle, against a scripted gateway answer set.
//
// One reading is a sessions.list traversal, which finds the run's sessions, plus
// sessions.usage.timeseries for each of them, which reads that session's
// transcript with no cache (openclaw ab5a30ea, src/gateway/server-methods/
// usage.ts:681-706 -> src/infra/session-cost-usage-reporting.ts:169-239). These
// tests drive the cycle through an injected rpc function, so every rule the
// counter relies on (scope, pagination, archives, error mapping) is pinned with
// no socket and no gateway.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUsageMeter,
  isMissingTranscriptError,
  timeseriesTokens,
} from '../../lib/token-budget.mjs';

const CONFIGURED = 'agent:main:proof-disposable';

function point(totalTokens, parts = {}) {
  const { input = 0, output = 0, cacheRead = 0, cacheWrite = 0 } = parts;
  return { timestamp: 1, input, output, cacheRead, cacheWrite, totalTokens, cost: 0 };
}

function series(sessionId, ...totals) {
  return { sessionId, points: totals.map((total) => point(total)) };
}

const missingTranscript = (key) => ({
  ok: false,
  error: { code: 'INVALID_REQUEST', message: `No transcript found for session: ${key}` },
});

/**
 * A scripted gateway: `rows` is the sessions.list content and `usage` maps a
 * timeseries key to its answer (a payload, or { error }). Both can be replaced
 * between readings. Every call is recorded.
 */
function scriptedGateway({ rows = [], usage = {}, pageSize = 1000 } = {}) {
  const state = { rows, usage, pageSize, calls: [], listError: null };
  state.rpc = async (method, params) => {
    state.calls.push({ method, params });
    if (method === 'sessions.list') {
      if (state.listError) return { ok: false, error: state.listError };
      const offset = params.offset ?? 0;
      const page = state.rows.slice(offset, offset + state.pageSize);
      const nextOffset = offset + page.length;
      const hasMore = nextOffset < state.rows.length;
      return { ok: true, payload: { sessions: page, count: page.length, totalCount: state.rows.length, hasMore, nextOffset: hasMore ? nextOffset : null } };
    }
    if (method === 'sessions.usage.timeseries') {
      const answer = state.usage[params.key];
      if (answer === undefined) return missingTranscript(params.key);
      if (answer?.ok === false) return answer;
      return { ok: true, payload: answer };
    }
    return { ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method ${method}` } };
  };
  state.timeseriesKeys = () => state.calls.filter((call) => call.method === 'sessions.usage.timeseries').map((call) => call.params.key);
  state.resetCalls = () => { state.calls.length = 0; };
  return state;
}

const meterFor = (gateway, options = {}) => createUsageMeter({
  rpc: gateway.rpc,
  configuredKeys: [CONFIGURED],
  now: () => '2026-11-19T12:00:00.000Z',
  ...options,
});

test('a timeseries reading counts every component of every point, whichever total is larger', () => {
  assert.deepEqual(timeseriesTokens(series('s1', 10, 20, 30)), { ok: true, sessionId: 's1', tokens: 60 });
  // usage.total wins when larger; the components win when usage.total undercounts them.
  const mixed = { sessionId: 's1', points: [point(100, { input: 10, output: 5 }), point(7, { input: 4, output: 1, cacheRead: 3, cacheWrite: 2 })] };
  assert.deepEqual(timeseriesTokens(mixed), { ok: true, sessionId: 's1', tokens: 110 });
  assert.deepEqual(timeseriesTokens({ sessionId: 's1', points: [] }), { ok: true, sessionId: 's1', tokens: 0 });
  assert.deepEqual(timeseriesTokens({ sessionId: 's1', points: [point(1.2)] }), { ok: true, sessionId: 's1', tokens: 2 }, 'a fractional total rounds up, never down');
  for (const bad of [null, {}, { sessionId: 's1' }, { sessionId: '', points: [] }, { sessionId: 's1', points: [point(-1)] }, { sessionId: 's1', points: [{ timestamp: 1, totalTokens: 'x' }] }]) {
    assert.equal(timeseriesTokens(bad).ok, false, `${JSON.stringify(bad)} is not a usage reading`);
  }
});

test('only the product\'s missing-transcript answer reads as no usage yet', () => {
  assert.equal(isMissingTranscriptError(missingTranscript('agent:main:x').error), true);
  assert.equal(isMissingTranscriptError({ code: 'INVALID_REQUEST', message: 'Invalid session key: agent:main:x' }), false);
  assert.equal(isMissingTranscriptError({ code: 'FORBIDDEN', message: 'No transcript found for session: x' }), false);
  assert.equal(isMissingTranscriptError(null), false);
});

test('the baseline reads the configured session and nothing else, not an earlier run\'s k6 session', async () => {
  const gateway = scriptedGateway({
    rows: [
      { key: CONFIGURED, sessionId: 'cfg' },
      { key: 'agent:main:r-cw-2-old', sessionId: 'old', label: 'k6 R-CW-2 old' },
      { key: 'agent:main:discord:channel:1', sessionId: 'prince', label: 'a prince channel' },
    ],
    usage: { [CONFIGURED]: series('cfg', 5000), 'agent:main:r-cw-2-old': series('old', 700) },
  });
  const baseline = await meterFor(gateway).baseline();
  assert.equal(baseline.readable, true);
  assert.deepEqual(baseline.sessions, { 'main:cfg': 5000 });
  assert.deepEqual(gateway.timeseriesKeys(), [CONFIGURED], 'an unrelated or earlier-run session is never read');
  assert.deepEqual(baseline.scope, { sessionsListed: 3, sessionsInScope: 1, byReason: { configured: 1 }, priorRunLabelled: 1 });
});

test('a reading counts new, labelled and spawned sessions, but not unrelated sessions that existed at the baseline', async () => {
  const gateway = scriptedGateway({
    rows: [
      { key: CONFIGURED, sessionId: 'cfg' },
      { key: 'agent:main:discord:channel:1', sessionId: 'prince' },
    ],
    usage: { [CONFIGURED]: series('cfg', 5000), 'agent:main:discord:channel:1': series('prince', 900) },
  });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows = [
    ...gateway.rows,
    { key: 'agent:main:r-cd-1-n1', sessionId: 'parent', label: 'k6 R-CD-1 n1' },
    { key: 'agent:main:subagent:abc', sessionId: 'child', spawnedBy: 'agent:main:r-cd-1-n1' },
    { key: 'agent:main:subagent:def', sessionId: 'grandchild', parentSessionKey: 'agent:main:subagent:abc' },
    { key: 'agent:main:auto-created', sessionId: 'unlinked' },
  ];
  Object.assign(gateway.usage, {
    [CONFIGURED]: series('cfg', 5000, 40),
    'agent:main:discord:channel:1': series('prince', 900, 99999),
    'agent:main:r-cd-1-n1': series('parent', 100),
    'agent:main:subagent:abc': series('child', 50),
    'agent:main:subagent:def': series('grandchild', 25),
    'agent:main:auto-created': series('unlinked', 5),
  });
  gateway.resetCalls();
  const reading = await meter.read();
  assert.equal(reading.readable, true);
  assert.deepEqual(reading.sessions, {
    'main:cfg': 5040,
    'main:parent': 100,
    'main:child': 50,
    'main:grandchild': 25,
    'main:unlinked': 5,
  });
  assert.ok(!gateway.timeseriesKeys().includes('agent:main:discord:channel:1'), 'pre-existing unrelated traffic is not the run\'s');
  assert.deepEqual(reading.scope.byReason, { configured: 1, labelled: 1, spawned: 2, 'new-since-baseline': 1 });
});

test('sessions.list pages are followed to the end, and a list that claims more without an offset is unreadable', async () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ key: `agent:main:r-x-${index}`, sessionId: `s${index}`, label: `k6 R-X ${index}` }));
  const usage = Object.fromEntries(rows.map((row) => [row.key, series(row.sessionId, 10)]));
  const gateway = scriptedGateway({ rows, usage, pageSize: 2 });
  const baseline = await meterFor(gateway, { pageSize: 2, configuredKeys: rows.map((row) => row.key) }).baseline();
  assert.equal(baseline.readable, true);
  assert.equal(baseline.scope.sessionsListed, 5);
  assert.equal(Object.keys(baseline.sessions).length, 5);
  assert.deepEqual(gateway.calls.filter((call) => call.method === 'sessions.list').map((call) => call.params.offset ?? 0), [0, 2, 4]);

  const broken = scriptedGateway({ rows, usage });
  broken.rpc = async (method, params) => (method === 'sessions.list'
    ? { ok: true, payload: { sessions: rows.slice(0, 2), hasMore: true, nextOffset: null } }
    : scriptedGateway({ rows, usage }).rpc(method, params));
  const unreadable = await meterFor(broken).baseline();
  assert.equal(unreadable.readable, false);
  assert.match(unreadable.error, /sessions-list/u);
});

test('a session that disappears is read once more from its archive, then closed', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:subagent:abc', sessionId: 'child-uuid', spawnedBy: CONFIGURED });
  gateway.usage['agent:main:subagent:abc'] = series('child-uuid', 300);
  assert.equal((await meter.read()).sessions['main:child-uuid'], 300);

  // cleanup="delete": the row is gone, the transcript is archived as
  // <sessionId>.jsonl.deleted.<ts>, readable as agent:<agentId>:<sessionId>.
  gateway.rows = gateway.rows.filter((row) => row.sessionId !== 'child-uuid');
  delete gateway.usage['agent:main:subagent:abc'];
  gateway.usage['agent:main:child-uuid'] = series('child-uuid', 300, 120);
  gateway.resetCalls();
  const afterDelete = await meter.read();
  assert.equal(afterDelete.readable, true);
  assert.equal(afterDelete.sessions['main:child-uuid'], 420, 'the turn the child ran after the last poll is still counted');
  assert.deepEqual(gateway.timeseriesKeys().sort(), [CONFIGURED, 'agent:main:child-uuid'].sort());

  gateway.resetCalls();
  const later = await meter.read();
  assert.ok(!gateway.timeseriesKeys().includes('agent:main:child-uuid'), 'a closed archive is final and is not re-read');
  assert.equal(later.sessions['main:child-uuid'], undefined, 'a closed session is no longer in the reading; the ledger keeps its total');
});

test('a disappeared session whose archive cannot be read makes the reading unreadable', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:r-cw-2-n', sessionId: 'gone', label: 'k6 R-CW-2 n' });
  gateway.usage['agent:main:r-cw-2-n'] = series('gone', 10);
  await meter.read();
  gateway.rows = gateway.rows.filter((row) => row.sessionId !== 'gone');
  const reading = await meter.read();
  assert.equal(reading.readable, false);
  assert.match(reading.error, /archive/u);
});

test('a reset session is accounted as a new instance, and the old instance is closed from its archive', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg-1' }], usage: { [CONFIGURED]: series('cfg-1', 10) } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows = [{ key: CONFIGURED, sessionId: 'cfg-2' }];
  gateway.usage = { [CONFIGURED]: series('cfg-2', 7), 'agent:main:cfg-1': series('cfg-1', 10, 3) };
  const reading = await meter.read();
  assert.equal(reading.readable, true);
  assert.deepEqual(reading.sessions, { 'main:cfg-2': 7, 'main:cfg-1': 13 });
});

test('a session with no transcript yet reads as zero; any other usage error is unreadable', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: {} });
  const meter = meterFor(gateway);
  const baseline = await meter.baseline();
  assert.equal(baseline.readable, true);
  assert.deepEqual(baseline.sessions, { 'main:cfg': 0 });

  gateway.usage[CONFIGURED] = { ok: false, error: { code: 'FORBIDDEN', message: 'missing scope: operator.read' } };
  const forbidden = await meter.read();
  assert.equal(forbidden.readable, false);
  assert.match(forbidden.error, /FORBIDDEN/u);

  gateway.usage[CONFIGURED] = { sessionId: 'cfg', points: 'not-a-list' };
  assert.equal((await meter.read()).readable, false);

  gateway.listError = { code: 'UNAVAILABLE', message: 'shutting down' };
  const listFailed = await meter.read();
  assert.equal(listFailed.readable, false);
  assert.match(listFailed.error, /sessions-list/u);
});

test('an rpc that throws (closed socket, timeout) is an unreadable reading, never zero', async () => {
  const meter = createUsageMeter({
    rpc: async () => { throw new Error('gateway-rpc-timeout'); },
    configuredKeys: [CONFIGURED],
    now: () => '2026-11-19T12:00:00.000Z',
  });
  const baseline = await meter.baseline();
  assert.equal(baseline.readable, false);
  assert.match(baseline.error, /gateway-rpc-timeout/u);
  await assert.rejects(() => meter.read(), /baseline/u, 'no reading before a readable baseline');
});

test('readings carry no raw session key or session id', async () => {
  const gateway = scriptedGateway({
    rows: [{ key: CONFIGURED, sessionId: 'cfg' }],
    usage: { [CONFIGURED]: series('cfg', 1), 'agent:main:r-cw-2-secretnonce': series('uuid-secret', 2) },
  });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:r-cw-2-secretnonce', sessionId: 'uuid-secret', label: 'k6 R-CW-2 secretnonce' });
  const reading = await meter.read();
  const publicView = JSON.stringify(meter.publicSessions());
  assert.ok(!publicView.includes('secretnonce') && !publicView.includes('uuid-secret'), publicView);
  assert.deepEqual(meter.publicSessions().map((entry) => entry.reason).sort(), ['configured', 'labelled']);
  assert.ok(meter.publicSessions().every((entry) => /^[0-9a-f]{12}$/u.test(entry.id)));
  assert.equal(typeof reading.sessions['main:uuid-secret'], 'number', 'the in-memory reading is keyed by id; only publicSessions() is published');
});

test('a session listed with no session id and no transcript closes at zero when it leaves', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:r-cw-2-n', label: 'k6 R-CW-2 n' });
  assert.equal((await meter.read()).readable, true);
  // Its first turn gives it a transcript and a session id of its own.
  gateway.rows = [{ key: CONFIGURED, sessionId: 'cfg' }, { key: 'agent:main:r-cw-2-n', sessionId: 'real', label: 'k6 R-CW-2 n' }];
  gateway.usage['agent:main:r-cw-2-n'] = series('real', 40);
  gateway.resetCalls();
  const reading = await meter.read();
  assert.equal(reading.readable, true, reading.error);
  assert.equal(reading.sessions['main:real'], 40);
  assert.deepEqual(gateway.timeseriesKeys().sort(), [CONFIGURED, 'agent:main:r-cw-2-n'].sort(), 'the placeholder has no archive to read');
});

// Review fixes (independent review of 02c0b98a).

test('a session discovered between readings and deleted before the next one is read from its archive', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  assert.equal((await meter.read()).readable, true);
  // A cleanup="delete" child lives for less than one usage reading: only the
  // fast sessions.list discovery sees it.
  gateway.rows.push({ key: 'agent:main:subagent:quick', sessionId: 'quick-uuid', spawnedBy: CONFIGURED });
  const discovered = await meter.discover();
  assert.equal(discovered.readable, true);
  assert.ok(!gateway.timeseriesKeys().includes('agent:main:subagent:quick'), 'discovery lists; it does not read usage');
  gateway.rows = gateway.rows.filter((row) => row.sessionId !== 'quick-uuid');
  gateway.usage['agent:main:quick-uuid'] = series('quick-uuid', 250);
  const reading = await meter.read();
  assert.equal(reading.readable, true, reading.error);
  assert.equal(reading.sessions['main:quick-uuid'], 250, 'its whole life is counted although no reading ever saw it listed');
});

test('a failed discovery is an unreadable counter, and a discovered row with no session id that vanishes is too', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.listError = { code: 'UNAVAILABLE', message: 'x' };
  const failed = await meter.discover();
  assert.equal(failed.readable, false);
  assert.match(failed.error, /sessions-list:UNAVAILABLE/u);
  gateway.listError = null;
  gateway.rows.push({ key: 'agent:main:subagent:nosid', spawnedBy: CONFIGURED });
  assert.equal((await meter.discover()).readable, true);
  gateway.rows = gateway.rows.filter((row) => row.key !== 'agent:main:subagent:nosid');
  const reading = await meter.read();
  assert.equal(reading.readable, false);
  assert.match(reading.error, /no-session-id/u);
});

test('an earlier run\'s k6 sessions are never read, even when they change; this run\'s are read every reading', async () => {
  const gateway = scriptedGateway({
    rows: [{ key: CONFIGURED, sessionId: 'cfg' }, { key: 'agent:main:r-old', sessionId: 'old', label: 'k6 R-OLD earlier' }],
    usage: { [CONFIGURED]: series('cfg', 10), 'agent:main:r-old': series('old', 20) },
  });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:r-new', sessionId: 'new', label: 'k6 R-NEW this-run' });
  gateway.usage['agent:main:r-old'] = series('old', 20, 999);
  gateway.usage['agent:main:r-new'] = series('new', 3);
  for (let poll = 0; poll < 3; poll += 1) {
    gateway.resetCalls();
    const reading = await meter.read();
    assert.deepEqual(gateway.timeseriesKeys().sort(), [CONFIGURED, 'agent:main:r-new'].sort(), `poll ${poll}`);
    assert.equal(reading.sessions['main:old'], undefined);
    assert.equal(reading.scope.priorRunLabelled, 1);
    assert.deepEqual(reading.scope.byReason, { configured: 1, labelled: 1 });
  }
});

test('a bare configured key matches its canonical agent-scoped row', async () => {
  const gateway = scriptedGateway({
    rows: [{ key: 'agent:main:main', sessionId: 'm' }, { key: 'agent:main:notmain', sessionId: 'n' }],
    usage: { 'agent:main:main': series('m', 7) },
  });
  const baseline = await createUsageMeter({ rpc: gateway.rpc, configuredKeys: ['main'], now: () => 'x' }).baseline();
  assert.deepEqual(baseline.sessions, { 'main:m': 7 });
  assert.deepEqual(baseline.scope.byReason, { configured: 1 });
});

// Second review (of 78fec962).

test('a session only a discovery saw, deleted with no archive, is an unreadable counter, never zero', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:subagent:incognito-x', sessionId: 'inc', spawnedBy: CONFIGURED });
  await meter.discover();
  gateway.rows = gateway.rows.filter((row) => row.sessionId !== 'inc');
  const reading = await meter.read();
  assert.equal(reading.readable, false, 'its consumption is unknown, so the counter cannot vouch for it');
  assert.match(reading.error, /vanished-session-archive:missing/u);
});

test('every session id a discovery sees is kept, so a key reset twice between readings loses none', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 's0' }], usage: { [CONFIGURED]: series('s0', 1) } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows = [{ key: CONFIGURED, sessionId: 's1' }];
  await meter.discover();
  gateway.rows = [{ key: CONFIGURED, sessionId: 's2' }];
  await meter.discover();
  gateway.rows = [{ key: CONFIGURED, sessionId: 's3' }];
  gateway.usage = {
    [CONFIGURED]: series('s3', 3),
    'agent:main:s0': series('s0', 1, 10),
    'agent:main:s1': series('s1', 20),
    'agent:main:s2': series('s2', 30),
  };
  const reading = await meter.read();
  assert.equal(reading.readable, true, reading.error);
  assert.deepEqual(reading.sessions, { 'main:s3': 3, 'main:s0': 11, 'main:s1': 20, 'main:s2': 30 });
});

test('a row first listed without a session id and then with one is the same session, not a vanished one', async () => {
  const gateway = scriptedGateway({ rows: [{ key: CONFIGURED, sessionId: 'cfg' }], usage: { [CONFIGURED]: series('cfg') } });
  const meter = meterFor(gateway);
  await meter.baseline();
  gateway.rows.push({ key: 'agent:main:r-x-n', label: 'k6 R-X n' });
  await meter.discover();
  gateway.rows[1] = { key: 'agent:main:r-x-n', sessionId: 'real', label: 'k6 R-X n' };
  gateway.usage['agent:main:r-x-n'] = series('real', 9);
  const reading = await meter.read();
  assert.equal(reading.readable, true, reading.error);
  assert.equal(reading.sessions['main:real'], 9);
});

test('a bare configured key that resolves to no listed session refuses the baseline', async () => {
  const gateway = scriptedGateway({ rows: [{ key: 'agent:main:custom-main', sessionId: 'm' }], usage: {} });
  const baseline = await createUsageMeter({ rpc: gateway.rpc, configuredKeys: ['main'], now: () => 'x' }).baseline();
  assert.equal(baseline.readable, false, 'a non-default mainKey or global scope would leave the configured session uncounted');
  assert.match(baseline.error, /configured-session-unresolved/u);
  const canonical = await createUsageMeter({ rpc: gateway.rpc, configuredKeys: ['agent:main:not-yet-created'], now: () => 'x' }).baseline();
  assert.equal(canonical.readable, true, 'a canonical key not created yet is counted when it appears');
});
