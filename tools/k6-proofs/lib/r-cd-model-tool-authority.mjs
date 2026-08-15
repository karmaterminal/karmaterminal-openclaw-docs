function normalizeModel(value) {
  return String(value || '').trim().replace(/[.,;:]+$/, '');
}

export function modelFromSessionMetadata(session) {
  const model = normalizeModel(session?.model);
  const provider = normalizeModel(session?.modelProvider || session?.provider);
  if (!model) return null;
  return model.includes('/') ? model : (provider ? `${provider}/${model}` : model);
}

export function sessionKeysFromListPayload(payload) {
  const sessions = Array.isArray(payload?.sessions)
    ? payload.sessions
    : (Array.isArray(payload) ? payload : []);
  return [...new Set(
    sessions
      .map((session) => (typeof session?.key === 'string' ? session.key : null))
      .filter((value) => typeof value === 'string' && value.length > 0),
  )].sort();
}

/**
 * Diff pre/post sessions.list { spawnedBy } key sets.
 * PASS authority requires exactly one new child key.
 */
export function diffSpawnedByChildren(preKeys, postKeys) {
  const pre = new Set(Array.isArray(preKeys) ? preKeys : []);
  const post = new Set(Array.isArray(postKeys) ? postKeys : []);
  const added = [...post].filter((key) => !pre.has(key)).sort();
  const removed = [...pre].filter((key) => !post.has(key)).sort();
  return {
    preCount: pre.size,
    postCount: post.size,
    added,
    removed,
    uniqueNewChildKey: added.length === 1 ? added[0] : null,
    ambiguous: added.length > 1,
    empty: added.length === 0,
  };
}

export function resolveModelToolChildAuthority({
  preKeys,
  postKeys,
  sessionsPayload,
  requestedModel,
  eventChildSessionKey,
  parentSessionKey,
}) {
  const diff = diffSpawnedByChildren(preKeys, postKeys);
  const sessions = Array.isArray(sessionsPayload?.sessions)
    ? sessionsPayload.sessions
    : (Array.isArray(sessionsPayload) ? sessionsPayload : []);
  const pre = new Set(Array.isArray(preKeys) ? preKeys : []);
  const eventKey = typeof eventChildSessionKey === 'string' && eventChildSessionKey.length > 0
    ? eventChildSessionKey
    : null;
  if (!diff.uniqueNewChildKey) {
    return {
      ...diff,
      childSessionKey: null,
      childSession: null,
      childMetadataModelByte: null,
      modelMatches: false,
      authoritySource: null,
      failureCategory: diff.ambiguous ? 'multiple-new-children' : 'zero-new-children',
    };
  }
  if (eventKey && (pre.has(eventKey) || eventKey !== diff.uniqueNewChildKey)) {
    const diffChild = sessions.find((session) => session?.key === diff.uniqueNewChildKey) || null;
    return {
      ...diff,
      childSessionKey: diff.uniqueNewChildKey,
      childSession: diffChild,
      childMetadataModelByte: modelFromSessionMetadata(diffChild),
      modelMatches: false,
      authoritySource: null,
      failureCategory: pre.has(eventKey)
        ? 'event-child-preexisting'
        : 'event-child-diff-mismatch',
    };
  }
  const selectedKey = diff.uniqueNewChildKey;

  const child = sessions.find((session) => (
    session?.key === selectedKey
    && (!parentSessionKey
      || session.spawnedBy === parentSessionKey
      || session.parentSessionKey === parentSessionKey)
  )) || null;
  if (!child) {
    return {
      ...diff,
      childSessionKey: null,
      childSession: null,
      childMetadataModelByte: null,
      modelMatches: false,
      authoritySource: null,
      failureCategory: 'child-parent-mismatch',
    };
  }
  const childMetadataModelByte = modelFromSessionMetadata(child);
  const requested = normalizeModel(requestedModel);
  const modelMatches = !!childMetadataModelByte && childMetadataModelByte === requested;
  return {
    ...diff,
    childSessionKey: selectedKey,
    childSession: child,
    childMetadataModelByte,
    modelMatches,
    authoritySource: eventKey
      ? 'event-correlated-sessions-list'
      : 'spawned-by-set-diff',
    failureCategory: !childMetadataModelByte
      ? 'missing-child-model-byte'
      : (modelMatches ? null : 'model-mismatch'),
  };
}

