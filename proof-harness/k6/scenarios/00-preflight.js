// 00-preflight.js — Scenario 0: preflight inventory.
//
// GOAL (notes §"Scenario 0"): prove the harness can authenticate and that the
// target session exposes the expected continuation tools. This is the gate that
// classifies an absent tool as HONEST-LIMIT instead of blind-firing.
//
// Steps: WS connect (operator.read) → health → sessions.list → tools.effective
//        → check continue_work / continue_delegate / request_compaction
//        visibility → write a preflight receipt + per-tool label.
//
// RUN (read-only — safe, never fires a continuation):
//   OPENCLAW_GATEWAY_TOKEN=*** \
//   OPENCLAW_SESSION_KEY=main \
//   k6 run --summary-export=summary.json proof-harness/k6/scenarios/00-preflight.js
//
// ⚠️ method/tool names are from the design notes — verify against the deployed
//    SHA (tools.catalog probe) before a real proof run.

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import {
  env, connectFrame, send, requireToken, newRecorder, callOk, responseFor, onConnectChallenge,
} from '../lib/gateway.js';
import {
  classifyToolVisibility, rollup, INCONCLUSIVE, label,
} from '../lib/verdict.js';

export const options = {
  scenarios: {
    preflight: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '30s' },
  },
  thresholds: {
    // A connect failure or auth failure should fail the threshold so CI flags it.
    preflight_setup_failures: ['count==0'],
  },
};

const setupFailures = new Counter('preflight_setup_failures');
const CONTINUATION_TOOLS = ['continue_work', 'continue_delegate', 'request_compaction'];

// Module-scope so handleSummary can read the result the iteration produced.
let RESULT = null;

export default function () {
  const cfg = env();
  const meta = { scenario: 'preflight', row: 'preflight', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    setupFailures.add(1);
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'preflight', { reason: 'no-token' },
      'Set OPENCLAW_GATEWAY_TOKEN (harness setup), then re-run.')]);
    return;
  }

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    const ids = {};
    // CHALLENGE-FIRST (Cael FIX #1, VERIFIED-GATEWAY-SURFACE.md): do NOT send
    // connect on `open` — the live gateway pushes `connect.challenge` first and
    // rejects a raw connect-on-open. We gate the connect send on the challenge,
    // then stagger the read-only probes AFTER connect is accepted.
    const onChallenge = onConnectChallenge(
      { token: cfg.token, scopes: ['operator.read'] },
      () => {
        rec.note('connect', 'connect.challenge received → sent operator connect (operator.read)');
        // Staggered sends so responses can correlate before the next call.
        socket.setTimeout(() => { ids.health = send(socket, rec, 'health'); }, 400);
        socket.setTimeout(() => { ids.sessions = send(socket, rec, 'sessions.list'); }, 800);
        socket.setTimeout(() => {
          ids.tools = send(socket, rec, 'tools.effective', { sessionKey: cfg.sessionKey });
        }, 1300);
        // Give the gateway time to answer all three, then close.
        socket.setTimeout(() => socket.close(), 6000);
      },
    );

    socket.on('open', () => {
      // Wait for connect.challenge before sending connect (challenge-first).
      rec.note('open', 'ws open — awaiting connect.challenge before sending connect');
    });

    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (onChallenge(socket, msg)) return; // consumed the connect.challenge frame
      // Mark auth/connect success when we see the connect response ok.
      if (msg && msg.type === 'res' && msg.result && rec.facts.authOk === null) {
        // best-effort: first successful res implies handshake accepted
        rec.setFact('authOk', true);
        rec.setFact('connected', true);
      }
    });

    socket.on('error', (e) => {
      rec.note('error', `ws error: ${e && e.error ? e.error() : e}`);
      setupFailures.add(1);
    });
  });

  const connected = check(res, { 'preflight: websocket upgraded (101)': (r) => r && r.status === 101 });
  if (!connected) setupFailures.add(1);

  // ---- classify from buffered frames (after the socket closed) ----
  const steps = [];

  // health
  const healthOk = ids_present(rec, 'health') && callOk(rec, find(rec, 'health'));
  rec.note('health', `health call ok=${healthOk}`);

  // sessions.list → record the resolvable session keys we saw (for the manifest).
  const sessRes = responseFor(rec, find(rec, 'sessions.list'));
  if (sessRes) rec.setFact('receipts.sessionsListRaw', truncate(sessRes));

  // tools.effective → extract the tool list and check each continuation tool.
  const toolsRes = responseFor(rec, find(rec, 'tools.effective'));
  const visibleTools = extractToolNames(toolsRes);
  rec.setFact('receipts.effectiveToolNames', visibleTools);

  for (const t of CONTINUATION_TOOLS) {
    const visible = visibleTools.includes(t);
    rec.setFact(`toolsVisible.${t}`, visible);
    // request_compaction is allowed to be absent where policy disallows it —
    // note that nuance for the human; the label itself is HONEST-LIMIT either way.
    const ctx = `session '${cfg.sessionKey}'`;
    steps.push(classifyToolVisibility(t, visible, ctx));
  }

  if (!toolsRes) {
    steps.push(label(INCONCLUSIVE, 'preflight',
      { reason: 'no tools.effective response' },
      'tools.effective returned no response in the window. Verify the method name ' +
      'against the deployed SHA (could be tools.effective vs tools.catalog) and re-run.'));
  }

  RESULT = finalize(rec, cfg, steps);
}

