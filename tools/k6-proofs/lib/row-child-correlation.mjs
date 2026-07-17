/**
 * Return a spawned child key only when its event belongs to the proof row.
 *
 * Gateway subscriptions can contain events from earlier proof work. Requiring
 * the row nonce prevents a stale child session from satisfying a later row's
 * persisted-model receipt.
 */
export function childSessionKeyForRow(eventData, rowNonce) {
  const event = eventData || {};
  if (!JSON.stringify(event).includes(rowNonce)) return null;
  return event.childSessionKey || event.task?.childSessionKey || event.session?.childSessionKey || null;
}
