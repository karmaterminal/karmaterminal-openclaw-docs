// Child-session observer for k6 proof rows (karmaterminal-openclaw-docs#562).
//
// Upstream openclaw 6652f7eac8 ("remove Tasks and TaskFlow runtime", #159179)
// deleted the gateway task-ledger RPC the rows used to poll. On current builds
// an unknown method is authorized before handler lookup and defaults to
// operator.admin, so a read+write proof connection gets
//   { code: "FORBIDDEN", message: "missing scope: operator.admin" }
// (src/gateway/server-methods.ts:603-609, src/gateway/method-scopes.ts:277 at
// cut 41b8d69b90). A row that treated that refusal as an empty ledger reported
// "child not observed" whatever the product did.
//
// This module replaces the ledger with surfaces the cut advertises:
//   - sessions.list { spawnedBy } (operator.read; core-descriptors.ts:252).
//     Rows carry spawnedBy = the requester key, plus status / endedAt /
//     lastRunId / label (src/gateway/session-utils-row.ts:436,465,538-546).
//   - chat.history { sessionKey } (operator.read; core-descriptors.ts:365).
//     A spawned child's first user message holds "[Subagent Task]" followed by
//     the task text the row wrote (src/agents/subagents/spawn/
//     subagent-system-prompt.ts:23-36). The row nonce / task token therefore
//     lives in the child's own transcript, which is the binding record.
//
// Binding rule (no looser than row-child-correlation.mjs): a child counts for
// the row only when (a) its own session row names the expected requester in
// spawnedBy and (b) its own first user message carries the row nonce or task
// token. A bare key, a nonce elsewhere in an event, or a label alone is never
// enough. Ambiguity (more than one match) binds nothing.
//
// Fail closed: a FORBIDDEN or unknown-method answer to any observer call is
// recorded as observation_refused and must turn the row PARTIAL. It never reads
// as "child not observed".
//
// k6 and Node compatible: no k6 or Node imports.

import { childSessionKeyForTokenOnly, childSessionKeysForRow } from './row-child-correlation.mjs';

export const OBSERVER_METHODS = Object.freeze(['sessions.list', 'chat.history']);

/** Row status values that end a child run (packages/gateway-protocol/src/schema/sessions-row.ts:28-36). */
export const TERMINAL_CHILD_STATUSES = Object.freeze(['done', 'failed', 'killed', 'timeout', 'interrupted']);

const SUBAGENT_TASK_MARKER = '[Subagent Task]';
const BASE = ['sessions.create', 'sessions.messages.subscribe', 'sessions.send'];

/**
 * Every gateway method each row calls, in one place. The preflight checks this
 * list against hello-ok features.methods before anything is dispatched, and a
 * test keeps manifests/<row>.json scenario.methods equal to it.
 */
export const ROW_METHODS = Object.freeze({
  'R-CD-1': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-CD-2': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-CD-3': Object.freeze([...BASE]),
  'R-CD-4': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-CD-CHAINED-DEPTH-2': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-CD-MODEL-DEFAULT': Object.freeze([...BASE, ...OBSERVER_METHODS, 'sessions.describe']),
  'R-CD-MODEL-TOOL': Object.freeze([...BASE, ...OBSERVER_METHODS, 'sessions.describe']),
  'R-CD-MODEL-TOKEN': Object.freeze([...BASE, ...OBSERVER_METHODS, 'sessions.describe']),
  'R-CD-MODEL-CHAINED-ALT': Object.freeze([...BASE, ...OBSERVER_METHODS, 'sessions.describe']),
  'R-CD-TOKEN': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-CW-DELEGATE-SELF-CONTINUATION': Object.freeze([...BASE, ...OBSERVER_METHODS]),
  'R-RC-2': Object.freeze([...BASE, ...OBSERVER_METHODS]),
});

export function rowMethods(rowId) {
  const methods = ROW_METHODS[rowId];
  return methods ? [...methods] : null;
}

// ---------------------------------------------------------------------------
// Preflight against hello-ok features.methods
// ---------------------------------------------------------------------------

/**
 * hello-ok is the payload of the res frame that answers connect
 * (src/gateway/server/ws-connection/connect-hello.ts:300; schema
 * packages/gateway-protocol/src/schema/frames.ts:94,106-107). The list is not
 * filtered by caller scope, and advertise:false methods are absent by design.
 */
