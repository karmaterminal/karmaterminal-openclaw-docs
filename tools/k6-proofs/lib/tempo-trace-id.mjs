/**
 * One Tempo/OTLP identifier contract for the whole harness.
 *
 * Node-only post-run module. Never import it from a k6 scenario graph.
 *
 * Two collectors previously carried divergent trace-id validators. The row
 * collector rejected a 31-hex Tempo search id outright (the exact
 * `invalid search trace id: 7abdc3584196ef745cb4d8c85897a88` that left R-CD-4
 * without a correlation receipt) until it grew a private left-pad; the trace
 * fetcher still accepted any 8..64 hex string and would have fetched that same
 * truncated id as if it were a real trace. Both resolve identifiers here now,
 * so a repair can never land on one caller only.
 */

const HEX_ONLY = /^[0-9a-f]+$/;
const ALL_ZERO = /^0+$/;

function assertHex(text, length, label) {
  if (text.length !== length || !HEX_ONLY.test(text) || ALL_ZERO.test(text)) {
    throw new Error(`invalid ${label}: ${text || '(empty)'}`);
  }
  return text;
}

/**
 * Tempo search sometimes strips one leading zero from 16-byte trace IDs,
 * yielding 31 hex characters. Accept exactly that form by left-padding one
 * `0`; reject every other malformed length and all-zero IDs.
 */
export function normalizeTempoSearchTraceId(value, label = 'search trace id') {
  const text = String(value ?? '').toLowerCase();
  if (text.length === 32) return assertHex(text, 32, label);
  if (text.length === 31 && HEX_ONLY.test(text)) return assertHex(`0${text}`, 32, label);
  throw new Error(`invalid ${label}: ${text || '(empty)'}`);
}

/**
 * Normalize a hex or base64 OTLP identifier to lowercase hex of `bytes` length.
 * Applies the 31-hex trace-id recovery for 16-byte values only.
 */
export function normalizeOtlpId(value, bytes, label) {
  const text = String(value ?? '');
  const lower = text.toLowerCase();
  if (lower.length === bytes * 2 && HEX_ONLY.test(lower)) {
    return assertHex(lower, bytes * 2, label);
  }
  if (bytes === 16 && lower.length === 31 && HEX_ONLY.test(lower)) {
    return normalizeTempoSearchTraceId(lower, label);
  }
  const decoded = Buffer.from(text, 'base64');
  if (decoded.length !== bytes) throw new Error(`invalid ${label} byte length`);
  return assertHex(decoded.toString('hex'), bytes * 2, label);
}

/**
 * Resolve an identifier that is about to be used in a Tempo
 * `/api/traces/<id>` fetch.
 *
 * The generic fetcher is also driven by hand and by fixtures with short
 * synthetic ids, so the accepted width stays 8..64 hex. What is *not*
 * tolerated is the failure class that produced the R-CD-4 gap: a 31-hex Tempo
 * search id fetched verbatim. That form is recovered to its true 32-hex value
 * instead of being requested as-is, and an all-zero id — the OTel invalid-trace
 * sentinel — fails closed rather than producing an empty "fetched" receipt.
 */
export function normalizeFetchTraceIdInput(value, label = 'trace id') {
  const text = String(value ?? '').trim().toLowerCase();
  if (text.length === 31 && HEX_ONLY.test(text)) {
    return normalizeTempoSearchTraceId(text, label);
  }
  if (text.length < 8 || text.length > 64 || !HEX_ONLY.test(text) || ALL_ZERO.test(text)) {
    throw new Error(`invalid ${label}: ${text || '(empty)'}`);
  }
  return text;
}
