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
}) {
  const diff = diffSpawnedByChildren(preKeys, postKeys);
  if (!diff.uniqueNewChildKey) {
    return {
      ...diff,
      childSessionKey: null,
      childMetadataModelByte: null,
      modelMatches: false,
      failureCategory: diff.ambiguous
        ? 'multiple-new-children'
        : 'zero-new-children',
    };
  }

  const sessions = Array.isArray(sessionsPayload?.sessions)
    ? sessionsPayload.sessions
    : (Array.isArray(sessionsPayload) ? sessionsPayload : []);
  const child = sessions.find((session) => session?.key === diff.uniqueNewChildKey) || null;
  const childMetadataModelByte = modelFromSessionMetadata(child);
  const requested = normalizeModel(requestedModel);
  const modelMatches = !!childMetadataModelByte && childMetadataModelByte === requested;
  return {
    ...diff,
    childSessionKey: diff.uniqueNewChildKey,
    childMetadataModelByte,
    modelMatches,
    failureCategory: !childMetadataModelByte
      ? 'missing-child-model-byte'
      : (modelMatches ? null : 'model-mismatch'),
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