export function advertisedMethodsFromHello(msg) {
  if (!msg || msg.type !== 'res' || msg.ok === false) return null;
  const payload = msg.payload;
  if (!payload || payload.type !== 'hello-ok') return null;
  const methods = payload.features?.methods;
  return Array.isArray(methods) ? methods.filter((m) => typeof m === 'string') : null;
}

export function preflightMethods(required, advertised) {
  const needed = Array.isArray(required) ? required : [];
  if (needed.length === 0) {
    return { ok: false, missing: [], reason: 'row has no declared method list' };
  }
  if (!Array.isArray(advertised)) {
    return { ok: false, missing: [...needed], reason: 'gateway hello-ok carried no features.methods list' };
  }
  const have = new Set(advertised);
  const missing = needed.filter((method) => !have.has(method));
  return missing.length === 0
    ? { ok: true, missing: [], reason: null }
    : { ok: false, missing, reason: `gateway does not advertise: ${missing.join(', ')}` };
}

/**
 * Gate a row's dispatch on the connect answer. Call observe(msg) on every
 * inbound frame until it returns 'ready' or 'refused'; send nothing before.
 */
export function createPreflightGate(rowId) {
  const required = rowMethods(rowId);
  const gate = {
    rowId,
    required: required || [],
    done: false,
    result: null,
    observe(msg) {
      if (gate.done || !msg || msg.type !== 'res') return null;
      gate.done = true;
      if (msg.ok === false) {
        const error = msg.error || {};
        gate.result = {
          ok: false,
          missing: [...gate.required],
          reason: `connect refused: ${error.code || 'unknown'} ${error.message || ''}`.trim(),
          advertised_count: 0,
        };
        return 'refused';
      }
      const advertised = advertisedMethodsFromHello(msg);
      const verdict = preflightMethods(required, advertised);
      gate.result = { ...verdict, advertised_count: Array.isArray(advertised) ? advertised.length : 0 };
      return verdict.ok ? 'ready' : 'refused';
    },
    timeout(ms) {
      if (gate.done) return false;
      gate.done = true;
      gate.result = {
        ok: false,
        missing: [...gate.required],
        reason: `no connect answer within ${ms}ms`,
        advertised_count: 0,
      };
      return true;
    },
  };
  return gate;
}

/**
 * Final fail-closed gate for a row verdict. A refused preflight (nothing was
 * dispatched), a refused observer method, or an incomplete observation (any
 * observer error that is not a refusal: timeout, UNAVAILABLE, a failed or
 * truncated page, an invalid traversal) means the row cannot claim either
 * outcome, so the verdict is PARTIAL with the reason named.
 *
 * keepProvenFail: the caller asserts its FAIL rests on authoritative evidence
 * gathered independently of the failed observation (e.g. a served-model
 * mismatch on an already-bound child). That FAIL is kept, with the observer
 * problem recorded as observerReason. A preflight refusal always wins.
 */
