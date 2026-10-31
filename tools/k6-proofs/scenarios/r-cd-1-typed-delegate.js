/**
 * Scenario: R-CD-1 — typed continue_delegate() schedule/spawn/return.
 *
 * Fires the typed continue_delegate tool (normal mode) via a sessions.send
 * agent turn. Verifies:
 *   1. Gateway accepts the dispatch (sessions.send accepted)
 *   2. Parent return/completion event observed on session stream (post-dispatch)
 *   3. Optional child context: the row-bound child from the child observer
 *      (sessions.list spawnedBy + the child's own spawn task; #562)
 *
 * Unlike R-CD-2 (silent-wake), mode=normal allows a channel message from
 * the delegate return. This scenario tracks it as soft evidence (not a
 * negative check).
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session — proof does not touch the live #sprites/main
 * Discord lane for repeatability runs.
 *
 * Receipts are product records the agent cannot author
 * (openclaw-bootstrap#1727). The return sentinel used to be written into the
 * delegate task, so the parent's own continue_delegate call carried it and
 * only a timing window kept that echo out:
 *   - scheduled: the nonce-bound continue_delegate toolResult (toolCallId)
 *     reports "scheduled", and CD1-DELEGATE-SCHEDULED is in the parent's text;
 *   - child return: the bound child's own transcript says
 *     CD1-DONE <nonce> TOKEN <12 chars>, a token minted there;
 *   - parent return: a parent run other than the dispatch run reproduces
 *     CD1-RETURN <nonce> TOKEN <that token>, not earlier than the token.
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
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { closeSocketAfterDelay } from '../lib/socket-close.js';
import { createChildObserver, createPreflightGate, failClosedVerdict } from '../lib/child-observer.mjs';
import { delegateReturnWindow } from '../lib/delegate-return-window.mjs';
import { gatewayLifecycleRunId } from '../lib/gateway-lifecycle.js';
import { assistantSentinelFromEvent, createToolReceiptTracker, mintedTokenFromHistory, tokenReplyFromHistory } from '../lib/sentinel-binding.mjs';

import { k6TimeoutMs } from '../lib/k6-timeout.mjs';
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
  promptTemplate: 'Proof nonce {{nonce}}: after you arrive, invent a fresh random token of exactly 12 lowercase letters and digits (make it up now; do not copy it from anywhere) and reply exactly CD1-DONE {{nonce}} TOKEN <your token>. Do not mutate files.',
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
    child_record_observed_optional: false,
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
    // docs#564: the return window opens at scheduled + delay (the earliest a
    // real return can exist). The old fixed gate is diagnostic only.
    return_window_opens_at_ms: null,
    return_before_legacy_wake_gate: false,
    prompt_echoes_ignored: 0,
    scheduled_receipt_observed: false,
    scheduled_text_bound: false,
    child_return_bound: false,
    child_return_reason: null,
    child_token_fingerprint: null,
    parent_return_reason: null,
    child_history_reads: 0,
    parent_history_reads: 0,
    // Diagnostics only: return text on the event stream inside the return window.
    return_text_seen: false,
    trace_id: null,
    preflight: null,
    observation_refused: null,
    verdict_reason: null,
    redacted_events: [],
  };

  const started = Date.now();
  const gate = createPreflightGate('R-CD-1');
  const observer = createChildObserver({ rootSessionKey: () => sessionKey });

  const sentTexts = [];
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    const traceIngestGraceMs = Number(__ENV.OPENCLAW_TRACE_INGEST_GRACE_MS || 10000);
    let traceCloseScheduled = false;
    let scheduledTracker = null;
    let dispatchRunId = null;
    let childToken = null;
    let childTokenTimestamp = null;
    let childReadScheduled = false;
    let parentReadScheduled = false;
    const parentHistoryIds = {};

    function markScheduled() {
      if (evidence.delegate_scheduled_sentinel || !evidence.scheduled_receipt_observed || !evidence.scheduled_text_bound) return;
      evidence.delegate_scheduled_sentinel = true;
      evidence.delegate_scheduled_at_ms = Date.now();
      evidence.trace_collect_after_ms = evidence.delegate_scheduled_at_ms + evidence.delegate_wake_gate_ms + traceIngestGraceMs;
      console.log('✓ continue_delegate toolResult scheduled and CD1-DELEGATE-SCHEDULED in the parent\'s own text');
    }

    // The child's own transcript carries its return and the token it minted.
    function requestChildHistory(delayMs) {
      if (!evidence.child_session_key || childToken || childReadScheduled || evidence.child_history_reads >= 40) return;
      childReadScheduled = true;
      socket.setTimeout(() => {
        childReadScheduled = false;
        evidence.child_history_reads += 1;
        if (!observer.refreshHistory(evidence.child_session_key, 200, 'cd1-child')) requestChildHistory(3000);
      }, k6TimeoutMs(delayMs));
    }

    function onChildHistory(messages) {
      const minted = mintedTokenFromHistory(messages, { marker: 'CD1-DONE', nonce: rowNonce, sentTexts });
      evidence.child_return_reason = minted.reason;
      if (!minted.token) { requestChildHistory(3000); return; }
      childToken = minted.token;
      childTokenTimestamp = minted.timestamp;
      evidence.child_return_bound = true;
      evidence.child_token_fingerprint = crypto.sha256(minted.token, 'hex').slice(0, 16);
      console.log('✓ the bound child returned CD1-DONE with a token it minted (its own transcript)');
      requestParentHistory(1000);
    }

    // The return reached the parent only if a later parent run reproduces the token.
    function requestParentHistory(delayMs) {
      if (!childToken || evidence.parent_return_event || parentReadScheduled || evidence.parent_history_reads >= 40) return;
      parentReadScheduled = true;
      socket.setTimeout(() => {
        parentReadScheduled = false;
        evidence.parent_history_reads += 1;
        parentHistoryIds[tracker.send(socket, 'chat.history', { sessionKey, limit: 200 })] = true;
      }, k6TimeoutMs(delayMs));
    }

    function onParentHistory(messages) {
      const bound = tokenReplyFromHistory(messages, {
        marker: 'CD1-RETURN',
        nonce: rowNonce,
        token: childToken,
        excludeRunIds: [dispatchRunId],
        notBeforeTimestamp: childTokenTimestamp,
      });
      evidence.parent_return_reason = bound.reason;
      if (!bound.bound) { requestParentHistory(4000); return; }
      evidence.parent_return_event = true;
      evidence.parent_return_event_at_ms = Date.now();
      console.log('✓ a parent run outside the dispatch reproduced the child token');
    }

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
          `Later, when the delegate's return arrives, reply exactly CD1-RETURN ${rowNonce} TOKEN <the TOKEN value from that return>. ` +
          `idempotencyKey="${inv.idempotencyKeyPrefix}-${rowNonce}". ` +
          `This is a proof run — no other action needed.`;
        sentTexts.push(task, agentInstruction);
        scheduledTracker = createToolReceiptTracker({ sessionKey, toolName: 'continue_delegate', argField: 'task', needle: rowNonce });
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // Optional child context (#562): row-bound child via the child observer.
      for (const delayMs of [5000, 15000, 30000, 60000]) {
        socket.setTimeout(() => observer.poll(), k6TimeoutMs(delayMs));
      }

      socket.setTimeout(() => socket.close(), 120000);
    }

    function afterHello(socket) {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-1-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CD-1 ${rowNonce}`,
          });
        }, 250);
      } else {
        socket.setTimeout(() => startProofFlow(socket), 500);
      }
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));
      observer.attach(
        (method, params) => tracker.send(socket, method, params),
        (delayMs, fn) => socket.setTimeout(fn, k6TimeoutMs(delayMs)),
      );
      socket.setTimeout(() => { if (gate.timeout(10000)) socket.close(); }, 10000);
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const preflight = gate.observe(msg);
        if (preflight === 'refused') {
          console.error(`✗ R-CD-1 preflight refused before dispatch: ${gate.result.reason}`);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello(socket);
        const observed = observer.claim(msg);
        const parentHistory = !observed && msg && msg.type === 'res' && parentHistoryIds[msg.id];
        if (parentHistory) delete parentHistoryIds[msg.id];
        const classified = tracker.classify(msg);
        if (observed) {
          const childMessages = observer.handle(observed, classified);
          if (observed.purpose === 'cd1-child' && Array.isArray(childMessages)) onChildHistory(childMessages);
        }
        if (parentHistory) {
          if (classified.ok) onParentHistory(Array.isArray(classified.payload?.messages) ? classified.payload.messages : []);
          else requestParentHistory(4000);
        }

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

        // sessions.send accepted — agent turn triggered
        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.tool_invoke_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            dispatchRunId = gatewayLifecycleRunId(classified.payload);
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — agent turn triggered (will call continue_delegate)');
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        // Optional child context — the child's own row names this session in
        // spawnedBy and its own spawn task carries the row nonce.
        if (observed && !evidence.child_session_key) {
          const bound = observer.boundChild(rowNonce);
          if (bound.childSessionKey) {
            evidence.child_record_observed_optional = true;
            evidence.child_session_key = bound.childSessionKey;
            console.log(`ℹ Row-bound child observed: status=${observer.childStatus(bound.childSessionKey) || 'unknown'}`);
            requestChildHistory(1000);
          }
        }
        if (evidence.child_session_key && !childToken) requestChildHistory(3000);

        // Session events — parent return surface.
        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          if (scheduledTracker) {
            const receipt = scheduledTracker.observe(eventName, eventData);
            if (receipt && !receipt.isError && receipt.status === 'scheduled') {
              evidence.scheduled_receipt_observed = true;
              if (!dispatchRunId && receipt.runId) dispatchRunId = receipt.runId;
            }
          }
          if (assistantSentinelFromEvent(eventName, eventData, { sessionKey, marker: 'CD1-DELEGATE-SCHEDULED', nonce: rowNonce, requireRunId: false })) {
            evidence.scheduled_text_bound = true;
          }
          markScheduled();
          if (eventStr.includes(HARNESS_MARKER)) {
            console.log('ℹ Ignoring harness prompt echo event');
          } else {
            // Diagnostics only: return-like text on the stream, inside or before the window.
            const returnSentinel = eventStr.includes(`CD1-DONE ${rowNonce}`) || eventName === 'delegate.return';
            const returnWindow = delegateReturnWindow({
              anchorAtMs: evidence.delegate_scheduled_at_ms,
              delayMs: evidence.delegate_delay_ms,
              legacyGateMs: evidence.wake_gate_ms,
              nowMs: Date.now(),
            });
            evidence.return_window_opens_at_ms = returnWindow.opensAtMs;
            if (returnSentinel && returnWindow.open) {
              evidence.return_text_seen = true;
              if (returnWindow.beforeLegacyGate) evidence.return_before_legacy_wake_gate = true;
            } else if (returnSentinel) {
              evidence.prompt_echoes_ignored += 1;
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
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'tool-invoke-accepted (sessions.send)': () => evidence.tool_invoke_accepted,
    'delegate scheduled sentinel observed post-dispatch': () => evidence.delegate_scheduled_sentinel,
    'parent-return-event observed post-dispatch': () => evidence.parent_return_event,
    'preflight: every row method advertised': () => gate.result?.ok === true,
    'child observer not refused': () => !evidence.observation_refused,
  });

  if (!evidence.tool_invoke_accepted || !evidence.delegate_scheduled_sentinel || !evidence.parent_return_event) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.tool_invoke_accepted && evidence.delegate_scheduled_sentinel &&
    evidence.child_return_bound && evidence.parent_return_event;
  const finalVerdict = failClosedVerdict(passed ? 'PASS-candidate' : 'PARTIAL-candidate', { gate, observer });
  evidence.verdict_reason = finalVerdict.reason;
  if (finalVerdict.reason) failures.add(1);

  console.log(`\n--- R-CD-1 EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CD-1] VERDICT: ${finalVerdict.verdict}`);
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
