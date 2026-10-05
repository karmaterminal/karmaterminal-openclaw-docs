/** Fail-closed evidence accounting for R-CD-TOKEN. k6/Node compatible. */

const RAW_FINAL_TEXT = 'raw-final-text';
const MESSAGE_BODY = 'message-body';
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'timed_out']);

function normalizedSurface(value) {
  const surface = String(value || '').trim().toLowerCase();
  if (surface === RAW_FINAL_TEXT || surface === `${RAW_FINAL_TEXT}-seat`) return RAW_FINAL_TEXT;
  if (surface === MESSAGE_BODY || surface === `${MESSAGE_BODY}-seat`) return MESSAGE_BODY;
  return 'unknown';
}

function taskId(task) {
  return String(task?.taskId || task?.id || '').trim();
}

function status(task) {
  return String(task?.status || '').trim().toLowerCase();
}

function oneTask(seen) {
  const tasks = Object.values(seen || {});
  return tasks.length === 1 ? tasks[0] : null;
}

/**
 * The token row may dispatch only from a newly-created disposable origin.
 * Requiring the active key to differ from the configured/requested key keeps a
 * malformed sessions.create response from silently falling back to a live
 * operator session.
 */
export function tokenDisposableOriginReady({
  creationRequested,
  sessionCreated,
  requestedSessionKey,
  activeSessionKey,
}) {
  const requested = String(requestedSessionKey || '').trim();
  const active = String(activeSessionKey || '').trim();
  return creationRequested === true && sessionCreated === true &&
    requested.length > 0 && active.length > 0 && active !== requested;
}

function rememberTask({ task, seen, hash }) {
  const id = taskId(task);
  if (!id) return;
  const snapshot = {
    taskId: id,
    taskIdHash: hash(id),
    runId: task?.runId ? String(task.runId) : null,
    runIdHash: task?.runId ? hash(String(task.runId)) : null,
    requesterSessionKey: task?.sessionKey ? String(task.sessionKey) : null,
    requesterSessionHash: task?.sessionKey ? hash(String(task.sessionKey)) : null,
    childSessionKey: task?.childSessionKey ? String(task.childSessionKey) : null,
    childSessionHash: task?.childSessionKey ? hash(String(task.childSessionKey)) : null,
    parentTaskId: task?.parentTaskId ? String(task.parentTaskId) : null,
    parentTaskIdHash: task?.parentTaskId ? hash(String(task.parentTaskId)) : null,
    status: status(task),
  };
  if (!seen[id]) seen[id] = snapshot;
  else Object.assign(seen[id], snapshot);
}

export function createTokenLedger({ surfaceClass }) {
  return {
    surfaceClass: normalizedSurface(surfaceClass),
    originTasks: {},
    delegateTasks: {},
    tasksListAccepted: 0,
    tasksListRejected: 0,
    taskPagesAccepted: 0,
    paginationExhausted: false,
    delegateParentMismatch: false,
  };
}

/**
 * LEGACY (#562): the task-ledger RPC (tasks.list) was removed upstream in
 * openclaw 6652f7eac8. These ledger functions and the tasks_list_* evidence
 * fields are kept only so retained corpus evidence and the row-scoped resolver
 * contract still classify; no scenario calls the RPC. Current runs use the
 * session ledger below.
 *
 * Consume one complete task-ledger snapshot (all pages). TaskSummary.title is
 * bounded to 80 characters, so the caller supplies short opaque markers that
 * survive the public gateway projection. The delegate must be owned by the
 * one origin child's session; title text alone is never enough to join it.
 */
export function observeTokenTaskLedger(
  ledger,
  { tasks, originTitle, delegateMarker, parentSessionKey, pages, hash },
) {
  if (!ledger || typeof hash !== 'function') return;
  ledger.tasksListAccepted += 1;
  ledger.taskPagesAccepted += Number(pages || 0);
  ledger.paginationExhausted = true;

  for (const task of Array.isArray(tasks) ? tasks : []) {
    const title = String(task?.title || '').trim();
    if (title === originTitle && String(task?.sessionKey || '') === String(parentSessionKey || '')) {
      rememberTask({ task, seen: ledger.originTasks, hash });
    }
  }

  const origin = oneTask(ledger.originTasks);
  if (!origin?.childSessionKey) return;
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const title = String(task?.title || '');
    if (!title.includes(delegateMarker)) continue;
    if (String(task?.sessionKey || '') !== origin.childSessionKey) continue;
    if (task?.parentTaskId && String(task.parentTaskId) !== origin.taskId) {
      ledger.delegateParentMismatch = true;
      continue;
    }
    rememberTask({ task, seen: ledger.delegateTasks, hash });
  }
}

