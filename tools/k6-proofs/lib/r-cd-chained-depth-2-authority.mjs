import { directChildSessionKeyForRow } from './row-child-correlation.mjs';
import {
  gatewayLifecyclePhase,
  gatewayLifecycleRunId,
  gatewayLifecycleSucceeded,
} from './gateway-lifecycle.js';

export const R_CD_CHAIN_TASK_LEDGER_SCHEMA =
  'openclaw.k6.r-cd-chained-depth-2.task-ledger.v1';

const HARNESS_MARKER = '[k6-proof-harness]';
const ROOT_CONSUMPTION_TOOL = 'heartbeat_respond';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function directSessionKey(eventData) {
  const data = asRecord(eventData);
  if (!data) return null;
  const candidates = [data.sessionKey, data.session]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function directMessage(eventData) {
  return asRecord(asRecord(eventData)?.message);
}

function directMessageRole(eventData) {
  const role = directMessage(eventData)?.role;
  return typeof role === 'string' ? role : null;
}

function directMessageText(eventData) {
  const message = directMessage(eventData);
  if (!message) return null;
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return null;
  const textParts = message.content
    .filter((part) => (
      part
      && typeof part === 'object'
      && !Array.isArray(part)
      && (
        (part.type === 'text' && typeof part.text === 'string') ||
        (
          part.type === 'toolResult' &&
          (typeof part.content === 'string' || typeof part.text === 'string')
        )
      )
    ))
    .map((part) => (
      part.type === 'text'
        ? part.text
        : (typeof part.content === 'string' ? part.content : part.text)
    ));
  return textParts.length > 0 ? textParts.join('\n') : null;
}

function directMessageToolName(eventData) {
  const message = directMessage(eventData);
  const candidates = [message?.toolName, message?.tool_name];
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part?.type !== 'toolResult') continue;
      candidates.push(part.toolName, part.name);
    }
  }
  const unique = [...new Set(
    candidates.filter((value) => typeof value === 'string' && value.length > 0),
  )];
  return unique.length === 1 ? unique[0] : null;
}

function directMessageStopReason(eventData) {
  const stopReason = directMessage(eventData)?.stopReason;
  return typeof stopReason === 'string' ? stopReason : null;
}

