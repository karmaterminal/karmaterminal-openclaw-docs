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