// ---- helpers ----
function find(rec, method) {
  for (const id of Object.keys(rec.correlations)) {
    if (rec.correlations[id].method === method) return id;
  }
  return null;
}
function ids_present(rec, method) { return !!find(rec, method); }

function extractToolNames(res) {
  // Tolerant extraction: tools.effective shape isn't byte-verified. Accept
  //   result.tools = [{name}|"name"], result = [...], result.effective = [...]
  if (!res) return [];
  const r = res.result !== undefined ? res.result : res;
  const arr = Array.isArray(r) ? r : (r && (r.tools || r.effective || r.available)) || [];
  return (Array.isArray(arr) ? arr : []).map((x) => (typeof x === 'string' ? x : (x && (x.name || x.tool)))).filter(Boolean);
}

function truncate(obj, n = 2000) {
  const s = JSON.stringify(obj);
  return s.length > n ? s.slice(0, n) + '…[truncated]' : s;
}

function finalize(rec, cfg, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `preflight row candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta,
    rowCandidate: roll,
    facts: rec.facts,
    notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName },
    // frames are large; include count + the parsed responses only (no token ever present)
    frameCount: rec.frames.length,
  };
}

// handleSummary writes the row-shaped JSON the post-processor consumes.
// k6 calls this once at the end with the aggregated metrics; we attach RESULT.
export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness',
    scenario: 'preflight',
    generatedAt: new Date().toISOString(),
    k6Metrics: summarizeMetrics(data),
    result: RESULT,
    HUMAN_VERDICT_REQUIRED: true,
  };
  return {
    'summary.json': JSON.stringify(out, null, 2),
    stdout: renderText(out),
  };
}

function summarizeMetrics(data) {
  const m = data && data.metrics ? data.metrics : {};
  const pick = {};
  for (const k of Object.keys(m)) {
    const v = m[k];
    pick[k] = v && v.values ? v.values : v;
  }
  return pick;
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  const lines = [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: preflight',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    '   tool visibility:',
  ];
  const tv = out.result && out.result.facts ? out.result.facts.toolsVisible || {} : {};
  for (const t of Object.keys(tv)) lines.push(`     - ${t}: ${tv[t] ? 'VISIBLE' : 'ABSENT (classify per surface)'}`);
  lines.push('   (this k6 run does NOT finalize a verdict — it labels candidates)');
  lines.push('──────────────────────────────────────────────');
  return lines.join('\n') + '\n';
}