function directToolCallId(value) {
  const record = asRecord(value);
  if (!record) return null;
  const candidates = [
    record.id,
    record.toolCallId,
    record.tool_call_id,
    record.toolUseId,
    record.tool_use_id,
  ].filter((entry) => typeof entry === 'string' && entry.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function directMessageSeq(eventData) {
  const data = asRecord(eventData);
  const message = directMessage(eventData);
  const metadata = asRecord(message?.__openclaw);
  const candidates = [data?.messageSeq, metadata?.seq]
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value >= 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function directRunId(eventData) {
  const data = asRecord(eventData);
  const metadata = asRecord(directMessage(eventData)?.__openclaw);
  const candidates = [data?.runId, metadata?.runId]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function timeMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function directMessageTimeMs(eventData) {
  return timeMs(directMessage(eventData)?.timestamp);
}

function exactPhraseRegex(phrase) {
  return new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(phrase)}(?=$|[^A-Za-z0-9_-])`,
    'g',
  );
}

function exactPhraseCount(text, phrase) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  return [...text.matchAll(exactPhraseRegex(phrase))].length;
}

function hasExactPhrase(text, phrase) {
  return exactPhraseCount(text, phrase) > 0;
}

function acceptedHeartbeatResult(eventData) {
  const text = directMessageText(eventData);
  if (!text || text.includes(HARNESS_MARKER)) return null;
  try {
    const payload = JSON.parse(text);
    return asRecord(payload)?.status === 'accepted' ? payload : null;
  } catch {
    return null;
  }
}

function heartbeatToolCall(eventData, nonce) {
  const message = directMessage(eventData);
  if (!message ||
      message.role !== 'assistant' ||
      directMessageStopReason(eventData) !== 'toolUse' ||
      !Array.isArray(message.content)) {
    return null;
  }
  const calls = message.content.filter((part) => (
    asRecord(part)?.type === 'toolCall' &&
    [part.name, part.toolName].some((value) => value === ROOT_CONSUMPTION_TOOL)
  ));
  if (calls.length !== 1) return null;
  const call = calls[0];
  const argumentsValue = asRecord(call.arguments);
  const inputValue = asRecord(call.input);
  if (argumentsValue && inputValue &&
      JSON.stringify(argumentsValue) !== JSON.stringify(inputValue)) {
    return null;
  }
  const input = argumentsValue || inputValue;
  const toolCallId = directToolCallId(call);
  if (!input ||
      !toolCallId ||
      typeof input.outcome !== 'string' ||
      typeof input.notify !== 'boolean' ||
      typeof input.summary !== 'string' ||
      input.summary.length === 0) {
    return null;
  }
  const textFields = [
    input.summary,
    input.notificationText,
    input.reason,
    input.nextCheck,
    input.scratch,
  ].filter((value) => typeof value === 'string');
  if (textFields.some((value) => value.includes(HARNESS_MARKER))) return null;
  const childMarker = `CHILD-DONE ${nonce} CHILD-SAW-GRANDCHILD`;
  const grandchildMarker = `GRANDCHILD-DONE ${nonce}`;
  if (textFields.reduce(
    (count, value) => count + exactPhraseCount(value, childMarker),
    0,
  ) !== 1 ||
      textFields.reduce(
        (count, value) => count + exactPhraseCount(value, grandchildMarker),
        0,
      ) !== 1) {
    return null;
  }
  return { toolCallId };
}

function heartbeatToolResultId(eventData) {
  const message = directMessage(eventData);
  if (!message || !Array.isArray(message.content)) {
    return directToolCallId(message);
  }
  const resultParts = message.content.filter((part) => asRecord(part)?.type === 'toolResult');
  if (resultParts.length > 1) return null;
  const ids = [
    directToolCallId(message),
    resultParts.length === 1 ? directToolCallId(resultParts[0]) : null,
  ].filter(Boolean);
  const unique = [...new Set(ids)];
  return unique.length === 1 ? unique[0] : null;
}

function taskId(task) {
  const record = asRecord(task);
  if (!record) return null;
  const candidates = [record.id, record.taskId]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

/** Accumulate one tasks.list page and fail closed on malformed or repeated cursors/ids. */
export function rCdChainTaskListPage(state, payload) {
  const previous = state && typeof state === 'object' && !Array.isArray(state)
    ? state
    : { tasks: [], seenCursors: [''] };
  if (!Array.isArray(previous.tasks) ||
      !Array.isArray(previous.seenCursors) ||
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      !Array.isArray(payload.tasks)) {
    return { ok: false, reason: 'invalid-task-page' };
  }
  const tasks = [...previous.tasks, ...payload.tasks];
  const ids = tasks.map(taskId);
  if (ids.some((value) => !value) || new Set(ids).size !== ids.length) {
    return { ok: false, reason: 'duplicate-or-invalid-task-id' };
  }
  if (payload.nextCursor === undefined) {
    return {
      ok: true,
      complete: true,
      nextCursor: null,
      state: { tasks, seenCursors: [...previous.seenCursors] },
    };
  }
  if (typeof payload.nextCursor !== 'string' ||
      payload.nextCursor.length === 0 ||
      !/^\d+$/.test(payload.nextCursor) ||
      previous.seenCursors.includes(payload.nextCursor)) {
    return { ok: false, reason: 'invalid-or-repeated-cursor' };
  }
  return {
    ok: true,
    complete: false,
    nextCursor: payload.nextCursor,
    state: {
      tasks,
      seenCursors: [...previous.seenCursors, payload.nextCursor],
    },
  };
}

/** Return the next bounded poll delay while the descendant observation window is open. */
export function rCdChainTaskSnapshotDelay({
  now,
  dispatchAcceptedAt,
  descendantTimeoutMs,
  requestedDelayMs,
  hasLedgerReceipt,
  snapshotInFlight,
  pollPending,
}) {
  const current = Number(now);
  const dispatch = Number(dispatchAcceptedAt);
  const timeout = Number(descendantTimeoutMs);
  const requested = Number(requestedDelayMs);
  if (hasLedgerReceipt || snapshotInFlight || pollPending ||
      dispatchAcceptedAt == null ||
      !Number.isFinite(current) ||
      !Number.isFinite(dispatch) ||
      !Number.isFinite(timeout) ||
      timeout <= 0 ||
      !Number.isFinite(requested) ||
      requested < 0) {
    return null;
  }
  const remainingMs = dispatch + timeout - current;
  return remainingMs > 0 ? Math.min(requested, remainingMs) : null;
}

function taskResultText(task) {
  const record = asRecord(task);
  if (!record) return '';
  return [...new Set(
    [record.progressSummary, record.terminalSummary, record.result]
      .filter((value) => typeof value === 'string' && value.length > 0),
  )].join('\n');
}

function taskPromptHasNonce(task, nonce) {
  return typeof task?.prompt === 'string' &&
    exactPhraseCount(task.prompt, nonce) >= 1;
}

/**
 * Resolve the exact two-row task chain exposed by tasks.list.
 *
 * The root task must point to one child, that child must own exactly one
 * grandchild task, both rows must be completed and delivered, and the depth-1
 * row must record the continue_work recovery election.
 */
export function rCdChainTaskLedgerReceipt(
  tasks,
  { rootSessionKey, nonce, dispatchAcceptedAtMs } = {},
) {
  const dispatchTime = timeMs(dispatchAcceptedAtMs);
  if (!Array.isArray(tasks) || !rootSessionKey || !nonce || dispatchTime === null) return null;
  const matches = tasks.filter((task) => directChildSessionKeyForRow(task, nonce));
  if (matches.length !== 2) return null;
  if (!matches.every((task) => taskPromptHasNonce(task, nonce))) return null;

  const rootTasks = matches.filter((task) => task?.sessionKey === rootSessionKey);
  if (rootTasks.length !== 1) return null;
  const rootTask = rootTasks[0];
  const childSessionKey = directChildSessionKeyForRow(rootTask, nonce);
  if (!childSessionKey || childSessionKey === rootSessionKey) return null;

  const grandchildTasks = matches.filter((task) => task?.sessionKey === childSessionKey);
  if (grandchildTasks.length !== 1) return null;
  const grandchildTask = grandchildTasks[0];
  const grandchildSessionKey = directChildSessionKeyForRow(grandchildTask, nonce);
  if (!grandchildSessionKey ||
      grandchildSessionKey === rootSessionKey ||
      grandchildSessionKey === childSessionKey) {
    return null;
  }

  const orderedTasks = [rootTask, grandchildTask];
  const taskIds = orderedTasks.map(taskId);
  const runIds = orderedTasks.map((task) => (
    typeof task?.runId === 'string' && task.runId.length > 0 ? task.runId : null
  ));
  if (taskIds.some((value) => !value) ||
      runIds.some((value) => !value) ||
      new Set(taskIds).size !== 2 ||
      new Set(runIds).size !== 2) {
    return null;
  }
  if (!orderedTasks.every((task) => (
    task?.status === 'completed' && task?.deliveryStatus === 'delivered'
  ))) {
    return null;
  }
  const createdAt = orderedTasks.map((task) => timeMs(task?.createdAt));
  if (createdAt.some((value) => value === null) ||
      createdAt[0] < dispatchTime ||
      createdAt[1] < createdAt[0]) {
    return null;
  }

  const recoveryMarker = `CHILD-DONE ${nonce}`;
  const grandchildMarker = `GRANDCHILD-DONE ${nonce}`;
  if (rootTask?.lastToolName !== 'continue_work' ||
      exactPhraseCount(taskResultText(rootTask), recoveryMarker) !== 1 ||
      exactPhraseCount(taskResultText(grandchildTask), grandchildMarker) !== 1) {
    return null;
  }

  const endedAt = orderedTasks.map((task) => timeMs(task?.endedAt));
  if (endedAt.some((value) => value === null) ||
      endedAt.some((value, index) => value < createdAt[index])) {
    return null;
  }

  return {
    schema: R_CD_CHAIN_TASK_LEDGER_SCHEMA,
    nonce,
    rootSessionKey,
    childSessionKey,
    grandchildSessionKey,
    taskIds,
    runIds,
    taskCount: 2,
    completedTaskCount: 2,
    deliveredTaskCount: 2,
    maxDepth: 2,
    recoveryWakeScheduled: true,
    dispatchAcceptedAtMs: dispatchTime,
    completedAtMs: Math.max(...endedAt),
  };
}

/** Identify a non-dispatch lifecycle start after both descendant tasks completed. */
export function rCdChainRootLifecycleStart({
  eventName,
  eventData,
  rootSessionKey,
  taskLedgerReceipt,
  dispatchRunId,
  observedAtMs,
}) {
  if (eventName !== 'agent' ||
      gatewayLifecyclePhase(eventData) !== 'start') {
    return null;
  }
  const explicitSessionKey = directSessionKey(eventData);
  if (explicitSessionKey && explicitSessionKey !== rootSessionKey) return null;
  const ledger = asRecord(taskLedgerReceipt);
  const runId = gatewayLifecycleRunId(eventData);
  const observed = timeMs(observedAtMs);
  if (!runId ||
      runId === dispatchRunId ||
      observed === null ||
      !Number.isFinite(ledger?.completedAtMs) ||
      observed < ledger.completedAtMs) {
    return null;
  }
  return { runId, startedAtMs: observed };
}

/** Capture the root's structured heartbeat input inside a proven post-return run. */
export function rCdChainRootReturnCandidate({
  eventName,
  eventData,
  rootSessionKey,
  nonce,
  taskLedgerReceipt,
  dispatchRunId,
  lifecycleRunId,
  lifecycleStartedAtMs,
  observedAtMs,
}) {
  if (eventName !== 'session.message' || !rootSessionKey || !nonce) return null;
  if (directSessionKey(eventData) !== rootSessionKey) return null;

  const ledger = asRecord(taskLedgerReceipt);
  if (ledger?.schema !== R_CD_CHAIN_TASK_LEDGER_SCHEMA ||
      ledger.nonce !== nonce ||
      ledger.rootSessionKey !== rootSessionKey ||
      ledger.taskCount !== 2 ||
      ledger.completedTaskCount !== 2 ||
      ledger.deliveredTaskCount !== 2 ||
      ledger.maxDepth !== 2 ||
      ledger.recoveryWakeScheduled !== true) {
    return null;
  }

  const runId = directRunId(eventData);
  const messageSeq = directMessageSeq(eventData);
  const messageTimeMs = directMessageTimeMs(eventData);
  const observed = timeMs(observedAtMs);
  const lifecycleStarted = timeMs(lifecycleStartedAtMs);
  const completedAtMs = timeMs(ledger.completedAtMs);
  const ledgerDispatchAtMs = timeMs(ledger.dispatchAcceptedAtMs);
  if (!runId ||
      runId !== lifecycleRunId ||
      typeof dispatchRunId !== 'string' ||
      dispatchRunId.length === 0 ||
      runId === dispatchRunId ||
      messageSeq === null ||
      messageTimeMs === null ||
      observed === null ||
      lifecycleStarted === null ||
      completedAtMs === null ||
      ledgerDispatchAtMs === null ||
      ledgerDispatchAtMs > completedAtMs ||
      lifecycleStarted < completedAtMs ||
      messageTimeMs < completedAtMs ||
      messageTimeMs < lifecycleStarted ||
      observed < completedAtMs) {
    return null;
  }

  const toolCall = heartbeatToolCall(eventData, nonce);
  if (!toolCall) return null;

  return {
    eventName,
    authority: 'structured-root-heartbeat-input',
    rootSessionKey,
    nonce,
    runId,
    lifecycleStartedAtMs: lifecycleStarted,
    inputMessageSeq: messageSeq,
    inputMessageTimeMs: messageTimeMs,
    inputObservedAtMs: observed,
    toolCallId: toolCall.toolCallId,
    taskCompletedAtMs: completedAtMs,
    childSessionKey: ledger.childSessionKey,
    grandchildSessionKey: ledger.grandchildSessionKey,
    taskIds: [...ledger.taskIds],
    runIds: [...ledger.runIds],
    role: 'assistant',
    stopReason: 'toolUse',
    toolName: ROOT_CONSUMPTION_TOOL,
  };
}

function hasExactRootAck(eventData, nonce) {
  const text = directMessageText(eventData);
  return Boolean(text) &&
    !text.includes(HARNESS_MARKER) &&
    hasExactPhrase(text, `ROOT-CHAIN-ACK ${nonce}`);
}

export function rCdChainRootAckObserved({
  eventName,
  eventData,
  rootSessionKey,
  nonce,
  lifecycleRunId,
}) {
  return eventName === 'session.message' &&
    directSessionKey(eventData) === rootSessionKey &&
    directMessageRole(eventData) === 'assistant' &&
    directRunId(eventData) === lifecycleRunId &&
    hasExactRootAck(eventData, nonce);
}

/** Bind the structured heartbeat input to its accepted tool result in the same run. */
export function rCdChainRootReturnAcceptance(
  candidate,
  {
    eventName,
    eventData,
    observedAtMs,
  } = {},
) {
  if (!candidate ||
      candidate.authority !== 'structured-root-heartbeat-input') {
    return null;
  }
  if (eventName !== 'session.message' ||
      directSessionKey(eventData) !== candidate.rootSessionKey ||
      directMessageRole(eventData) !== 'toolResult' ||
      directMessageToolName(eventData) !== ROOT_CONSUMPTION_TOOL ||
      heartbeatToolResultId(eventData) !== candidate.toolCallId ||
      !acceptedHeartbeatResult(eventData) ||
      directRunId(eventData) !== candidate.runId) {
    return null;
  }

  const messageSeq = directMessageSeq(eventData);
  const messageTimeMs = directMessageTimeMs(eventData);
  const observed = timeMs(observedAtMs);
  if (messageSeq === null ||
      messageSeq <= candidate.inputMessageSeq ||
      messageTimeMs === null ||
      messageTimeMs < candidate.inputMessageTimeMs ||
      observed === null ||
      observed < candidate.inputObservedAtMs) {
    return null;
  }

  return {
    ...candidate,
    authority: 'structured-root-heartbeat-accepted',
    acceptedMessageSeq: messageSeq,
    acceptedMessageTimeMs: messageTimeMs,
    acceptedObservedAtMs: observed,
    acceptedStatus: 'accepted',
  };
}

/** Finalize only when the same post-return lifecycle run ends successfully. */
export function rCdChainRootReturnReceipt(
  acceptance,
  {
    childSessionKey,
    grandchildSessionKey,
    eventName,
    eventData,
    observedAtMs,
    assistantSentinelObserved = false,
  } = {},
) {
  if (!acceptance ||
      acceptance.authority !== 'structured-root-heartbeat-accepted' ||
      !childSessionKey ||
      !grandchildSessionKey ||
      childSessionKey === grandchildSessionKey ||
      childSessionKey !== acceptance.childSessionKey ||
      grandchildSessionKey !== acceptance.grandchildSessionKey) {
    return null;
  }
  const explicitSessionKey = directSessionKey(eventData);
  if (eventName !== 'agent' ||
      (explicitSessionKey && explicitSessionKey !== acceptance.rootSessionKey) ||
      gatewayLifecyclePhase(eventData) !== 'end' ||
      !gatewayLifecycleSucceeded(eventData) ||
      gatewayLifecycleRunId(eventData) !== acceptance.runId) {
    return null;
  }
  const observed = timeMs(observedAtMs);
  if (observed === null || observed < acceptance.acceptedObservedAtMs) return null;

  return {
    authority: 'structured-post-return-consumption',
    rootSessionKey: acceptance.rootSessionKey,
    nonce: acceptance.nonce,
    childSessionKey,
    grandchildSessionKey,
    taskIds: [...acceptance.taskIds],
    runIds: [...acceptance.runIds],
    consumptionRunId: acceptance.runId,
    taskCompletedAtMs: acceptance.taskCompletedAtMs,
    consumptionRunStartedAtMs: acceptance.lifecycleStartedAtMs,
    consumptionInputAtMs: acceptance.inputMessageTimeMs,
    consumptionAcceptedAtMs: acceptance.acceptedMessageTimeMs,
    consumptionTerminalAtMs: observed,
    inputMessageSeq: acceptance.inputMessageSeq,
    acceptedMessageSeq: acceptance.acceptedMessageSeq,
    assistantSentinelObserved: assistantSentinelObserved === true,
  };
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
