/**
 * Scenario: R-CW-TOKEN — bare CONTINUE_WORK token path from lightContext subagent.
 *
 * Proves that a child subagent final response ending in a bare CONTINUE_WORK
 * token does more than parse/strip: it schedules and drives hop-2, which emits
 * an explicit TOKEN-HOP2-DONE sentinel on wake.
 *
 * Every receipt is a product record the agent cannot author
 * (openclaw-bootstrap#1727). At F′ every one of these flags flipped on
 * substrings the parent's own sessions_spawn call carries (the spawn task
 * holds TOKEN-HOP1, CONTINUE_WORK and TOKEN-HOP2-DONE), and the hop-2 byte
 * matched 160 ms after the journal's work-wake, before any hop-2 reply.
 *   - spawn: the parent's sessions_spawn toolResult, bound by toolCallId to the
 *     call whose task carries the nonce, answered "accepted" with a
 *     childSessionKey;
 *   - hop 1 / hop 2: the child's own rows on that key (subscribed live, and its
 *     transcript): TOKEN-HOP1 in assistant text, then, after a
 *     "[continuation:wake]" row or in another run, TOKEN-HOP2-DONE with a token
 *     the child mints in hop 2; no typed continue_work call in the child;
 *   - return: the parent reproducing that hop-2 token in a run other than the
 *     dispatch run.
 *
 * Repeatable mode: set OPENCLAW_CREATE_DISPOSABLE_SESSION=true to create a
 * disposable parent session. The parent session is instructed to call
 * sessions_spawn(lightContext=true, mode=run) for a child that emits the token.
 *
 * Required proof byte before PASS fold: hop-2 execution sentinel. Journal/Tempo
 * receipts are still expected for human review; this k6 scenario captures WS
 * session evidence and trace ids when surfaced.
 *
 * References:
 *   - Issue: karmaterminal/karmaterminal-openclaw-docs#118
 *   - Manifest: tools/k6-proofs/manifests/r-cw-token.json
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { gatewayLifecycleRunId } from '../lib/gateway-lifecycle.js';
import { tokenWorkHops } from '../lib/continue-work-chain.mjs';
import { createToolReceiptTracker, eventSessionKey, tokenReplyFromHistory, toolReceiptsFromHistory } from '../lib/sentinel-binding.mjs';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';

export const options = {
  scenarios: {
    r_cw_token_bracket: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '180s',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cw_token_duration: ['p(95)<150000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cw_token_duration');

const manifest = loadManifestFromEnv();
const DEFAULTS = {
  sessionKey: 'main',
  seat: 'cael-dgx',
  tokenDelaySeconds: 5,
  idempotencyKeyPrefix: 'R-CW-TOKEN',
  taskNamePrefix: 'r-cw-token',
};
const HARNESS_MARKER = '[k6-proof-harness]';

function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

function invocationCfg() {
  const inv = manifest?.invocation || {};
  return {
    tokenDelaySeconds: Number(inv.tokenDelaySeconds ?? __ENV.OPENCLAW_TOKEN_DELAY_SECONDS ?? DEFAULTS.tokenDelaySeconds),
    idempotencyKeyPrefix: inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix,
    taskNamePrefix: inv.taskNamePrefix || DEFAULTS.taskNamePrefix,
    lightContext: inv.lightContext !== false,
  };
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce = nonce('R-CW-TOKEN');

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
    row: 'R-CW-TOKEN',
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
    parent_dispatch_accepted: false,
    subagent_spawn_requested: false,
    subagent_spawn_accepted: false,
    token_emitted_or_stripped: false,
    hop_2_executed: false,
    parent_return: false,
    dispatch_accepted_at_ms: null,
    hop_2_at_ms: null,
    trace_id: null,
    child_session_key: null,
    spawn_receipt_status: null,
    spawn_receipt_source: null,
    child_subscribed: false,
    child_rows_seen: 0,
    child_history_reads: 0,
    child_typed_continue_work_observed: false,
    hop_reason: null,
    hop_2_token_fingerprint: null,
    parent_history_reads: 0,
    parent_return_reason: null,
    // Diagnostics only: sentinel text seen anywhere on the event stream.
    hop1_text_seen: false,
    hop2_text_seen: false,
    redacted_events: [],
  };

  const started = Date.now();

  const sentTexts = [];
  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    let spawnTracker = null;
    let dispatchRunId = null;
    let childKey = null;
    const childRows = [];
    let hop2Token = null;
    let hop2Timestamp = null;
    let childHistoryScheduled = false;
    let parentHistoryScheduled = false;
    let closing = false;
    const historyKeyById = {};

    function closeSoon() {
      if (closing) return;
      closing = true;
      socket.setTimeout(() => socket.close(), 1000);
    }

    function recordSpawn(receipts, source) {
      if (childKey || receipts.length === 0) return;
      if (receipts.length > 1) { evidence.spawn_receipt_status = 'ambiguous'; return; }
      const [receipt] = receipts;
      evidence.spawn_receipt_status = receipt.status;
      evidence.spawn_receipt_source = source;
      const key = typeof receipt.payload?.childSessionKey === 'string' ? receipt.payload.childSessionKey.trim() : '';
      if (receipt.isError || receipt.status !== 'accepted' || !key) return;
      if (receipt.runId) dispatchRunId = dispatchRunId || receipt.runId;
      childKey = key;
      evidence.subagent_spawn_accepted = true;
      evidence.child_session_key = key;
      console.log(`✓ sessions_spawn toolResult accepted with a childSessionKey (${source})`);
      tracker.send(socket, 'sessions.messages.subscribe', { key: childKey });
      requestChildHistory(250);
    }

    // The child's own rows decide hop 1 and hop 2; the parent stream never does.
    function evaluateChild(rows, source) {
      if (evidence.hop_2_executed) return;
      const hops = tokenWorkHops(rows, { nonce: rowNonce, hop1Marker: 'TOKEN-HOP1', hop2Marker: 'TOKEN-HOP2-DONE', sentTexts });
      if (hops.typedToolUsed) evidence.child_typed_continue_work_observed = true;
      evidence.hop_reason = hops.reason;
      if (hops.hop1Index >= 0 && !hops.typedToolUsed && !evidence.token_emitted_or_stripped) {
        evidence.token_emitted_or_stripped = true;
        console.log(`✓ child hop 1 said TOKEN-HOP1 with no typed continue_work call (${source})`);
      }
      if (hops.complete) {
        hop2Token = hops.token;
        hop2Timestamp = hops.tokenTimestamp;
        evidence.hop_2_executed = true;
        evidence.hop_2_at_ms = Date.now();
        evidence.hop_2_token_fingerprint = crypto.sha256(hops.token, 'hex').slice(0, 16);
        console.log(`✓ child hop 2 minted its token after the wake (${source})`);
        requestParentHistory(1000);
      }
    }

    function requestChildHistory(delayMs) {
      if (!childKey || childHistoryScheduled || evidence.hop_2_executed || evidence.child_history_reads >= 60) return;
      childHistoryScheduled = true;
      socket.setTimeout(() => {
        childHistoryScheduled = false;
        evidence.child_history_reads += 1;
        historyKeyById[tracker.send(socket, 'chat.history', { sessionKey: childKey, limit: 200 })] = childKey;
      }, k6TimeoutMs(delayMs));
    }

    function requestParentHistory(delayMs) {
      if (parentHistoryScheduled || evidence.parent_return || evidence.parent_history_reads >= 60) return;
      parentHistoryScheduled = true;
      socket.setTimeout(() => {
        parentHistoryScheduled = false;
        evidence.parent_history_reads += 1;
        historyKeyById[tracker.send(socket, 'chat.history', { sessionKey, limit: 200 })] = sessionKey;
      }, k6TimeoutMs(delayMs));
    }

    function onParentHistory(messages) {
      recordSpawn(toolReceiptsFromHistory(messages, { toolName: 'sessions_spawn', argField: 'task', needle: rowNonce }), 'chat.history');
      if (hop2Token) {
        const bound = tokenReplyFromHistory(messages, {
          marker: 'TOKEN-HOP2-RETURN',
          nonce: rowNonce,
          token: hop2Token,
          excludeRunIds: [dispatchRunId],
          notBeforeTimestamp: hop2Timestamp,
        });
        evidence.parent_return_reason = bound.reason;
        if (bound.bound) {
          evidence.parent_return = true;
          console.log('✓ the parent reproduced the hop-2 token outside the dispatch run');
          closeSoon();
          return;
        }
      }
      if (!childKey || hop2Token) requestParentHistory(4000);
    }

    function startProofFlow(socket) {
      tracker.send(socket, 'sessions.messages.subscribe', { key: sessionKey });

      socket.setTimeout(() => {
        const inv = invocationCfg();
        const taskName = `${inv.taskNamePrefix}-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
        const childTask =
          `k6 proof R-CW-TOKEN nonce ${rowNonce}. ` +
          `First turn: reply exactly TOKEN-HOP1 ${rowNonce}, then end your entire response with a bare CONTINUE_WORK:${inv.tokenDelaySeconds} token on its own final line. ` +
          `Do not call the continue_work tool. Do not wrap the token in brackets. ` +
          `On the continuation wake/hop-2, invent a fresh random token of exactly 12 lowercase letters and digits (make it up now; do not copy it from anywhere) and reply exactly TOKEN-HOP2-DONE ${rowNonce} TOKEN <your token>. ` +
          `Do not mutate files. Do not post externally.`;
        const agentInstruction =
          `${HARNESS_MARKER} Call sessions_spawn exactly once with runtime="subagent", mode="run", ` +
          `taskName="${taskName}", label="k6 R-CW-TOKEN ${rowNonce}", lightContext=${inv.lightContext ? 'true' : 'false'}, ` +
          `context="isolated", cleanup="delete", and task=${JSON.stringify(childTask)}. ` +
          `After the sessions_spawn tool result is accepted, reply exactly PARENT-SPAWNED ${rowNonce}. ` +
          `Later, if the child's hop-2 result reaches you, reply exactly TOKEN-HOP2-RETURN ${rowNonce} TOKEN <the TOKEN value from that result>. ` +
          `This is a proof run.`;
        sentTexts.push(childTask, agentInstruction);
        spawnTracker = createToolReceiptTracker({ sessionKey, toolName: 'sessions_spawn', argField: 'task', needle: rowNonce });
        evidence.subagent_spawn_requested = true;
        tracker.send(socket, 'sessions.send', {
          key: sessionKey,
          message: agentInstruction,
          idempotencyKey: `${inv.idempotencyKeyPrefix}-DISPATCH-${rowNonce}`,
        });
      }, 500);

      // Child run plus token delay may be slow on a busy seat; keep the socket up.
      socket.setTimeout(() => socket.close(), 150000);
    }

    socket.on('open', () => {
      socket.send(connectFrame(token));

      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cw-token-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          tracker.send(socket, 'sessions.create', {
            key: disposableKey,
            label: `k6 R-CW-TOKEN ${rowNonce}`,
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
            startProofFlow(socket);
          } else {
            console.error(`✗ sessions.create rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
            socket.close();
          }
        }

        if (classified.kind === 'response' && classified.method === 'sessions.send') {
          if (classified.ok) {
            evidence.parent_dispatch_accepted = true;
            evidence.dispatch_accepted_at_ms = Date.now();
            dispatchRunId = gatewayLifecycleRunId(classified.payload) || dispatchRunId;
            if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
            console.log('✓ sessions.send accepted — parent agent turn triggered');
            requestParentHistory(5000);
          } else {
            console.error(`✗ sessions.send rejected: ${JSON.stringify(classified.error)}`);
            failures.add(1);
          }
        }

        if (classified.kind === 'response' && classified.method === 'chat.history') {
          const messages = Array.isArray(classified.payload?.messages) ? classified.payload.messages : [];
          const historyKey = historyKeyById[msg.id] || null;
          delete historyKeyById[msg.id];
          if (!classified.ok) {
            if (historyKey === childKey) requestChildHistory(3000); else requestParentHistory(4000);
          } else if (historyKey === childKey) {
            evaluateChild(messages, 'child chat.history');
            if (!evidence.hop_2_executed) requestChildHistory(3000);
          } else {
            onParentHistory(messages);
          }
        }

        if (classified.kind === 'event') {
          const eventData = classified.data || {};
          const eventStr = JSON.stringify(eventData);
          const eventName = classified.event || '';
          if (eventData.traceId && eventStr.includes(rowNonce) && !evidence.trace_id) evidence.trace_id = eventData.traceId;
          // The parent's sessions_spawn toolResult, bound to its own call by toolCallId.
          if (spawnTracker) {
            const receipt = spawnTracker.observe(eventName, eventData);
            if (receipt) recordSpawn([receipt], 'session.message');
          }
          // The child's own rows, on the child key only.
          if (childKey && eventName === 'session.message' && eventSessionKey(eventData) === childKey && eventData.message) {
            childRows.push({ ...eventData.message, __openclaw: { ...(eventData.message.__openclaw || {}), runId: eventData.message.__openclaw?.runId || eventData.runId } });
            evidence.child_rows_seen = childRows.length;
            evaluateChild(childRows, 'child session.message');
          }
          // Diagnostics only.
          if (!eventStr.includes(HARNESS_MARKER)) {
            if (eventStr.includes(`TOKEN-HOP1 ${rowNonce}`)) evidence.hop1_text_seen = true;
            if (eventStr.includes(`TOKEN-HOP2-DONE ${rowNonce}`)) evidence.hop2_text_seen = true;
          }
        }

        if (evidence.parent_dispatch_accepted &&
            evidence.subagent_spawn_accepted &&
            evidence.token_emitted_or_stripped &&
            evidence.hop_2_executed &&
            evidence.parent_return) {
          console.log('All required R-CW-TOKEN evidence gathered, closing early');
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
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'parent dispatch accepted': () => evidence.parent_dispatch_accepted,
    'subagent spawn requested': () => evidence.subagent_spawn_requested,
    'subagent spawn accepted': () => evidence.subagent_spawn_accepted,
    'token turn observed': () => evidence.token_emitted_or_stripped,
    'hop-2 executed (required)': () => evidence.hop_2_executed,
    'parent return received': () => evidence.parent_return,
  });

  if (!evidence.parent_dispatch_accepted ||
      !evidence.subagent_spawn_requested ||
      !evidence.subagent_spawn_accepted ||
      !evidence.token_emitted_or_stripped ||
      !evidence.hop_2_executed ||
      !evidence.parent_return) {
    failures.add(1);
  }

  const passed = (!createDisposableSession || evidence.session_created) &&
    evidence.parent_dispatch_accepted &&
    evidence.subagent_spawn_requested &&
    evidence.subagent_spawn_accepted &&
    evidence.token_emitted_or_stripped &&
    evidence.hop_2_executed &&
    !evidence.child_typed_continue_work_observed &&
    evidence.parent_return;

  console.log(`\n--- R-CW-TOKEN EVIDENCE SUMMARY ---`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`--- END EVIDENCE ---`);
  console.log(`\n[R-CW-TOKEN] VERDICT: ${passed ? 'PASS-candidate' : 'PARTIAL-candidate'}`);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const passRate = data.metrics.proof_failures?.values?.count === 0;
  const summary = {
    row: 'R-CW-TOKEN',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp,
    verdict: passRate ? 'PASS-candidate' : 'PARTIAL-candidate',
    metrics: {
      duration_ms: data.metrics.r_cw_token_duration?.values || null,
      failures: data.metrics.proof_failures?.values?.count || 0,
    },
  };

  return {
    stdout: `\n[R-CW-TOKEN] Summary: ${summary.verdict} | SHA: ${summary.sha} | Seat: ${summary.seat}\n`,
    'r-cw-token-bracket-summary.json': JSON.stringify(summary, null, 2),
  };
}
