// The token-budget meter as a process, over a real WebSocket to a stub gateway.
//
// run-proofs.sh starts scripts/token-budget-meter.mjs in the background and
// reads only what it leaves on disk: the state file and the trip flag. These
// tests run the real script against a local gateway that speaks the connect
// handshake and answers sessions.list and sessions.usage.timeseries from a
// script, so the refusal, trip, drain, stop and orphan paths are each
// exercised end to end with no seat and no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachReadinessGateway } from './helpers/readiness-gateway.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const meterScript = path.resolve(here, '../token-budget-meter.mjs');
const TOKEN = 'token-budget-meter-test-token';
const CONFIGURED = 'agent:main:proof-disposable';
const SECRET_KEY = 'agent:main:r-cw-2-secretnonce';

async function startGateway(methods) {
  const server = createServer((request, response) => response.writeHead(404).end());
  // Upgraded sockets are not closed by closeAllConnections, and a request the
  // gateway never answers leaves one open, so teardown destroys them itself.
  const sockets = new Set();
  server.on('upgrade', (request, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const gateway = attachReadinessGateway(server, { token: TOKEN, runtimeSha: 'a'.repeat(40), methods });
  return {
    ...gateway,
    url: `ws://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(resolve);
    }),
  };
}

const listing = (rows) => () => ({ ok: true, payload: { sessions: rows(), count: rows().length, hasMore: false, nextOffset: null } });
const usageOf = (sessionId, tokens) => ({ ok: true, payload: { sessionId, points: [{ timestamp: 1, input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: tokens, cost: 0 }] } });

async function startMeter({ url, budget = '1000', token = TOKEN, parentPid = null, env = {}, baselineOut = false, baselineOutBlocked = false, abortMark = false }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'token-budget-meter-'));
  const state = path.join(dir, 'state.json');
  const flag = path.join(dir, 'tripped');
  const args = [meterScript, 'watch', '--budget', budget, '--state', state, '--trip-flag', flag];
  if (baselineOut) args.push('--baseline-out', path.join(dir, 'baseline-sessions.json'));
  if (abortMark) args.push('--abort-mark', path.join(dir, 'abort-mark'));
  // A directory where the file should go makes its write fail.
  if (baselineOutBlocked) await mkdir(path.join(dir, 'baseline-sessions.json'));
  if (parentPid) args.push('--parent-pid', String(parentPid));
  const child = spawn(process.execPath, args, {
    env: {
      PATH: process.env.PATH,
      OPENCLAW_GATEWAY_WS: url,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_SESSION_KEY: CONFIGURED,
      OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '0.1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const readState = async () => JSON.parse(await readFile(state, 'utf8'));
  const waitFor = async (predicate, label, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const current = await readState().catch(() => null);
      if (current && predicate(current)) return current;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}; state: ${JSON.stringify(current)}\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  return {
    child,
    exited,
    readState,
    waitFor,
    flag,
    baselineSessions: async () => JSON.parse(await readFile(path.join(dir, 'baseline-sessions.json'), 'utf8')),
    baselineSessionsPath: path.join(dir, 'baseline-sessions.json'),
    markAbort: (at) => writeFile(path.join(dir, 'abort-mark'), `${at}\n`),
    output: () => output,
    cleanup: async () => {
      child.kill('SIGKILL');
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test('an unreadable baseline is refused: phase unenforceable, exit 3, no trip flag', async () => {
  const gateway = await startGateway({ 'sessions.list': () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'missing scope' } }) });
  const meter = await startMeter({ url: gateway.url });
  try {
    assert.equal(await meter.exited, 3, meter.output());
    const state = await meter.readState();
    assert.equal(state.phase, 'unenforceable');
    assert.equal(state.error, 'baseline-unreadable: sessions-list:FORBIDDEN');
    assert.equal(state.baseline.readable, false);
    assert.equal(existsSync(meter.flag), false);
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('a rejected token or an unreachable gateway is refused before any reading', async () => {
  const gateway = await startGateway({ 'sessions.list': listing(() => []) });
  const wrongToken = await startMeter({ url: gateway.url, token: 'not-the-token' });
  try {
    assert.equal(await wrongToken.exited, 3);
    assert.equal((await wrongToken.readState()).error, 'baseline-unreadable: gateway-auth-rejected');
  } finally {
    await wrongToken.cleanup();
    await gateway.close();
  }
  const unreachable = await startMeter({ url: gateway.url });
  try {
    assert.equal(await unreachable.exited, 3);
    assert.equal((await unreachable.readState()).error, 'baseline-unreadable: gateway-connect-failed');
  } finally {
    await unreachable.cleanup();
  }
  const noBudget = await startMeter({ url: 'ws://127.0.0.1:9', budget: '1e6' });
  try {
    assert.equal(await noBudget.exited, 3);
    assert.match((await noBudget.readState()).error, /^budget-config-invalid: the token budget is not a positive whole number/u);
  } finally {
    await noBudget.cleanup();
  }
});

test('climbing usage trips the flag, readings continue after the trip, and SIGTERM stops with a final reading', async () => {
  let tokens = 0;
  let lists = 0;
  const gateway = await startGateway({
    // The disposable session appears after the baseline listing, as a row's would.
    'sessions.list': () => {
      lists += 1;
      return listing(() => [
        { key: CONFIGURED, sessionId: 'cfg' },
        ...(lists > 1 ? [{ key: SECRET_KEY, sessionId: 'uuid-secret', label: 'k6 R-CW-2 secretnonce' }] : []),
      ])();
    },
    'sessions.usage.timeseries': ({ key }) => (key === SECRET_KEY ? usageOf('uuid-secret', (tokens += 150)) : usageOf('cfg', 9000)),
  });
  const meter = await startMeter({ url: gateway.url, budget: '1000' });
  try {
    const armed = await meter.waitFor((state) => state.phase !== 'baseline', 'armed');
    assert.equal(armed.baseline.readable, true);
    assert.equal(armed.baseline.tokensInScope, 9000, 'the baseline holds pre-run usage, which is never charged');
    const tripped = await meter.waitFor((state) => state.trip, 'a trip');
    assert.equal(tripped.trip.reason, 'projected-exceed');
    assert.ok(tripped.trip.cumulative < 1000, 'the run stops before the next poll could cross the budget');
    assert.ok(existsSync(meter.flag), 'the flag follows the state');
    assert.deepEqual(JSON.parse(await readFile(meter.flag, 'utf8')), tripped.trip);
    const drained = await meter.waitFor((state) => state.readings.length >= tripped.readings.length + 2, 'readings after the trip');
    assert.equal(drained.trip.at, tripped.trip.at, 'the first trip stays');
    assert.ok(drained.cumulative > tripped.cumulative, 'consumption after the stop is still recorded');
    meter.child.kill('SIGTERM');
    assert.equal(await meter.exited, 0, meter.output());
    const stopped = await meter.readState();
    assert.equal(stopped.phase, 'stopped');
    assert.equal(stopped.readings.at(-1).final, true);
    assert.equal(stopped.pollIntervalMs, 100);
    // The measured cadence is what bounds the overshoot, so the meter reports it.
    assert.equal(stopped.cadence.readings, stopped.readings.length);
    assert.ok(stopped.cadence.intervalMsMax >= stopped.cadence.intervalMsMedian);
    assert.ok(stopped.cadence.intervalMsMedian >= 90, `start-to-start polling at 100 ms: ${JSON.stringify(stopped.cadence)}`);
    assert.ok(stopped.cadence.readMsMax >= 0);
    assert.ok(Number.isInteger(stopped.cadence.postTripTokens) && stopped.cadence.postTripTokens > 0, 'consumption after the trip is reported');
    for (const reading of stopped.readings) {
      assert.match(reading.at, /^\d{4}-\d{2}-\d{2}T/u);
      assert.equal(typeof reading.readMs, 'number');
    }
    const text = await readFile(path.join(path.dirname(meter.flag), 'state.json'), 'utf8');
    for (const secret of [TOKEN, 'secretnonce', 'uuid-secret', CONFIGURED]) {
      assert.ok(!text.includes(secret), `the state file must not carry ${secret}`);
    }
    assert.ok(gateway.connects.every((connect) => JSON.stringify(connect.scopes) === '["operator.read"]'), 'the meter asks for operator.read only');
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('a counter that stops answering mid-run trips counter-unreadable within the read timeout', async () => {
  let reads = 0;
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }]),
    'sessions.usage.timeseries': () => {
      reads += 1;
      return reads <= 2 ? usageOf('cfg', 10) : new Promise(() => {});
    },
  });
  const meter = await startMeter({ url: gateway.url, budget: '1000000', env: { OPENCLAW_PROOFS_TOKEN_BUDGET_READ_TIMEOUT_SECONDS: '0.3' } });
  try {
    const tripped = await meter.waitFor((state) => state.trip, 'a trip');
    assert.equal(tripped.trip.reason, 'counter-unreadable');
    assert.equal(tripped.trip.error, 'gateway-rpc-timeout');
    assert.equal(tripped.readTimeoutMs, 300);
    assert.ok(existsSync(meter.flag));
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('the meter exits on its own once its parent is gone', async () => {
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }]),
    'sessions.usage.timeseries': () => usageOf('cfg', 1),
  });
  const parent = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  const meter = await startMeter({ url: gateway.url, budget: '1000000', parentPid: parent.pid });
  try {
    await meter.waitFor((state) => state.phase === 'armed' && state.readings.length > 0, 'armed readings');
    parent.kill('SIGKILL');
    assert.equal(await meter.exited, 0);
    assert.equal((await meter.readState()).phase, 'stopped');
  } finally {
    parent.kill('SIGKILL');
    await meter.cleanup();
    await gateway.close();
  }
});

// Review fixes (independent review of 02c0b98a).

test('a counter that goes down is published by session hash, never by session id', async () => {
  let reads = 0;
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg-secret-id' }]),
    'sessions.usage.timeseries': () => usageOf('cfg-secret-id', (reads += 1) <= 2 ? 500 : 100),
  });
  const meter = await startMeter({ url: gateway.url, budget: '1000000' });
  try {
    const state = await meter.waitFor((current) => current.readings.some((reading) => reading.decreased?.length), 'a decreased reading');
    const decreased = state.readings.find((reading) => reading.decreased.length).decreased;
    assert.ok(decreased.every((id) => /^[0-9a-f]{12}$/u.test(id)), JSON.stringify(decreased));
    meter.child.kill('SIGTERM');
    await meter.exited;
    const text = await readFile(path.join(path.dirname(meter.flag), 'state.json'), 'utf8');
    assert.ok(!text.includes('cfg-secret-id'), 'no raw session id in the state');
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('the meter lists sessions between readings, and a failed listing there trips counter-unreadable', async () => {
  let lists = 0;
  const gateway = await startGateway({
    'sessions.list': () => {
      lists += 1;
      return lists >= 12 ? { ok: false, error: { code: 'UNAVAILABLE', message: 'x' } } : { ok: true, payload: { sessions: [{ key: CONFIGURED, sessionId: 'cfg' }], hasMore: false } };
    },
    'sessions.usage.timeseries': () => usageOf('cfg', 1),
  });
  const meter = await startMeter({
    url: gateway.url,
    budget: '1000000',
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '1', OPENCLAW_PROOFS_TOKEN_BUDGET_DISCOVERY_SECONDS: '0.1' },
  });
  try {
    const tripped = await meter.waitFor((state) => state.trip, 'a trip', 15_000);
    assert.equal(tripped.discoveryIntervalMs, 100);
    assert.ok(tripped.discoveries > tripped.readings.filter((reading) => reading.readable).length, `discoveries ${tripped.discoveries} run between readings`);
    assert.equal(tripped.trip.reason, 'counter-unreadable');
    assert.equal(tripped.trip.error, 'discovery: sessions-list:UNAVAILABLE');
    assert.ok(existsSync(meter.flag));
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('a refused configuration never echoes the value it refused', async () => {
  const meter = await startMeter({ url: 'ws://127.0.0.1:9', env: { OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: 'secret-looking-value' } });
  try {
    assert.equal(await meter.exited, 3);
    const state = await meter.readState();
    assert.equal(state.phase, 'unenforceable');
    assert.match(state.error, /^budget-config-invalid: /u);
    assert.ok(!state.error.includes('secret-looking-value'), state.error);
  } finally {
    await meter.cleanup();
  }
});

// Second review (of 78fec962).

test('the meter exits once its parent is gone even while slow discoveries run back to back', async () => {
  const gateway = await startGateway({
    'sessions.list': () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, payload: { sessions: [{ key: CONFIGURED, sessionId: 'cfg' }], hasMore: false } }), 300)),
    'sessions.usage.timeseries': () => usageOf('cfg', 1),
  });
  const parent = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  const meter = await startMeter({
    url: gateway.url,
    budget: '1000000',
    parentPid: parent.pid,
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '5', OPENCLAW_PROOFS_TOKEN_BUDGET_DISCOVERY_SECONDS: '0.1' },
  });
  try {
    await meter.waitFor((state) => state.phase === 'armed' && state.discoveries >= 2, 'discoveries');
    parent.kill('SIGKILL');
    const exited = await Promise.race([meter.exited, new Promise((resolve) => setTimeout(() => resolve('still running'), 4000))]);
    assert.equal(exited, 0, 'a meter whose runner is gone must stop polling the gateway');
  } finally {
    parent.kill('SIGKILL');
    await meter.cleanup();
    await gateway.close();
  }
});

test('the meter keeps its state fresh between readings and holds one connection', async () => {
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }]),
    'sessions.usage.timeseries': () => usageOf('cfg', 1),
  });
  const meter = await startMeter({
    url: gateway.url,
    budget: '1000000',
    env: { OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS: '3', OPENCLAW_PROOFS_TOKEN_BUDGET_DISCOVERY_SECONDS: '0.1' },
  });
  try {
    const first = await meter.waitFor((state) => state.phase === 'armed' && state.discoveries >= 1, 'a discovery');
    const later = await meter.waitFor((state) => state.discoveries >= first.discoveries + 5, 'more discoveries');
    assert.equal(later.readings.length, first.readings.length, 'no usage reading in between');
    assert.ok(Date.parse(later.updatedAt) > Date.parse(first.updatedAt), 'a discovery rewrites the state, so the runner never sees a healthy meter as stale');
    assert.equal(gateway.connects.length, 1, `one authenticated connection for the run, not one per discovery (${gateway.connects.length})`);
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

// The token budget's cutoff (🌊, Discord 1573086211386384495) never aborts a
// session that existed before the run, and reports per-session usage that
// landed after the trip; the meter supplies both.

test('--baseline-out holds every session the baseline listed, written before the meter arms; the trip keeps per-session totals', async () => {
  let tokens = 0;
  let lists = 0;
  const gateway = await startGateway({
    'sessions.list': () => {
      lists += 1;
      return listing(() => [
        { key: CONFIGURED, sessionId: 'cfg' },
        { key: 'agent:main:heartbeat', sessionId: 'hb' },
        ...(lists > 1 ? [{ key: SECRET_KEY, sessionId: 'uuid-secret', label: 'k6 R-CW-2 secretnonce' }] : []),
      ])();
    },
    'sessions.usage.timeseries': ({ key }) => (key === SECRET_KEY ? usageOf('uuid-secret', (tokens += 150)) : usageOf('cfg', 9000)),
  });
  const meter = await startMeter({ url: gateway.url, budget: '1000', baselineOut: true });
  try {
    const armed = await meter.waitFor((state) => state.phase !== 'baseline', 'armed');
    assert.ok(existsSync(meter.baselineSessionsPath), 'written by the time the phase leaves baseline');
    const baseline = await meter.baselineSessions();
    assert.equal(baseline.at, armed.baseline.at);
    assert.deepEqual(baseline.sessions, [{ key: CONFIGURED, sessionId: 'cfg' }, { key: 'agent:main:heartbeat', sessionId: 'hb' }]);
    const tripped = await meter.waitFor((state) => state.trip, 'a trip');
    assert.deepEqual(tripped.tripSessions, tripped.sessions.map(({ id, lastTokens }) => ({ id, lastTokens })), 'the totals the tripping reading left');
    const later = await meter.waitFor((state) => state.readings.length >= tripped.readings.length + 2, 'readings after the trip');
    assert.deepEqual(later.tripSessions, tripped.tripSessions, 'kept as the trip left them');
    assert.ok(!JSON.stringify(later).includes('uuid-secret'), 'the public state still carries no session id');
    assert.ok(gateway.connects.every((connect) => JSON.stringify(connect.scopes) === '["operator.read"]'), 'the meter stays read-only');
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('a baseline file that cannot be written refuses the run rather than arming without it', async () => {
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }]),
    'sessions.usage.timeseries': () => usageOf('cfg', 1),
  });
  const meter = await startMeter({ url: gateway.url, baselineOut: true, baselineOutBlocked: true });
  try {
    assert.equal(await meter.exited, 3, meter.output());
    const state = await meter.readState();
    assert.equal(state.phase, 'unenforceable');
    assert.equal(state.error, 'baseline-sessions-unwritten');
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});

test('once the abort mark appears, the next reading keeps the totals the last reading left, and later growth is measured against them', async () => {
  let tokens = 0;
  let aborted = false;
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }, { key: SECRET_KEY, sessionId: 'uuid-secret', label: 'k6 R-CW-2 secretnonce' }]),
    'sessions.usage.timeseries': ({ key }) => (key === SECRET_KEY ? usageOf('uuid-secret', (tokens += aborted ? 0 : 100)) : usageOf('cfg', 1)),
  });
  const meter = await startMeter({ url: gateway.url, budget: '999999', abortMark: true });
  try {
    await meter.waitFor((state) => state.readings.length >= 3, 'three readings');
    aborted = true;
    const before = await meter.readState();
    assert.equal(before.abortSessions, null, 'nothing is kept before the mark');
    await meter.markAbort('2026-11-19T00:00:00.000Z');
    const marked = await meter.waitFor((state) => state.abortSessions, 'the abort snapshot');
    const later = await meter.waitFor((state) => state.readings.length >= marked.readings.length + 2, 'readings after the mark');
    assert.equal(later.abortSessions.markedAt, '2026-11-19T00:00:00.000Z');
    assert.deepEqual(later.abortSessions, marked.abortSessions, 'kept once, as the mark found it');
    // At most one reading was in flight when the mark appeared; its growth sits in the snapshot.
    assert.ok(later.abortSessions.cumulative >= before.cumulative && later.abortSessions.cumulative <= before.cumulative + 100);
    assert.equal(later.cumulative, later.abortSessions.cumulative, 'nothing grew after the abort, and the snapshot says so');
    assert.ok(!JSON.stringify(later.abortSessions).includes('uuid-secret'));
  } finally {
    await meter.cleanup();
    await gateway.close();
  }
});
