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
let finalEvidence = null;

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

export function isOutboundChannelDeliveryEvent(eventName, eventData) {
  const lowerName = String(eventName || '').toLowerCase();
  const namedDelivery = lowerName.includes('delivery') &&
    (lowerName.includes('channel') || lowerName.includes('message') || lowerName.includes('outbound'));
  if (namedDelivery) return true;
  if (!eventData || typeof eventData !== 'object') return false;

  const channelTarget = eventData.channelId || eventData.channel_id ||
    eventData.targetChannel || eventData.deliveryChannel;
  const deliveryStatus = String(
    eventData.deliveryStatus || eventData.delivery_state || eventData.deliveryState || '',
  ).toLowerCase();
  return Boolean(channelTarget) && ['sent', 'delivered', 'completed'].includes(deliveryStatus);
}

// Gateway event envelopes have used both runId and turnId spellings. Keep the
// proof row strict across those variants: an event without the accepted send's
// identifier is diagnostic context, never lifecycle proof.
export function lifecycleRunId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.runId || value.run_id || value.turnId || value.turn_id ||
    value.data?.runId || value.data?.run_id || value.data?.turnId || value.data?.turn_id || null;
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest && manifest.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  // R-CD-2 is only certified on an unbound disposable session.  A caller may
  // still disable creation for diagnostics, but that can never promote a pass.
  const createDisposableSession = (__ENV.OPENCLAW_CREATE_DISPOSABLE_SESSION || 'true').toLowerCase() === 'true';
  const seat = manifest && manifest.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CD-2');

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
    // Required receipts
    tool_accepted: false,
    send_run_id_captured: false,
    terminal_run_matched: false,
    wake_run_matched: false,
    delegate_scheduled_receipt: false,
    dispatch_turn_completed: false,
    terminal_success_observed: false,
    child_fire_or_completion_observed: false,
    post_wake_quiet_completed: false,
    dispatch_failure_observed: false,
    task_created: false,
    task_mode: null,
    // Silent-wake specific
    agent_turn_observed: false,
    parent_wake_observed: false,
    dispatch_channel_message_observed: false,
    channel_message_observed: false, // MUST stay false for PASS
    silent_status_record_observed: false,
    dispatch_accepted_at_ms: null,
    // Keep the raw run/turn identifier only in memory. Evidence artifacts may
    // retain its one-way fingerprint to prove that send, terminal, and wake
    // all refer to the same turn without publishing the identifier itself.
    send_run_fingerprint: null,
    terminal_run_fingerprint: null,
    wake_run_fingerprint: null,
    wake_gate_ms: Number(__ENV.OPENCLAW_MIN_DELEGATE_DELAY_MS || 5000),
    post_wake_quiet_ms: Number(__ENV.OPENCLAW_POST_WAKE_QUIET_MS || 5000),
    post_wake_quiet_timer_started: false,
    child_session: null,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();
  let acceptedDispatchRunId = null;

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();

    function startProofFlow(socket) {
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
        const agentInstruction = `[k6-proof-harness] Call continue_delegate with: task="${prompt}", mode="${inv.mode}", delaySeconds=${inv.delaySeconds}. This is a proof run — execute the tool call immediately, no other action needed.`;
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

        if (classified.kind === 'response' && classified.method === 'sessions.create') {
          if (classified.ok && classified.payload) {
            sessionKey = classified.payload.key || sessionKey;
            evidence.sessionKey = sessionKey;
            evidence.session_created = true;
            evidence.created_session_key = sessionKey;
            console.log(`✓ disposable session created: ${sessionKey}`);
            tracker.send(socket, 'sessions.list', { limit: 20 });
          } else {
            console.error('✗ sessions.create rejected');
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.list') {
          const sessions = classified.payload?.sessions || classified.payload?.items || [];
          const created = sessions.find((session) => session?.key === sessionKey);
          const hasChannelBinding = Boolean(created?.channelId || created?.channel || created?.deliveryChannel);
          if (evidence.session_created && created && !hasChannelBinding) {
            evidence.session_unbound_confirmed = true;
            console.log('✓ disposable session re-read as unbound');
            startProofFlow(socket);
          } else {
            console.error('✗ disposable session is missing or bound');
            failures.add(1);
            socket.close();
          }
        }

        // Check sessions.send accepted (agent turn triggered)
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            const acceptedRunId = lifecycleRunId(classified.payload);
            if (acceptedRunId) {
              acceptedDispatchRunId = acceptedRunId;
              evidence.send_run_fingerprint = crypto.sha256(String(acceptedRunId), 'hex').slice(0, 16);
              evidence.send_run_id_captured = true;
            } else {
              // An accepted send without an identifier cannot be joined to a
              // later lifecycle event and is intentionally non-promotable.
              evidence.dispatch_failure_observed = true;
            }
            if (classified.payload && classified.payload.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered for R-CD-2 (mode=silent-wake)');
          } else if (classified.error) {
            console.error('✗ sessions.send rejected');
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

          // Some target sessions emit generic agent lifecycle events rather than
          // an early session.message before the delayed wake. Count these as the
          // dispatching agent turn, not as the silent-wake return.
          if (eventName === 'agent' && evidence.tool_accepted) {
            evidence.agent_turn_observed = true;
            const stream = String(eventData.stream || '').toLowerCase();
            const phase = String(eventData.data?.phase || '').toLowerCase();
            const status = String(eventData.data?.status || eventData.status || '').toLowerCase();
            const eventRunId = lifecycleRunId(eventData);
            const sameAcceptedRun = Boolean(acceptedDispatchRunId && eventRunId && eventRunId === acceptedDispatchRunId);
            if (stream === 'lifecycle' && phase === 'end' && sameAcceptedRun) {
              if (['error', 'failed', 'failure', 'aborted'].includes(status) || eventData.data?.replayInvalid === true) {
                evidence.dispatch_failure_observed = true;
              } else {
                evidence.dispatch_turn_completed = true;
                evidence.terminal_success_observed = true;
                evidence.terminal_run_matched = true;
                evidence.terminal_run_fingerprint = crypto.sha256(String(eventRunId), 'hex').slice(0, 16);
              }
            }
            if (stream === 'item' && ['error', 'failed', 'failure', 'aborted'].includes(status)) {
              evidence.dispatch_failure_observed = true;
            }
          }

          // session.message events immediately after sessions.send are the dispatching
          // agent turn, not the silent-wake return.  The delegate delay is clamped
          // by the gateway, so only count a parent wake after the minimum delay.
          if (eventName === 'session.message' && evidence.tool_accepted) {
            const elapsed = evidence.dispatch_accepted_at_ms ? Date.now() - evidence.dispatch_accepted_at_ms : 0;
            const eventRunId = lifecycleRunId(eventData);
            const sameAcceptedRun = Boolean(acceptedDispatchRunId && eventRunId && eventRunId === acceptedDispatchRunId);
            if (elapsed >= evidence.wake_gate_ms && sameAcceptedRun) {
              evidence.parent_wake_observed = true;
              evidence.agent_turn_observed = true;
              evidence.child_fire_or_completion_observed = true;
              evidence.wake_run_matched = true;
              evidence.wake_run_fingerprint = crypto.sha256(String(eventRunId), 'hex').slice(0, 16);
              if (!evidence.post_wake_quiet_timer_started) {
                evidence.post_wake_quiet_timer_started = true;
                socket.setTimeout(() => {
                  if (!evidence.channel_message_observed) {
                    evidence.post_wake_quiet_completed = true;
                    console.log('✓ bounded post-wake quiet window completed');
                  }
                  socket.close();
                }, evidence.post_wake_quiet_ms);
              }
              console.log('✓ delayed session.message event observed (silent-wake return candidate)');
            } else {
              evidence.agent_turn_observed = true;
              console.log('✓ initial session.message event observed (dispatching agent turn)');
            }
          }

          // continue_status({ notify:false }) is internal completion bookkeeping,
          // even when a generic chat event carries channel/delivery metadata for
          // the bound session. Record it explicitly instead of treating arbitrary
          // transcript text as proof of outbound delivery.
          if (eventStr.includes(rowNonce) && eventStr.includes('"notify":false') &&
              eventStr.includes('"outcome":"done"')) {
            evidence.silent_status_record_observed = true;
            evidence.delegate_scheduled_receipt = true;
            console.log('ℹ internal continue_status notify:false receipt observed');
          }

          // Negative check: only an explicit outbound-delivery-shaped event counts.
          // Generic agent/chat events can contain the full transcript plus routing
          // metadata, so substring checks for "channel" and "deliver" are unsafe.
          if (eventStr.includes(rowNonce) &&
              isOutboundChannelDeliveryEvent(eventName, eventData)) {
            if (eventStr.includes('[k6-proof-harness]')) {
              evidence.dispatch_channel_message_observed = true;
              console.log('ℹ dispatch instruction channel event observed (not delegate return)');
            } else {
              evidence.channel_message_observed = true;
              console.warn('✗ Delegate channel delivery detected — silent mode violated!');
              failures.add(1);
            }
          }
        }

        // Early close only after a delayed parent wake candidate is observed; task
        // ledger context remains optional.  Do not close on the initial dispatch
        // agent turn, or this row only proves sessions.send.
        if (evidence.tool_accepted && evidence.parent_wake_observed && evidence.post_wake_quiet_completed) {
          console.log('Primary silent-wake evidence gathered, closing early');
          socket.close();
        }
      } catch (e) {
        console.warn('gateway frame parse error');
      }
    });

    socket.on('error', (e) => {
      console.error(`ws error: ${e && e.error ? e.error() : e}`);
      failures.add(1);
    });
  });

  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  finalEvidence = evidence;
  duration.add(evidence.duration_ms);

  // Checks — core evidence for silent-wake proof:
  // 1. Agent turn triggered (sessions.send accepted)
  // 2. Agent produced session.message events (turn ran)
  // 3. No channel delivery (silent mode verified)
  // Note: task_created via tasks.list is OPTIONAL — continuation tasks
  // use their own tracking surface, not the generic task ledger.
  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'agent turn triggered (sessions.send accepted)': () => evidence.tool_accepted,
    'dispatching agent turn observed': () => evidence.agent_turn_observed,
    'delayed parent wake candidate observed': () => evidence.parent_wake_observed,
    'no channel delivery (silent verified)': () => !evidence.channel_message_observed,
  });

  if (!evidence.tool_accepted || !evidence.agent_turn_observed || !evidence.parent_wake_observed) {
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
  // Only the post-run resolver may promote R-CD-2 after it joins this local
  // evidence with the strict private continuation correlation receipt.
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
    candidateOnly: true,
    foldRequiresReview: true,
    observability: {
      traceStatus: 'resolved-after-run',
    },
    review: {
      status: 'review-pending',
      pendingReceipts: ['continuation-lifecycle-correlation'],
      notes: ['R-CD-2 summary is provisional. The runner owns final promotion from the validated public-safe lifecycle receipt.'],
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
