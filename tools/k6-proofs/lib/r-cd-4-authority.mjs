const HARNESS_MARKER = '[k6-proof-harness]';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function directSessionKey(eventData) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) return null;
  const candidates = [eventData.sessionKey, eventData.session]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function hasExactSentinel(eventData, marker, nonce) {
  const serialized = JSON.stringify(eventData);
  if (!serialized || serialized.includes(HARNESS_MARKER)) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(marker)}\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(serialized);
}

/**
 * Identify the target/parent session event that carries the exact row marker.
 *
 * This deliberately accepts only the structured top-level event session. A
 * session key or nonce appearing in nested prompt text must not route the
 * receipt. Child identity is bound separately after a nonce-correlated spawn
 * event is observed.
 */
export function rCd4ReturnCandidate({ eventName, eventData, expectedSessionKey, nonce }) {
  if (eventName !== 'session.message') return null;
  if (!expectedSessionKey || !nonce) return null;
  const sessionKey = directSessionKey(eventData);
  if (sessionKey !== expectedSessionKey) return null;
  if (!hasExactSentinel(eventData, 'TARGET-RECEIVED', nonce)) return null;
  return {
    eventName,
    sessionKey,
    nonce,
    marker: `TARGET-RECEIVED ${nonce}`,
  };
}

/** Finalize only after the row has independently observed its spawned child. */
export function rCd4ReturnReceipt(candidate, childSessionKey) {
  if (!candidate || typeof childSessionKey !== 'string' || childSessionKey.length === 0) {
    return null;
  }
  return { ...candidate, childSessionKey };
}
