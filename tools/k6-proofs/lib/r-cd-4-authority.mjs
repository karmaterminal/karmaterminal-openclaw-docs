import { directChildSessionKeyForRow } from './row-child-correlation.mjs';

export const R_CD_4_OBSERVATION_WINDOW_MS = 90_000;
export const R_CD_4_DURATION_THRESHOLD_MS = 110_000;

const HARNESS_MARKER = '[k6-proof-harness]';
const R_CD_4_TASK_TOKEN_SUFFIX_CHARS = 16;

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
 * Identify the target/parent session event that proves the recipient consumed
 * the prompt-only continuation return and acted in the named session.
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
  if (directMessageRole(eventData) !== 'assistant') return null;
  if (!hasExactSentinel(eventData, 'TARGET-ACK', nonce)) return null;
  return {
    eventName,
    sessionKey,
    nonce,
    marker: `TARGET-ACK ${nonce}`,
    role: 'assistant',
  };
}

export function rCd4TargetReadyCandidate({ eventName, eventData, targetSessionKey, nonce }) {
  if (eventName !== 'session.message') return null;
  if (!targetSessionKey || !nonce) return null;
  if (directSessionKey(eventData) !== targetSessionKey) return null;
  if (directMessageRole(eventData) !== 'assistant') return null;
  if (!hasExactSentinel(eventData, 'TARGET-READY', nonce)) return null;
  return {
    eventName,
    sessionKey: targetSessionKey,
    nonce,
    marker: `TARGET-READY ${nonce}`,
    role: 'assistant',
  };
}

export function rCd4TaskIdentityToken(nonce) {
  if (typeof nonce !== 'string' || nonce.length === 0) return null;
  return `RCD4:${nonce.slice(-R_CD_4_TASK_TOKEN_SUFFIX_CHARS)}`;
}

export function rCd4TaskPrompt(template, nonce) {
  if (typeof template !== 'string' || typeof nonce !== 'string' || nonce.length === 0) {
    return null;
  }
  return template
    .replaceAll('{{nonceSuffix16}}', nonce.slice(-R_CD_4_TASK_TOKEN_SUFFIX_CHARS))
    .replaceAll('{{nonce}}', nonce);
}

export function rCd4ChildAuthority(candidates) {
  const observedChildSessionKeys = [...new Set(
    candidates.filter((value) => typeof value === 'string' && value.length > 0),
  )];
  return {
    observedChildSessionKeys,
    childSessionKey: observedChildSessionKeys.length === 1 ? observedChildSessionKeys[0] : null,
    ambiguous: observedChildSessionKeys.length > 1,
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

export function rCd4HistoryObservation({
  messages,
  sessionKey,
  targetSessionKey,
  parentSessionKey,
  nonce,
  elapsedMs,
  wakeGateMs,
}) {
  const result = {
    targetCandidate: null,
    parentCandidate: null,
    genericWakeObserved: false,
  };
  for (const message of Array.isArray(messages) ? messages : []) {
    const observation = rCd4SessionMessageObservation({
      eventName: 'session.message',
      eventData: { sessionKey, message },
      targetSessionKey,
      parentSessionKey,
      nonce,
      elapsedMs,
      wakeGateMs,
    });
    result.targetCandidate ??= observation.targetCandidate;
    result.parentCandidate ??= observation.parentCandidate;
    result.genericWakeObserved ||= observation.genericWakeObserved;
  }
  return result;
}

/**
 * Treat tasks.list as child authority only when one structured task record
 * binds its real childSessionKey to this row nonce.
 */
export function rCd4TaskObservation(task, nonce) {
  const taskIdentityToken = rCd4TaskIdentityToken(nonce);
  const childSessionKey = directChildSessionKeyForRow(
    task,
    nonce,
    taskIdentityToken ? [taskIdentityToken] : [],
  );
  if (!childSessionKey) {
    return {
      childSessionKey: null,
      completed: false,
      traceId: null,
    };
  }
  return {
    childSessionKey,
    completed: task?.state === 'completed' || task?.status === 'completed',
    traceId: typeof task?.traceId === 'string' && task.traceId.length > 0
      ? task.traceId
      : null,
  };
}

/**
 * A target receipt still needs the remaining observation window to prove that
 * no matching parent receipt arrives later. A parent receipt is already a
 * terminal target-only failure and may close early.
 */
export function rCd4ShouldScheduleEarlyClose({ parentReturnReceipt }) {
  return parentReturnReceipt !== null && parentReturnReceipt !== undefined;
}

/** Finalize only after the row has independently observed its spawned child. */
export function rCd4ReturnReceipt(candidate, childSessionKey) {
  if (!candidate || typeof childSessionKey !== 'string' || childSessionKey.length === 0) {
    return null;
  }
  return { ...candidate, childSessionKey };
}
