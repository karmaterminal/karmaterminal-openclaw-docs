/**
 * Scenario: R-CD-1 — typed continue_delegate() schedule/spawn/return.
 *
 * Fires the typed continue_delegate tool (normal mode) via a sessions.send
 * agent turn. Verifies:
 *   1. Gateway accepts the dispatch (sessions.send accepted)
 *   2. Parent return/completion event observed on session stream (post-dispatch)
 *   3. Optional task-ledger context (when available)
 *
 * Unlike R-CD-2 (silent-wake), mode=normal allows a channel message from
 * the delegate return. This scenario tracks it as soft evidence (not a
 * negative check).
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session — proof does not touch the live #sprites/main
 * Discord lane for repeatability runs.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#103
 *   - Manifest: tools/k6-proofs/manifests/r-cd-1.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';

export const options = {
  scenarios: {
    r_cd_1_typed_delegate: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '150s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_1_duration: ['p(95)<120000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_1_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'ronan-dgx',
  mode: 'normal',
  delaySeconds: 1,
  promptTemplate: 'Proof nonce {{nonce}}: reply with DONE and the nonce only. Do not mutate files.',
  idempotencyKeyPrefix: 'R-CD-1',
};
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tool: inv.tool || 'continue_delegate',
    mode: inv.mode || __ENV.OPENCLAW_DELEGATE_MODE || DEFAULTS.mode,
    delaySeconds: Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds),
    promptTemplate: inv.promptTemplate || DEFAULTS.promptTemplate,
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
  const rowNonce = nonce('R-CD-1');

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
    row: 'R-CD-1',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Required receipts
    tool_invoke_accepted: false,
    delegate_scheduled_sentinel: false,
    parent_return_event: false,
    // Soft receipts
    task_ledger_entry_optional: false,
    child_session_key: null,
    channel_message_observed: false,
    dispatch_accepted_at_ms: null,
    wake_gate_ms: Number(__ENV.OPENCLAW_MIN_DELEGATE_DELAY_MS || 5000),
    delegate_scheduled_at_ms: null,
    parent_return_event_at_ms: null,
    trace_collect_after_ms: null,
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    delegate_delay_ms: null,
    delegate_wake_gate_ms: null,
    prompt_echoes_ignored: 0,
    trace_id: null,
    redacted_events: [],
  };

  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    // Response-driven handshake: start the row when the gateway
    // acknowledges connect, not after a fixed guess. The old fixed delay
    // survives only as the recorded upper bound.
    const handshake = new GatewayHandshake({
      tracker,
      evidence,
      fallbackMs: 500,
      onReady: () => {
        if (createDisposableSession) {
          const disposableKey = disposableSessionKey('r-cd-1', rowNonce);
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CD-1 ${rowNonce}`,
          });
        } else {
          startProofFlow(socket);
        }
      },
    });

    const traceIngestGraceMs = Number(__ENV.OPENCLAW_TRACE_INGEST_GRACE_MS || 10000);
    let traceCloseScheduled = false;

    function maybeCloseAfterTraceGrace() {
      if (!evidence.tool_invoke_accepted ||
          !evidence.delegate_scheduled_sentinel ||
          !evidence.parent_return_event ||
          traceCloseScheduled) {
        return;
      }
      const waitUntil = Number(evidence.trace_collect_after_ms || Date.now());
      const remaining = Math.max(0, waitUntil - Date.now());
      traceCloseScheduled = true;
      closeSocketAfterDelay(socket, remaining, () => {
        console.log('Required R-CD-1 receipts and trace-ingest grace gathered, closing');
      });
    }

    function startProofFlow(socket) {
      // Subscribe to session events — primary surface for task ledger and return.
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      // Dispatch via sessions.send — triggers agent turn that calls continue_delegate.
      socket.setTimeout(() => {
        const inv = invocationCfg();
        const task = inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce);
        evidence.reason_hash = crypto.sha256(task, 'hex').slice(0, 16);
        evidence.reason_length = task.length;
        evidence.delegate_mode = inv.mode;
        evidence.delegate_delay_ms = inv.delaySeconds * 1000;
        evidence.delegate_wake_gate_ms = Math.max(evidence.wake_gate_ms, evidence.delegate_delay_ms);
        const agentInstruction =
          `[k6-proof-harness] Call continue_delegate with task="${task}", mode="${inv.mode}", delaySeconds=${inv.delaySeconds}. ` +
          `After the continue_delegate tool result reports scheduled, reply exactly CD1-DELEGATE-SCHEDULED ${rowNonce}. ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${rowNonce}". ` +
          `This is a proof run — no other action needed.`;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // Poll task ledger — optional context only.
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 5000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 15000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 30000);
      socket.setTimeout(() => tracker.send(socket, 'tasks.list', { limit: 20 }), 60000);

      socket.setTimeout(() => socket.close(), 120000);
    }

    socket.on('open', () => {
      handshake.begin(socket, token);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const classified = tracker.classify(msg);
        handshake.observe(classified);

        recordClassifiedEvent(evidence, classified, redactEvent);

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

        // sessions.send accepted — agent turn triggered
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_invoke_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered (will call continue_delegate)');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Task ledger — optional context only.
        if (classified.kind === 'response' && classified.method === 'tasks.list') {
          const tasks = classified.payload?.tasks || [];
          for (const task of tasks) {
            const taskStr = JSON.stringify(task);
            if (taskStr.includes(rowNonce)) {
              evidence.task_ledger_entry_optional = true;
              const possibleChild = task.sessionKey || task.childSessionKey || null;
              if (possibleChild && possibleChild !== sessionKey) {
                evidence.child_session_key = possibleChild;
              }
              if (task.traceId) evidence.trace_id = task.traceId;
              console.log(`ℹ Optional task ledger context with nonce: ${possibleChild || 'unknown'} state=${task.state || 'unknown'}`);
            }
          }
        }

        // Session events — parent return surface.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventStr = JSON.stringify(classified.data || {});
          if (eventStr.includes(HARNESS_MARKER)) {
            console.log('ℹ Ignoring harness prompt echo event');
          } else {
            // Parent scheduled sentinel emitted only after continue_delegate tool result.
            if (eventStr.includes(`CD1-DELEGATE-SCHEDULED ${rowNonce}`)) {
              evidence.delegate_scheduled_sentinel = true;
              if (evidence.delegate_scheduled_at_ms === null) {
                evidence.delegate_scheduled_at_ms = Date.now();
                evidence.trace_collect_after_ms =
                  evidence.delegate_scheduled_at_ms +
                  evidence.delegate_wake_gate_ms +
                  traceIngestGraceMs;
              }
              console.log(`✓ CD1-DELEGATE-SCHEDULED sentinel observed post-dispatch: ${eventName}`);
            }

            // Child return sentinel from delegate child arrival.
            const returnSentinel = eventStr.includes(`CD1-DONE ${rowNonce}`) || eventName === 'delegate.return';
            const returnWindowOpen = evidence.delegate_scheduled_at_ms !== null &&
              Date.now() >= evidence.delegate_scheduled_at_ms + evidence.delegate_wake_gate_ms;
            if (returnSentinel && returnWindowOpen) {
              evidence.parent_return_event = true;
              evidence.parent_return_event_at_ms = Date.now();
              console.log(`✓ CD1-DONE/delegate return evidence observed post-dispatch: ${eventName}`);
            } else if (returnSentinel) {
              evidence.prompt_echoes_ignored += 1;
              console.log('ℹ Ignored delegate return-like event before delayed wake gate');
            }

            // Channel message (soft — expected for mode=normal, unlike R-CD-2)
            if (eventStr.includes('channel') && eventStr.includes(rowNonce)) {
              evidence.channel_message_observed = true;
              console.log('ℹ Channel message from delegate return (expected for mode=normal)');
            }
          }
        }

        maybeCloseAfterTraceGrace();
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
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted (sessions.send)': () => evidence.tool_invoke_accepted,
    'delegate scheduled sentinel observed post-dispatch': () => evidence.delegate_scheduled_sentinel,
    'parent-return-event observed post-dispatch': () => evidence.parent_return_event,
    'task-ledger-entry optional context': () => true,
  });

  if (!evidence.tool_invoke_accepted || !evidence.delegate_scheduled_sentinel || !evidence.parent_return_event) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.tool_invoke_accepted && evidence.delegate_scheduled_sentinel && evidence.parent_return_event;

  console.log(`\n--- R-CD-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-1] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CD-1',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'ronan-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cd_1_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CD-1] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cd-1-typed-delegate-summary.json': JSON.stringify(summary, null, 2),
  };
}
