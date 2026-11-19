#!/usr/bin/env node
// token-budget-meter.mjs — the counter behind run-proofs.sh --token-budget.
//
//   node scripts/token-budget-meter.mjs watch --budget <tokens> \
//     --state <file> --trip-flag <file> [--parent-pid <pid>]
//
// Reads the gateway from OPENCLAW_GATEWAY_WS with OPENCLAW_GATEWAY_TOKEN (taken
// from the environment only, never an argument), as the row scenarios' backend
// identity with operator.read and nothing more. Configured session keys come
// from OPENCLAW_SESSION_KEY and OPENCLAW_TARGET_SESSION_KEY.
//
// It takes a baseline reading first. If that cannot be read, it writes phase
// "unenforceable" and exits 3, and the runner refuses to start. Otherwise it
// writes phase "armed" and reads again every poll interval, start to start
// (lib/token-budget.mjs has the source, the scope and the stop rules). When the
// ledger trips it writes the state, then creates the trip flag, and keeps
// reading so the receipt also records what was consumed after the stop. On
// SIGTERM or SIGINT it takes one last reading, writes phase "stopped" and
// exits 0. It exits on its own once --parent-pid is gone.
//
// The state file is public-safe: totals, times, scope counts and 12-hex session
// id hashes. No session key, session id, token or gateway message is written.
import { renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { HARNESS_CLIENT_IDENTITY } from '../lib/gateway-client-identity.mjs';
import {
  createBudgetLedger,
  createUsageMeter,
  parseTokenBudget,
  publicId,
  tokenBudgetPollMs,
} from '../lib/token-budget.mjs';

export const TOKEN_BUDGET_STATE_SCHEMA = 'openclaw.k6.token-budget-state.v1';
export const TOKEN_BUDGET_READ_TIMEOUT_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET_READ_TIMEOUT_SECONDS';
export const TOKEN_BUDGET_DISCOVERY_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET_DISCOVERY_SECONDS';
const DEFAULT_READ_TIMEOUT_SECONDS = 20;
// Between readings the meter lists sessions about once a second, so a session
// created and deleted between two readings is still found (and read from its
// archive by the next reading).
const DEFAULT_DISCOVERY_SECONDS = 1;
const METER_CLIENT = Object.freeze({
  id: HARNESS_CLIENT_IDENTITY.id,
  mode: HARNESS_CLIENT_IDENTITY.mode,
  version: 'k6-proof-token-budget-v1',
  platform: 'node',
});
export const COUNTED_TOKENS =
  'input + output + cacheRead + cacheWrite (or usage.total when larger) of every model response recorded in the transcripts of the run\'s sessions';

function secondsSetting(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback * 1000;
  const seconds = /^\d+(?:\.\d{1,3})?$/u.test(raw) ? Number(raw) : NaN;
  if (!(seconds >= min && seconds <= max)) throw new Error(`${name} is not seconds from ${min} to ${max}`);
  return Math.round(seconds * 1000);
}

/**
 * One authenticated gateway connection that is closed, failing every pending
 * request, at `deadline` (epoch ms). request() resolves to { ok, payload, error }.
 */
export function openGatewayRpc(wsUrl, token, { deadline, WebSocketImpl = globalThis.WebSocket } = {}) {
  return new Promise((resolveOpen, rejectOpen) => {
    if (typeof WebSocketImpl !== 'function') {
      rejectOpen(new Error('websocket-unavailable'));
      return;
    }
    const pending = new Map();
    let socket;
    let opened = false;
    let failure = null;
    const connectId = `token-budget-connect-${randomUUID()}`;
    const fail = (reason) => {
      if (failure) return;
      failure = reason;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* already failed */ }
      if (!opened) rejectOpen(new Error(reason));
      for (const { reject } of pending.values()) reject(new Error(reason));
      pending.clear();
    };
    const timer = setTimeout(() => fail('gateway-rpc-timeout'), Math.max(0, deadline - Date.now()));
    const client = {
      request(method, params) {
        if (failure) return Promise.reject(new Error(failure));
        const id = `token-budget-${randomUUID()}`;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          socket.send(JSON.stringify({ type: 'req', id, method, params }));
        });
      },
      close() {
        clearTimeout(timer);
        failure ??= 'closed';
        try { socket.close(); } catch { /* closing a closed socket */ }
      },
    };
    try {
      socket = new WebSocketImpl(wsUrl);
    } catch {
      fail('gateway-connect-failed');
      return;
    }
    socket.onerror = () => fail(opened ? 'gateway-socket-error' : 'gateway-connect-failed');
    socket.onclose = () => fail('gateway-closed');
    socket.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        fail('gateway-frame-invalid');
        return;
      }
      if (frame?.type === 'event' && frame.event === 'connect.challenge' && !opened) {
        socket.send(JSON.stringify({
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: 4,
            maxProtocol: 4,
            client: METER_CLIENT,
            role: 'operator',
            scopes: ['operator.read'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            userAgent: METER_CLIENT.version,
          },
        }));
        return;
      }
      if (frame?.type !== 'res') return;
      if (frame.id === connectId) {
        if (frame.ok !== true || frame.payload?.type !== 'hello-ok') {
          fail('gateway-auth-rejected');
          return;
        }
        opened = true;
        resolveOpen(client);
        return;
      }
      const waiter = pending.get(frame.id);
      if (!waiter) return;
      pending.delete(frame.id);
      waiter.resolve(frame.ok === true
        ? { ok: true, payload: frame.payload ?? null }
        : { ok: false, error: frame.error ?? { code: 'ERROR' } });
    };
  });
}