export function mergeModelToolChildAuthorityEvidence(currentEvidence, authority) {
  const current = currentEvidence || {};
  if (
    current.child_identity_conflict === true
    || current.spawned_by_diff_ambiguous === true
  ) {
    return { ...current };
  }
  if (authority?.ambiguous === true) {
    return {
      ...current,
      spawned_by_diff_ambiguous: true,
      model_matches: false,
      model_classification_reason: 'spawnedBy set-diff produced multiple new children',
    };
  }
  const authorityChildKey = typeof authority?.childSessionKey === 'string'
    && authority.childSessionKey.length > 0
    ? authority.childSessionKey
    : null;
  if (
    authorityChildKey
    && (
      (
        typeof current.child_session_key === 'string'
        && current.child_session_key.length > 0
        && current.child_session_key !== authorityChildKey
      )
      || (
        typeof current.event_child_session_key === 'string'
        && current.event_child_session_key.length > 0
        && current.event_child_session_key !== authorityChildKey
      )
    )
  ) {
    return {
      ...current,
      child_identity_conflict: true,
      spawned_by_diff_ambiguous: true,
      model_matches: false,
      model_classification_reason: 'conflicting authoritative child-session keys',
    };
  }
  const hasStickyAuthority = (
    current.child_session_metadata_observed === true
    && typeof current.child_session_key === 'string'
    && current.child_session_key.length > 0
    && typeof current.child_metadata_model_byte === 'string'
    && current.child_metadata_model_byte.length > 0
  );
  const hasNewAuthority = (
    typeof authority?.childSessionKey === 'string'
    && authority.childSessionKey.length > 0
    && typeof authority.childMetadataModelByte === 'string'
    && authority.childMetadataModelByte.length > 0
  );

  if (!hasNewAuthority) {
    if (hasStickyAuthority) return { ...current };
    return {
      ...current,
      spawned_by_diff_empty: authority?.empty === true,
      spawned_by_diff_ambiguous: authority?.ambiguous === true,
      model_classification_reason: authority?.failureCategory || current.model_classification_reason,
    };
  }

  const child = authority.childSession || {};
  return {
    ...current,
    child_session_key: authority.childSessionKey,
    child_session_observed: true,
    child_session_metadata_observed: true,
    child_metadata_model_byte: authority.childMetadataModelByte,
    child_metadata_model_source:
      `gateway sessions.list ${authority.authoritySource} provider/model metadata`,
    child_session_metadata: {
      key: child.key || authority.childSessionKey,
      provider: child.modelProvider || child.provider || null,
      model: child.model || null,
      modelSelectionLocked: child.modelSelectionLocked === true,
      spawnedBy: child.spawnedBy || child.parentSessionKey || null,
    },
    child_authority_source: authority.authoritySource,
    child_identity_conflict: false,
    model_matches: authority.modelMatches,
    spawned_by_diff_empty: false,
    spawned_by_diff_ambiguous: false,
    model_classification_reason: authority.failureCategory === 'model-mismatch'
      ? 'requested model does not match authoritative child-session metadata'
      : null,
  };
}

function messageText(message) {
  if (typeof message?.content === 'string') return message.content;
  if (!Array.isArray(message?.content)) return null;
  const parts = message.content
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text);
  return parts.length > 0 ? parts.join('\n') : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exact child→parent return marker required for return authority:
 *   MODEL-TOOL-CHILD <nonce> MODEL <provider/model>
 *
 * Generic assistant/system text that merely mentions the nonce (including
 * paraphrased schedule acknowledgements) is NOT return authority.
 * Model equality still comes solely from spawnedBy metadata — this marker
 * only proves a nonce-bound return payload landed in parent history.
 */
export function childReturnMarkerRegex(nonce) {
  if (!nonce || typeof nonce !== 'string') return null;
  return new RegExp(
    `\\bMODEL-TOOL-CHILD\\s+${escapeRegex(nonce)}\\s+MODEL\\s+([A-Za-z0-9_.\\/-]+)\\b`,
  );
}

/**
 * Parent sessions.get history may confirm a nonce-bound child return.
 *
 * Authority requires the exact MODEL-TOOL-CHILD <nonce> MODEL ... marker
 * (or the same typed pattern already used for auxiliary self-report parse).
 * The parent's own schedule ack (MODEL-TOOL-PARENT-SCHEDULED) and any
 * paraphrased schedule/waiting text are NOT returns.
 * When the marker is present in parent history it proves a child→parent
 * return payload landed, but model equality still comes solely from
 * spawnedBy metadata.
 */
export function parentReturnContainsNonce(messages, nonce) {
  const marker = childReturnMarkerRegex(nonce);
  if (!marker) return false;
  for (const message of Array.isArray(messages) ? messages : []) {
    const role = message?.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
    const text = messageText(message);
    if (typeof text !== 'string') continue;
    if (text.includes('[k6-proof-harness]')) continue;
    // Parent schedule ack is not child→parent return authority.
    if (/\bMODEL-TOOL-PARENT-SCHEDULED\b/.test(text)) continue;
    // Strict: only the exact child-return marker counts.
    if (marker.test(text)) return true;
  }
  return false;
}

/** Auxiliary only — never establishes model equality. */
export function parseAuxiliaryChildSelfReport(text, nonce) {
  if (typeof text !== 'string' || !nonce) return null;
  const marker = childReturnMarkerRegex(nonce);
  if (!marker) return null;
  const match = text.match(marker);
  return match ? normalizeModel(match[1]) : null;
}

/**
 * Baseline-gated dispatch controller for R-CD-MODEL-TOOL.
 *
 * The sole sessions.send dispatch fires exactly once from a successful
 * pre-dispatch sessions.list {spawnedBy} baseline response — never from a
 * fixed timing gap after subscribe. A watchdog may fail-closed if the
 * baseline never arrives; after fail-closed, a late baseline cannot dispatch.
 */
export function createModelToolDispatchGate() {
  let baselineCaptured = false;
  let dispatched = false;
  let failedClosed = false;

  return {
    /** Successful pre sessions.list response — may trigger the sole dispatch. */
    onPreBaselineCaptured() {
      if (failedClosed) return { action: 'noop', reason: 'already-failed-closed' };
      if (dispatched) return { action: 'noop', reason: 'already-dispatched' };
      baselineCaptured = true;
      dispatched = true;
      return { action: 'dispatch' };
    },
    /** Watchdog: if baseline never arrived, fail closed. */
    onBaselineWatchdog() {
      if (dispatched || baselineCaptured) {
        return { action: 'noop', reason: 'baseline-already-handled' };
      }
      failedClosed = true;
      return { action: 'fail-closed' };
    },
    getState() {
      return {
        baselineCaptured,
        dispatched,
        failedClosed,
        dispatchCount: dispatched ? 1 : 0,
      };
    },
  };
}
