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

function hasExactRootAck(eventData, nonce) {
  const messageText = directMessageText(eventData);
  if (!messageText || messageText.includes(HARNESS_MARKER)) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])ROOT-CHAIN-ACK\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(messageText);
}

/**
 * Identify the root-session acknowledgement emitted after the root consumes
 * the prompt-only continuation return. Raw child/grandchild output is not
 * sufficient because it can appear on descendant session streams.
 */
export function rCdChainRootReturnCandidate({ eventName, eventData, rootSessionKey, nonce }) {
  if (eventName !== 'session.message') return null;
  if (!rootSessionKey || !nonce) return null;
  if (directSessionKey(eventData) !== rootSessionKey) return null;
  if (directMessageRole(eventData) !== 'assistant') return null;
  if (!hasExactRootAck(eventData, nonce)) return null;
  return {
    eventName,
    rootSessionKey,
    nonce,
    marker: `ROOT-CHAIN-ACK ${nonce}`,
    role: 'assistant',
  };
}

/** Finalize only when both distinct nonce-bound hop identities are known. */
export function rCdChainRootReturnReceipt(
  candidate,
  { childSessionKey, grandchildSessionKey } = {},
) {
  if (!candidate || !childSessionKey || !grandchildSessionKey) return null;
  if (childSessionKey === grandchildSessionKey) return null;
  return { ...candidate, childSessionKey, grandchildSessionKey };
}

/**
 * Own the observation deadline at the boundary that creates it. Descendant
 * progression gets one bounded window; once the grandchild is observed, root
 * return gets a fresh bounded window instead of inheriting the nearly-expired
 * dispatch timer.
 */
export function rCdChainObservationState({
  now,
  dispatchAcceptedAt,
  grandchildObservedAt,
  rootReturnReceipt,
  descendantTimeoutMs,
  rootReturnTimeoutMs,
}) {
  const current = Number(now);
  const dispatch = Number(dispatchAcceptedAt);
  const grandchild = grandchildObservedAt == null ? null : Number(grandchildObservedAt);
  if (!Number.isFinite(current) || !Number.isFinite(dispatch) ||
      !Number.isFinite(descendantTimeoutMs) || descendantTimeoutMs <= 0 ||
      !Number.isFinite(rootReturnTimeoutMs) || rootReturnTimeoutMs <= 0) {
    return { phase: 'invalid', deadlineAtMs: null, timedOut: true };
  }
  if (rootReturnReceipt) {
    return { phase: 'complete', deadlineAtMs: null, timedOut: false };
  }
  if (grandchild === null || !Number.isFinite(grandchild)) {
    const deadlineAtMs = dispatch + descendantTimeoutMs;
    return {
      phase: current >= deadlineAtMs ? 'descendant-timeout' : 'awaiting-descendants',
      deadlineAtMs,
      timedOut: current >= deadlineAtMs,
    };
  }
  const deadlineAtMs = grandchild + rootReturnTimeoutMs;
  return {
    phase: current >= deadlineAtMs ? 'root-return-timeout' : 'awaiting-root-return',
    deadlineAtMs,
    timedOut: current >= deadlineAtMs,
  };
}
