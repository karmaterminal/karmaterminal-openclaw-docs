/**
 * Scenario: R-CD-3 — post-compaction lifeboat after an accepted request_compaction.
 *
 * In a disposable session (sessions.create must answer a key other than the
 * configured session, else nothing is sent; review F6):
 *   1. Fill: real prior turns of inert filler until the session's measured
 *      usage (fresh totalTokens / contextTokens from sessions.describe, the
 *      inputs request_compaction itself reads) passes the 70% threshold. No
 *      threshold is lowered and no config is touched; a fill that cannot get
 *      there within its turn and token budgets, or below the automatic
 *      compaction line, stops with the reason named. A falling total or a
 *      changed sessionId on the describe row stops it as a mid-fill
 *      compaction (review F7).
 *   2. Proof turn: stage continue_delegate(mode="post-compaction") with the
 *      lifeboat task, then call request_compaction.
 *   3. Receipts, all product records the agent cannot author
 *      (karmaterminal/openclaw-bootstrap#1727):
 *      - the continue_delegate and request_compaction toolResults, each bound
 *        to its own call by toolCallId;
 *      - the released lifeboat: a child whose own row names this session in
 *        spawnedBy and whose own spawn task starts with the product's
 *        "[continuation:post-compaction] [continuation:chain-hop:N] " release
 *        composition and carries the row token; a requester call whose
 *        arguments carry that prefix refuses the binding (review F4);
 *      - the lifeboat's report: a token it mints in its own transcript, absent
 *        from every harness-sent text;
 *      - the return: this session reproducing that token in a run other than
 *        the proof and fill runs, after the token.
 *   No sentinel is ever read from this session's event stream: at F′ that
 *   stream carried the agent's own continue_delegate call, whose task held the
 *   old return sentinel, and the row recorded a return that never happened.
 *
 * Verdicts (lib/r-cd-3-lifeboat.mjs classifyRcd3Evidence): PASS needs every
 * receipt above. An unknown or unmeasured request_compaction rejection is
 * PARTIAL with its own reason and never PASS; a measured below-threshold
 * rejection is a different PARTIAL reason. Expected PARTIAL cause (review N3):
 * the fill's sessions.describe denominator can be a provenance-checked
 * minimum (context-token-provenance.ts:50-108) while request_compaction
 * divides by the raw entry.contextTokens (agent-runner-post-compaction-release.ts
 * :149-170), so a fill that reads as reached can still meet a measured
 * below-threshold rejection.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import { createChildObserver, createPreflightGate, failClosedVerdict } from '../lib/child-observer.mjs';
import { renderRowTaskTemplate } from '../lib/row-child-correlation.mjs';
import { gatewayLifecyclePhase, gatewayLifecycleRunId } from '../lib/gateway-lifecycle.js';
import { createToolReceiptTracker, eventSessionKey, requesterCallTexts } from '../lib/sentinel-binding.mjs';
import {
  COMPACTION_RESERVE_FLOOR_TOKENS,
  COMPACTION_THRESHOLD,
  DEFAULT_FILL_BUDGET_TOKENS,
  DEFAULT_FILL_CEILING,
  DEFAULT_FILL_MAX_TURNS,
  DEFAULT_FILL_TARGET,
  FILL_CALIBRATION_CHARS,
  FILL_INITIAL_TOKENS_PER_CHAR,
  classifyRcd3Evidence,
  compactionOutcome,
  compactionReceiptsFromHistory,
  fillerText,
  isReleasedLifeboatTask,
  lifeboatReport,
  measuredSessionUsage,
  parentReturn,
  planFillStep,
  rcd3TaskIdentityToken,
  requesterPrefixCall,
  stagingOutcome,
  stagingReceiptsFromHistory,
  summaryRcd3Verdict,
} from '../lib/r-cd-3-lifeboat.mjs';
import { k6TimeoutMs } from '../lib/k6-timeout.mjs';

export const options = {
  scenarios: {
    r_cd_3_post_compaction: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '20m',
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    r_cd_3_duration: ['p(95)<1150000'],
  },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_3_duration');
const manifest = loadManifestFromEnv();
const HARNESS_MARKER = '[k6-proof-harness]';
const DEFAULT_LIFEBOAT_TEMPLATE =
  'RCD3:{{nonceSuffix16}} R-CD-3 post-compaction lifeboat nonce {{nonce}}: when you run, invent a fresh random token of exactly 12 lowercase letters and digits (make it up now; do not copy it from anywhere) and reply exactly RCD3-LIFEBOAT {{nonce}} TOKEN <your token>. Requester: when this lifeboat result reaches you, reply exactly RCD3-PARENT-RETURN {{nonce}} TOKEN <the TOKEN value from this result>. Do not mutate files.';
const MAX_REDACTED_EVENTS = 400;
let finalEvidence = null;

function boolEnv(name, fallback = false) {
  const value = (__ENV[name] || '').toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function numberEnv(name, fallback) {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function fingerprint(value) {
  return crypto.sha256(String(value), 'hex').slice(0, 16);
}

/** The configured session, by its own key or as the canonical `agent:<id>:<key>` of a bare one. */
function isConfiguredSession(key, configured) {
  if (!configured) return false;
  return key === configured || (!configured.includes(':') && key.endsWith(`:${configured}`));
}