export function rejectTokenTaskLedgerObservation(ledger) {
  if (!ledger) return;
  ledger.tasksListRejected += 1;
  ledger.paginationExhausted = false;
}

export function tokenLedgerRuntimeIdentity(ledger) {
  const origin = oneTask(ledger?.originTasks);
  const delegate = oneTask(ledger?.delegateTasks);
  return {
    originTaskId: origin?.taskId || null,
    originRunId: origin?.runId || null,
    originChildSessionKey: origin?.childSessionKey || null,
    delegateTaskId: delegate?.taskId || null,
    delegateRunId: delegate?.runId || null,
    delegateChildSessionKey: delegate?.childSessionKey || null,
  };
}

export function summarizeTokenLedger(ledger) {
  const origin = oneTask(ledger?.originTasks);
  const delegate = oneTask(ledger?.delegateTasks);
  return {
    surface_class: ledger?.surfaceClass || 'unknown',
    tasks_list_accepted: ledger?.tasksListAccepted || 0,
    tasks_list_rejected: ledger?.tasksListRejected || 0,
    task_pages_accepted: ledger?.taskPagesAccepted || 0,
    task_pagination_exhausted: ledger?.paginationExhausted === true,
    origin_task_unique_count: Object.keys(ledger?.originTasks || {}).length,
    origin_task_id_hash: origin?.taskIdHash || null,
    origin_run_id_hash: origin?.runIdHash || null,
    origin_requester_session_hash: origin?.requesterSessionHash || null,
    origin_child_session_hash: origin?.childSessionHash || null,
    origin_task_status: origin?.status || null,
    delegate_task_unique_count: Object.keys(ledger?.delegateTasks || {}).length,
    delegate_task_id_hash: delegate?.taskIdHash || null,
    delegate_run_id_hash: delegate?.runIdHash || null,
    delegate_requester_session_hash: delegate?.requesterSessionHash || null,
    delegate_child_session_hash: delegate?.childSessionHash || null,
    delegate_parent_task_id_hash: delegate?.parentTaskIdHash || null,
    delegate_task_status: delegate?.status || null,
    delegate_requester_matches_origin_child:
      Boolean(origin?.childSessionHash) && delegate?.requesterSessionHash === origin.childSessionHash,
    delegate_parent_mismatch: ledger?.delegateParentMismatch === true,
  };
}

// ---------------------------------------------------------------------------
// Session-row ledger (#562). The task ledger RPC was removed upstream
// (openclaw 6652f7eac8). Child identity now comes from the child observer
// (lib/child-observer.mjs): sessions.list { spawnedBy } rows plus each child's
// own spawn task from chat.history.
//
// Mapping, old task record -> current session evidence:
//   origin: title === originTitle && sessionKey === parent
//        -> row.label === originTitle && row.spawnedBy === parent
//           (sessions_spawn label= is stored on the child entry,
//            subagent-spawn-session-patch.ts:168; spawnedBy at :99)
//   delegate: title includes marker && sessionKey === origin child
//        -> own spawn task includes marker && row.spawnedBy === origin child
//   runId -> row.lastRunId; status 'completed' -> row.status 'done'
//   taskId / parentTaskId -> NO current gateway surface. These identities stay
//   null, so classifyTokenEvidence cannot reach PASS: the receipt is PARTIAL
//   with task_identity_unavailable_reason, never a weaker substitute.
// The legacy summary field names are kept so the row-scoped resolver contract
// (lib/r-cd-token-authoritative-receipt.mjs) reads the mapped values unchanged.
// ---------------------------------------------------------------------------

export const TOKEN_TASK_IDENTITY_UNAVAILABLE_REASON =
  'task identity (taskId, parentTaskId) has no gateway surface since TaskFlow was removed upstream (openclaw 6652f7eac8); child session identity is recorded instead';

function rememberSession({ record, seen, hash }) {
  const key = String(record?.childSessionKey || '').trim();
  if (!key) return;
  const runId = record?.lastRunId ? String(record.lastRunId) : null;
  const requester = record?.spawnedBy ? String(record.spawnedBy) : null;
  const rowStatus = String(record?.status || '').trim().toLowerCase();
  seen[key] = {
    childSessionKey: key,
    childSessionHash: hash(key),
    runId,
    runIdHash: runId ? hash(runId) : null,
    requesterSessionKey: requester,
    requesterSessionHash: requester ? hash(requester) : null,
    rowStatus,
    // Row status 'done' is the current terminal-success state
    // (packages/gateway-protocol/src/schema/sessions-row.ts:28-36).
    status: rowStatus === 'done' ? 'completed' : rowStatus,
  };
}

