#!/usr/bin/env node
// token-budget-abort.mjs — the token budget's cutoff behind run-proofs.sh.
//
//   harvest   --log <private k6 log> --row <ROW> --ledger <file>
//   abort     --ledger <file> --baseline <file> --out <file>
//   overshoot --state <file> [--abort <file>] [--drain <file>]
//
// harvest runs after every budgeted row's k6 exits. It appends to the run's
// private ledger each ownership record that row's k6 logged when a
// sessions.create was answered (lib/session-ownership.mjs), keeping only
// records that carry the run's tag from OPENCLAW_PROOFS_OWNERSHIP_TAG.
//
// abort runs once, when the budget trips (🌊's ruling, Discord
// 1573086211386384495). It connects as the row scenarios' backend identity
// with operator.read and operator.write, lists the gateway's sessions,
// decides which the run owns (lib/token-budget-cutoff.mjs), and calls
// sessions.abort once per owned session, in order, with no retry. It never
// aborts anything when the listing, the ledger or the baseline cannot be
// read: ownership it cannot prove is ownership it does not have. The token
// comes from OPENCLAW_GATEWAY_TOKEN and the URL from OPENCLAW_GATEWAY_WS,
// never from an argument. The document it writes is public-safe: sessions
// appear as 12-hex hashes, and no key, session id, token or gateway message is
// written.
//
// overshoot prints the receipt's overshoot section: the observed figures and
// the maximum possible overshoot, which this guard never bounds.
import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { OWNERSHIP_TAG_ENV, parseOwnershipRecords } from '../lib/session-ownership.mjs';
import {
  ABORT_ACK_NOTE,
  CUTOFF_GUARD,
  computeOvershoot,
  resolveOwnership,
  runAbortPass,
  sessionPublicId,
} from '../lib/token-budget-cutoff.mjs';
import { openGatewayRpc } from './token-budget-meter.mjs';

export const TOKEN_BUDGET_ABORT_SCHEMA = 'openclaw.k6.token-budget-abort.v1';
export const TOKEN_BUDGET_ABORT_TIMEOUT_ENV = 'OPENCLAW_PROOFS_TOKEN_BUDGET_ABORT_TIMEOUT_SECONDS';
const DEFAULT_ABORT_TIMEOUT_SECONDS = 60;
const ABORT_SCOPES = Object.freeze(['operator.read', 'operator.write']);
const LIST_PAGE = 500;
const MAX_LIST_PAGES = 200;
const USAGE = 'usage: token-budget-abort.mjs harvest --log <file> --row <ROW> --ledger <file> | '
  + 'abort --ledger <file> --baseline <file> --out <file> | '
  + 'overshoot --state <file> [--abort <file>] [--drain <file>]';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith('--') || value === undefined) throw new Error(USAGE);
    args[name.slice(2)] = value;
  }
  return args;
}

function writeAtomic(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, file);
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** The ledger: one JSON object per line, records and per-row harvest summaries. */
export function readLedger(file) {
  const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const records = entries.filter((entry) => entry.type === 'record').map(({ key, sessionId }) => ({ key, sessionId }));
  const harvests = entries.filter((entry) => entry.type === 'harvest');
  return {
    records,
    rejected: harvests.reduce((sum, entry) => sum + (Number.isInteger(entry.rejected) ? entry.rejected : 0), 0),
    harvestFailures: harvests.filter((entry) => entry.error).length,
  };
}

/** Append one row's ownership records (and a summary of the row's harvest) to the ledger. */
export function harvest({ log, row, ledger, tag }) {
  let text;
  try {
    text = readFileSync(log, 'utf8');
  } catch {
    appendFileSync(ledger, `${JSON.stringify({ type: 'harvest', row, records: 0, rejected: 0, error: 'log-unreadable' })}\n`);
    return { records: 0, rejected: 0, error: 'log-unreadable' };
  }
  const { records, rejected } = parseOwnershipRecords(text, tag);
  const lines = records.map((record) => JSON.stringify({ type: 'record', row, ...record }));
  lines.push(JSON.stringify({ type: 'harvest', row, records: records.length, rejected }));
  appendFileSync(ledger, `${lines.join('\n')}\n`);
  return { records: records.length, rejected };
}

