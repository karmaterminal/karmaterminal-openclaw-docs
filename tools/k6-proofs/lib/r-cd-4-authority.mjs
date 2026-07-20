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

function directMessageRole(eventData) {
  const message = eventData?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  return typeof message.role === 'string' ? message.role : null;
}

function directMessageText(eventData) {
  const message = eventData?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return null;
  const textParts = message.content
    .filter((part) => (
      part
      && typeof part === 'object'
      && !Array.isArray(part)
      && part.type === 'text'
      && typeof part.text === 'string'
    ))
    .map((part) => part.text);
  return textParts.length > 0 ? textParts.join('\n') : null;
}

function hasExactSentinel(eventData, marker, nonce) {
  const messageText = directMessageText(eventData);
  if (!messageText || messageText.includes(HARNESS_MARKER)) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(marker)}\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(messageText);
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
  if (directMessageRole(eventData) !== 'system') return null;
  if (!hasExactSentinel(eventData, 'TARGET-RECEIVED', nonce)) return null;
  return {
    eventName,
    sessionKey,
    nonce,
    marker: `TARGET-RECEIVED ${nonce}`,
    role: 'system',
  };
}

/**
 * Inspect return authority for every post-dispatch session.message.
 *
 * `wakeGateMs` is intentionally diagnostic-only: it tells the caller whether
 * a generic message arrived after the expected wake delay, but it never gates
 * nonce-bound target or parent authority. A legitimate continuation return can
 * arrive before the generic wake timer, especially when delaySeconds is below
 * the default observation gate.
 */
export function rCd4SessionMessageObservation({
  eventName,
  eventData,
  targetSessionKey,
  parentSessionKey,
  nonce,
  elapsedMs,
  wakeGateMs,
}) {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const gate = Number.isFinite(wakeGateMs) ? wakeGateMs : 0;
  return {
    targetCandidate: rCd4ReturnCandidate({
      eventName,
      eventData,
      expectedSessionKey: targetSessionKey,
      nonce,
    }),
    parentCandidate: rCd4ReturnCandidate({
      eventName,
      eventData,
      expectedSessionKey: parentSessionKey,
      nonce,
    }),
    genericWakeObserved: elapsed >= gate,
  };
}

/** Finalize only after the row has independently observed its spawned child. */
export function rCd4ReturnReceipt(candidate, childSessionKey) {
  if (!candidate || typeof childSessionKey !== 'string' || childSessionKey.length === 0) {
    return null;
  }
  return { ...candidate, childSessionKey };
}