export function failClosedVerdict(verdict, { gate = null, observer = null, keepProvenFail = false } = {}) {
  if (gate && gate.result && gate.result.ok !== true) {
    return { verdict: 'PARTIAL-candidate', reason: `preflight refused before dispatch: ${gate.result.reason}` };
  }
  if (gate && !gate.result) {
    return { verdict: 'PARTIAL-candidate', reason: 'preflight never completed; nothing was dispatched' };
  }
  const observerReason = observer ? observer.failClosedReason() : null;
  if (observerReason && keepProvenFail && verdict === 'FAIL-candidate') {
    return { verdict, reason: null, observerReason };
  }
  if (observerReason) return { verdict: 'PARTIAL-candidate', reason: observerReason };
  return { verdict, reason: null };
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/**
 * A refused or unknown method: FORBIDDEN (scope / default-deny) or
 * INVALID_REQUEST "unknown method: X" (admin callers). Returns
 * { method, code, message } or null.
 */
export function observationRefusal(method, classified) {
  if (!classified || classified.ok !== false) return null;
  const error = classified.error || {};
  const code = String(error.code || '');
  const message = String(error.message || '');
  const refused = code === 'FORBIDDEN' ||
    /missing scope/i.test(message) ||
    /unknown method/i.test(message);
  return refused ? { method, code: code || null, message } : null;
}

// ---------------------------------------------------------------------------
// Transcript helpers
// ---------------------------------------------------------------------------

export function messageText(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

/**
 * The spawn task from the child's own transcript. `messages` must be the
 * transcript from its true start (the observer pages chat.history back to the
 * oldest page before calling this). Only the FIRST user message counts, and it
 * must carry "[Subagent Task]"; the text after the marker is returned. A later
 * user or wake message carrying the nonce is never taken as the spawn task.
 */
export function subagentTaskText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const first = list.find((m) => m && String(m.role || '').toLowerCase() === 'user');
  if (!first) return null;
  const text = messageText(first);
  const at = text ? text.indexOf(SUBAGENT_TASK_MARKER) : -1;
  if (at < 0) return null;
  return text.slice(at + SUBAGENT_TASK_MARKER.length).trim();
}

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

function str(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveKey(value) {
  return typeof value === 'function' ? str(value()) : str(value);
}

/**
 * Observe the children (and, with maxDepth > 1, descendants) of one root
 * session. attach(send) once with a function (method, params) => requestId;
 * call claim(msg) BEFORE tracker.classify(msg), then handle(claim, classified).
 */
export function createChildObserver({
  rootSessionKey,
  maxDepth = 1,
  listLimit = 100,
  historyLimit = 50,
  // chat.history offset 0 is the NEWEST page; nextOffset walks to older pages
  // and hasMore === false marks the oldest one (openclaw 41b8d69b90
  // chat-history-response-page.ts:91-112; chat-history-handler.cli-import
  // .test.ts:465-470). Binding reads back to the oldest page, bounded here.
  maxHistoryPages = 10,
  onRoundComplete = null,
  // Re-read a child's transcript until its spawn task is bound: chat.history
  // can answer before the spawn message is persisted. schedule(delayMs, fn)
  // is the scenario's socket.setTimeout; without it retries ride on poll().
  schedule = null,
  historyRetryMs = 2000,
  maxHistoryAttempts = 8,
} = {}) {
  const pending = {};
  const records = {};
  const requesterDepth = {};
  let send = null;
  let round = 0;
  let roundOutstanding = 0;
  let roundSeen = {};
  let roundOffsets = {};
  let roundInvalid = false;

  const state = {
    refusal: null,
    errors: [],
    counters: { list_responses: 0, rows_seen: 0, history_responses: 0, history_retries: 0, rounds_completed: 0, rounds_invalid: 0 },
  };

  function root() {
    return resolveKey(rootSessionKey);
  }

  function sendTracked(method, params, meta) {
    if (!send || state.refusal) return null;
    const id = send(method, params);
    if (id) pending[id] = { method, params, ...meta };
    return id;
  }

  function requestList(requester, depth, offset, forRound) {
    if (forRound === round) {
      const offsetKey = `${requester}|${offset || 0}`;
      if (roundOffsets[offsetKey]) {
        // A page offset repeating inside one traversal is a pagination loop.
        roundInvalid = true;
        state.errors.push({ method: 'sessions.list', code: 'PAGINATION_LOOP', message: `offset ${offset || 0} repeated` });
        return;
      }
      roundOffsets[offsetKey] = true;
    }
    const params = { spawnedBy: requester, limit: listLimit };
    if (offset) params.offset = offset;
    if (forRound === round) roundOutstanding += 1;
    sendTracked('sessions.list', params, { requester, depth, round: forRound });
  }

  function requestHistory(record) {
    if (record.task !== null || record.historyInFlight || record.historyAttempts >= maxHistoryAttempts) return;
    if (record.historyAttempts > 0) state.counters.history_retries += 1;
    record.historyRequested = true;
    record.historyInFlight = true;
    record.historyAttempts += 1;
    record.historyPages = [];
    requestHistoryPage(record, 0);
  }

  function requestHistoryPage(record, offset) {
    const id = sendTracked('chat.history', { sessionKey: record.childSessionKey, limit: historyLimit, offset }, {
      childSessionKey: record.childSessionKey,
      offset,
    });
    if (!id) record.historyInFlight = false;
  }

  function historyPagingFailure(record, code, message) {
    record.historyInFlight = false;
    record.historyPagingFailed = { code, message };
    state.errors.push({ method: 'chat.history', code, message, childSessionKey: record.childSessionKey, paging: true });
  }

  function retryHistory(record) {
    if (record.task !== null || record.historyAttempts >= maxHistoryAttempts) return;
    if (typeof schedule === 'function') schedule(historyRetryMs, () => requestHistory(record));
  }

  function finishListForRound(meta) {
    if (meta.round !== round) return;
    roundOutstanding = Math.max(0, roundOutstanding - 1);
    if (roundOutstanding === 0) {
      state.counters.rounds_completed += 1;
      if (roundInvalid) state.counters.rounds_invalid += 1;
      if (typeof onRoundComplete === 'function') {
        onRoundComplete(observer.snapshotDigestInput(), { valid: !roundInvalid, round });
      }
    }
  }

  function upsertRow(row, meta) {
    const key = str(row?.key);
    if (!key) return;
    // The filter runs server-side (src/gateway/session-list-filters.ts:150-163);
    // recheck the row's own field so a filter change cannot widen the set.
    if (str(row.spawnedBy) !== meta.requester) return;
    const rootKey = root();
    if (key === rootKey || key === meta.requester) return;
    if (meta.round === round) {
      // The same child twice in one traversal: the snapshot is not consistent.
      if (roundSeen[key]) roundInvalid = true;
      roundSeen[key] = true;
    }
    state.counters.rows_seen += 1;
    const existing = records[key];
    const record = existing || {
      childSessionKey: key,
      spawnedBy: meta.requester,
      depth: meta.depth + 1,
      task: null,
      historyRequested: false,
      historyInFlight: false,
      historyAttempts: 0,
      historyPages: [],
      historyPagingFailed: null,
    };
    record.label = str(row.label);
    record.status = str(row.status);
    record.endedAt = row.endedAt ?? null;
    record.lastRunId = str(row.lastRunId);
    record.parentSessionKey = str(row.parentSessionKey);
    records[key] = record;
    if (record.task === null && !record.historyPagingFailed) requestHistory(record);
    if (record.depth < maxDepth && requesterDepth[key] === undefined) {
      requesterDepth[key] = record.depth;
    }
  }

  const observer = {
    state,
    attach(sendFn, scheduleFn = null) {
      send = sendFn;
      if (typeof scheduleFn === 'function') schedule = scheduleFn;
    },

    /** Start one traversal: list children of the root and of every known requester. */
    poll() {
      const rootKey = root();
      if (!rootKey || !send || state.refusal) return false;
      round += 1;
      roundOutstanding = 0;
      roundSeen = {};
      roundOffsets = {};
      roundInvalid = false;
      requesterDepth[rootKey] = 0;
      for (const [requester, depth] of Object.entries(requesterDepth)) {
        if (depth < maxDepth) requestList(requester, depth, 0, round);
      }
      return true;
    },

    /** Re-read one session's transcript (e.g. after its return was observed). */
    refreshHistory(childSessionKey, limit = historyLimit, purpose = 'refresh') {
      if (!str(childSessionKey)) return null;
      return sendTracked('chat.history', { sessionKey: childSessionKey, limit }, { childSessionKey, purpose });
    },

    claim(msg) {
      if (!msg || msg.type !== 'res' || !msg.id || !pending[msg.id]) return null;
      const meta = pending[msg.id];
      delete pending[msg.id];
      return meta;
    },

    /** Returns the transcript messages for a 'refresh' claim, else null. */
    handle(meta, classified) {
      if (!meta || !classified) return null;
      const refusal = observationRefusal(meta.method, classified);
      if (refusal) {
        if (!state.refusal) state.refusal = refusal;
        return null;
      }
      if (classified.ok === false) {
        const error = classified.error || {};
        state.errors.push({ method: meta.method, code: error.code || null, message: error.message || '' });
        if (meta.method === 'sessions.list') {
          if (meta.round === round) roundInvalid = true;
          finishListForRound(meta);
        }
        if (meta.method === 'chat.history' && !meta.purpose && records[meta.childSessionKey]) {
          state.errors[state.errors.length - 1].childSessionKey = meta.childSessionKey;
          records[meta.childSessionKey].historyInFlight = false;
          retryHistory(records[meta.childSessionKey]);
        }
        return null;
      }
      const payload = classified.payload || {};
      if (meta.method === 'sessions.list') {
        state.counters.list_responses += 1;
        const rows = Array.isArray(payload.sessions) ? payload.sessions : [];
        for (const row of rows) upsertRow(row, meta);
        const nextOffset = Number(payload.nextOffset);
        if (payload.hasMore === true && Number.isFinite(nextOffset) && nextOffset > 0) {
          requestList(meta.requester, meta.depth, nextOffset, meta.round);
        } else if (payload.hasMore === true) {
          // More rows exist but no usable cursor: a later page could hold the
          // match, so the traversal is truncated, not complete.
          if (meta.round === round) roundInvalid = true;
          state.errors.push({ method: 'sessions.list', code: 'PAGINATION_TRUNCATED', message: `hasMore without a usable nextOffset (${String(payload.nextOffset)})` });
        }
        finishListForRound(meta);
        return null;
      }
      if (meta.method === 'chat.history') {
        state.counters.history_responses += 1;
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const record = records[meta.childSessionKey];
        if (record && !meta.purpose) {
          record.historyPages.push(messages);
          if (payload.hasMore === true) {
            const nextOffset = Number(payload.nextOffset);
            if (!Number.isFinite(nextOffset) || nextOffset <= Number(meta.offset || 0)) {
              historyPagingFailure(record, 'HISTORY_PAGING_TRUNCATED', `hasMore without a usable older nextOffset (${String(payload.nextOffset)})`);
            } else if (record.historyPages.length >= maxHistoryPages) {
              historyPagingFailure(record, 'HISTORY_PAGING_CAP', `oldest page not reached within ${maxHistoryPages} pages`);
            } else {
              requestHistoryPage(record, nextOffset);
            }
            return null;
          }
          if (payload.hasMore !== false) {
            // Without pagination fields there is no proof this page starts the transcript.
            historyPagingFailure(record, 'HISTORY_PAGING_UNAVAILABLE', 'chat.history answered without hasMore; the first user message cannot be proven');
            return null;
          }
          record.historyInFlight = false;
          // Pages arrive newest first; each page is oldest-to-newest inside.
          const transcript = record.historyPages.slice().reverse().flat();
          record.historyPagesRead = record.historyPages.length;
          if (record.task === null) record.task = subagentTaskText(transcript);
          if (record.task !== null) {
            // A transcript read that failed earlier and has now succeeded is recovered.
            for (const e of state.errors) {
              if (e.method === 'chat.history' && e.childSessionKey === record.childSessionKey) e.recovered = true;
            }
          } else {
            retryHistory(record);
          }
        }
        return meta.purpose ? messages : null;
      }
      return null;
    },

    records() {
      return Object.values(records).map((r) => ({ ...r }));
    },

    record(childSessionKey) {
      const r = records[childSessionKey];
      return r ? { ...r } : null;
    },

    /** Candidate records in the shape row-child-correlation.mjs binds against. */
    bindingRecords({ spawnedBy = null, depth = null } = {}) {
      return Object.values(records)
        .filter((r) => typeof r.task === 'string' && r.task.length > 0)
        .filter((r) => spawnedBy === null || r.spawnedBy === spawnedBy)
        .filter((r) => depth === null || r.depth === depth)
        .map((r) => ({ childSessionKey: r.childSessionKey, task: r.task }));
    },

    /**
     * The one child under `spawnedBy` (default: root) whose own spawn task
     * carries the nonce or one of `tokens`. ambiguous=true when more than one.
     */
    boundChild(rowNonce, tokens = [], { spawnedBy = undefined, depth = null } = {}) {
      const requester = spawnedBy === undefined ? root() : spawnedBy;
      const keys = childSessionKeysForRow(
        { tasks: observer.bindingRecords({ spawnedBy: requester, depth }) },
        rowNonce,
        tokens,
      );
      return { childSessionKey: keys.length === 1 ? keys[0] : null, ambiguous: keys.length > 1, candidates: keys };
    },

    /** childSessionKeyForTokenOnly over this observer's own-transcript records. */
    boundChildForTokenOnly(includeToken, excludeToken, { spawnedBy = null, depth = null } = {}) {
      return childSessionKeyForTokenOnly(
        { tasks: observer.bindingRecords({ spawnedBy, depth }) },
        includeToken,
        excludeToken,
      );
    },

    /** Same as boundChildForTokenOnly, with ambiguity reported instead of hidden. */
    boundChildTokenOnly(includeToken, excludeToken, { spawnedBy = null, depth = null } = {}) {
      if (!includeToken || !excludeToken) return { childSessionKey: null, ambiguous: false, candidates: [] };
      const recs = { tasks: observer.bindingRecords({ spawnedBy, depth }) };
      const excluded = new Set(childSessionKeysForRow(recs, excludeToken));
      const keys = childSessionKeysForRow(recs, includeToken).filter((k) => !excluded.has(k));
      return { childSessionKey: keys.length === 1 ? keys[0] : null, ambiguous: keys.length > 1, candidates: keys };
    },

    childStatus(childSessionKey) {
      return records[childSessionKey]?.status || null;
    },

    childCompleted(childSessionKey) {
      return records[childSessionKey]?.status === 'done';
    },

    childTerminal(childSessionKey) {
      return TERMINAL_CHILD_STATUSES.includes(records[childSessionKey]?.status || '');
    },

    /** Stable, sorted view of every observed record for snapshot digests. */
    snapshotDigestInput() {
      return Object.values(records)
        .map((r) => ({
          key: r.childSessionKey,
          spawnedBy: r.spawnedBy,
          depth: r.depth,
          status: r.status || '',
          endedAt: r.endedAt ?? null,
          lastRunId: r.lastRunId || '',
          label: r.label || '',
          bound: typeof r.task === 'string',
        }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    },

    /** The first unrecovered non-refusal observer error, or null. */
    incomplete() {
      const error = state.errors.find((e) => e.recovered !== true);
      if (error) return { method: error.method, code: error.code, message: error.message };
      const exhausted = Object.values(records).find((r) => r.task === null && r.historyAttempts >= maxHistoryAttempts && !r.historyInFlight);
      if (exhausted) {
        // A child of this lineage whose spawn task could never be read might be
        // the match or a duplicate: binding cannot be claimed either way.
        return { method: 'chat.history', code: 'HISTORY_UNBOUND', message: `spawn task unread after ${exhausted.historyAttempts} attempts` };
      }
      if (state.counters.rounds_invalid > 0) {
        return { method: 'sessions.list', code: 'INVALID_TRAVERSAL', message: `${state.counters.rounds_invalid} traversal(s) incomplete or inconsistent` };
      }
      return null;
    },

    /** Reason the row cannot claim anything from the observer, or null. */
    failClosedReason() {
      if (state.refusal) {
        return `observation refused: ${state.refusal.method} ${state.refusal.code || ''} ${state.refusal.message}`.replace(/\s+/g, ' ').trim();
      }
      const incomplete = observer.incomplete();
      if (incomplete) {
        return `observation incomplete: ${incomplete.method} ${incomplete.code || ''} ${incomplete.message}`.replace(/\s+/g, ' ').trim();
      }
      return null;
    },

    summary() {
      return {
        observation_refused: state.refusal,
        observation_incomplete: observer.incomplete(),
        observation_errors: state.errors.slice(0, 10),
        observer_list_responses: state.counters.list_responses,
        observer_rows_seen: state.counters.rows_seen,
        observer_history_responses: state.counters.history_responses,
        observer_history_retries: state.counters.history_retries,
        observer_history_unbound: Object.values(records)
          .filter((r) => r.task === null)
          .map((r) => ({ attempts: r.historyAttempts, exhausted: r.historyAttempts >= maxHistoryAttempts, paging: r.historyPagingFailed })),
        observer_rounds_completed: state.counters.rounds_completed,
        observer_rounds_invalid: state.counters.rounds_invalid,
        observer_children_recorded: Object.keys(records).length,
      };
    },
  };
  return observer;
}

/**
 * One child identity from two sources (#563 review item 2). The observer
 * binding (own row spawnedBy = requester + own spawn task carries the row
 * token, unique) is the only source that can bind. Event-path candidates
 * (nonce-bound records seen on subscribed events) are cross-checks: alone
 * they bind nothing, and any disagreement with the observer, or more than one
 * of them, is a conflict that must fail the row closed.
 *
 * observerBinding: { childSessionKey, ambiguous } from boundChild(), or a bare
 * key / null (boundChildForTokenOnly).
 */
export function reconcileChildIdentity({ observerBinding = null, eventCandidates = [] } = {}) {
  const binding = typeof observerBinding === 'string' || observerBinding === null
    ? { childSessionKey: observerBinding, ambiguous: false }
    : observerBinding;
  const events = [...new Set((Array.isArray(eventCandidates) ? eventCandidates : [])
    .filter((v) => typeof v === 'string' && v.length > 0))];
  if (binding.ambiguous) {
    return { childSessionKey: null, conflict: true, reason: 'more than one child is bound to the row (observer)' };
  }
  if (events.length > 1) {
    return { childSessionKey: null, conflict: true, reason: `event path names ${events.length} different children` };
  }
  const key = typeof binding.childSessionKey === 'string' && binding.childSessionKey ? binding.childSessionKey : null;
  if (!key) {
    return {
      childSessionKey: null,
      conflict: false,
      reason: events.length ? 'event-path candidate awaits observer lineage binding' : null,
    };
  }
  if (events.length === 1 && events[0] !== key) {
    return { childSessionKey: null, conflict: true, reason: 'event path and observer name different children' };
  }
  return { childSessionKey: key, conflict: false, reason: null };
}
