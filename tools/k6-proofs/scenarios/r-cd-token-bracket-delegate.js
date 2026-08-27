/** Scenario: R-CD-TOKEN — terminal bracket token from an isolated child. */
import ws from 'k6/ws';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  classifyTokenEvidence,
  createTokenLedger,
  observeTokenTaskLedger,
  parseTokenReturnEvent,
  parseTokenReturnTranscriptMessage,
  rejectTokenTaskLedgerObservation,
  summarizeTokenLedger,
  tokenDisposableOriginReady,
  tokenLedgerHasTerminalTasks,
  tokenLedgerRuntimeIdentity,
  tokenOriginCursorFromMessages,
} from '../lib/r-cd-token-contract.js';

export const options = {
  scenarios: {
    r_cd_token_bracket_delegate: {
      executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '210s',
    },
  },
  thresholds: { proof_failures: ['count==0'], r_cd_token_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_token_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main', seat: 'cael-dgx', delaySeconds: 10,
  idempotencyKeyPrefix: 'R-CD-TOKEN', taskNamePrefix: 'r-cd-token',
};
const HARNESS_MARKER = '[k6-proof-harness]';
const TASK_POLL_MS = Number(__ENV.OPENCLAW_TOKEN_TASK_POLL_MS || 750);
const ORIGIN_CURSOR_POLL_MS = Number(__ENV.OPENCLAW_TOKEN_CURSOR_POLL_MS || 500);
const SETTLE_MS = Number(__ENV.OPENCLAW_TOKEN_SETTLE_MS || 5000);
const TASK_PAGE_LIMIT = 500;
const REQUIRED_STABLE_TASK_SNAPSHOTS = 3;
function boolEnv(name) { return (__ENV[name] || '').toLowerCase() === 'true'; }
function hash(value) { return crypto.sha256(String(value), 'hex').slice(0, 16); }
function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELEGATE_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    taskNamePrefix: inv.taskNamePrefix || DEFAULTS.taskNamePrefix,
    promptTemplate: inv.promptTemplate || '{{marker}} reply exactly RCDT-RETURN-{{tag}}',
    lightContext: inv.lightContext !== false,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLW_GATEWAY_TOKEN || __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') ||
    boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const surfaceClass = __ENV.OPENCLAW_SEAT_CLASS || 'unknown';
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = __ENV.OPENCLAW_ROW_NONCE || nonce('R-CD-TOKEN');
  const attemptId = __ENV.OPENCLAW_PROOF_ATTEMPT_ID || rowNonce;
  const tag = hash(rowNonce);
  const inv = invocationCfg();
  const taskName = `${inv.taskNamePrefix}-${tag}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  const originTitle = `RCDT-O-${tag}`;
  // Production prepends 63 characters before signal.task and then exposes only
  // the first 80 title characters. Keep this marker to 14 characters so it is
  // preserved with three characters of margin at chain-hop/depth 1.
  const delegateMarker = `D-${tag.slice(0, 12)}`;
  const returnSentinel = `RCDT-RETURN-${tag}`;
  const delegateTask = inv.promptTemplate
    .replace(/\{\{marker\}\}/g, delegateMarker)
    .replace(/\{\{tag\}\}/g, tag);
  const bracket = `[[CONTINUE_DELEGATE: ${delegateTask} +${inv.delaySeconds}s]]`;
  const childTask = `Reply exactly RCDT-HOP1-${tag}, then put this exact terminal bracket on its own final line: ${bracket} Do not call continue_delegate. Put no text after the closing brackets. Do not mutate files.`;
  const ledger = createTokenLedger({ surfaceClass });
  if (!token) { console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }
  const evidence = {
    row: 'R-CD-TOKEN', manifest_loaded: !!manifest, seat,
    requested_session_hash: hash(requestedSessionKey), session_hash: hash(sessionKey),
    disposable_creation_requested: createDisposableSession,
    disposable_origin_ready: false,
    session_created: false,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeBuildSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(), prompt_injected: false, send_accepted: false,
    send_run_id_hash: null, row_nonce_hash: hash(rowNonce), attempt_id_hash: hash(attemptId),
    reason_hash: hash(delegateTask), reason_length: delegateTask.length, delegate_mode: 'normal',
    origin_subscription_accepted: false, delegate_return_observed: false,
    origin_cursor_snapshot_accepted: false, origin_cursor_snapshots_rejected: 0,
    origin_return_cursor: null, origin_return_cursor_time_ms: null,
    origin_return_event_count: 0, origin_return_run_id_hash: null,
    origin_return_message_seq: null, origin_return_message_time_ms: null,
    origin_return_observed_at_ms: null, root_substituted_return_count: 0,
    return_target_session_hash: null, return_source_session_hash: null,
    interrupted: true, terminal_reason: 'observation-window-open',
    dispatch_accepted_at_ms: null, trace_id: null, event_receipt_kinds: [],
    task_snapshot_consistent: false, task_snapshot_stable_count: 0,
    task_snapshot_digest: null,
  };
  const started = Date.now();
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let taskPollPending = false;
    let taskSnapshot = [];
    let taskSnapshotPages = 0;
    let taskCursorSeen = {};
    let previousTaskSnapshotDigest = null;
    let closed = false;
    let settleStartedAt = null;
    let originSubscriptionRequestId = null;
    let originSubscriptionTarget = null;
    let originSubscriptionAcceptedAtMs = null;
    let originCursorPollPending = false;
    let originCursorPollScheduled = false;
    const pendingReturnEvents = [];
    const observedReturnMessageSeqs = {};

    function returnBindingReady() {
      const identity = tokenLedgerRuntimeIdentity(ledger);
      return Boolean(
        identity.originChildSessionKey &&
        identity.delegateChildSessionKey &&
        identity.delegateRunId &&
        evidence.origin_cursor_snapshot_accepted &&
        Number.isSafeInteger(evidence.origin_return_cursor) &&
        originSubscriptionAcceptedAtMs,
      );
    }

    function rememberReturnReceipt(receipt, kind) {
      if (!receipt || observedReturnMessageSeqs[receipt.messageSeq]) return false;
      observedReturnMessageSeqs[receipt.messageSeq] = true;
      evidence.origin_return_event_count += 1;
      evidence.delegate_return_observed = evidence.origin_return_event_count === 1;
      if (evidence.origin_return_event_count === 1) {
        evidence.return_target_session_hash = receipt.targetSessionHash;
        evidence.return_source_session_hash = receipt.sourceSessionHash;
        evidence.origin_return_run_id_hash = receipt.returnRunIdHash;
        evidence.origin_return_message_seq = receipt.messageSeq;
        evidence.origin_return_message_time_ms = receipt.messageTimeMs;
        evidence.origin_return_observed_at_ms = receipt.observedAtMs;
      }
      evidence.event_receipt_kinds.push(kind);
      return true;
    }

    function tryReturnEvent({ eventData, observedAtMs }) {
      const identity = tokenLedgerRuntimeIdentity(ledger);
      if (!returnBindingReady()) return false;
      return rememberReturnReceipt(parseTokenReturnEvent(eventData, {
        expectedTargetSessionKey: identity.originChildSessionKey,
        expectedDelegateChildSessionKey: identity.delegateChildSessionKey,
        expectedDelegateRunId: identity.delegateRunId,
        expectedSentinel: returnSentinel,
        originCursor: evidence.origin_return_cursor,
        subscriptionAcceptedAtMs: originSubscriptionAcceptedAtMs,
        observedAtMs,
        hash,
      }), 'bound-session-message-return');
    }

    function reconcilePendingReturns() {
      if (!returnBindingReady()) return;
      const observations = pendingReturnEvents.splice(0);
      for (const observation of observations) tryReturnEvent(observation);
    }

    function requestOriginCursorSnapshot() {
      if (closed ||
          !evidence.origin_subscription_accepted ||
          (evidence.origin_cursor_snapshot_accepted &&
            evidence.origin_return_event_count > 0) ||
          originCursorPollPending) return;
      const identity = tokenLedgerRuntimeIdentity(ledger);
      if (!identity.originChildSessionKey || !identity.originRunId) {
        scheduleOriginCursorPoll();
        return;
      }
      originCursorPollPending = true;
      tracker.send(socket, 'sessions.get', {
        key: identity.originChildSessionKey,
        limit: 50,
      });
    }

    function scheduleOriginCursorPoll(delay = ORIGIN_CURSOR_POLL_MS) {
      if (closed ||
          !evidence.origin_subscription_accepted ||
          (evidence.origin_cursor_snapshot_accepted &&
            evidence.origin_return_event_count > 0) ||
          originCursorPollPending ||
          originCursorPollScheduled) return;
      originCursorPollScheduled = true;
      socket.setTimeout(() => {
        originCursorPollScheduled = false;
        requestOriginCursorSnapshot();
      }, delay);
    }

    function consumeOriginCursorSnapshot(classified) {
      originCursorPollPending = false;
      if (!classified.ok || !Array.isArray(classified.payload?.messages)) {
        evidence.origin_cursor_snapshots_rejected += 1;
        scheduleOriginCursorPoll();
        return;
      }
      const identity = tokenLedgerRuntimeIdentity(ledger);
      if (!evidence.origin_cursor_snapshot_accepted) {
        const cursor = tokenOriginCursorFromMessages(classified.payload.messages, {
          expectedOriginRunId: identity.originRunId,
        });
        if (!cursor) {
          scheduleOriginCursorPoll();
          return;
        }
        evidence.origin_cursor_snapshot_accepted = true;
        evidence.origin_return_cursor = cursor.messageSeq;
        evidence.origin_return_cursor_time_ms = cursor.messageTimeMs;
      }
      const observedAtMs = Date.now();
      for (const message of classified.payload.messages) {
        rememberReturnReceipt(parseTokenReturnTranscriptMessage(message, {
          expectedTargetSessionKey: identity.originChildSessionKey,
          expectedDelegateChildSessionKey: identity.delegateChildSessionKey,
          expectedDelegateRunId: identity.delegateRunId,
          expectedSentinel: returnSentinel,
          originCursor: evidence.origin_return_cursor,
          observedAtMs,
          hash,
        }), 'bound-session-transcript-return');
      }
      reconcilePendingReturns();
      closeComplete();
      scheduleOriginCursorPoll();
    }

    function maybeSubscribeOrigin() {
      if (originSubscriptionRequestId || evidence.origin_subscription_accepted) return;
      const identity = tokenLedgerRuntimeIdentity(ledger);
      if (!identity.originChildSessionKey) return;
      originSubscriptionTarget = identity.originChildSessionKey;
      originSubscriptionRequestId = tracker.send(socket, 'sessions.messages.subscribe', {
        key: originSubscriptionTarget,
      });
    }

    function proofComplete() {
      const summary = summarizeTokenLedger(ledger);
      return tokenLedgerHasTerminalTasks(ledger) &&
        summary.origin_task_unique_count === 1 &&
        summary.delegate_task_unique_count === 1 &&
        summary.delegate_requester_matches_origin_child === true &&
        summary.delegate_parent_mismatch !== true &&
        evidence.task_snapshot_consistent === true &&
        evidence.task_snapshot_stable_count >= REQUIRED_STABLE_TASK_SNAPSHOTS &&
        evidence.origin_subscription_accepted &&
        evidence.origin_cursor_snapshot_accepted &&
        evidence.origin_return_event_count === 1 &&
        evidence.root_substituted_return_count === 0 &&
        evidence.delegate_return_observed;
    }

    function closeComplete() {
      if (closed) return;
      const summary = summarizeTokenLedger(ledger);
      if (summary.origin_task_unique_count > 1 || summary.delegate_task_unique_count > 1 ||
          summary.delegate_parent_mismatch) {
        evidence.interrupted = false;
        evidence.terminal_reason = 'duplicate-or-mislinked-task-identity-observed';
        closed = true;
        socket.close();
        return;
      }
      if (evidence.origin_return_event_count > 1) {
        evidence.delegate_return_observed = false;
        evidence.interrupted = false;
        evidence.terminal_reason = 'duplicate-normal-origin-return-observed';
        closed = true;
        socket.close();
        return;
      }
      if (!proofComplete()) { settleStartedAt = null; return; }
      if (settleStartedAt === null) settleStartedAt = Date.now();
      if (Date.now() - settleStartedAt < SETTLE_MS) return;
      evidence.interrupted = false;
      evidence.terminal_reason = 'exactly-once-token-chain-settled';
      closed = true;
      console.log('All required R-CD-TOKEN identities remained unique through the settle window');
      socket.close();
    }

    function requestTaskPage(cursor) {
      const params = { limit: TASK_PAGE_LIMIT };
      if (cursor) params.cursor = cursor;
      tracker.send(socket, 'tasks.list', params);
    }

    function scheduleTaskPoll(delay = TASK_POLL_MS) {
      if (closed || taskPollPending || !evidence.send_accepted) return;
      socket.setTimeout(() => {
        if (closed || taskPollPending) return;
        taskPollPending = true;
        taskSnapshot = [];
        taskSnapshotPages = 0;
        taskCursorSeen = {};
        requestTaskPage(null);
      }, delay);
    }

    function consumeTaskPage(classified) {
      if (!classified.ok || !Array.isArray(classified.payload?.tasks)) {
        taskPollPending = false;
        rejectTokenTaskLedgerObservation(ledger);
        scheduleTaskPoll();
        return;
      }
      taskSnapshot.push(...classified.payload.tasks);
      taskSnapshotPages += 1;
      const nextCursor = String(classified.payload.nextCursor || '').trim();
      if (nextCursor) {
        if (taskCursorSeen[nextCursor]) {
          taskPollPending = false;
          rejectTokenTaskLedgerObservation(ledger);
          scheduleTaskPoll();
          return;
        }
        taskCursorSeen[nextCursor] = true;
        requestTaskPage(nextCursor);
        return;
      }
      taskPollPending = false;
      const uniqueTaskIds = {};
      let duplicateTaskId = false;
      for (const task of taskSnapshot) {
        const id = String(task?.taskId || task?.id || '').trim();
        if (!id) continue;
        if (uniqueTaskIds[id]) duplicateTaskId = true;
        uniqueTaskIds[id] = true;
      }
      if (duplicateTaskId) {
        evidence.task_snapshot_consistent = false;
        evidence.task_snapshot_stable_count = 0;
        previousTaskSnapshotDigest = null;
        rejectTokenTaskLedgerObservation(ledger);
        scheduleTaskPoll();
        return;
      }
      const taskSnapshotDigest = hash(JSON.stringify(taskSnapshot
        .map((task) => ({
          taskId: String(task?.taskId || task?.id || ''),
          status: String(task?.status || ''),
          updatedAt: task?.updatedAt ?? null,
          title: String(task?.title || ''),
          sessionKey: String(task?.sessionKey || ''),
          childSessionKey: String(task?.childSessionKey || ''),
          parentTaskId: String(task?.parentTaskId || ''),
        }))
        .sort((left, right) => left.taskId < right.taskId ? -1 : left.taskId > right.taskId ? 1 : 0)));
      evidence.task_snapshot_stable_count = taskSnapshotDigest === previousTaskSnapshotDigest
        ? evidence.task_snapshot_stable_count + 1
        : 1;
      previousTaskSnapshotDigest = taskSnapshotDigest;
      evidence.task_snapshot_digest = taskSnapshotDigest;
      evidence.task_snapshot_consistent =
        evidence.task_snapshot_stable_count >= REQUIRED_STABLE_TASK_SNAPSHOTS;
      observeTokenTaskLedger(ledger, {
        tasks: taskSnapshot, originTitle,
        parentSessionKey: sessionKey, pages: taskSnapshotPages, hash,
      });
      maybeSubscribeOrigin();
      requestOriginCursorSnapshot();
      reconcilePendingReturns();
      closeComplete();
      scheduleTaskPoll();
    }

    function startProofFlow() {
      if (!tokenDisposableOriginReady({
        creationRequested: createDisposableSession,
        sessionCreated: evidence.session_created,
        requestedSessionKey,
        activeSessionKey: sessionKey,
      })) {
        evidence.interrupted = false;
        evidence.terminal_reason = 'pre-dispatch-disposable-origin-required';
        failures.add(1);
        closed = true;
        socket.close();
        return;
      }
      evidence.disposable_origin_ready = true;
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => {
        const instruction = `${HARNESS_MARKER} Call sessions_spawn exactly once with runtime="subagent", mode="run", taskName="${taskName}", label="${originTitle}", lightContext=${inv.lightContext ? 'true' : 'false'}, context="isolated", cleanup="delete", and task=${JSON.stringify(childTask)}. After sessions_spawn is accepted, reply exactly RCDT-PARENT-SPAWNED-${tag}. This is a proof run.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: instruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${tag}`,
        });
      }, 500);
      socket.setTimeout(() => {
        if (!closed) {
          evidence.interrupted = true;
          evidence.terminal_reason = 'observation-window-expired';
          closed = true;
          socket.close();
        }
      }, 180000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      if (!createDisposableSession) {
        evidence.interrupted = false;
        evidence.terminal_reason = 'pre-dispatch-disposable-creation-not-enabled';
        failures.add(1);
        closed = true;
        socket.close();
        return;
      }
      socket.setTimeout(() => {
        tracker.send(socket, 'sessions.create', {
          key: `r-cd-token-${tag}`,
          label: `k6 R-CD-TOKEN ${tag}`,
        });
      }, 250);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const originSubscribeResponse = Boolean(
          originSubscriptionRequestId && msg.type === 'res' && msg.id === originSubscriptionRequestId,
        );
        const classified = tracker.classify(msg);
        evidence.event_receipt_kinds.push(
          `${classified.kind}:${classified.method || classified.event || 'other'}`,
        );
        if (originSubscribeResponse) {
          if (classified.ok && classified.payload?.subscribed === true &&
              classified.payload?.key === originSubscriptionTarget) {
            evidence.origin_subscription_accepted = true;
            originSubscriptionAcceptedAtMs = Date.now();
            requestOriginCursorSnapshot();
          } else {
            evidence.terminal_reason = 'origin-session-subscription-rejected';
            failures.add(1);
          }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          const createdSessionKey = String(classified.payload?.key || '').trim();
          if (classified.ok && createdSessionKey && createdSessionKey !== requestedSessionKey) {
            sessionKey = createdSessionKey;
            evidence.session_hash = hash(sessionKey);
            evidence.session_created = true;
            startProofFlow();
          } else {
            failures.add(1); evidence.terminal_reason = 'disposable-session-rejected';
            closed = true; socket.close();
          }
        }
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok && classified.payload?.runId) {
            evidence.prompt_injected = true;
            evidence.send_accepted = true;
            evidence.send_run_id_hash = hash(classified.payload.runId);
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            scheduleTaskPoll(250);
          } else {
            failures.add(1); evidence.terminal_reason = 'sessions-send-rejected';
          }
        }
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          consumeTaskPage(classified);
        }
        if (classified.kind === 'response' && classified.method === 'sessions.get') {
          consumeOriginCursorSnapshot(classified);
        }
        if (classified.kind === 'event' && classified.event === 'session.message') {
          const eventData = classified.data || {};
          if (pendingReturnEvents.length < 50) {
            pendingReturnEvents.push({ eventData, observedAtMs: Date.now() });
          } else {
            evidence.interrupted = false;
            evidence.terminal_reason = 'return-event-buffer-overflow';
            failures.add(1);
            closed = true;
            socket.close();
          }
          reconcilePendingReturns();
          closeComplete();
        }
      } catch (error) {
        console.warn(`parse error: ${error}`);
      }
    });
    socket.on('error', (error) => {
      console.error(`ws error: ${error && error.error ? error.error() : error}`);
      evidence.interrupted = true; evidence.terminal_reason = 'websocket-error'; failures.add(1);
    });
  });

  Object.assign(evidence, summarizeTokenLedger(ledger));
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);
  const verdict = classifyTokenEvidence(evidence);
  check(res, { 'websocket connected': (value) => value && value.status === 101 });
  check(null, {
    'raw final text surface declared': () => evidence.surface_class === 'raw-final-text',
    'disposable session created and distinct': () => evidence.session_created &&
      evidence.disposable_origin_ready,
    'send accepted with run identity': () => evidence.send_accepted && !!evidence.send_run_id_hash,
    'task ledger fully paginated': () => evidence.task_pagination_exhausted,
    'task ledger snapshot stable across full traversals': () => evidence.task_snapshot_consistent &&
      evidence.task_snapshot_stable_count >= REQUIRED_STABLE_TASK_SNAPSHOTS,
    'origin task exactly once': () => evidence.origin_task_unique_count === 1,
    'token delegate task exactly once': () => evidence.delegate_task_unique_count === 1,
    'delegate owned by origin child': () => evidence.delegate_requester_matches_origin_child,
    'origin child subscription accepted': () => evidence.origin_subscription_accepted,
    'origin initial-run cursor captured': () => evidence.origin_cursor_snapshot_accepted &&
      evidence.origin_cursor_snapshots_rejected === 0,
    'bound delegate return observed': () => evidence.delegate_return_observed,
    'normal origin return exactly once': () => evidence.origin_return_event_count === 1 &&
      evidence.root_substituted_return_count === 0,
    'run not interrupted': () => evidence.interrupted === false,
  });
  if (verdict !== 'PASS-candidate') failures.add(1);
  console.log('\n--- R-CD-TOKEN EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CD-TOKEN] VERDICT: ${verdict}`);
}

export function handleSummary(data) {
  const summary = {
    row: 'R-CD-TOKEN',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp: new Date().toISOString(),
    // Never authoritative. The row-scoped signed resolver may promote this.
    verdict: 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_token_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };
  return {
    stdout: `\n[R-CD-TOKEN] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-token-bracket-delegate-summary.json': JSON.stringify(summary, null, 2),
  };
}
