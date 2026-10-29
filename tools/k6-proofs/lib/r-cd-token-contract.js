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
//   taskId / parentTaskId -> NO current gateway surface. The replacement bind
//   is a unique origin label under the disposable parent, a unique marked
//   delegate under that origin, and a return from that delegate to the origin.
//   The row-scoped resolver separately joins the reason hash/length to Tempo.
// The legacy summary field names are kept so the row-scoped resolver contract
// (lib/r-cd-token-authoritative-receipt.mjs) reads the mapped values unchanged.
// ---------------------------------------------------------------------------

function timeMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    // Row endedAt is the run's lifecycle end (session-run-lifecycle-projection.ts:215).
    endedAtMs: timeMs(record?.endedAt),
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
    delegateEndedAtMs: delegate?.endedAtMs ?? null,
  };
}

export function summarizeTokenSessionLedger(ledger) {
  const origin = oneTask(ledger?.originSessions);
  const delegate = oneTask(ledger?.delegateSessions);
  return {
    surface_class: ledger?.surfaceClass || 'unknown',
    observation_surface: 'sessions.list spawnedBy + chat.history own spawn task',
    // TaskFlow IDs remain unavailable; report the actual observer surface.
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
  if (evidence?.observation_surface !== 'sessions.list spawnedBy + chat.history own spawn task' &&
      (!evidence?.origin_task_id_hash || !evidence?.delegate_task_id_hash)) reasons.push('task identity hashes missing');
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

// ---------------------------------------------------------------------------
// Delegate return (karmaterminal/openclaw-bootstrap#1727).
//
// Two product routes carry a token delegate's return to the origin child:
//
// - direct-announce: deliverSubagentAnnouncement delivers to the requester
//   with an "[Inter-session message] sourceSession=<delegate child> ...
//   sourceTool=subagent_announce" header, which binds the source on the row.
//   Older products published that row; at 8ba08c76d8 display projection hides
//   it (chat-display-projection.history.ts:413-415).
// - targeted-return: since openclaw 2273ef64d5 (2026-09-12) every pending
//   delegate carries a recipient-authority binding for its requester, so
//   routeSubagentContinuationReturn handles every delegate return: a durable
//   systemEvent row plus a queued system event on the origin child, then a
//   `delegate-return` wake (logged `[continuation:targeted-return] Delivered
//   to <origin> from <delegate>`). The wake hands the return text to an
//   ordinary session-event turn as its user message (provenance
//   internal_system / continuation / the delegate run). Display projection
//   empties that runtime-context row and hides it from session.message and
//   chat.history (history.ts:416-421), and the woken run's lifecycle names no
//   delegate. The direct-announce path is not reached for a continuation
//   delegate.
//
// The targeted return binds the same four things the header did, from the
// surfaces that are visible:
//   (a) target: the woken run's own assistant answer, top-level sessionKey ===
//       the origin child, in a run that started on the origin (lifecycle
//       start) at or after the delegate run ended (the delegate row's endedAt)
//       and is not the origin's own bracket run. The origin already knows the
//       sentinel from its own task, so a later origin turn alone proves
//       nothing; the order is what a targeted return implies;
//   (b) source: the delegate child's own transcript (cleanup "keep") answers
//       the sentinel in the delegate's own run;
//   (c) the exact RCDT-RETURN-<tag> sentinel, word-bounded, once, on both legs;
//   (d) this row run: <tag> is derived from the runner-owned nonce, and both
//       legs are bound to run identities (delegate run, woken origin run).
// A sentinel from another session, another run, a run that never started on
// the origin, a run that started before the delegate ended, an unstamped row,
// or a return with no delegate leg never binds (not an exhaustive list).
// For this route (b) is the delegate's own answer plus that order, not a
// provenance stamp on one visible row: the product's own stamp (the hidden
// user row's provenance runId) is not shown to subscribers.
// ---------------------------------------------------------------------------

const HARNESS_MARKER = '[k6-proof-harness]';
const BRACKET_OPEN = '[[CONTINUE_DELEGATE:';
export const TOKEN_RETURN_ROUTES = Object.freeze(['direct-announce', 'targeted-return']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-bounded occurrences of the exact sentinel. */
function exactSentinelCount(text, sentinel) {
  if (typeof text !== 'string' || !text || typeof sentinel !== 'string' || !sentinel) return 0;
  const matches = text.match(new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escapeRegex(sentinel)}(?=$|[^A-Za-z0-9_-])`,
    'g',
  ));
  return matches ? matches.length : 0;
}

/** The top-level event session; a disagreement between its two names binds nothing. */
function eventSessionKey(eventData) {
  if (!isRecord(eventData)) return null;
  const keys = [eventData.sessionKey, eventData.session]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(keys)];
  return unique.length === 1 ? unique[0] : null;
}

/** Run identity of a transcript row: envelope runId and __openclaw.runId must agree. */
function rowRunId(eventData) {
  const message = isRecord(eventData?.message) ? eventData.message : null;
  const meta = isRecord(message?.__openclaw) ? message.__openclaw : null;
  const ids = [eventData?.runId, meta?.runId]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(ids)];
  return unique.length === 1 ? unique[0] : null;
}

/** An assistant row carrying the exact sentinel once, not a prompt or bracket echo. */
function assistantSentinelText(message, sentinel) {
  if (!isRecord(message) || String(message.role || '').toLowerCase() !== 'assistant') return false;
  const text = contentText(message);
  return Boolean(text) &&
    exactSentinelCount(text, sentinel) === 1 &&
    !text.includes(HARNESS_MARKER) &&
    !text.includes(BRACKET_OPEN);
}

/**
 * A woken run on the origin child: a lifecycle start, on the origin's own key,
 * of a run other than the origin's bracket run, that started at or after the
 * delegate run ended. Returns { runId, startedAtMs } or null.
 */
export function parseTokenOriginWakeStart(eventData, { expectedTargetSessionKey, originSpawnRunId, delegateEndedAtMs }) {
  if (!isRecord(eventData) || !expectedTargetSessionKey || !originSpawnRunId) return null;
  if (eventSessionKey(eventData) !== String(expectedTargetSessionKey)) return null;
  if (String(eventData.stream || '').toLowerCase() !== 'lifecycle') return null;
  if (String(eventData.data?.phase || '').toLowerCase() !== 'start') return null;
  const runId = typeof eventData.runId === 'string' && eventData.runId ? eventData.runId : null;
  if (!runId || runId === String(originSpawnRunId)) return null;
  const startedAtMs = timeMs(eventData.data?.startedAt) ?? timeMs(eventData.ts);
  const delegateEnded = timeMs(delegateEndedAtMs);
  if (startedAtMs === null || delegateEnded === null || startedAtMs < delegateEnded) return null;
  return { runId, startedAtMs };
}

/**
 * The source leg: the delegate child's own transcript answers the exact
 * sentinel, in an assistant row stamped with the delegate's own run. Exactly
 * one such row binds; the spawn task (a user row) never counts.
 */
export function parseTokenSourceReturn(
  messages,
  { expectedDelegateChildSessionKey, expectedDelegateRunId, expectedSentinel, hash },
) {
  if (!Array.isArray(messages) || typeof hash !== 'function') return null;
  const source = String(expectedDelegateChildSessionKey || '');
  const run = String(expectedDelegateRunId || '');
  if (!source || !run || !expectedSentinel) return null;
  const matches = messages.filter((message) =>
    assistantSentinelText(message, expectedSentinel) && rowRunId({ message }) === run);
  if (matches.length !== 1) return null;
  return {
    sourceSessionKey: source,
    sourceSessionHash: hash(source),
    sourceRunIdHash: hash(run),
  };
}

function directAnnounceReturn(eventData, { expectedSentinel, expectedDelegateChildSessionKey, hash }) {
  const message = eventData.message;
  if (!message || !['user', 'system'].includes(String(message.role || '').toLowerCase())) return null;
  const text = contentText(message);
  if (!text || !text.includes(expectedSentinel) || text.includes(HARNESS_MARKER)) return null;
  const header = text.match(/^\[Inter-session message\]([^\n]*)/);
  if (!header || !/\bsourceTool=subagent_announce\b/.test(header[1])) return null;
  const source = header[1].match(/\bsourceSession=([^\s]+)/)?.[1] || '';
  if (!source || source !== String(expectedDelegateChildSessionKey || '')) return null;
  return {
    route: 'direct-announce',
    targetSessionHash: hash(String(eventData.sessionKey)),
    sourceSessionHash: hash(source),
  };
}

/**
 * The target leg plus the source leg. Live (requireWakeStart): the answer's
 * run must be a woken run (wakeRuns: runId -> startedAtMs, from
 * parseTokenOriginWakeStart) that started at or after the delegate ended.
 * Transcript: the row must come after the origin's own bracket-run rows
 * (anchored by the caller), be stamped with a run other than that bracket
 * run, and carry a timestamp at or after the delegate ended.
 */
function targetedReturn(eventData, {
  expectedSentinel,
  expectedDelegateChildSessionKey,
  originSpawnRunId,
  wakeRuns,
  delegateEndedAtMs,
  sourceReturn,
  hash,
}, { requireWakeStart }) {
  if (!assistantSentinelText(eventData.message, expectedSentinel)) return null;
  const runId = rowRunId(eventData);
  if (!runId || !originSpawnRunId || runId === String(originSpawnRunId)) return null;
  const delegateEnded = timeMs(delegateEndedAtMs);
  if (delegateEnded === null) return null;
  const answeredAtMs = requireWakeStart
    ? (wakeRuns instanceof Map ? timeMs(wakeRuns.get(runId)) : null)
    : timeMs(eventData.message?.timestamp);
  if (answeredAtMs === null || answeredAtMs < delegateEnded) return null;
  const source = String(expectedDelegateChildSessionKey || '');
  if (!source || !isRecord(sourceReturn) || sourceReturn.sourceSessionKey !== source ||
      sourceReturn.sourceSessionHash !== hash(source) ||
      typeof sourceReturn.sourceRunIdHash !== 'string') return null;
  return {
    route: 'targeted-return',
    targetSessionHash: hash(String(eventData.sessionKey)),
    sourceSessionHash: sourceReturn.sourceSessionHash,
    returnRunIdHash: hash(runId),
    sourceRunIdHash: sourceReturn.sourceRunIdHash,
    returnAfterDelegateEndMs: answeredAtMs - delegateEnded,
  };
}

/**
 * Parse only the structured session.message return surface, never arbitrary
 * JSON. Accepts the direct-announce row (header-bound source) or the
 * targeted-return woken answer (wake-start-bound target plus the delegate's
 * own source leg).
 */
export function parseTokenReturnEvent(eventData, options) {
  const { expectedTargetSessionKey, hash } = options || {};
  if (!eventData || typeof hash !== 'function') return null;
  if (String(eventData.sessionKey || '') !== String(expectedTargetSessionKey || '')) return null;
  if (eventSessionKey(eventData) !== String(expectedTargetSessionKey || '')) return null;
  return directAnnounceReturn(eventData, options) ||
    targetedReturn(eventData, options, { requireWakeStart: true });
}

/**
 * Recover a return from the origin child's own transcript (chat.history).
 * Exactly one bound return across both routes. A targeted answer counts only
 * after the last row of the origin's own bracket run. Under cleanup "delete"
 * this transcript is gone once the origin's announce completes; the live
 * route is then the only one.
 */
export function parseTokenReturnHistory(messages, options) {
  if (!Array.isArray(messages) || !options || typeof options.hash !== 'function') return null;
  const target = options.expectedTargetSessionKey;
  let anchor = -1;
  messages.forEach((message, index) => {
    if (options.originSpawnRunId && rowRunId({ message }) === String(options.originSpawnRunId)) anchor = index;
  });
  const matches = messages
    .map((message, index) => {
      const eventData = { sessionKey: target, message };
      return directAnnounceReturn(eventData, options) ||
        (index > anchor && anchor >= 0
          ? targetedReturn(eventData, options, { requireWakeStart: false })
          : null);
    })
    .filter(Boolean);
  return matches.length === 1 ? matches[0] : null;
}

function hex16(value) {
  return typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
}

/** Route-specific return binding; legacy evidence without a route is the header route. */
function returnRouteBound(evidence) {
  const route = evidence?.return_route;
  if (route === undefined || route === null || route === 'direct-announce') return true;
  if (route !== 'targeted-return') return false;
  return evidence.source_return_observed === true &&
    hex16(evidence.source_return_run_id_hash) &&
    evidence.source_return_run_id_hash === evidence.delegate_run_id_hash &&
    hex16(evidence.return_run_id_hash) &&
    hex16(evidence.origin_spawn_run_id_hash) &&
    evidence.return_run_id_hash !== evidence.origin_spawn_run_id_hash &&
    evidence.return_run_id_hash !== evidence.delegate_run_id_hash &&
    Number.isFinite(evidence.return_after_delegate_end_ms) &&
    evidence.return_after_delegate_end_ms >= 0;
}

export function classifyTokenEvidence(evidence) {
  if (evidence?.surface_class !== RAW_FINAL_TEXT) return 'PARTIAL-candidate';
  const sessionObservation = evidence.observation_surface ===
    'sessions.list spawnedBy + chat.history own spawn task';
  const exactOnce = evidence.origin_task_unique_count === 1 && evidence.delegate_task_unique_count === 1;
  const identities = [
    evidence.origin_run_id_hash,
    evidence.origin_requester_session_hash,
    evidence.origin_child_session_hash,
    evidence.delegate_run_id_hash,
    evidence.delegate_requester_session_hash,
    evidence.delegate_child_session_hash,
    evidence.send_run_id_hash,
    evidence.row_nonce_hash,
    evidence.attempt_id_hash,
    evidence.return_target_session_hash,
    evidence.return_source_session_hash,
  ].every((value) => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value));
  const lineageIdentity = sessionObservation ||
    [evidence.origin_task_id_hash, evidence.delegate_task_id_hash]
      .every((value) => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value));
  const observationClean = sessionObservation
    ? Number(evidence.observer_traversals_refused) === 0 &&
      Number(evidence.observer_rounds_accepted) > 0
    : evidence.tasks_list_rejected === 0;
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
    observationClean && exactOnce && identities && lineageIdentity &&
    evidence.origin_run_id_hash !== evidence.delegate_run_id_hash &&
    evidence.delegate_requester_matches_origin_child === true &&
    evidence.delegate_parent_mismatch !== true &&
    evidence.return_target_session_hash === evidence.origin_child_session_hash &&
    evidence.return_source_session_hash === evidence.delegate_child_session_hash &&
    returnRouteBound(evidence) &&
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
