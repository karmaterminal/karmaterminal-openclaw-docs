/**
 * Scenario: R-CD-2 — continue_delegate(mode="silent-wake") full path.
 *
 * Verifies:
 *   1. Gateway accepts continue_delegate with mode=silent-wake
 *   2. Child task spawns and completes
 *   3. Parent session wakes (receives internal context)
 *   4. NO channel message is delivered (silent mode)
 *
 * The key differentiator from R-CD-1: the delegate return must NOT produce
 * a channel message. The parent wakes (gets a new turn) but the return is
 * internal-only context enrichment.
 *
 * Manifest-driven: reads row config from OPENCLAW_ROW_MANIFEST env var.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#119
 *   - Manifest: tools/k6-proofs/manifests/r-cd-2.json
 */
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';
import {
  classifyRcd2LifecycleEvent,
  hasRcd2LocalEvidence,
  isRcd2OutboundChannelDeliveryEvent,
  rCd2ScheduledSentinel,
} from '../lib/r-cd-2-lifecycle.js';

export const options = {
  scenarios: {
    r_cd_2_silent_wake: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '120s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_2_duration: ['p(95)<90000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_2_duration');

function safeRpcFailureCategory(method) {
  // RPC payloads can contain provider details, prompts, or identifiers.  Public
  // proof output records only this opaque method/category pair.
  return `${method}-rejected`;
}

// --- Manifest-driven config ---
const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'silent-wake',
  delaySeconds: 1,
  promptTemplate: 'Proof nonce {{nonce}}: reply with DONE and the nonce only. Do not mutate files. Do not post to any channel.',
  idempotencyKeyPrefix: 'R-CD-2',
};

function invocationCfg() {
  const inv = manifest && manifest.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || __ENV.OPENCLAW_DELEGATE_MODE || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds !== undefined ? inv.delaySeconds : (__ENV.OPENCLAW_DELAY_SECONDS !== undefined ? __ENV.OPENCLAW_DELAY_SECONDS : DEFAULTS.delaySeconds)),
    promptTemplate: inv.promptTemplate || DEFAULTS.promptTemplate,
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest && manifest.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const disposableEnv =
    __ENV.OPENCLAW_CREATE_DISPOSABLE_SESSION ||
    __ENV.OPENCLAW_CREATE_DISPOSABLE_SESSIONS ||
    'true';
  const createDisposableSession = disposableEnv.toLowerCase() === 'true';
  const seat = manifest && manifest.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-2');
  const postWakeQuietMs = Number(__ENV.OPENCLAW_R_CD_2_POST_WAKE_QUIET_MS || 5000);

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (!createDisposableSession) {
    console.error('R-CD-2 requires an unbound disposable session for no-channel proof');
    failures.add(1);
    return;
  }
  if (
    !Number.isFinite(postWakeQuietMs) ||
    postWakeQuietMs < 1000 ||
    postWakeQuietMs > 30000
  ) {
    console.error(
      'OPENCLAW_R_CD_2_POST_WAKE_QUIET_MS must be a finite value from 1000 through 30000',
    );
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
    row: 'R-CD-2',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    sessionKey,
    requestedSessionKey,
    session_created: false,
    session_unbound_confirmed: false,
    created_session_key: null,
    candidateSha: manifest && manifest.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    disposable_session_required: createDisposableSession,
    // Required receipts
    tool_accepted: false,
    delegate_scheduled_receipt: false,
    delegate_scheduled_at_ms: null,
    task_created: false,
    task_mode: null,
    // Silent-wake specific
    agent_turn_observed: false,
    parent_wake_observed: false,
    dispatch_channel_message_observed: false,
    channel_message_observed: false, // MUST stay false for PASS
    silent_status_record_observed: false,
    dispatch_accepted_at_ms: null,
    dispatch_run_id: null,
    dispatch_turn_completed: false,
    dispatch_turn_completed_at_ms: null,
    wake_gate_ms: Number(__ENV.OPENCLAW_MIN_DELEGATE_DELAY_MS || 5000),
    parent_wake_observed_at_ms: null,
    post_wake_quiet_ms: postWakeQuietMs,
    post_wake_quiet_completed: false,
    child_session: null,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    trace_id: null,
    dispatch_failure_observed: false,
    failure_receipt: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let successCloseScheduled = false;
    let proofFlowStarted = false;

    function maybeScheduleSuccessClose() {
      if (
        successCloseScheduled ||
        !evidence.delegate_scheduled_receipt ||
        !evidence.dispatch_turn_completed ||
        !evidence.parent_wake_observed ||
        evidence.dispatch_failure_observed ||
        evidence.channel_message_observed
      ) {
        return;
      }
      const closeAfterMs =
        evidence.parent_wake_observed_at_ms + evidence.post_wake_quiet_ms;
      const remainingMs = Math.max(0, closeAfterMs - Date.now());
      successCloseScheduled = true;
      closeSocketAfterDelay(socket, remainingMs, () => {
        if (!evidence.dispatch_failure_observed && !evidence.channel_message_observed) {
          evidence.post_wake_quiet_completed = true;
          console.log('✓ bounded post-wake no-delivery window completed');
        }
      });
    }

    function startProofFlow(socket) {
      if (proofFlowStarted) return;
      proofFlowStarted = true;
      // Subscribe to parent session messages to detect wake + verify no channel delivery.
      // Protocol: sessions.messages.subscribe uses 'key' not 'sessionKey'.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Fire continue_delegate via sessions.send — instructs the agent to call the tool.
      // NOTE: tools.invoke at the RPC layer accepts the call but continuation tools
      // are agent-side (execute inside an agent turn). sessions.send triggers an actual
      // agent turn that can call the tool, which is the E2E proof path.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const prompt = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        evidence.reason_hash = crypto.sha256(prompt, 'hex').slice(0, 16);
        evidence.reason_length = prompt.length;
        evidence.delegate_mode = inv.mode;
        const agentInstruction =
          `[k6-proof-harness] Call continue_delegate with: task="${prompt}", mode="${inv.mode}", delaySeconds=${inv.delaySeconds}. ` +
          `After the continue_delegate tool result reports scheduled, reply exactly ${rCd2ScheduledSentinel(rowNonce)}. ` +
          `This is a proof run — execute the tool call immediately, no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-${rowNonce}`,
        });
      }, 500);

      // Poll task ledger — check mode field.
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 5000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 15000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 10 }), 30000);

      // Extended wait for silent-wake (child must complete + parent must wake).
      socket.setTimeout(() => socket.close(), 90000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-2-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CD-2 ${rowNonce}`,
          });
        }, 250);
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

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            tracker.send(socket, 'sessions.list', { limit: 10, search: sessionKey });
          } else {
            console.error(`✗ ${safeRpcFailureCategory('sessions.create')}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.list') {
          if (!classified.ok) {
            console.error(`✗ ${safeRpcFailureCategory('sessions.list')}`);
            failures.add(1);
            socket.close();
          } else {
            const sessions = Array.isArray(classified.payload && classified.payload.sessions)
              ? classified.payload.sessions
              : [];
            const created = sessions.find((session) => session && session.key === sessionKey);
            const deliveryContext = created && created.deliveryContext || {};
            const hasChannelBinding = Boolean(
              created &&
                (created.lastChannel ||
                  created.lastTo ||
                  created.lastAccountId ||
                  deliveryContext.channel ||
                  deliveryContext.to ||
                  deliveryContext.accountId),
            );
            if (!created || hasChannelBinding) {
              console.error('✗ disposable session is missing or has a channel delivery binding');
              failures.add(1);
              socket.close();
            } else {
              evidence.session_unbound_confirmed = true;
              console.log('✓ disposable session has no channel delivery binding');
              startProofFlow(socket);
            }
          }
        }

        // Check sessions.send accepted (agent turn triggered)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            evidence.dispatch_run_id = classified.payload && classified.payload.runId || null;
            if (classified.payload && classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-CD-2 (mode=silent-wake)');
          } else if (classified.error) {
            console.error(`✗ ${safeRpcFailureCategory('sessions.send')}`);
            failures.add(1);
          }
        }

        // Optional TaskFlow ledger context. Absence here is not a failure:
        // continue_delegate uses pending-delegate/subagent surfaces.
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload && classified.payload.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              evidence.task_created = true;
              evidence.child_session = task.sessionKey || task.childSessionKey || null;
              evidence.task_mode = task.mode || task.returnMode || null;
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log(`✓ Task found with nonce — mode: ${evidence.task_mode}`);
            }
          }
        }

        // Detect dispatch progress and parent wake via session/agent events.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          const lifecycle = classifyRcd2LifecycleEvent({
            eventName,
            eventData,
            rowNonce,
            harnessMarker: '[k6-proof-harness]',
            toolAccepted: evidence.tool_accepted,
            dispatchRunId: evidence.dispatch_run_id,
            delegateScheduledAtMs: evidence.delegate_scheduled_at_ms,
            dispatchTurnCompletedAtMs: evidence.dispatch_turn_completed_at_ms,
            wakeGateMs: evidence.wake_gate_ms,
            nowMs: Date.now(),
          });

          // Some target sessions emit generic agent lifecycle events rather than
          // an early session.message before the delayed wake. Count these as the
          // dispatching agent turn, not as the silent-wake return.
          if (eventName === 'agent' && evidence.tool_accepted) {
            evidence.agent_turn_observed = true;
          }

          if (lifecycle.delegateScheduledReceipt) {
            evidence.delegate_scheduled_receipt = true;
            evidence.delegate_scheduled_at_ms = Date.now();
            evidence.agent_turn_observed = true;
            console.log('✓ correlated continue_delegate scheduled receipt observed');
          }

          if (lifecycle.dispatchTurnCompleted) {
            evidence.dispatch_turn_completed = true;
            evidence.dispatch_turn_completed_at_ms = Date.now();
            console.log('✓ dispatching agent turn completed successfully');
          }

          if (lifecycle.parentWakeObserved) {
            evidence.parent_wake_observed = true;
            evidence.parent_wake_observed_at_ms =
              evidence.parent_wake_observed_at_ms || Date.now();
            evidence.agent_turn_observed = true;
            console.log('✓ correlated delayed parent wake observed after delegate scheduling receipt');
          } else if (eventName === 'session.message' && evidence.tool_accepted) {
            evidence.agent_turn_observed = true;
            console.log('ℹ session.message observed without qualified continuation wake');
          }

          if (lifecycle.failureReceipt && !evidence.dispatch_failure_observed) {
            evidence.dispatch_failure_observed = true;
            evidence.failure_receipt = lifecycle.failureReceipt;
            failures.add(1);
            console.warn(`✗ dispatching turn failed: ${lifecycle.failureReceipt.kind}`);
            socket.close();
          }

          // continue_status({ notify:false }) is internal completion bookkeeping,
          // even when a generic chat event carries channel/delivery metadata for
          // the bound session. Record it explicitly instead of treating arbitrary
          // transcript text as proof of outbound delivery.
          if (eventStr.includes(rowNonce) && eventStr.includes('"notify":false') &&
              eventStr.includes('"outcome":"done"')) {
            evidence.silent_status_record_observed = true;
            console.log('ℹ internal continue_status notify:false receipt observed');
          }

          // Negative check: only an explicit outbound-delivery-shaped event counts.
          // Generic agent/chat events can contain the full transcript plus routing
          // metadata, so substring checks for "channel" and "deliver" are unsafe.
          if (isRcd2OutboundChannelDeliveryEvent(eventName, eventData)) {
            evidence.channel_message_observed = true;
            console.warn('✗ Outbound channel delivery detected — silent mode violated!');
            failures.add(1);
            socket.close();
          }
        }

        maybeScheduleSuccessClose();
      } catch {
        console.warn('gateway-frame-parse-failed');
      }
    });

    socket.on('error', () => {
      console.error('gateway-websocket-error');
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  duration.add(evidence.duration_ms);

  // Checks — core evidence for silent-wake proof:
  // 1. Agent turn triggered (sessions.send accepted)
  // 2. Agent produced session.message events (turn ran)
  // 3. No channel delivery (silent mode verified)
  // Note: task_created via tasks.list is OPTIONAL — continuation tasks
  // use their own tracking surface, not the generic task ledger.
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'unbound disposable session confirmed': () => evidence.session_unbound_confirmed,
    'agent turn triggered (sessions.send accepted)': () => evidence.tool_accepted,
    'dispatching agent turn observed': () => evidence.agent_turn_observed,
    'correlated delegate scheduled receipt observed': () => evidence.delegate_scheduled_receipt,
    'dispatching agent turn completed successfully': () => evidence.dispatch_turn_completed,
    'correlated delayed parent wake observed after scheduling': () => evidence.parent_wake_observed,
    'post-wake no-delivery window completed': () => evidence.post_wake_quiet_completed,
    'dispatching turn stayed successful': () => !evidence.dispatch_failure_observed,
    'no channel delivery (silent verified)': () => !evidence.channel_message_observed,
  });

  const localEvidenceComplete = hasRcd2LocalEvidence(evidence);
  if (!localEvidenceComplete && !evidence.dispatch_failure_observed) {
    failures.add(1);
  }
  if (evidence.channel_message_observed) {
    failures.add(1);
    console.error('FAIL: silent-wake delegate produced channel output');
  }

  console.log(`R_CD_2_EVIDENCE ${JSON.stringify(evidence)}`);
  console.log(`\n--- R-CD-2 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  // Only run-proofs.sh may promote this row after the strict trace correlator
  // writes r-cd-2-lifecycle-receipt.json.  The VU has useful local evidence,
  // but cannot itself attest same-trace/chain/mode topology.
  console.log('\n[R-CD-2] VERDICT: PARTIAL-candidate');
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summary = {
    row: 'R-CD-2',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: 'PARTIAL-candidate',
    lifecycleReceipt: {
      path: 'r-cd-2-lifecycle-receipt.json',
      verdict: 'PENDING',
      authority: 'strict-continuation-correlation',
    },
    candidateOnly: true,
    foldRequiresReview: true,
    review: {
      status: 'review-pending',
      receiptSource: 'run-proofs evidence extraction and Tempo postprocessing',
      notes: [
        'The VU cannot establish same-trace/chain/mode topology. run-proofs must replace this provisional verdict with r-cd-2-lifecycle-receipt.json before any PASS-candidate exists.',
      ],
    },
    metrics: {
      duration_ms: data.metrics.r_cd_2_duration && data.metrics.r_cd_2_duration.values || null,
      failures: data.metrics.proof_failures && data.metrics.proof_failures.values && data.metrics.proof_failures.values.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-2] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-2-summary.json': JSON.stringify(summary, null, 2),
  };
}