/**
 * The cadence the readings actually kept: start-to-start intervals, read
 * durations, and the tokens counted after the trip (the measured overshoot
 * past the stop decision).
 */
export function readingCadence(readings, trip) {
  const times = readings.map((reading) => Date.parse(reading.at)).filter(Number.isFinite);
  const intervals = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  const readMs = readings.map((reading) => reading.readMs).filter(Number.isFinite);
  const last = readings.at(-1);
  return {
    readings: readings.length,
    intervalMsMedian: intervals.length ? intervals[Math.floor(intervals.length / 2)] : null,
    intervalMsMax: intervals.length ? intervals.at(-1) : null,
    readMsMax: readMs.length ? Math.max(...readMs) : null,
    postTripTokens: trip && last ? last.cumulative - trip.cumulative : null,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith('--') || value === undefined) throw new Error(`usage: token-budget-meter.mjs watch --budget <tokens> --state <file> --trip-flag <file> [--parent-pid <pid>]`);
    args[name.slice(2)] = value;
  }
  return args;
}

function writeAtomic(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, file);
}

function parentAlive(pid) {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function watch(args, env = process.env) {
  const statePath = args.state;
  const flagPath = args['trip-flag'];
  if (!statePath || !flagPath) throw new Error('--state and --trip-flag are required');
  const parentPid = args['parent-pid'] ? Number(args['parent-pid']) : null;
  const state = {
    schema: TOKEN_BUDGET_STATE_SCHEMA,
    phase: 'baseline',
    budget: null,
    countedTokens: COUNTED_TOKENS,
    source: 'sessions.list + sessions.usage.timeseries (openclaw gateway WebSocket, operator.read)',
    pollIntervalMs: null,
    readTimeoutMs: null,
    discoveryIntervalMs: null,
    discoveries: 0,
    baseline: null,
    cumulative: 0,
    maxIncrement: 0,
    trip: null,
    readings: [],
    cadence: readingCadence([], null),
    sessions: [],
    error: null,
    updatedAt: new Date().toISOString(),
  };
  const save = () => {
    state.updatedAt = new Date().toISOString();
    writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
  };
  const refuse = (error) => {
    state.phase = 'unenforceable';
    state.error = error;
    save();
    return 3;
  };

  // A refusal names the setting, never the value it refused.
  let budget;
  let pollMs;
  let timeoutMs;
  let discoveryMs;
  try {
    budget = parseTokenBudget(args.budget);
  } catch {
    return refuse('budget-config-invalid: the token budget is not a positive whole number of at most 15 digits');
  }
  if (!budget.enabled) return refuse('budget-config-invalid: no budget was given');
  try {
    pollMs = tokenBudgetPollMs(env);
  } catch {
    return refuse('budget-config-invalid: OPENCLAW_PROOFS_TOKEN_BUDGET_POLL_SECONDS is out of range');
  }
  try {
    timeoutMs = secondsSetting(env, TOKEN_BUDGET_READ_TIMEOUT_ENV, DEFAULT_READ_TIMEOUT_SECONDS, 0.1, 120);
    discoveryMs = Math.min(pollMs, secondsSetting(env, TOKEN_BUDGET_DISCOVERY_ENV, DEFAULT_DISCOVERY_SECONDS, 0.05, 60));
  } catch (error) {
    return refuse(`budget-config-invalid: ${error.message}`);
  }
  Object.assign(state, { budget: budget.budget, pollIntervalMs: pollMs, readTimeoutMs: timeoutMs, discoveryIntervalMs: discoveryMs });
  const wsUrl = env.OPENCLAW_GATEWAY_WS;
  const token = env.OPENCLAW_GATEWAY_TOKEN;
  if (!wsUrl) return refuse('gateway-url-missing');
  if (!token) return refuse('gateway-token-missing');

  let cycleRpc = null;
  const meter = createUsageMeter({
    rpc: (method, params) => cycleRpc(method, params),
    configuredKeys: [env.OPENCLAW_SESSION_KEY, env.OPENCLAW_TARGET_SESSION_KEY],
  });
  // One connection per reading, closed at the reading's deadline.
  const timed = async (read) => {
    const started = Date.now();
    let connection = null;
    cycleRpc = async (method, params) => {
      connection ??= openGatewayRpc(wsUrl, token, { deadline: started + timeoutMs });
      return (await connection).request(method, params);
    };
    try {
      const reading = await read();
      return { reading, readMs: Date.now() - started };
    } finally {
      if (connection) (await connection.catch(() => null))?.close();
    }
  };

  const baselineRead = await timed(() => meter.baseline());
  const baseline = baselineRead.reading;
  state.baseline = {
    at: baseline.at,
    readable: baseline.readable,
    readMs: baselineRead.readMs,
    scope: baseline.scope ?? null,
    tokensInScope: baseline.readable ? Object.values(baseline.sessions).reduce((sum, tokens) => sum + tokens, 0) : null,
  };
  if (!baseline.readable) return refuse(`baseline-unreadable: ${baseline.error}`);
  const ledger = createBudgetLedger({ budget: budget.budget, baseline });
  state.phase = 'armed';
  state.sessions = meter.publicSessions();
  save();

  let stopping = false;
  let wake = null;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  // Record one ledger entry (a usage reading, or a failed discovery), write the
  // state, then the trip flag if this entry tripped the ledger.
  const observe = (reading, extra) => {
    const wasTripped = Boolean(state.trip);
    const entry = ledger.observe(reading);
    const recorded = ledger.state().readings.at(-1);
    state.readings.push({
      ...recorded,
      ...(recorded.decreased ? { decreased: recorded.decreased.map(publicId) } : {}),
      ...extra,
    });
    state.cumulative = entry.cumulative;
    state.maxIncrement = entry.maxIncrement;
    state.trip = entry.trip;
    state.sessions = meter.publicSessions();
    state.cadence = readingCadence(state.readings.filter((item) => !item.discovery), state.trip);
    if (entry.trip) state.phase = 'tripped';
    save();
    if (entry.trip && !wasTripped) writeAtomic(flagPath, `${JSON.stringify(entry.trip)}\n`);
  };

  let nextAt = Date.now() + pollMs;
  let nextDiscoveryAt = Date.now() + discoveryMs;
  for (;;) {
    while (!stopping && Date.now() < nextAt) {
      if (Date.now() >= nextDiscoveryAt) {
        nextDiscoveryAt = Date.now() + discoveryMs;
        const { reading: found, readMs } = await timed(() => meter.discover());
        state.discoveries += 1;
        if (!found.readable) {
          observe({ at: found.at, readable: false, error: `discovery: ${found.error}` }, { readMs, discovery: true });
        }
        continue;
      }
      await new Promise((resolve) => {
        wake = resolve;
        setTimeout(resolve, Math.min(250, Math.max(0, Math.min(nextAt, nextDiscoveryAt) - Date.now())));
      });
      wake = null;
      if (!parentAlive(parentPid)) stopping = true;
    }
    const final = stopping;
    nextAt = Math.max(nextAt + pollMs, Date.now());
    nextDiscoveryAt = Date.now() + discoveryMs;
    const { reading, readMs } = await timed(() => meter.read());
    observe(reading, {
      readMs,
      ...(reading.scope ? { scope: reading.scope } : {}),
      ...(final ? { final: true } : {}),
    });
    if (final) {
      state.phase = 'stopped';
      save();
      return 0;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'watch') throw new Error('the only command is: watch');
  process.exitCode = await watch(args);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`token-budget-meter: ${error.message}`);
    process.exitCode = 1;
  });
}
