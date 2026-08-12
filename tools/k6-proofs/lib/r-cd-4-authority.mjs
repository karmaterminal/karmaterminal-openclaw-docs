import { directChildSessionKeyForRow } from './row-child-correlation.mjs';
import {
  resolveTargetedReturnAuthority,
  fingerprintIdentity,
} from './targeted-return-receipt.mjs';

export const R_CD_4_OBSERVATION_WINDOW_MS = 90_000;
export const R_CD_4_DURATION_THRESHOLD_MS = 110_000;
export {
  resolveTargetedReturnAuthority,
  fingerprintIdentity,
};

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
 * Diagnostic-only marker observation.
 *
 * Silent-wake delivery authority is the payload-free gateway
 * `[continuation:targeted-return]` receipt (see targeted-return-receipt.mjs).
 * Transcript session.message / sessions.get nonce text must never promote PASS.
 */
export function rCd4DiagnosticMarkerCandidate({ eventName, eventData, expectedSessionKey, nonce }) {
  if (eventName !== 'session.message') return null;
  if (!expectedSessionKey || !nonce) return null;
  const sessionKey = directSessionKey(eventData);
  if (sessionKey !== expectedSessionKey) return null;
  if (directMessageRole(eventData) !== 'system') return null;
  if (!hasExactSentinel(eventData, 'TARGET-RECEIVED', nonce)) return null;
  return {
    eventName,
    sessionKeyFingerprint: fingerprintIdentity(sessionKey),
    nonceFingerprint: fingerprintIdentity(nonce),
    marker: 'TARGET-RECEIVED',
    role: 'system',
    authoritative: false,
  };
}

/** @deprecated message markers are not delivery authority; use resolveTargetedReturnAuthority */
export function rCd4ReturnCandidate(args) {
  return rCd4DiagnosticMarkerCandidate(args);
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
 * Inspect diagnostic marker observations only. Never gates silent-wake delivery.
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
    targetDiagnosticMarker: rCd4DiagnosticMarkerCandidate({
      eventName,
      eventData,
      expectedSessionKey: targetSessionKey,
      nonce,
    }),
    parentDiagnosticMarker: rCd4DiagnosticMarkerCandidate({
      eventName,
      eventData,
      expectedSessionKey: parentSessionKey,
      nonce,
    }),
    // Back-compat aliases — still non-authoritative.
    targetCandidate: null,
    parentCandidate: null,
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
    targetDiagnosticMarker: null,
    parentDiagnosticMarker: null,
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
    result.targetDiagnosticMarker ??= observation.targetDiagnosticMarker;
    result.parentDiagnosticMarker ??= observation.parentDiagnosticMarker;
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
 * Message-marker receipts are never authoritative for silent-wake delivery.
 * Always returns null so callers cannot promote transcript text to PASS.
 */
export function rCd4ReturnReceipt(_candidate, _childSessionKey) {
  return null;
}

export function rCd4ShouldScheduleEarlyClose({ parentReturnReceipt }) {
  return parentReturnReceipt !== null && parentReturnReceipt !== undefined;
}

/**
 * Finalize R-CD-4 return authority from the shared journal collector only.
 */
export function rCd4JournalReturnAuthority(args) {
  return resolveTargetedReturnAuthority({ ...args, row: args.row || 'R-CD-4' });
}