async function listSessions(rpc) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const answer = await rpc('sessions.list', { limit: LIST_PAGE, ...(offset ? { offset } : {}) });
    if (answer?.ok !== true) {
      const code = typeof answer?.error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(answer.error.code) ? answer.error.code : 'ERROR';
      throw new Error(`sessions-list:${code}`);
    }
    const payload = answer.payload;
    if (!payload || !Array.isArray(payload.sessions) || typeof payload.hasMore !== 'boolean') throw new Error('sessions-list:malformed');
    rows.push(...payload.sessions.filter((row) => row && typeof row.key === 'string' && row.key));
    if (!payload.hasMore) return rows;
    if (!Number.isInteger(payload.nextOffset) || payload.nextOffset <= offset) throw new Error('sessions-list:no-next-offset');
    offset = payload.nextOffset;
  }
  throw new Error('sessions-list:too-many-pages');
}

function abortTimeoutMs(env) {
  const raw = env[TOKEN_BUDGET_ABORT_TIMEOUT_ENV];
  if (raw === undefined || raw === '') return DEFAULT_ABORT_TIMEOUT_SECONDS * 1000;
  const seconds = /^\d+(?:\.\d{1,3})?$/u.test(raw) ? Number(raw) : NaN;
  if (!(seconds >= 0.1 && seconds <= 600)) throw new Error(`${TOKEN_BUDGET_ABORT_TIMEOUT_ENV} is not seconds from 0.1 to 600`);
  return Math.round(seconds * 1000);
}

/**
 * The cutoff: list, decide, abort. Resolves to the public abort document.
 * `connect(scopes, deadline)` opens the gateway connection (injected so the
 * decision path can be tested without one).
 */
