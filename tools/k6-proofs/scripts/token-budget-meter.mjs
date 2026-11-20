#!/usr/bin/env node
// token-budget-meter.mjs — the counter behind run-proofs.sh --token-budget.
//
//   node scripts/token-budget-meter.mjs watch --budget <tokens> \
//     --state <file> --trip-flag <file> [--baseline-out <file>] \
//     [--abort-mark <file>] [--abort-doc <file>] [--parent-pid <pid>]
//
// Reads the gateway from OPENCLAW_GATEWAY_WS with OPENCLAW_GATEWAY_TOKEN (taken
// from the environment only, never an argument), as the row scenarios' backend
// identity with operator.read and nothing more. Configured session keys come
// from OPENCLAW_SESSION_KEY and OPENCLAW_TARGET_SESSION_KEY.
//
// It holds one authenticated connection for the run and takes a baseline
// reading first. If that cannot be read, it writes phase
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
// --baseline-out is the one private file: the key and session id of every
// session the baseline listed, written before phase "armed", for the cutoff
// (scripts/token-budget-abort.mjs), which never aborts a session that existed
// before the run. The runner keeps it in its mode-700 budget directory.
// --abort-mark names the file the runner writes, with the time, once the
// cutoff has ended. The meter looks for it as each reading completes. Once it
// appears, the meter keeps the per-session totals (as hashes) as they stood
// before the first reading that completed at or after that time, so the
// receipt can show which sessions grew after the abort. A reading begun before
// it and completed after it is marked straddlesAbort and counts after it: its
// growth may have landed during the abort pass, but post-abort growth is never
// understated. Every reading records when it completed.
// --abort-doc names the cutoff's public abort document, read once with the
// mark: a session the cutoff named by its key (it had no session id then) is
// published with that name as abortId under the session id it is metered by.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
 * One authenticated gateway connection. The handshake must finish by
 * `deadline` (epoch ms); each request(method, params, deadline) must be
 * answered by its own deadline. Any timeout, socket error or close fails the
 * connection and every pending request; failed() then reports it, and the
 * meter opens a new one for its next reading. request() resolves to
 * { ok, payload, error }.
 */
