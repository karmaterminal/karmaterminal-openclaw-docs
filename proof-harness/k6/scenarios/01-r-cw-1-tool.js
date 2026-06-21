// 01-r-cw-1-tool.js — Scenario 1: R-CW-1 typed continue_work() smoke.
//
// GOAL (notes §"Scenario 1", spec §test-1): fire a same-session continuation
// request through the gateway and observe a successor turn + chain correlation,
// capturing the trace id. PASS-candidate = tool accepted + a follow-up turn +
// same chain/run correlation + trace artifact present. ERRONEOUS = 0 turns or >1.
//
// ⚠️ THIS SCENARIO FIRES A REAL CONTINUATION. It is gated behind SAFE_TO_FIRE=1.
//    A bare `k6 run` will NOT invoke the tool (it preflights + records a setup
//    note and exits). This protects the live gateway during scaffold/dev.
//
// RUN (only when you intend to fire, on a quiet seat deployed at CANDIDATE_SHA):
//   SAFE_TO_FIRE=1 OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=main \
//   PROOF_NONCE=cw1-$(date +%s) CANDIDATE_SHA=<sha> SEAT_NAME=elliott-legion \
//   k6 run --summary-export=summary.json proof-harness/k6/scenarios/01-r-cw-1-tool.js
//
// The fire path is the TYPED TOOL (tools.invoke). Its both-forms sibling is the
// TOKEN form in 02-r-cw-token.js — they are INDEPENDENT code paths; both rows
// are mandatory (BOTH-FORMS MANDATE).

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder, callOk, responseFor } from '../lib/gateway.js';
import { classifyContinueWorkTool, rollup, label, INCONCLUSIVE, LIMIT } from '../lib/verdict.js';

export const options = {
  scenarios: {
    r_cw_1_tool: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '2m' },
  },
  thresholds: {
    proof_failures: ['count==0'],          // explicit gateway errors
    proof_row_duration: ['p(95)<120000'],
  },
};

const failures = new Counter('proof_failures');
let RESULT = null;

export default function () {
  const cfg = env();
  const meta = { scenario: 'r_cw_1_tool', row: 'R-CW-1', form: 'tool', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'R-CW-1', { reason: 'no-token' }, 'Set token.')]);
    return;
  }

  // SAFETY GATE: refuse to fire unless explicitly enabled.
  if (!cfg.safeToFire) {
    rec.note('safety', 'SAFE_TO_FIRE!=1 — refusing to invoke continue_work. ' +
      'This is the scaffold-safe default. Re-run with SAFE_TO_FIRE=1 on a quiet seat to actually fire.');
    RESULT = finalize(rec, cfg, [label(LIMIT, 'R-CW-1',
      { reason: 'safety-gate-closed', safeToFire: false },
      'Harness safety gate prevented the fire (by design). Not a SUT verdict.')]);
    return;
  }

  const fire = { accepted: null, successorTurnObserved: false, chainCorrelated: false, traceId: null };
  let fireId = null;
  let chainHints = [];

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      // operator.write needed to invoke.
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      rec.note('connect', 'sent operator connect (read+write)');

      // Subscribe to the target session's messages/events BEFORE firing, so we
      // don't miss the successor turn. (subscribe method name: verify vs SHA.)
      socket.setTimeout(() => {
        send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey });
        rec.note('subscribe', `subscribed to messages for ${cfg.sessionKey}`);
      }, 500);

      // Fire the typed continue_work via tools.invoke.
      socket.setTimeout(() => {
        const idem = `R-CW-1/${cfg.candidateSha}/${cfg.seatName}/${cfg.nonce}`;
        fireId = send(socket, rec, 'tools.invoke', {
          name: 'continue_work',
          sessionKey: cfg.sessionKey,
          args: { delaySeconds: 1, reason: `k6 proof R-CW-1 typed continue_work nonce ${cfg.nonce}` },
          idempotencyKey: idem,
        }, 'fire');
        rec.note('fire', `invoked continue_work (idem=${idem}, nonce=${cfg.nonce})`);
      }, 1200);

      // Observe window: wait for the successor turn to begin. continue_work
      // delaySeconds=1 means hop-2 should arm ~1s after the current turn ends;
      // we hold the socket open long enough to catch the successor-turn events.
      socket.setTimeout(() => socket.close(), 90000);
    });

    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);

      // Capture the fire response → accepted? trace id?
      if (msg.type === 'res' && fireId && msg.id === fireId) {
        fire.accepted = msg.ok === true || (msg.result !== undefined && !msg.error);
        const tid = deepFindTraceId(msg);
        if (tid) { fire.traceId = tid; rec.setFact('receipts.traceId', tid); }
      }

      // Heuristic successor-turn + chain detection from event frames. We look
      // for run/turn-start events carrying our session key AFTER the fire, and
      // any chain/continuation correlation id. (Exact event envelope: verify
      // vs deployed SHA; this matches loosely on common field names.)
      const blob = JSON.stringify(msg);
      if (fire.accepted && /turn|run|continuation/i.test(blob) && blob.includes(cfg.sessionKey)) {
        if (/continuation|chain|continue_work|work-(drive|dispatch)/i.test(blob)) {
          fire.successorTurnObserved = true;
          const chainId = (blob.match(/continuation-[0-9a-f]+/) || [])[0]
            || (msg.params && (msg.params.chainId || msg.params.runId)) || null;
          if (chainId) { fire.chainCorrelated = true; chainHints.push(chainId); rec.setFact('receipts.chainId', chainId); }
        }
      }
    });

    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  check(res, { 'R-CW-1: websocket upgraded (101)': (r) => r && r.status === 101 });

  rec.setFact('fired.continue_work_tool', { ok: fire.accepted, traceId: fire.traceId });
  rec.note('observe', `successorTurnObserved=${fire.successorTurnObserved} chainCorrelated=${fire.chainCorrelated} traceId=${fire.traceId || 'NONE'}`);

  RESULT = finalize(rec, cfg, [classifyContinueWorkTool(fire)]);
}

// Search any nested object for a trace/traceId/traceparent field.
function deepFindTraceId(obj, depth = 0) {
  if (!obj || depth > 6) return null;
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (/^trace(id|parent)?$/i.test(k) && typeof obj[k] === 'string') return obj[k];
      const r = deepFindTraceId(obj[k], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function finalize(rec, cfg, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `R-CW-1 candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness', scenario: 'r_cw_1_tool', row: 'R-CW-1', form: 'tool',
    generatedAt: new Date().toISOString(), result: RESULT, HUMAN_VERDICT_REQUIRED: true,
    note: 'BOTH-FORMS: this is the TOOL form; the TOKEN sibling is R-CW-TOKEN (02-r-cw-token.js).',
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  return [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: R-CW-1 (typed continue_work)',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    `   trace id      : ${out.result && out.result.facts && out.result.facts.receipts ? (out.result.facts.receipts.traceId || 'NONE — capture from Tempo') : 'NONE'}`,
    '   both-forms    : TOOL form (token sibling = R-CW-TOKEN)',
    '──────────────────────────────────────────────',
  ].join('\n') + '\n';
}