export async function cutoff({ ledgerFile, baselineFile, env = process.env, connect, clock = () => Date.now() }) {
  const startedAt = new Date(clock()).toISOString();
  const doc = {
    schema: TOKEN_BUDGET_ABORT_SCHEMA,
    guard: CUTOFF_GUARD,
    attempted: false,
    reason: null,
    startedAt,
    completedAt: null,
    scopes: [...ABORT_SCOPES],
    ownership: { records: 0, recordsRejected: 0, harvestFailures: 0, rowsListed: null, baselineSessions: null, recordedNotListed: 0 },
    sessions: [],
    ambiguous: [],
    untouched: null,
    counts: { owned: 0, aborted: 0, noActiveRun: 0, acknowledged: 0, refused: 0, failed: 0, notAttempted: 0, skipped: 0, ambiguous: 0 },
    abortCalls: 0,
    retries: 0,
    error: null,
    note: ABORT_ACK_NOTE,
  };
  const finish = () => {
    doc.completedAt = new Date(clock()).toISOString();
    return doc;
  };

  let ledger;
  let baseline;
  try {
    ledger = readLedger(ledgerFile);
  } catch {
    doc.reason = 'ownership-ledger-unreadable';
    return finish();
  }
  Object.assign(doc.ownership, { records: ledger.records.length, recordsRejected: ledger.rejected, harvestFailures: ledger.harvestFailures });
  try {
    baseline = readJson(baselineFile);
    if (!Array.isArray(baseline?.sessions)) throw new Error('malformed');
  } catch {
    doc.reason = 'baseline-sessions-unreadable';
    return finish();
  }
  doc.ownership.baselineSessions = baseline.sessions.length;
  let timeoutMs;
  try {
    timeoutMs = abortTimeoutMs(env);
  } catch {
    doc.reason = 'abort-timeout-invalid';
    return finish();
  }
  const deadline = clock() + timeoutMs;

  let client;
  try {
    client = await connect(ABORT_SCOPES, deadline);
  } catch (error) {
    doc.attempted = true;
    doc.error = `abort-connection-failed: ${String(error?.message || error).slice(0, 80)}`;
    return finish();
  }
  doc.attempted = true;
  try {
    const rpc = (method, params) => client.request(method, params, deadline);
    let rows;
    try {
      rows = await listSessions(rpc);
    } catch (error) {
      doc.error = `listing-failed: ${String(error?.message || error).slice(0, 80)}`;
      return finish();
    }
    doc.ownership.rowsListed = rows.length;
    const decision = resolveOwnership({
      records: ledger.records,
      baseline: baseline.sessions,
      rows,
      configuredKeys: [env.OPENCLAW_SESSION_KEY, env.OPENCLAW_TARGET_SESSION_KEY],
    });
    doc.ownership.recordedNotListed = decision.recordedNotListed;
    doc.untouched = decision.untouched;
    doc.ambiguous = decision.ambiguous.map((session) => ({ id: sessionPublicId(session.key, session.sessionId), reason: session.reason, labelled: session.labelled }));
    const pass = await runAbortPass({ rpc, owned: decision.owned, deadline, clock });
    doc.abortCalls = pass.calls;
    if (pass.connectionError) doc.error = `abort-connection-lost: ${pass.connectionError}`;
    doc.sessions = pass.results.map((result) => {
      const id = sessionPublicId(result.key, result.sessionId);
      return {
        id,
        role: result.role,
        depth: result.depth,
        outcome: result.outcome,
        ...(result.status ? { status: result.status } : {}),
        ...(result.error ? { error: result.error } : {}),
        ...(result.refusal ? { refusal: result.refusal } : {}),
        ...(result.reason ? { reason: result.reason } : {}),
      };
    });
    const tally = (outcome) => doc.sessions.filter((session) => session.outcome === outcome).length;
    doc.counts = {
      owned: doc.sessions.length,
      aborted: tally('aborted'),
      noActiveRun: tally('no-active-run'),
      acknowledged: tally('acknowledged'),
      refused: tally('refused'),
      failed: tally('failed'),
      notAttempted: tally('not-attempted'),
      skipped: tally('skipped'),
      ambiguous: doc.ambiguous.length,
    };
    return finish();
  } finally {
    client.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'harvest') {
    if (!args.log || !args.row || !args.ledger) throw new Error(USAGE);
    const result = harvest({ log: args.log, row: args.row, ledger: args.ledger, tag: process.env[OWNERSHIP_TAG_ENV] });
    console.log(JSON.stringify({ row: args.row, ...result }));
    return;
  }
  if (args.command === 'abort') {
    if (!args.ledger || !args.baseline || !args.out) throw new Error(USAGE);
    const wsUrl = process.env.OPENCLAW_GATEWAY_WS;
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    const doc = await cutoff({
      ledgerFile: args.ledger,
      baselineFile: args.baseline,
      connect: (scopes, deadline) => {
        if (!wsUrl) return Promise.reject(new Error('gateway-url-missing'));
        if (!token) return Promise.reject(new Error('gateway-token-missing'));
        return openGatewayRpc(wsUrl, token, { deadline, scopes });
      },
    });
    writeAtomic(args.out, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(JSON.stringify({ attempted: doc.attempted, reason: doc.reason, error: doc.error, counts: doc.counts }));
    return;
  }
  if (args.command === 'overshoot') {
    if (!args.state) throw new Error(USAGE);
    const optional = (file) => {
      if (!file) return null;
      try {
        return readJson(file);
      } catch {
        return null;
      }
    };
    console.log(JSON.stringify(computeOvershoot({ state: readJson(args.state), abort: optional(args.abort), drain: optional(args.drain) })));
    return;
  }
  throw new Error(USAGE);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`token-budget-abort: ${error.message}`);
    process.exitCode = 1;
  });
}
