/**
 * Scenario: R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain.
 *
 * Fires parent→child→grandchild chain and verifies the full return path.
 * The child is instructed to fire its OWN continue_delegate, creating a
 * depth-2 chain. The proof verifies:
 *   1. Parent dispatches (depth-0 → depth-1) via sessions.send (agent turn)
 *   2. Child spawns and fires its own delegate (depth-1 → depth-2)
 *   3. Grandchild spawns and completes
 *   4. Return propagates up-tree to parent
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session, so the proof does not touch the live #sprites/main
 * Discord lane.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#119
 *   - Manifest: tools/k6-proofs/manifests/r-cd-chained-depth-2.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { gatewayLifecyclePhase, gatewayLifecycleRunId } from '../lib/gateway-lifecycle.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  rCdChainRootAckObserved,
  rCdChainRootLifecycleStart,
  rCdChainRootReturnAcceptance,
  rCdChainRootReturnCandidate,
  rCdChainObservationState,
  rCdChainRootReturnReceipt,
  rCdChainTaskListPage,
  rCdChainTaskLedgerReceipt,
  rCdChainTaskSnapshotDelay,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

export const options = {
  scenarios: {
    r_cd_chained_depth_2: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '360s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_chain_duration: ['p(95)<330000'],
  },
};

const failures = new Counter('proof_failures');
const chainDuration = new Trend('r_cd_chain_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  idempotencyKeyPrefix: 'R-CD-CHAIN',
};
const POST_DISPATCH_EVIDENCE_GATE_MS = Number(__ENV.OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS || 1500);
const DESCENDANT_OBSERVATION_MS = Number(__ENV.OPENCLAW_CHAIN_DESCENDANT_OBSERVATION_MS || 180000);
const ROOT_RETURN_OBSERVATION_MS = Number(__ENV.OPENCLAW_CHAIN_ROOT_RETURN_OBSERVATION_MS || 120000);
const TASK_SNAPSHOT_POLL_MS = Number(__ENV.OPENCLAW_CHAIN_TASK_SNAPSHOT_POLL_MS || 5000);

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || '',
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const chainNonce = nonce('R-CD-CHAIN');

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }

  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
    }
  }

  const evidence = {
    row: 'R-CD-CHAINED-DEPTH-2',
    manifest_loaded: !!manifest,
    nonce: chainNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    runtimeBuildSha: __ENV.OPENCLAW_RUNTIME_BUILD_SHA || 'unset',
    started: new Date().toISOString(),
    // Chain progression
    parent_dispatch_accepted: false,
    child_spawned: false,
    grandchild_spawned: false,
    child_done_sentinel: false,
    child_waiting_sentinel: false,
    depth1_recovery_wake_scheduled: false,
    grandchild_done_sentinel: false,
    chain_return_received: false,
    task_ledger_receipt: null,
    root_return_candidate: null,
    root_return_acceptance: null,
    root_return_receipt: null,
    root_ack_sentinel_observed: false,
    dispatch_run_captured: false,
    accepted_dispatch_run_id: null,
    task_pagination_exhausted: false,
    tasks_list_rejected: 0,
    task_snapshot_stable_count: 0,
    task_snapshot_digest: null,
    dispatch_accepted_at_ms: null,
    grandchild_observed_at_ms: null,
    observation_phase: 'not-dispatched',
    observation_deadline_at_ms: null,
    terminal_reason: 'observation-window-open',
    // Depth tracking
    max_depth_observed: 0,
    child_session: null,
    grandchild_session: null,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let rootReturnTimerStarted = false;
    let descendantTimerStarted = false;
    let taskSnapshotPollPending = false;
    let taskSnapshot = null;
    const rootObservationEvents = [];

    function updateObservationState() {
      if (!evidence.dispatch_accepted_at_ms) return null;
      const state = rCdChainObservationState({
        now: Date.now(),
        dispatchAcceptedAt: evidence.dispatch_accepted_at_ms,
        grandchildObservedAt: evidence.grandchild_observed_at_ms,
        rootReturnReceipt: evidence.root_return_receipt,
        descendantTimeoutMs: DESCENDANT_OBSERVATION_MS,
        rootReturnTimeoutMs: ROOT_RETURN_OBSERVATION_MS,
      });
      evidence.observation_phase = state.phase;
      evidence.observation_deadline_at_ms = state.deadlineAtMs;
      return state;
    }

    function startRootReturnObservationWindow(socket) {
      if (rootReturnTimerStarted || evidence.grandchild_observed_at_ms === null) return;
      rootReturnTimerStarted = true;
      const initialState = updateObservationState();
      const remainingMs = initialState?.deadlineAtMs === null
        ? ROOT_RETURN_OBSERVATION_MS
        : Math.max(0, initialState.deadlineAtMs - Date.now());
      socket.setTimeout(() => {
        const state = updateObservationState();
        if (state?.phase === 'root-return-timeout') {
          evidence.terminal_reason = 'root-return-observation-window-expired';
          socket.close();
        }
      }, remainingMs);
    }

    function startDescendantObservationWindow(socket) {
      if (descendantTimerStarted || !evidence.dispatch_accepted_at_ms) return;
      descendantTimerStarted = true;
      const schedule = () => {
        const state = updateObservationState();
        if (state?.phase === 'descendant-timeout') {
          evidence.terminal_reason = 'descendant-observation-window-expired';
          socket.close();
          return;
        }
        if (state?.phase !== 'awaiting-descendants' || state.deadlineAtMs === null) return;
        socket.setTimeout(schedule, Math.max(0, state.deadlineAtMs - Date.now()));
      };
      schedule();
    }

    function taskId(task) {
      const ids = [task?.id, task?.taskId]
        .filter((value) => typeof value === 'string' && value.length > 0);
      const unique = [...new Set(ids)];
      return unique.length === 1 ? unique[0] : null;
    }

    function taskCreatedAtMs(task) {
      const numeric = Number(task?.createdAt);
      if (Number.isFinite(numeric)) return numeric;
      const parsed = Date.parse(task?.createdAt);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function scheduleTaskSnapshot(socket, delayMs = TASK_SNAPSHOT_POLL_MS) {
      const nextDelayMs = rCdChainTaskSnapshotDelay({
        now: Date.now(),
        dispatchAcceptedAt: evidence.dispatch_accepted_at_ms,
        descendantTimeoutMs: DESCENDANT_OBSERVATION_MS,
        requestedDelayMs: delayMs,
        hasLedgerReceipt: evidence.task_ledger_receipt !== null,
        snapshotInFlight: taskSnapshot !== null,
        pollPending: taskSnapshotPollPending,
      });
      if (nextDelayMs === null) return;
      taskSnapshotPollPending = true;
      socket.setTimeout(() => {
        taskSnapshotPollPending = false;
        requestTaskSnapshot(socket);
      }, nextDelayMs);
    }

    function rejectTaskSnapshot(socket, reason) {
      evidence.tasks_list_rejected += 1;
      evidence.task_pagination_exhausted = false;
      taskSnapshot = null;
      console.warn(`✗ task snapshot rejected: ${reason}`);
      scheduleTaskSnapshot(socket);
    }

    function requestNextTaskDetail(socket) {
      if (!taskSnapshot) return;
      const nextTaskId = taskSnapshot.detailQueue.shift();
      if (!nextTaskId) {
        const details = taskSnapshot.details
          .slice()
          .sort((left, right) => taskId(left).localeCompare(taskId(right)));
        const digest = crypto.sha256(JSON.stringify(details), 'hex').slice(0, 16);
        evidence.task_snapshot_stable_count =
          evidence.task_snapshot_digest === digest
            ? evidence.task_snapshot_stable_count + 1
            : 1;
        evidence.task_snapshot_digest = digest;
        evidence.task_pagination_exhausted = true;
        const taskLedgerReceipt = rCdChainTaskLedgerReceipt(details, {
          rootSessionKey: sessionKey,
          nonce: chainNonce,
          dispatchAcceptedAtMs: evidence.dispatch_accepted_at_ms,
        });
        taskSnapshot = null;
        if (!taskLedgerReceipt || evidence.task_snapshot_stable_count < 2) {
          scheduleTaskSnapshot(socket);
          return;
        }
        if (Date.now() >= evidence.dispatch_accepted_at_ms + DESCENDANT_OBSERVATION_MS) {
          evidence.terminal_reason = 'descendant-observation-window-expired';
          socket.close();
          return;
        }
        evidence.task_ledger_receipt = taskLedgerReceipt;
        evidence.child_session = taskLedgerReceipt.childSessionKey;
        evidence.grandchild_session = taskLedgerReceipt.grandchildSessionKey;
        evidence.child_spawned = true;
        evidence.grandchild_spawned = true;
        evidence.child_waiting_sentinel = true;
        evidence.depth1_recovery_wake_scheduled = true;
        evidence.grandchild_done_sentinel = true;
        evidence.max_depth_observed = taskLedgerReceipt.maxDepth;
        evidence.grandchild_observed_at_ms = taskLedgerReceipt.completedAtMs;
        startRootReturnObservationWindow(socket);
        reconcileRootConsumption();
        console.log('✓ stable, fully paginated exactly-once depth-2 task ledger observed');
        return;
      }
      taskSnapshot.currentDetailId = nextTaskId;
      tracker.send(socket, 'tasks.get', { taskId: nextTaskId });
    }

    function finishTaskListPagination(socket) {
      if (!taskSnapshot) return;
      const rootTasks = taskSnapshot.tasks.filter((task) => (
        task?.sessionKey === sessionKey &&
        typeof task?.childSessionKey === 'string' &&
        taskCreatedAtMs(task) !== null &&
        taskCreatedAtMs(task) >= evidence.dispatch_accepted_at_ms
      ));
      const childKeys = new Set(rootTasks.map((task) => task.childSessionKey));
      const candidates = taskSnapshot.tasks.filter((task) => (
        rootTasks.includes(task) ||
        (
          childKeys.has(task?.sessionKey) &&
          typeof task?.childSessionKey === 'string' &&
          taskCreatedAtMs(task) !== null &&
          taskCreatedAtMs(task) >= evidence.dispatch_accepted_at_ms
        )
      ));
      const ids = candidates.map(taskId);
      if (ids.some((value) => !value) || new Set(ids).size !== ids.length) {
        rejectTaskSnapshot(
          socket,
          'duplicate or invalid task identity across paginated snapshot',
        );
        return;
      }
      taskSnapshot.detailQueue = ids;
      taskSnapshot.details = [];
      requestNextTaskDetail(socket);
    }

    function requestTaskSnapshot(socket) {
      if (taskSnapshot ||
          evidence.task_ledger_receipt ||
          !evidence.parent_dispatch_accepted ||
          Date.now() >= evidence.dispatch_accepted_at_ms + DESCENDANT_OBSERVATION_MS) {
        return;
      }
      taskSnapshot = {
        tasks: [],
        seenCursors: [''],
        detailQueue: [],
        details: [],
        currentDetailId: null,
      };
      evidence.task_pagination_exhausted = false;
      tracker.send(socket, 'tasks.list', { limit: 100 });
    }

    function reconcileRootConsumption() {
      if (!evidence.task_ledger_receipt || !evidence.accepted_dispatch_run_id) return;
      const lifecycleStarts = new Map();
      let candidate = null;
      let acceptance = null;
      let receipt = null;
      let assistantSentinelObserved = false;
      for (const event of rootObservationEvents) {
        const lifecycleStart = rCdChainRootLifecycleStart({
          eventName: event.eventName,
          eventData: event.eventData,
          rootSessionKey: sessionKey,
          taskLedgerReceipt: evidence.task_ledger_receipt,
          dispatchRunId: evidence.accepted_dispatch_run_id,
          observedAtMs: event.observedAtMs,
        });
        if (lifecycleStart) {
          lifecycleStarts.set(lifecycleStart.runId, lifecycleStart.startedAtMs);
        }
        if (!candidate) {
          for (const [lifecycleRunId, lifecycleStartedAtMs] of lifecycleStarts) {
            candidate = rCdChainRootReturnCandidate({
              eventName: event.eventName,
              eventData: event.eventData,
              rootSessionKey: sessionKey,
              nonce: chainNonce,
              taskLedgerReceipt: evidence.task_ledger_receipt,
              dispatchRunId: evidence.accepted_dispatch_run_id,
              lifecycleRunId,
              lifecycleStartedAtMs,
              observedAtMs: event.observedAtMs,
            });
            if (candidate) break;
          }
        }
        if (candidate && !acceptance) {
          acceptance = rCdChainRootReturnAcceptance(candidate, {
            eventName: event.eventName,
            eventData: event.eventData,
            observedAtMs: event.observedAtMs,
          });
        }
        if (candidate && rCdChainRootAckObserved({
          eventName: event.eventName,
          eventData: event.eventData,
          rootSessionKey: sessionKey,
          nonce: chainNonce,
          lifecycleRunId: candidate.runId,
        })) {
          assistantSentinelObserved = true;
        }
        if (acceptance) {
          receipt = rCdChainRootReturnReceipt(acceptance, {
            childSessionKey: evidence.child_session,
            grandchildSessionKey: evidence.grandchild_session,
            eventName: event.eventName,
            eventData: event.eventData,
            observedAtMs: event.observedAtMs,
            assistantSentinelObserved,
          });
          if (receipt) break;
        }
      }
      evidence.root_return_candidate = candidate;
      evidence.root_return_acceptance = acceptance;
      evidence.root_return_receipt = receipt;
      evidence.chain_return_received = receipt !== null;
      if (receipt) {
        evidence.child_done_sentinel = true;
        evidence.grandchild_done_sentinel = true;
        evidence.root_ack_sentinel_observed = receipt.assistantSentinelObserved;
        evidence.terminal_reason = 'structured-root-consumption-received';
        updateObservationState();
      }
    }

    function startProofFlow(socket) {
      // Subscribe to parent session events — primary proof surface for chain progression.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch the chain via sessions.send — triggers an agent turn that calls
      // continue_delegate. tools.invoke at the RPC layer does not execute agent-side
      // tools; sessions.send is the correct E2E path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const task = inv.promptTemplate.replace(/\{\{nonce\}\}/g, chainNonce);
        evidence.reason_hash = crypto.sha256(task, 'hex').slice(0, 16);
        evidence.reason_length = task.length;
        evidence.delegate_mode = inv.mode;
        const agentInstruction =
          `[k6-proof-harness] Chain proof nonce ${chainNonce}. ` +
          `Call continue_delegate with: mode="${inv.mode}", fanoutMode="tree", delaySeconds=${inv.delaySeconds}, ` +
          `task=${JSON.stringify(task)}, ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${chainNonce}". ` +
          `After the tool result reports scheduled, reply exactly ROOT-READY ${chainNonce}. ` +
          `On a later turn, only after an internal task completion contains CHILD-DONE ${chainNonce} CHILD-SAW-GRANDCHILD, ` +
          `consume that completion in the normal structured heartbeat response. ` +
          `ROOT-CHAIN-ACK ${chainNonce} is optional supplemental confirmation.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${chainNonce}`,
        });
      }, 500);

    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-chain-${chainNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CD-CHAINED-DEPTH-2 ${chainNonce}`,
          });
        }, 250);
      } else {
        socket.setTimeout(() => startProofFlow(socket), 500);
      }
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);

        evidence.redacted_events.push({
          ts: Date.now(),
          kind: classified.kind,
          method: classified.method || null,
          event: classified.event || null,
          ok: classified.ok !== undefined ? classified.ok : null,
          data: classified.payload ? redactEvent(classified.payload) : null,
        });

        // Disposable session creation
        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            startProofFlow(socket);
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        // Parent dispatch accepted (sessions.send triggers agent turn)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.parent_dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.accepted_dispatch_run_id = gatewayLifecycleRunId(classified.payload);
            evidence.dispatch_run_captured = Boolean(evidence.accepted_dispatch_run_id);
            updateObservationState();
            startDescendantObservationWindow(socket);
            scheduleTaskSnapshot(socket, 8000);
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for depth-2 chain');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          if (!taskSnapshot) {
            evidence.tasks_list_rejected += 1;
          } else if (!classified.ok) {
            rejectTaskSnapshot(socket, 'tasks.list request failed');
          } else {
            const page = rCdChainTaskListPage(
              {
                tasks: taskSnapshot.tasks,
                seenCursors: taskSnapshot.seenCursors,
              },
              classified.payload,
            );
            if (!page.ok) {
              rejectTaskSnapshot(socket, page.reason);
            } else {
              taskSnapshot.tasks = page.state.tasks;
              taskSnapshot.seenCursors = page.state.seenCursors;
              if (page.complete) {
                finishTaskListPagination(socket);
              } else {
                tracker.send(socket, 'tasks.list', {
                  limit: 100,
                  cursor: page.nextCursor,
                });
              }
            }
          }
        }

        if (classified.kind === 'response' && classified.method === 'tasks.get') {
          if (!taskSnapshot || !taskSnapshot.currentDetailId) {
            evidence.tasks_list_rejected += 1;
          } else if (!classified.ok ||
              taskId(classified.payload?.task) !== taskSnapshot.currentDetailId) {
            rejectTaskSnapshot(socket, 'tasks.get response did not match requested task');
          } else {
            taskSnapshot.details.push(classified.payload.task);
            taskSnapshot.currentDetailId = null;
            requestNextTaskDetail(socket);
          }
        }

        // Replay root transcript and lifecycle events against the completed task
        // ledger so evidence arriving before the second stable poll is retained.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const afterDispatchGate = evidence.parent_dispatch_accepted &&
            evidence.dispatch_accepted_at_ms &&
            Date.now() - evidence.dispatch_accepted_at_ms >=
              POST_DISPATCH_EVIDENCE_GATE_MS;
          if (afterDispatchGate &&
              (eventName === 'session.message' ||
                (eventName === 'agent' && gatewayLifecyclePhase(eventData)))) {
            rootObservationEvents.push({
              eventName,
              eventData,
              observedAtMs: Date.now(),
            });
            reconcileRootConsumption();
            if (evidence.root_return_receipt) {
              console.log('✓ structured post-return root consumption observed');
            }
          }
        }

        // Early close only on strict post-dispatch sentinels.
        if (evidence.parent_dispatch_accepted &&
            evidence.child_done_sentinel &&
            evidence.depth1_recovery_wake_scheduled &&
            evidence.grandchild_done_sentinel &&
            evidence.child_session &&
            evidence.grandchild_session &&
            evidence.root_return_receipt) {
          console.log('Full chain evidence gathered, closing early');
          socket.close();
        }
      } catch (e) {
        console.warn(`parse error: ${e}`);
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  chainDuration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'dispatch run identity captured': () => evidence.dispatch_run_captured,
    'exactly-once depth-2 task ledger observed': () => evidence.task_ledger_receipt !== null,
    'child sentinel observed post-dispatch': () => evidence.child_done_sentinel,
    'depth-1 recovery wake scheduled': () => evidence.depth1_recovery_wake_scheduled,
    'grandchild sentinel observed post-dispatch': () => evidence.grandchild_done_sentinel,
    'nonce-bound child identity observed': () => evidence.child_session !== null,
    'nonce-bound grandchild identity observed': () => evidence.grandchild_session !== null,
    'structured post-return root consumption observed': () => evidence.root_return_receipt !== null,
    'max depth >= 2': () => evidence.max_depth_observed >= 2,
  });

  if (!evidence.parent_dispatch_accepted || !evidence.dispatch_run_captured ||
      !evidence.task_ledger_receipt || !evidence.child_done_sentinel ||
      !evidence.depth1_recovery_wake_scheduled ||
      !evidence.grandchild_done_sentinel || !evidence.child_session ||
      !evidence.grandchild_session || !evidence.root_return_receipt) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted &&
    evidence.dispatch_run_captured &&
    evidence.task_ledger_receipt !== null &&
    evidence.depth1_recovery_wake_scheduled &&
    evidence.child_done_sentinel &&
    evidence.grandchild_done_sentinel &&
    evidence.child_session !== null &&
    evidence.grandchild_session !== null &&
    evidence.root_return_receipt !== null;

  console.log(`\n--- R-CD-CHAINED-DEPTH-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-CHAINED-DEPTH-2] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
  console.log(`  Max depth observed: ${evidence.max_depth_observed}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CD-CHAINED-DEPTH-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_chain_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-CHAINED-DEPTH-2] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-chained-depth-2-summary.json': JSON.stringify(summary, null, 2),
  };
}