export function createTokenSessionLedger({ surfaceClass }) {
  return {
    surfaceClass: normalizedSurface(surfaceClass),
    originSessions: {},
    delegateSessions: {},
    roundsAccepted: 0,
    roundsRefused: 0,
  };
}

/** Consume one complete observer traversal (every sessions.list page answered). */
export function observeTokenSessionLedger(
  ledger,
  { records, originTitle, delegateMarker, parentSessionKey, hash },
) {
  if (!ledger || typeof hash !== 'function') return;
  ledger.roundsAccepted += 1;
  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    if (String(record?.spawnedBy || '') !== String(parentSessionKey || '')) continue;
    if (String(record?.label || '').trim() !== originTitle) continue;
    rememberSession({ record, seen: ledger.originSessions, hash });
  }
  const origin = oneTask(ledger.originSessions);
  if (!origin) return;
  for (const record of list) {
    if (String(record?.spawnedBy || '') !== origin.childSessionKey) continue;
    if (typeof record?.task !== 'string' || !record.task.includes(delegateMarker)) continue;
    rememberSession({ record, seen: ledger.delegateSessions, hash });
  }
}

export function rejectTokenSessionLedgerObservation(ledger) {
  if (!ledger) return;
  ledger.roundsRefused += 1;
}

export function tokenSessionLedgerRuntimeIdentity(ledger) {
  const origin = oneTask(ledger?.originSessions);
  const delegate = oneTask(ledger?.delegateSessions);
  return {
    originRunId: origin?.runId || null,
    originChildSessionKey: origin?.childSessionKey || null,
    delegateRunId: delegate?.runId || null,
    delegateChildSessionKey: delegate?.childSessionKey || null,
  };
}

export function summarizeTokenSessionLedger(ledger) {
  const origin = oneTask(ledger?.originSessions);
  const delegate = oneTask(ledger?.delegateSessions);
  return {
    surface_class: ledger?.surfaceClass || 'unknown',
    observation_surface: 'sessions.list spawnedBy + chat.history own spawn task',
    task_identity_unavailable_reason: TOKEN_TASK_IDENTITY_UNAVAILABLE_REASON,
    // No legacy task-ledger counters: classifyTokenEvidence requires the legacy
    // rejection counter to be exactly 0, so its absence also keeps PASS closed.
    observer_traversals_refused: ledger?.roundsRefused || 0,
    observer_rounds_accepted: ledger?.roundsAccepted || 0,
    task_pages_accepted: 0,
    task_pagination_exhausted: (ledger?.roundsAccepted || 0) > 0 && (ledger?.roundsRefused || 0) === 0,
    origin_task_unique_count: Object.keys(ledger?.originSessions || {}).length,
    origin_task_id_hash: null,
    origin_run_id_hash: origin?.runIdHash || null,
    origin_requester_session_hash: origin?.requesterSessionHash || null,
    origin_child_session_hash: origin?.childSessionHash || null,
    origin_task_status: origin?.status || null,
    delegate_task_unique_count: Object.keys(ledger?.delegateSessions || {}).length,
    delegate_task_id_hash: null,
    delegate_run_id_hash: delegate?.runIdHash || null,
    delegate_requester_session_hash: delegate?.requesterSessionHash || null,
    delegate_child_session_hash: delegate?.childSessionHash || null,
    delegate_parent_task_id_hash: null,
    delegate_task_status: delegate?.status || null,
    delegate_requester_matches_origin_child:
      Boolean(origin?.childSessionHash) && delegate?.requesterSessionHash === origin.childSessionHash,
    // Lineage is the requester link itself; there is no second parent field to disagree.
    delegate_parent_mismatch: false,
  };
}

export function tokenSessionLedgerHasTerminalSessions(ledger) {
  const origin = oneTask(ledger?.originSessions);
  const delegate = oneTask(ledger?.delegateSessions);
  return Boolean(
    origin && delegate && TERMINAL_STATUSES.has(origin.status) && TERMINAL_STATUSES.has(delegate.status),
  );
}

