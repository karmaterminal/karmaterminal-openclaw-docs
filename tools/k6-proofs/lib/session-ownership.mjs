// Which gateway sessions a budgeted proof run created: the ownership record
// (🌊's ruling on the token budget's scoped sessions.abort, Discord
// 1573086211386384495).
//
// When a token budget trips, run-proofs.sh may call sessions.abort only on a
// session this run provably created, or on a descendant of one. The proof is
// written at creation: when a row scenario's sessions.create is answered,
// RequestTracker.classify (lib/gateway-ws.js) logs one ownership record with
// the session key and session id the gateway answered. The runner arms this
// only for a budgeted live run, by putting a fresh random tag in
// OPENCLAW_PROOFS_OWNERSHIP_TAG; with no tag nothing is logged, and an
// unbudgeted run's k6 output is unchanged.
//
// The tag exists in the runner's environment and k6's, and nowhere a model can
// read it: it is never sent to the gateway. So a line a model managed to get
// into the k6 log (a scenario that logs reply text) cannot claim a session: its
// tag is wrong, and it is counted as rejected. The record lives only in the
// private k6 log and the runner's private ledger. The public k6.log replaces it
// (scripts/sanitize-k6-artifacts.mjs).
//
// k6 and Node compatible: no k6 or Node imports.

export const OWNERSHIP_TAG_ENV = 'OPENCLAW_PROOFS_OWNERSHIP_TAG';
export const OWNERSHIP_MARKER = '[k6-owned-session]';
const TAG = /^[0-9a-f]{32}$/u;

/** True for a tag the runner could have issued: 32 lowercase hex digits. */
export function isOwnershipTag(tag) {
  return typeof tag === 'string' && TAG.test(tag);
}

/**
 * The ownership record for one answered sessions.create, or null when there
 * is nothing to record: no valid tag (an unbudgeted run), a refused create, or
 * an answer with no session key.
 */
export function ownershipRecordLine(tag, payload) {
  if (!isOwnershipTag(tag) || !payload || typeof payload !== 'object') return null;
  const key = typeof payload.key === 'string' && payload.key ? payload.key : null;
  if (!key) return null;
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId ? payload.sessionId : null;
  return `${OWNERSHIP_MARKER} ${tag} ${JSON.stringify({ key, sessionId })}`;
}

// A k6 console line is `time=... level=info msg="<json string>" source=console`,
// or with K6_LOG_FORMAT=json one JSON object whose msg is the message. A bare
// line (another runner, a test) is taken as the message itself.
function messageOf(line) {
  if (line.trimStart().startsWith('{')) {
    try {
      const entry = JSON.parse(line);
      return typeof entry?.msg === 'string' ? entry.msg : null;
    } catch {
      return null;
    }
  }
  const marker = ' msg=';
  const start = line.indexOf(marker);
  if (start < 0) return line;
  const encodedStart = start + marker.length;
  const source = line.lastIndexOf(' source=');
  const encoded = line.slice(encodedStart, source > encodedStart ? source : undefined).trim();
  if (!encoded.startsWith('"')) return encoded;
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}

/**
 * Every ownership record in a k6 log that carries `tag`. A message that starts
 * with the marker but has another tag, or no well-formed record, is counted in
 * `rejected` and never returned. A message that only mentions the marker later
 * on is not a record at all.
 * @returns {{ records: {key: string, sessionId: string|null}[], rejected: number }}
 */
export function parseOwnershipRecords(logText, tag) {
  const records = [];
  let rejected = 0;
  for (const line of String(logText || '').split(/\r?\n/u)) {
    if (!line.includes(OWNERSHIP_MARKER)) continue;
    const message = messageOf(line);
    if (typeof message !== 'string' || !message.startsWith(`${OWNERSHIP_MARKER} `)) continue;
    const rest = message.slice(OWNERSHIP_MARKER.length + 1);
    const space = rest.indexOf(' ');
    const lineTag = space < 0 ? rest : rest.slice(0, space);
    if (!isOwnershipTag(tag) || lineTag !== tag) {
      rejected += 1;
      continue;
    }
    let record;
    try {
      record = JSON.parse(rest.slice(space + 1));
    } catch {
      rejected += 1;
      continue;
    }
    const key = typeof record?.key === 'string' && record.key ? record.key : null;
    const sessionId = record?.sessionId === null || (typeof record?.sessionId === 'string' && record.sessionId) ? record.sessionId : undefined;
    if (!key || sessionId === undefined) {
      rejected += 1;
      continue;
    }
    records.push({ key, sessionId });
  }
  return { records, rejected };
}