export default function () {
  const url = __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey = manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || 'main';
  let sessionKey = requestedSessionKey;
  const createDisposableSession = boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS', true);
  const seat = manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx';
  const rowNonce = nonce('R-CD-3');
  const taskToken = rcd3TaskIdentityToken(rowNonce);
  const fillTarget = Math.max(COMPACTION_THRESHOLD + 0.01, Math.min(DEFAULT_FILL_CEILING - 0.02, numberEnv('OPENCLAW_RCD3_FILL_TARGET', DEFAULT_FILL_TARGET)));
  const fillBudgetTokens = numberEnv('OPENCLAW_RCD3_FILL_BUDGET_TOKENS', DEFAULT_FILL_BUDGET_TOKENS);
  const fillMaxTurns = numberEnv('OPENCLAW_RCD3_FILL_MAX_TURNS', DEFAULT_FILL_MAX_TURNS);
  const fillTurnTimeoutMs = numberEnv('OPENCLAW_RCD3_FILL_TURN_TIMEOUT_MS', 300000);
  // A seat that configures a compaction reserve above the 20,000 floor declares it here; it only lowers the fill's cap.
  const compactionReserveTokens = numberEnv('OPENCLAW_RCD3_COMPACTION_RESERVE_TOKENS', COMPACTION_RESERVE_FLOOR_TOKENS);
  const socketTimeoutMs = numberEnv('OPENCLAW_RCD3_SOCKET_TIMEOUT_MS', 1080000);

  if (!token) {
    console.error('OPENCLAW_GATEWAY_TOKEN is required');
    failures.add(1);
    return;
  }
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const lifeboatTask = renderRowTaskTemplate(manifest?.invocation?.promptTemplate || DEFAULT_LIFEBOAT_TEMPLATE, rowNonce);
  const compactionReason = `R-CD-3 k6 proof nonce ${rowNonce}: compact this session after staging the post-compaction lifeboat.`;
  const evidence = {
    row: 'R-CD-3',
    manifest_loaded: !!manifest,
    nonce: rowNonce,
    task_identity_token: taskToken,
    seat,
    requestedSessionKey,
    sessionKey,
    session_created: false,
    created_session_key: null,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    started: new Date().toISOString(),
    // Fill: real prior turns until measured usage passes the threshold.
    fill_target: fillTarget,
    fill_budget_tokens: fillBudgetTokens,
    fill_max_turns: fillMaxTurns,
    fill_turns: [],
    fill_reached: false,
    fill_measured_usage: null,
    fill_context_tokens: null,
    fill_compaction_reserve_tokens: compactionReserveTokens,
    fill_stop_reason: null,
    // Proof turn and its authoritative receipts.
    proof_dispatched: false,
    dispatch_accepted: false,
    staging_receipt_observed: false,
    staging_receipt_status: null,
    staging_receipt_source: null,
    compaction_outcome_kind: null,
    compaction_receipt_status: null,
    compaction_receipt_guard: null,
    compaction_context_usage: null,
    compaction_threshold: null,
    compaction_receipt_source: null,
    // The released lifeboat and its return.
    lifeboat_child_observed: false,
    lifeboat_child_session_key: null,
    lifeboat_child_status: null,
    lifeboat_identity_conflict: false,
    lifeboat_identity_reason: null,
    requester_prefix_call: null,
    lifeboat_report_bound: false,
    lifeboat_report_reason: null,
    lifeboat_token_fingerprint: null,
    parent_return_bound: false,
    parent_return_reason: null,
    parent_history_reads: 0,
    lifeboat_history_reads: 0,
    trace_id: null,
    // Fingerprint of the staged lifeboat task (#600). The product releases a
    // lifeboat without a continuation.delegate.dispatch span (openclaw#1497),
    // so no Tempo trace carries it; the collector stays fail-closed on it.
    reason_hash: null,
    reason_length: null,
    delegate_mode: null,
    preflight: null,
    verdict_reason: null,
    redacted_events: [],
    redacted_events_dropped: 0,
  };
  const started = Date.now();
  const gate = createPreflightGate('R-CD-3');
  const observer = createChildObserver({ rootSessionKey: () => sessionKey });
  // Every text the harness sends, and the requester's own staging arguments; a token found in any of them is not minted by the lifeboat.
  const sentTexts = [lifeboatTask, compactionReason];

  const res = ws.connect(url, {}, (socket) => {
    const tracker = new RequestTracker();
    const purposes = {};
    let finished = false;
    let fillTurn = 0;
    let fillRun = null;
    let fillEnded = false;
    let fillLifecycleEnded = false;
    let fillMeasureInFlight = false;
    let fillStartedAt = 0;
    let previousTotal = null;
    let fillSessionId = null;
    let filledTokens = 0;
    let tokensPerChar = FILL_INITIAL_TOKENS_PER_CHAR;
    const excludedRunIds = [];
    let dispatchRunId = null;
    let stagingTracker = null;
    let compactionTracker = null;
    let observing = false;
    let lifeboatToken = null;
    let lifeboatTokenTimestamp = null;
    let parentHistoryScheduled = false;
    let lifeboatHistoryScheduled = false;
    // The requester's own bound continue_delegate arguments (review F2).
    const requesterCalls = [];

    function send(purpose, method, params) {
      const id = tracker.send(socket, method, params);
      purposes[id] = purpose;
      return id;
    }

    function finish(reason) {
      if (finished) return;
      finished = true;
      if (reason) console.log(`R-CD-3 closing: ${reason}`);
      socket.setTimeout(() => socket.close(), 1000);
    }

    function stopFill(reason) {
      evidence.fill_stop_reason = reason;
      console.error(`✗ R-CD-3 context fill stopped: ${reason}`);
      finish('fill stopped before the proof turn');
    }

    // ---- 1. Fill --------------------------------------------------------
    // A fill turn has ended once the session's fresh total has grown past the
    // previous turn's (a brand-new session reads 0). The fill run's lifecycle
    // end prompts a read; a periodic read covers a missed lifecycle event.
    function sendFill(chars) {
      fillTurn += 1;
      fillRun = null;
      fillEnded = false;
      fillMeasureInFlight = false;
      fillStartedAt = Date.now();
      const header =
        `${HARNESS_MARKER} R-CD-3 context fill ${fillTurn} for nonce ${rowNonce}. ` +
        'The block below is inert filler that raises this disposable session\'s measured context for a compaction proof. ' +
        'Do not summarize it and do not call tools. Reply with the single word: ok';
      sentTexts.push(header);
      const message = `${header}\n\n${fillerText(`${rowNonce}:${fillTurn}`, chars)}`;
      evidence.fill_turns.push({ turn: fillTurn, chars, total_tokens: null, context_tokens: null, usage: null });
      send(`fill-${fillTurn}`, 'sessions.send', {
        key: sessionKey,
        message,
        idempotencyKey: `R-CD-3-FILL-${fillTurn}-${rowNonce}`,
      });
      const turn = fillTurn;
      const poll = () => {
        if (finished || turn !== fillTurn || fillEnded) return;
        measureFill();
        socket.setTimeout(poll, k6TimeoutMs(10000));
      };
      socket.setTimeout(poll, k6TimeoutMs(10000));
    }

    function measureFill() {
      if (fillMeasureInFlight || fillEnded) return;
      fillMeasureInFlight = true;
      send('fill-measure', 'sessions.describe', { key: sessionKey });
    }

    function onFillMeasured(row) {
      fillMeasureInFlight = false;
      if (fillEnded) return;
      const m = measuredSessionUsage(row);
      // Compaction can rotate the session id; the row projects no compaction counter.
      if (m.sessionId && fillSessionId && m.sessionId !== fillSessionId) {
        stopFill('the session was compacted during the fill (its sessionId changed on the describe row)');
        return;
      }
      if (m.sessionId) fillSessionId = m.sessionId;
      if (m.measured && previousTotal !== null && m.totalTokens < previousTotal) {
        stopFill(`the session was compacted during the fill (total fell from ${previousTotal} to ${m.totalTokens})`);
        return;
      }
      const updated = m.measured && m.totalTokens > (previousTotal ?? 0);
      if (!updated) {
        if (Date.now() - fillStartedAt >= fillTurnTimeoutMs) {
          stopFill(m.measured
            ? `fill turn ${fillTurn} did not raise the measured total (${m.totalTokens}) within ${fillTurnTimeoutMs} ms`
            : `fill turn ${fillTurn}: ${m.reason}`);
        } else if (fillLifecycleEnded) {
          // The turn ended; turn-end accounting may land a moment later.
          socket.setTimeout(measureFill, k6TimeoutMs(1500));
        }
        return;
      }
      fillEnded = true;
      fillLifecycleEnded = false;
      const record = evidence.fill_turns[evidence.fill_turns.length - 1];
      record.total_tokens = m.totalTokens;
      record.context_tokens = m.contextTokens;
      record.usage = m.usage;
      evidence.fill_measured_usage = m.usage;
      evidence.fill_context_tokens = m.contextTokens;
      if (previousTotal !== null) {
        const grew = m.totalTokens - previousTotal;
        filledTokens += grew;
        if (record.chars > 0 && grew > 0) tokensPerChar = grew / record.chars;
      } else {
        // The first total also holds the system prompt; count the filler at a typical rate.
        filledTokens += Math.round(record.chars * 0.25);
      }
      previousTotal = m.totalTokens;
      const step = planFillStep({
        measurement: m,
        turnsUsed: fillTurn,
        filledTokens,
        tokensPerChar,
        target: fillTarget,
        budgetTokens: fillBudgetTokens,
        maxTurns: fillMaxTurns,
        reserveTokens: compactionReserveTokens,
      });
      console.log(`ℹ R-CD-3 fill ${fillTurn}: measured usage ${(m.usage * 100).toFixed(1)}% of ${m.contextTokens} → ${step.action}`);
      if (step.action === 'done') {
        evidence.fill_reached = true;
        sendProof();
      } else if (step.action === 'fill') {
        sendFill(step.chars);
      } else {
        stopFill(step.reason);
      }
    }

    // ---- 2. Proof turn --------------------------------------------------
    function sendProof() {
      evidence.reason_hash = crypto.sha256(lifeboatTask, 'hex').slice(0, 16);
      evidence.reason_length = lifeboatTask.length;
      evidence.delegate_mode = 'post-compaction';
      stagingTracker = createToolReceiptTracker({ sessionKey, toolName: 'continue_delegate', argField: 'task', needle: taskToken });
      compactionTracker = createToolReceiptTracker({ sessionKey, toolName: 'request_compaction', argField: 'reason', needle: rowNonce });
      const instruction =
        `${HARNESS_MARKER} R-CD-3 nonce ${rowNonce}. ` +
        `First call continue_delegate with mode="post-compaction", delaySeconds=0, task=${JSON.stringify(lifeboatTask)}. ` +
        `Then call request_compaction with reason=${JSON.stringify(compactionReason)}. ` +
        'Then reply with one line naming the status each tool returned. No config changes, no files.';
      sentTexts.push(instruction);
      evidence.proof_dispatched = true;
      send('proof', 'sessions.send', { key: sessionKey, message: instruction, idempotencyKey: `R-CD-3-${rowNonce}` });
    }

    function recordStaging(receipts, source) {
      for (const receipt of receipts) {
        if (!requesterCalls.some((call) => call.id === receipt.toolCallId)) requesterCalls.push({ id: receipt.toolCallId, args: receipt.args });
      }
      if (evidence.staging_receipt_observed) return;
      const staging = stagingOutcome(receipts);
      if (!receipts.length) return;
      evidence.staging_receipt_status = staging.status;
      evidence.staging_receipt_source = source;
      if (staging.staged) {
        evidence.staging_receipt_observed = true;
        console.log(`✓ continue_delegate toolResult queued-for-compaction (${source})`);
      }
    }

    function recordCompaction(receipts, source) {
      if (!receipts.length || (evidence.compaction_outcome_kind && evidence.compaction_outcome_kind !== 'missing')) return;
      const outcome = compactionOutcome(receipts);
      evidence.compaction_outcome_kind = outcome.kind;
      evidence.compaction_receipt_status = outcome.status ?? null;
      evidence.compaction_receipt_guard = outcome.guard ?? null;
      evidence.compaction_context_usage = outcome.contextUsage;
      evidence.compaction_threshold = outcome.threshold;
      evidence.compaction_receipt_source = source;
      console.log(`✓ request_compaction toolResult bound to the row call: ${outcome.kind} (${source})`);
      if (outcome.kind === 'accepted') {
        startLifeboatObservation();
      } else {
        // Nothing will be released on this run; keep the socket long enough for the staging receipt.
        socket.setTimeout(() => finish(`request_compaction answered ${outcome.kind}`), k6TimeoutMs(5000));
      }
    }

    function scheduleParentHistory(delayMs) {
      if (finished || parentHistoryScheduled) return;
      parentHistoryScheduled = true;
      socket.setTimeout(() => {
        parentHistoryScheduled = false;
        if (finished) return;
        evidence.parent_history_reads += 1;
        send('parent-history', 'chat.history', { sessionKey, limit: 200 });
      }, k6TimeoutMs(delayMs));
    }

    // Any requester call carrying the post-compaction prefix refuses the lifeboat binding.
    function noteRequesterRow(message, source) {
      if (evidence.requester_prefix_call) return;
      const call = requesterPrefixCall(message);
      if (!call) return;
      evidence.requester_prefix_call = { ...call, source };
      console.error(`✗ a requester ${call.tool} call carried the post-compaction prefix (${source}); the lifeboat cannot be bound`);
    }

    function onParentHistory(messages) {
      for (const message of messages) noteRequesterRow(message, 'chat.history');
      recordStaging(stagingReceiptsFromHistory(messages, taskToken), 'chat.history');
      recordCompaction(compactionReceiptsFromHistory(messages, rowNonce), 'chat.history');
      if (lifeboatToken) {
        const bound = parentReturn(messages, {
          rowNonce,
          token: lifeboatToken,
          excludeRunIds: [dispatchRunId, ...excludedRunIds],
          tokenTimestamp: lifeboatTokenTimestamp,
        });
        evidence.parent_return_reason = bound.reason;
        if (bound.bound) {
          evidence.parent_return_bound = true;
          console.log('✓ requester reproduced the lifeboat token outside the proof and fill runs');
          finish('every R-CD-3 receipt is bound');
          return;
        }
      }
      if (!evidence.compaction_outcome_kind || evidence.compaction_outcome_kind === 'accepted') scheduleParentHistory(4000);
    }

    // ---- 3. The released lifeboat ---------------------------------------
    function startLifeboatObservation() {
      if (observing) return;
      observing = true;
      const poll = () => {
        if (finished || evidence.lifeboat_child_observed) return;
        observer.poll();
        socket.setTimeout(poll, k6TimeoutMs(5000));
      };
      socket.setTimeout(poll, k6TimeoutMs(3000));
    }

    function resolveLifeboat() {
      if (evidence.lifeboat_child_observed || evidence.lifeboat_identity_conflict || evidence.requester_prefix_call) return;
      const bound = observer.boundChild(rowNonce, taskToken ? [taskToken] : []);
      if (bound.ambiguous) {
        evidence.lifeboat_identity_conflict = true;
        evidence.lifeboat_identity_reason = 'more than one child is bound to the row (observer)';
        finish('lifeboat identity conflict');
        return;
      }
      if (!bound.childSessionKey) return;
      const record = observer.record(bound.childSessionKey);
      if (!isReleasedLifeboatTask(record?.task, taskToken)) return;
      evidence.lifeboat_child_observed = true;
      evidence.lifeboat_child_session_key = bound.childSessionKey;
      evidence.lifeboat_child_status = observer.childStatus(bound.childSessionKey);
      console.log('✓ released lifeboat child observed (own spawnedBy + own post-compaction spawn task)');
      scheduleLifeboatHistory(500);
    }

    function scheduleLifeboatHistory(delayMs) {
      if (finished || lifeboatHistoryScheduled || lifeboatToken || evidence.lifeboat_history_reads >= 40) return;
      lifeboatHistoryScheduled = true;
      socket.setTimeout(() => {
        lifeboatHistoryScheduled = false;
        if (finished) return;
        evidence.lifeboat_history_reads += 1;
        if (!observer.refreshHistory(evidence.lifeboat_child_session_key, 100, 'lifeboat')) scheduleLifeboatHistory(3000);
      }, k6TimeoutMs(delayMs));
    }

    function onLifeboatHistory(messages) {
      // Absent from the requester's own staging call arguments too (review F2).
      const calls = [...requesterCalls, ...(stagingTracker ? stagingTracker.calls() : [])];
      for (const text of requesterCallTexts(calls)) if (!sentTexts.includes(text)) sentTexts.push(text);
      const report = lifeboatReport(messages, { rowNonce, sentTexts });
      evidence.lifeboat_report_reason = report.reason;
      if (!report.token) {
        scheduleLifeboatHistory(3000);
        return;
      }
      lifeboatToken = report.token;
      lifeboatTokenTimestamp = report.timestamp;
      evidence.lifeboat_report_bound = true;
      evidence.lifeboat_token_fingerprint = fingerprint(report.token);
      console.log('✓ lifeboat minted its token in its own transcript');
      scheduleParentHistory(1000);
    }

    // ---- connection -----------------------------------------------------
    function afterHello() {
      if (createDisposableSession) {
        socket.setTimeout(() => {
          const disposableKey = `r-cd-3-${rowNonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          send('create', 'sessions.create', { key: disposableKey, label: `k6 R-CD-3 ${rowNonce}` });
        }, 250);
      } else {
        socket.setTimeout(startFlow, 500);
      }
    }

    function startFlow() {
      if (!createDisposableSession) {
        // The fill and the compaction it unlocks change the session they run in.
        // OPENCLAW_CREATE_DISPOSABLE_SESSIONS (plural, default true) is the switch;
        // OPENCLAW_CREATE_DISPOSABLE_SESSION=true also enables, but =false alone does not disable (review N11).
        stopFill('the measured fill runs only in a disposable session (OPENCLAW_CREATE_DISPOSABLE_SESSIONS=false)');
        return;
      }
      send('subscribe', 'sessions.messages.subscribe', { key: sessionKey });
      socket.setTimeout(() => sendFill(FILL_CALIBRATION_CHARS), 500);
      socket.setTimeout(() => {
        if (!evidence.proof_dispatched && !evidence.fill_stop_reason) evidence.fill_stop_reason = 'the run ended before the fill finished';
        socket.close();
      }, k6TimeoutMs(socketTimeoutMs));
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
          console.error(`✗ R-CD-3 preflight refused before dispatch: ${gate.result.reason}`);
          socket.close();
          return;
        }
        if (preflight === 'ready') afterHello();
        const observed = observer.claim(msg);
        const purpose = msg && msg.type === 'res' ? purposes[msg.id] || null : null;
        const classified = tracker.classify(msg);
        if (evidence.redacted_events.length < MAX_REDACTED_EVENTS) {
          evidence.redacted_events.push({
            ts: Date.now(),
            kind: classified.kind,
            method: classified.method || null,
            event: classified.event || null,
            ok: classified.ok !== undefined ? classified.ok : null,
            data: classified.payload ? redactEvent(classified.payload) : null,
          });
        } else {
          evidence.redacted_events_dropped += 1;
        }

        if (observed) {
          const messages = observer.handle(observed, classified);
          if (observed.purpose === 'lifeboat' && Array.isArray(messages)) onLifeboatHistory(messages);
          if (observer.failClosedReason()) {
            finish('child observation refused or incomplete');
            return;
          }
          resolveLifeboat();
          return;
        }

        if (classified.kind === 'response') {
          if (purpose === 'create') {
            // Review F6 (mirrors R-CD-TOKEN): the fill and the proof go only to a created
            // key distinct from the configured session; anything else sends nothing.
            const createdKey = classified.ok && typeof classified.payload?.key === 'string' ? classified.payload.key.trim() : '';
            if (createdKey && !isConfiguredSession(createdKey, requestedSessionKey)) {
              sessionKey = createdKey;
              evidence.sessionKey = sessionKey;
              evidence.session_created = true;
              evidence.created_session_key = sessionKey;
              console.log(`✓ disposable session created: ${sessionKey}`);
              startFlow();
            } else {
              const reason = !classified.ok
                ? `sessions.create rejected: ${JSON.stringify(classified.error)}`
                : !createdKey
                  ? 'sessions.create answered no session key; the fill would fall back to the configured session'
                  : `sessions.create answered the configured session ${requestedSessionKey}, not a disposable one`;
              evidence.fill_stop_reason = reason;
              console.error(`✗ ${reason}`);
              failures.add(1);
              socket.close();
            }
          } else if (purpose && purpose.startsWith('fill-') && purpose !== 'fill-measure') {
            if (classified.ok) {
              fillRun = gatewayLifecycleRunId(classified.payload);
              // A fill run without an id stays in the list as null: the return then
              // cannot be proven outside it and binds nothing (review F5).
              excludedRunIds.push(fillRun || null);
            } else {
              stopFill(`fill turn ${fillTurn} was rejected: ${JSON.stringify(classified.error)}`);
            }
          } else if (purpose === 'fill-measure') {
            if (classified.ok) onFillMeasured(classified.payload?.session || null);
            else stopFill(`sessions.describe was rejected: ${JSON.stringify(classified.error)}`);
          } else if (purpose === 'proof') {
            if (classified.ok) {
              evidence.dispatch_accepted = true;
              dispatchRunId = gatewayLifecycleRunId(classified.payload);
              if (classified.payload?.traceId) evidence.trace_id = classified.payload.traceId;
              console.log('✓ sessions.send accepted — R-CD-3 proof turn triggered');
              scheduleParentHistory(5000);
            } else {
              console.error(`✗ proof sessions.send rejected: ${JSON.stringify(classified.error)}`);
              failures.add(1);
              finish('proof turn rejected');
            }
          } else if (purpose === 'parent-history') {
            if (classified.ok) onParentHistory(Array.isArray(classified.payload?.messages) ? classified.payload.messages : []);
            else scheduleParentHistory(4000);
          }
          return;
        }

        if (classified.kind === 'event') {
          const eventName = classified.event || '';
          const eventData = classified.data || {};
          // Fill turn end: the fill run's own lifecycle end.
          if (eventName === 'agent' && fillRun && !fillEnded && !fillLifecycleEnded &&
              gatewayLifecycleRunId(eventData) === fillRun && gatewayLifecyclePhase(eventData) === 'end') {
            fillLifecycleEnded = true;
            socket.setTimeout(measureFill, k6TimeoutMs(750));
          }
          if (eventName === 'session.message' && eventSessionKey(eventData) === sessionKey) noteRequesterRow(eventData.message, 'session.message');
          // Authoritative toolResults on the live stream, bound by toolCallId.
          if (stagingTracker) {
            const receipt = stagingTracker.observe(eventName, eventData);
            if (receipt) recordStaging([receipt], 'session.message');
          }
          if (compactionTracker) {
            const receipt = compactionTracker.observe(eventName, eventData);
            if (receipt) recordCompaction(compactionTracker.receipts(), 'session.message');
          }
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
  evidence.preflight = gate.result;
  Object.assign(evidence, observer.summary());
  if (evidence.lifeboat_child_session_key) evidence.lifeboat_child_status = observer.childStatus(evidence.lifeboat_child_session_key);
  const outcome = classifyRcd3Evidence(evidence);
  const finalVerdict = failClosedVerdict(outcome.verdict, { gate, observer });
  evidence.verdict = finalVerdict.verdict;
  evidence.verdict_reason = finalVerdict.reason || outcome.reason;
  finalEvidence = evidence;
  duration.add(evidence.duration_ms);

  check(res, { 'websocket connected': (r) => r && r.status === 101 });
  check(null, {
    'measured context fill reached the threshold': () => evidence.fill_reached,
    'proof turn accepted': () => evidence.dispatch_accepted,
    'continue_delegate staging receipt bound': () => evidence.staging_receipt_observed,
    'request_compaction accepted (bound toolResult)': () => evidence.compaction_outcome_kind === 'accepted',
    'released lifeboat child observed': () => evidence.lifeboat_child_observed,
    'lifeboat report bound in its own transcript': () => evidence.lifeboat_report_bound,
    'return bound by the requester reproducing the lifeboat token': () => evidence.parent_return_bound,
  });
  if (evidence.verdict !== 'PASS-candidate') failures.add(1);

  console.log('\n--- R-CD-3 EVIDENCE SUMMARY ---');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('--- END EVIDENCE ---');
  console.log(`\n[R-CD-3] VERDICT: ${evidence.verdict}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const summary = {
    row: 'R-CD-3',
    sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    seat: __ENV.OPENCLAW_SEAT_NAME || 'cael-dgx',
    timestamp: new Date().toISOString(),
    verdict: summaryRcd3Verdict(finalEvidence),
    evidence: finalEvidence,
    metrics: {
      failures: failuresCount,
      duration_ms: data.metrics.r_cd_3_duration?.values || null,
    },
  };
  return { 'r-cd-3-summary.json': JSON.stringify(summary, null, 2) };
}
