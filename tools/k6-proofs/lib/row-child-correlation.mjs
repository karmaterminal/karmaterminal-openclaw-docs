function directStringValues(record) {
  return Object.values(record).flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
    return [];
  });
}

function childKeyBoundToNonce(record, rowNonce) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const childSessionKey = typeof record.childSessionKey === 'string' ? record.childSessionKey : null;
  if (!childSessionKey) return null;
  return directStringValues(record).some((value) => value.includes(rowNonce)) ? childSessionKey : null;
}

/** Return a child key only when this exact structured record binds it to the row. */
export function directChildSessionKeyForRow(record, rowNonce) {
  if (!rowNonce || typeof rowNonce !== 'string') return null;
  return childKeyBoundToNonce(record, rowNonce);
}

/**
 * Return a spawned child key only when the same structured record binds that
 * key to the proof-row nonce.
 *
 * Gateway subscriptions can contain aggregate events from earlier proof work.
 * A nonce anywhere in the outer event is not enough: a stale top-level child
 * key plus an unrelated nested task for the current row must fail closed.
 */
export function childSessionKeyForRow(eventData, rowNonce) {
  if (!rowNonce || typeof rowNonce !== 'string') return null;
  const matches = new Set();
  const seen = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (!Array.isArray(value)) {
      const match = directChildSessionKeyForRow(value, rowNonce);
      if (match) matches.add(match);
    }
    for (const child of Object.values(value)) visit(child);
  }

  visit(eventData);
  return matches.size === 1 ? [...matches][0] : null;
}
