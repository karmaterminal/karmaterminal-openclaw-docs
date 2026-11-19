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
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

async function startMeter({ url, budget = '1000', token = TOKEN, parentPid = null, env = {} }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'token-budget-meter-'));
  const state = path.join(dir, 'state.json');
  const flag = path.join(dir, 'tripped');
  const args = [meterScript, 'watch', '--budget', budget, '--state', state, '--trip-flag', flag];
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
    assert.match((await noBudget.readState()).error, /^budget-config-invalid: invalid token budget/u);
  } finally {
    await noBudget.cleanup();
  }
});

test('climbing usage trips the flag, readings continue after the trip, and SIGTERM stops with a final reading', async () => {
  let tokens = 0;
  const gateway = await startGateway({
    'sessions.list': listing(() => [{ key: CONFIGURED, sessionId: 'cfg' }, { key: SECRET_KEY, sessionId: 'uuid-secret', label: 'k6 R-CW-2 secretnonce' }]),
    'sessions.usage.timeseries': ({ key }) => (key === SECRET_KEY ? usageOf('uuid-secret', (tokens += 150)) : usageOf('cfg', 9000)),
  });
  const meter = await startMeter({ url: gateway.url, budget: '1000' });
  try {
    const armed = await meter.waitFor((state) => state.phase !== 'baseline', 'armed');
    assert.equal(armed.baseline.readable, true);
    assert.equal(armed.baseline.tokensInScope, 9150, 'the baseline holds pre-run usage, which is never charged');
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
