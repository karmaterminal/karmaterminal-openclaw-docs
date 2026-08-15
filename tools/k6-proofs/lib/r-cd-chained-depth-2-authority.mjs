function fingerprint(value, fingerprintIdentity) {
  return typeof fingerprintIdentity === 'function' ? fingerprintIdentity(value) : null;
}

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

function hasExactGrandchildMarker(eventData, nonce) {
  const messageText = directMessageText(eventData);
  if (!messageText || messageText.includes(HARNESS_MARKER)) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])GRANDCHILD-DONE\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(messageText);
}

/**
 * Diagnostic-only root marker observation.
 *
 * Grandchild→root silent-wake routing authority is the shared payload-free
 * `[continuation:targeted-return]` collector, not transcript system text.
 */
export function rCdChainRootDiagnosticMarker({
  eventName,
  eventData,
  rootSessionKey,
  nonce,
  fingerprintIdentity,
}) {
  if (eventName !== 'session.message') return null;
  if (!rootSessionKey || !nonce) return null;
  if (directSessionKey(eventData) !== rootSessionKey) return null;
  if (directMessageRole(eventData) !== 'system') return null;
  if (!hasExactGrandchildMarker(eventData, nonce)) return null;
  return {
    eventName,
    rootSessionFingerprint: fingerprint(rootSessionKey, fingerprintIdentity),
    nonceFingerprint: fingerprint(nonce, fingerprintIdentity),
    marker: 'GRANDCHILD-DONE',
    role: 'system',
    authoritative: false,
  };
}

/** @deprecated transcript markers are not routing authority */
export function rCdChainRootReturnCandidate(args) {
  return rCdChainRootDiagnosticMarker(args);
}

/**
 * Message-marker receipts never establish root routing authority.
 */
export function rCdChainRootReturnReceipt(_candidate, _hops) {
  return null;
}

/**
 * Require two distinct nonce-bound hop identities before journal authority
 * can finalize grandchild→root routing.
 */
export function rCdChainHopIdentities({
  childSessionKey,
  grandchildSessionKey,
  fingerprintIdentity,
} = {}) {
  if (!childSessionKey || !grandchildSessionKey) {
    return { ok: false, reason: 'missing-hop' };
  }
  if (childSessionKey === grandchildSessionKey) {
    return { ok: false, reason: 'indistinct-hops' };
  }
  return {
    ok: true,
    childSessionKey,
    grandchildSessionKey,
    childFingerprint: fingerprint(childSessionKey, fingerprintIdentity),
    grandchildFingerprint: fingerprint(grandchildSessionKey, fingerprintIdentity),
  };
}

export function resolveUniqueSpawnedByChild({ sessionsPayload, parentSessionKey } = {}) {
  if (typeof parentSessionKey !== 'string' || parentSessionKey.length === 0) {
    return {
      uniqueChildKey: null,
      child: null,
      candidates: [],
      ambiguous: false,
      empty: true,
      failureCategory: 'missing-parent-session',
    };
  }
  const sessions = Array.isArray(sessionsPayload?.sessions)
    ? sessionsPayload.sessions
    : (Array.isArray(sessionsPayload) ? sessionsPayload : []);
  const children = sessions.filter((session) => (
    typeof session?.key === 'string'
    && session.key.length > 0
    && session.key !== parentSessionKey
    && (session.spawnedBy === parentSessionKey || session.parentSessionKey === parentSessionKey)
  ));
  const candidates = [...new Set(children.map((session) => session.key))].sort();
  const uniqueChildKey = candidates.length === 1 ? candidates[0] : null;
  return {
    uniqueChildKey,
    child: uniqueChildKey
      ? children.find((session) => session.key === uniqueChildKey) || null
      : null,
    candidates,
    ambiguous: candidates.length > 1,
    empty: candidates.length === 0,
    failureCategory: candidates.length > 1
      ? 'multiple-direct-children'
      : (candidates.length === 0 ? 'zero-direct-children' : null),
  };
}

/**
 * Nested depth-2 call must request fanoutMode=tree so grandchild completion
 * routes up the ancestry to root. Outer parent→child call stays unchanged.
 */
export function rCdChainNestedDelegateSpec({ nonce, mode = 'silent-wake' } = {}) {
  if (typeof nonce !== 'string' || nonce.length === 0) return null;
  return {
    mode,
    fanoutMode: 'tree',
    task: `Grandchild nonce ${nonce}: reply exactly GRANDCHILD-DONE ${nonce} only after you arrive. Do not mutate files.`,
  };
}

export function rCdChainPromptTemplate() {
  return (
    "Proof chain nonce {{nonce}}: you are depth-1. Fire your own continue_delegate(" +
    "mode='silent-wake', fanoutMode='tree', " +
    "task='Grandchild nonce {{nonce}}: reply exactly GRANDCHILD-DONE {{nonce}} only after you arrive. Do not mutate files.'" +
    "). After the nested continue_delegate tool result reports scheduled, reply exactly " +
    'CHILD-DONE {{nonce}} CHILD-DELEGATE-SCHEDULED.'
  );
}