/** Names of the R-CD-TOKEN receipts still missing, for an explicit PARTIAL reason. */
export function tokenPartialReasons(evidence) {
  const reasons = [];
  if (!evidence?.origin_task_id_hash || !evidence?.delegate_task_id_hash) {
    reasons.push(evidence?.task_identity_unavailable_reason || 'task identity hashes missing');
  }
  if (evidence?.surface_class !== RAW_FINAL_TEXT) reasons.push('seat surface is not raw-final-text');
  if (evidence?.origin_task_unique_count !== 1) reasons.push('origin child not observed exactly once');
  if (evidence?.delegate_task_unique_count !== 1) reasons.push('token delegate child not observed exactly once');
  if (evidence?.origin_task_status !== 'completed') reasons.push('origin child row not done');
  if (evidence?.delegate_task_status !== 'completed') reasons.push('delegate child row not done');
  if (evidence?.delegate_return_observed !== true) reasons.push('bound delegate return not observed');
  if (evidence?.task_snapshot_consistent !== true) reasons.push('observer snapshot not stable across 3 traversals');
  if (Number(evidence?.observer_traversals_refused || 0) !== 0) reasons.push('observer traversal refused or invalid');
  return reasons;
}

function contentText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

/** Parse only the structured session.message return surface, never arbitrary JSON. */
export function parseTokenReturnEvent(
  eventData,
  { expectedTargetSessionKey, expectedSentinel, expectedDelegateChildSessionKey, hash },
) {
  if (!eventData || typeof hash !== 'function') return null;
  if (String(eventData.sessionKey || '') !== String(expectedTargetSessionKey || '')) return null;
  const message = eventData.message;
  if (!message || !['user', 'system'].includes(String(message.role || '').toLowerCase())) return null;
  const text = contentText(message);
  if (!text || !text.includes(expectedSentinel) || text.includes('[k6-proof-harness]')) return null;
  const header = text.match(/^\[Inter-session message\]([^\n]*)/);
  if (!header || !/\bsourceTool=subagent_announce\b/.test(header[1])) return null;
  const source = header[1].match(/\bsourceSession=([^\s]+)/)?.[1] || '';
  if (!source || source !== String(expectedDelegateChildSessionKey || '')) return null;
  return {
    targetSessionHash: hash(String(eventData.sessionKey)),
    sourceSessionHash: hash(source),
  };
}

export function classifyTokenEvidence(evidence) {
  if (evidence?.surface_class !== RAW_FINAL_TEXT) return 'PARTIAL-candidate';
  const exactOnce = evidence.origin_task_unique_count === 1 && evidence.delegate_task_unique_count === 1;
  const identities = [
    evidence.origin_task_id_hash,
    evidence.origin_run_id_hash,
    evidence.origin_requester_session_hash,
    evidence.origin_child_session_hash,
    evidence.delegate_task_id_hash,
    evidence.delegate_run_id_hash,
    evidence.delegate_requester_session_hash,
    evidence.delegate_child_session_hash,
    evidence.send_run_id_hash,
    evidence.row_nonce_hash,
    evidence.attempt_id_hash,
    evidence.return_target_session_hash,
    evidence.return_source_session_hash,
  ].every((value) => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value));
  const taskStates = evidence.origin_task_status === 'completed' && evidence.delegate_task_status === 'completed';
  const complete = evidence.session_created === true &&
    evidence.disposable_origin_ready === true &&
    evidence.prompt_injected === true &&
    evidence.send_accepted === true &&
    evidence.origin_subscription_accepted === true &&
    evidence.delegate_return_observed === true &&
    evidence.task_pagination_exhausted === true &&
    evidence.task_snapshot_consistent === true &&
    Number(evidence.task_snapshot_stable_count || 0) >= 3 &&
    evidence.tasks_list_rejected === 0 &&
    exactOnce && identities &&
    evidence.origin_run_id_hash !== evidence.delegate_run_id_hash &&
    evidence.delegate_requester_matches_origin_child === true &&
    evidence.delegate_parent_mismatch !== true &&
    evidence.return_target_session_hash === evidence.origin_child_session_hash &&
    evidence.return_source_session_hash === evidence.delegate_child_session_hash &&
    taskStates && evidence.interrupted !== true;
  return complete ? 'PASS-candidate' : 'PARTIAL-candidate';
}

export function tokenLedgerHasTerminalTasks(ledger) {
  const origin = oneTask(ledger?.originTasks);
  const delegate = oneTask(ledger?.delegateTasks);
  return Boolean(
    origin && delegate && TERMINAL_STATUSES.has(origin.status) && TERMINAL_STATUSES.has(delegate.status),
  );
}
