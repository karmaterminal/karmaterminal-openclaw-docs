// Spawn events expose row text as task/text; tasks.list exposes it as title.
// Routing keys identify sessions and must never supply row-nonce authority.
const DIRECT_ROW_IDENTITY_FIELDS = ['task', 'text', 'title'];
const TASK_RECORD_FIELDS = ['task'];
const TASK_RECORD_COLLECTION_FIELDS = ['tasks', 'records'];
const TASK_IDENTITY_NONCE_SUFFIX_CHARS = 16;

export function compactTaskIdentityToken(prefix, rowNonce) {
  if (!/^[A-Z0-9-]{1,8}$/.test(String(prefix || '')) ||
      typeof rowNonce !== 'string' ||
      rowNonce.length < TASK_IDENTITY_NONCE_SUFFIX_CHARS) {
    return null;
  }
  return `${prefix}:${rowNonce.slice(-TASK_IDENTITY_NONCE_SUFFIX_CHARS)}`;
}

export function renderRowTaskTemplate(template, rowNonce) {
  if (typeof template !== 'string' || typeof rowNonce !== 'string' || rowNonce.length === 0) {
    return null;
  }
  return template
    .replaceAll('{{nonceSuffix16}}', rowNonce.slice(-TASK_IDENTITY_NONCE_SUFFIX_CHARS))
    .replaceAll('{{nonce}}', rowNonce);
}

function directTaskIdentityValues(record) {
  return DIRECT_ROW_IDENTITY_FIELDS.flatMap((field) => {
    const value = record[field];
    return typeof value === 'string' ? [value] : [];
  });
}

function rowIdentityTokens(rowNonce, additionalTokens = []) {
  return [rowNonce, ...additionalTokens]
    .filter((value) => typeof value === 'string' && value.length > 0);
}

function childKeyBoundToNonce(record, rowNonce, additionalTokens = []) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const childSessionKey = typeof record.childSessionKey === 'string' ? record.childSessionKey : null;
  if (!childSessionKey) return null;
  const tokens = rowIdentityTokens(rowNonce, additionalTokens);
  return directTaskIdentityValues(record).some((value) => (
    tokens.some((token) => value.includes(token))
  ))
    ? childSessionKey
    : null;
}

/** Return a child key only when this exact structured record binds it to the row. */
export function directChildSessionKeyForRow(record, rowNonce, additionalTokens = []) {
  if (!rowNonce || typeof rowNonce !== 'string') return null;
  return childKeyBoundToNonce(record, rowNonce, additionalTokens);
}

/**
 * Return a spawned child key only when the same structured record binds that
 * key to the proof-row nonce.
 *
 * Gateway subscriptions can contain aggregate events from earlier proof work.
 * A nonce anywhere in the outer event is not enough: only direct records and
 * recognized task-record containers are authoritative. Nested metadata must
 * never supply or conflict with child authority.
 */
export function childSessionKeysForRow(eventData, rowNonce, additionalTokens = []) {
  if (!rowNonce || typeof rowNonce !== 'string') return [];
  const matches = new Set();
  const seen = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (!Array.isArray(value)) {
      const match = directChildSessionKeyForRow(value, rowNonce, additionalTokens);
      if (match) matches.add(match);
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    for (const field of TASK_RECORD_FIELDS) visit(value[field]);
    for (const field of TASK_RECORD_COLLECTION_FIELDS) {
      if (Array.isArray(value[field])) visit(value[field]);
    }
  }

  visit(eventData);
  return [...matches];
}

export function childSessionKeyForRow(eventData, rowNonce, additionalTokens = []) {
  const matches = childSessionKeysForRow(eventData, rowNonce, additionalTokens);
  return matches?.length === 1 ? matches[0] : null;
}
