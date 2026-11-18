// One Tempo re-poll before a searched row is given up as uncorrelated.
//
// After each Tempo compaction, retention deletes the compaction's input blocks
// (compacted_block_retention=1h). The blocklist poll can race that delete and
// fail, so queriers miss the merged block until the next poll
// (blocklist_poll=5m): for up to about five minutes a trace that exists returns
// nothing from search or /api/traces/<id>, and then it heals. On 2026-11-18
// that made run 44245772142's traces look lost (06:50-06:55Z) when they were
// not (🍃's diagnosis, confirmed by 🌫).
//
// So collect-continuation-trace.mjs searches once more, one blocklist-poll
// period plus margin after a search that came back empty, before it gives up,
// and records both attempts. review-debt routing (lib/trace-debt-route.mjs)
// reads that record to say whether a re-poll was tried. This module owns the
// wait and the shape of the record for both of them.

export const TEMPO_REPOLL_ENV = 'OPENCLAW_PROOFS_TEMPO_REPOLL_SECONDS';
// Tempo's blocklist_poll on the fleet: a re-poll at least this long after an
// empty search outlasts one blocklist-poll gap.
export const TEMPO_BLOCKLIST_POLL_SECONDS = 300;
// One blocklist poll plus 30 s margin.
export const DEFAULT_TEMPO_REPOLL_SECONDS = TEMPO_BLOCKLIST_POLL_SECONDS + 30;
// A larger value is a unit mistake (330000 meant as milliseconds would wait
// almost four days), not a wait anyone wants.
const MAX_TEMPO_REPOLL_SECONDS = 3600;
const SECONDS = /^\d+(?:\.\d{1,3})?$/u;

// What the collector prints to stdout when it fails after a re-poll; the
// runner keeps it as continuation-trace-collector.json.
export const TRACE_SEARCH_RECORD_SCHEMA = 'openclaw.k6.trace-search-record.v1';

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ATTEMPT_KEYS = ['attempt', 'startedAt', 'endedAt', 'window', 'queryCount', 'result'];
const ATTEMPT_RESULTS = new Set(['matched', 'no-match', 'invalid-topology', 'error']);

/**
 * The re-poll wait in milliseconds: OPENCLAW_PROOFS_TEMPO_REPOLL_SECONDS, or
 * 330 s when it is unset or empty. Throws on anything but a number of seconds
 * from 0 to 3600 with at most millisecond precision, so a bad value fails the
 * collector before it queries Tempo instead of waiting the wrong time.
 */
export function tempoRepollMs(env = process.env) {
  const raw = env?.[TEMPO_REPOLL_ENV];
  if (raw === undefined || raw === '') return DEFAULT_TEMPO_REPOLL_SECONDS * 1000;
  const seconds = SECONDS.test(raw) ? Number(raw) : NaN;
  if (!(seconds <= MAX_TEMPO_REPOLL_SECONDS)) {
    throw new Error(
      `invalid ${TEMPO_REPOLL_ENV}: ${raw}; set a number of seconds from 0 to ${MAX_TEMPO_REPOLL_SECONDS} ` +
      `with at most three decimals (default ${DEFAULT_TEMPO_REPOLL_SECONDS})`,
    );
  }
  return Math.round(seconds * 1000);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function attemptValid(entry, index, window) {
  const keys = index === 0 ? ATTEMPT_KEYS : [...ATTEMPT_KEYS, 'repollWaitSeconds'];
  return sameKeys(entry, keys) &&
    entry.attempt === index + 1 &&
    ISO_MS.test(entry.startedAt) && ISO_MS.test(entry.endedAt) &&
    Date.parse(entry.endedAt) >= Date.parse(entry.startedAt) &&
    sameKeys(entry.window, ['startUnixSeconds', 'endUnixSeconds']) &&
    entry.window.startUnixSeconds === window.startUnixSeconds &&
    entry.window.endUnixSeconds === window.endUnixSeconds &&
    Number.isInteger(entry.queryCount) && entry.queryCount > 0 &&
    ATTEMPT_RESULTS.has(entry.result);
}

/**
 * Whether `attempts` is what the collector records when it re-polled: a first
 * search over `window` that matched nothing, then one re-poll over the same
 * window that began no sooner than its recorded wait after the first ended.
 * `repollResult`, when given, is the result the re-poll must have had.
 */
export function repolledSearchAttemptsValid(attempts, { window, repollResult } = {}) {
  if (!Array.isArray(attempts) || attempts.length !== 2 || !plainObject(window)) return false;
  const [first, repoll] = attempts;
  if (!attempts.every((entry, index) => attemptValid(entry, index, window))) return false;
  const waitSeconds = repoll.repollWaitSeconds;
  return first.result === 'no-match' &&
    (repollResult === undefined || repoll.result === repollResult) &&
    typeof waitSeconds === 'number' && Number.isFinite(waitSeconds) && waitSeconds >= 0 &&
    Date.parse(repoll.startedAt) - Date.parse(first.endedAt) >= Math.round(waitSeconds * 1000);
}

/**
 * The re-poll a collector search record names for this run, or null when the
 * record is absent, malformed, or was not made for this reason fingerprint and
 * search window: `{ waitSeconds, attempts: [{ attempt, startedAt, endedAt, result }] }`.
 */
export function repollFromSearchRecord(record, { reasonHash, reasonLength, window }) {
  if (!plainObject(record) || record.schema !== TRACE_SEARCH_RECORD_SCHEMA) return null;
  if (!sameKeys(record.reason, ['hash', 'length']) ||
      record.reason.hash !== reasonHash || record.reason.length !== reasonLength) {
    return null;
  }
  const attempts = record.searchAttempts;
  if (!repolledSearchAttemptsValid(attempts, { window })) return null;
  return {
    waitSeconds: attempts[1].repollWaitSeconds,
    attempts: attempts.map(({ attempt, startedAt, endedAt, result }) => ({ attempt, startedAt, endedAt, result })),
  };
}