export function openGatewayRpc(wsUrl, token, { deadline, scopes = ['operator.read'], WebSocketImpl = globalThis.WebSocket } = {}) {
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
      clearTimeout(connectTimer);
      try { socket?.close(); } catch { /* already failed */ }
      if (!opened) rejectOpen(new Error(reason));
      for (const { reject, timer } of pending.values()) {
        clearTimeout(timer);
        reject(new Error(reason));
      }
      pending.clear();
    };
    const connectTimer = setTimeout(() => fail('gateway-rpc-timeout'), Math.max(0, deadline - Date.now()));
    const client = {
      failed: () => failure !== null,
      request(method, params, requestDeadline) {
        if (failure) return Promise.reject(new Error(failure));
        const id = `token-budget-${randomUUID()}`;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => fail('gateway-rpc-timeout'), Math.max(0, requestDeadline - Date.now()));
          pending.set(id, { resolve, reject, timer });
          socket.send(JSON.stringify({ type: 'req', id, method, params }));
        });
      },
      close() {
        fail('closed');
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
            scopes: [...scopes],
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
        clearTimeout(connectTimer);
        resolveOpen(client);
        return;
      }
      const waiter = pending.get(frame.id);
      if (!waiter) return;
      pending.delete(frame.id);
      clearTimeout(waiter.timer);
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
    if (!name?.startsWith('--') || value === undefined) throw new Error(`usage: token-budget-meter.mjs watch --budget <tokens> --state <file> --trip-flag <file> [--baseline-out <file>] [--abort-mark <file>] [--abort-doc <file>] [--parent-pid <pid>]`);
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
    // Per-session totals (12-hex hashes) as the tripping reading left them, so
    // the receipt can show which sessions' usage landed after the trip.
    tripSessions: null,
    // The same, as they stood before the first reading that completed at or
    // after the cutoff ended (see --abort-mark), with the cumulative total then
    // (both null when no totals were kept from before it) and how many of the
    // abort document's session ids were read to link id-less sessions (null:
    // the document could not be read).
    abortSessions: null,
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

  // One connection for the whole run. A connection found failed at the start
  // of a reading (the gateway closed it while idle) is replaced quietly; a
  // failure during a reading fails that reading. Every request in a reading
  // shares the reading's deadline.
  let link = null;
  let cycleDeadline = 0;
  const meter = createUsageMeter({
    rpc: async (method, params) => {
      if (!link || link.client?.failed()) {
        const opening = { client: null, promise: openGatewayRpc(wsUrl, token, { deadline: cycleDeadline }) };
        opening.promise.then((client) => { opening.client = client; }, () => {});
        link = opening;
      }
      let client;
      try {
        client = await link.promise;
      } catch (error) {
        link = null;
        throw error;
      }
      return client.request(method, params, cycleDeadline);
    },
    configuredKeys: [env.OPENCLAW_SESSION_KEY, env.OPENCLAW_TARGET_SESSION_KEY],
  });
  const timed = async (read) => {
    const started = Date.now();
    cycleDeadline = started + timeoutMs;
    const reading = await read();
    const completedMs = Date.now();
    return { reading, readMs: completedMs - started, completedMs };
  };
  const closeLink = () => link?.client?.close();

  const baselineRead = await timed(() => meter.baseline());
  const baseline = baselineRead.reading;
  state.baseline = {
    at: baseline.at,
    readable: baseline.readable,
    readMs: baselineRead.readMs,
    scope: baseline.scope ?? null,
    tokensInScope: baseline.readable ? Object.values(baseline.sessions).reduce((sum, tokens) => sum + tokens, 0) : null,
  };
  if (!baseline.readable) {
    closeLink();
    return refuse(`baseline-unreadable: ${baseline.error}`);
  }
  const ledger = createBudgetLedger({ budget: budget.budget, baseline });
  if (args['baseline-out']) {
    try {
      writeAtomic(args['baseline-out'], `${JSON.stringify({ at: baseline.at, sessions: meter.baselineSessions() })}\n`);
    } catch {
      closeLink();
      return refuse('baseline-sessions-unwritten');
    }
  }
  state.phase = 'armed';
  state.sessions = meter.publicSessions();
  save();

  // The totals each usage reading left, with when it began and completed, so
  // the abort snapshot can be the totals before the first reading that
  // completed after the abort, wherever the mark is first seen. From the trip
  // on every one is kept until the snapshot; before it, the last two.
  const totalsNow = () => ({ cumulative: state.cumulative, sessions: state.sessions.map(({ id, lastTokens }) => ({ id, lastTokens })) });
  let checkpoints = [{ index: null, startedMs: null, completedMs: Date.now(), ...totalsNow() }];

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
    if (entry.trip && !wasTripped) state.tripSessions = state.sessions.map(({ id, lastTokens }) => ({ id, lastTokens }));
    state.cadence = readingCadence(state.readings.filter((item) => !item.discovery), state.trip);
    if (entry.trip) state.phase = 'tripped';
    save();
    if (entry.trip && !wasTripped) writeAtomic(flagPath, `${JSON.stringify(entry.trip)}\n`);
  };

  // The abort snapshot (see --abort-mark and --abort-doc), once. A mark read
  // without its time (caught before the time was written) is taken at a later
  // reading. If no kept totals completed before the mark's time, the meter
  // claims none (cumulative and sessions null) rather than later ones; the
  // receipt then splits the readings itself.
  const keepAbortSnapshot = () => {
    let markedAt = null;
    try {
      markedAt = readFileSync(args['abort-mark'], 'utf8').trim() || null;
    } catch { /* not readable yet */ }
    const abortMs = Date.parse(markedAt ?? '');
    if (!Number.isFinite(abortMs)) return;
    const kept = checkpoints.filter((checkpoint) => checkpoint.completedMs < abortMs).at(-1) ?? null;
    for (const later of checkpoints.slice(kept ? checkpoints.indexOf(kept) + 1 : 0)) {
      if (later.index !== null && later.startedMs < abortMs) state.readings[later.index].straddlesAbort = true;
    }
    let abortIds = null;
    if (args['abort-doc']) {
      try {
        const doc = JSON.parse(readFileSync(args['abort-doc'], 'utf8'));
        if (!Array.isArray(doc?.sessions)) throw new Error('malformed');
        abortIds = new Set(doc.sessions.map((session) => session?.id).filter((id) => typeof id === 'string' && /^[0-9a-f]{12}$/u.test(id)));
      } catch {
        abortIds = null;
      }
    }
    if (abortIds) meter.linkAbortIds(abortIds);
    state.abortSessions = { markedAt, cumulative: kept?.cumulative ?? null, sessions: kept?.sessions ?? null, abortIdsRead: abortIds ? abortIds.size : null };
    state.sessions = meter.publicSessions();
    checkpoints = null;
    save();
  };

  let nextAt = Date.now() + pollMs;
  let nextDiscoveryAt = Date.now() + discoveryMs;
  for (;;) {
    while (!stopping && Date.now() < nextAt) {
      // Checked on every pass, so neither slow discoveries run back to back nor
      // slow readings keep a meter polling for a runner that is gone.
      if (!parentAlive(parentPid)) {
        stopping = true;
        break;
      }
      if (Date.now() >= nextDiscoveryAt) {
        const { reading: found, readMs, completedMs } = await timed(() => meter.discover());
        nextDiscoveryAt = Date.now() + discoveryMs;
        state.discoveries += 1;
        if (found.readable) {
          // Fresh state between readings: the runner's staleness check.
          save();
        } else {
          observe({ at: found.at, readable: false, error: `discovery: ${found.error}` }, { readMs, completedAt: new Date(completedMs).toISOString(), discovery: true });
        }
        continue;
      }
      await new Promise((resolve) => {
        wake = resolve;
        setTimeout(resolve, Math.min(250, Math.max(0, Math.min(nextAt, nextDiscoveryAt) - Date.now())));
      });
      wake = null;
    }
    if (!parentAlive(parentPid)) stopping = true;
    const final = stopping;
    nextAt = Math.max(nextAt + pollMs, Date.now());
    nextDiscoveryAt = Date.now() + discoveryMs;
    const { reading, readMs, completedMs } = await timed(() => meter.read());
    observe(reading, {
      readMs,
      completedAt: new Date(completedMs).toISOString(),
      ...(reading.scope ? { scope: reading.scope } : {}),
      ...(final ? { final: true } : {}),
    });
    if (checkpoints) {
      checkpoints.push({ index: state.readings.length - 1, startedMs: Date.parse(reading.at), completedMs, ...totalsNow() });
      if (!state.trip && checkpoints.length > 2) checkpoints.splice(0, checkpoints.length - 2);
    }
    if (args['abort-mark'] && !state.abortSessions && existsSync(args['abort-mark'])) keepAbortSnapshot();
    if (final) {
      state.phase = 'stopped';
      save();
      closeLink();
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
