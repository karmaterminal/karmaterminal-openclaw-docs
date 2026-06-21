// 04-r-cd-token.js — Scenario 4: R-CD-TOKEN bracket [[CONTINUE_DELEGATE]] smoke.
//
// GOAL (notes §"Scenario 4", spec §test-6, BOTH-FORMS MANDATE): force the
// BRACKET PARSER path of continue_delegate. Inject a prompt requiring the agent
// to end with exactly `[[CONTINUE_DELEGATE: <task> | silent-wake]]`; observe the
// child run is created and the completion returns / WAKES the parent.
//
// WHY SEPARATE FROM R-CD-1: the bracket is parsed from finalized reply text
// (tokens.ts bracket parse / subagent-announce.ts:453) — INDEPENDENT from the
// typed tool. Parity must be proven in BOTH forms; a tool-only proof is blind to
// the bracket path (the #952 class).
//
// ─────────────────────────────────────────────────────────────────────────────
// R-CD-ROW-OWNER CORRECTION (🌊 Ronan, corpus R-CD owner — review-catch
// `1518171071`): silent-wake's RETURN IS NOT CHANNEL-POSTED. A `silent-wake`
// delegate return lands as INTERNAL CONTEXT and TRIGGERS A FRESH PARENT TURN —
// it does NOT surface the child's `DONE <nonce>` in the parent transcript the way
// `mode:normal` does. So watching the parent transcript for the nonce (the v1
// detection) would MISS a successful silent-wake return → false FAIL/INCONCLUSIVE.
//
//   • silent-wake receipt  = child-spawn + a FRESH PARENT TURN fires post-return
//                            (new run/turn on the parent session AFTER the child
//                            completes) — the WAKE, not the transcript echo.
//   • normal-mode receipt  = child-spawn + the child's `DONE <nonce>` SURFACES in
//                            the parent transcript (the channel echo).
//
// This scenario proves the BRACKET (silent-wake) path, so its primary receipt is
// the WAKE. We ALSO opportunistically capture a transcript-nonce if it appears
// (some delivery shapes echo), but absence of the transcript-nonce under
// silent-wake is EXPECTED, not a failure. The verdict accepts EITHER the wake OR
// the transcript-return as the parent-side receipt.
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ FIRES A REAL DELEGATE via the agent's own reply. Gated behind SAFE_TO_FIRE=1.
//    Bare `k6 run` preflights + records a safety note + exits.
//
// RUN (quiet seat at CANDIDATE_SHA, target a DEDICATED test session):
//   SAFE_TO_FIRE=1 OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=*** \
//   PROOF_NONCE=cdtok-$(date +%s) k6 run --summary-export=summary.json \
//   proof-harness/k6/scenarios/04-r-cd-token.js
//
// BOTH-FORMS sibling = R-CD-1 (the typed tool).

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder } from '../lib/gateway.js';
import { classifyContinueDelegateToken, rollup, label, INCONCLUSIVE, LIMIT } from '../lib/verdict.js';

export const options = {
  scenarios: {
    r_cd_token: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '3m' },
  },
  thresholds: { proof_failures: ['count==0'], proof_row_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
let RESULT = null;

// The bracket form with silent-wake (per the notes' Scenario 4 example). The
// child is asked to return the nonce + DONE. silent-wake → the child's return
// also WAKES the parent (the path worth proving end-to-end). The child's reply
// itself need not surface in the parent transcript (silent return), so the
// load-bearing parent-side receipt is the fresh-turn wake.
function buildPrompt(nonce) {
  return [
    `PROOF HARNESS R-CD-TOKEN. Do not mutate any files.`,
    `Reply with a single short line, then end your response with EXACTLY this on its own final line:`,
    `[[CONTINUE_DELEGATE: Proof nonce ${nonce}: reply with exactly "DONE ${nonce}" and nothing else; do not mutate files | silent-wake]]`,
  ].join('\n');
}

export default function () {
  const cfg = env();
  const meta = { scenario: 'r_cd_token', row: 'R-CD-TOKEN', form: 'token', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'R-CD-TOKEN', { reason: 'no-token' }, 'Set token.')]);
    return;
  }
  if (!cfg.safeToFire) {
    rec.note('safety', 'SAFE_TO_FIRE!=1 — refusing to inject the bracket-driving prompt. Scaffold-safe default.');
    RESULT = finalize(rec, cfg, [label(LIMIT, 'R-CD-TOKEN', { reason: 'safety-gate-closed' },
      'Harness safety gate prevented the fire (by design). Not a SUT verdict.')]);
    return;
  }

  // obs.parentWoke = the silent-wake receipt (a fresh parent turn/run after the
  //                  child completes). obs.parentReturnObserved = the optional
  //                  transcript-nonce (normal-mode echo; may be absent under
  //                  silent-wake and that's expected). The verdict accepts EITHER.
  const obs = {
    promptSent: false, childObserved: false,
    parentReturnObserved: false,   // transcript-nonce echo (optional under silent-wake)
    parentWoke: false,             // fresh parent turn post-return (the silent-wake receipt)
    traceId: null,
  };
  const nonce = cfg.nonce;
  const returnNeedle = `DONE ${nonce}`;
  let sendId = null;
  let childSeenAtMs = null;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      socket.setTimeout(() => { send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }); }, 500);
      socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 800);

      socket.setTimeout(() => {
        sendId = send(socket, rec, 'sessions.send', { sessionKey: cfg.sessionKey, text: buildPrompt(nonce) }, 'send');
        obs.promptSent = true;
        rec.note('send', `injected R-CD-TOKEN bracket-driving prompt (nonce ${nonce})`);
      }, 1200);

      socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 12000);
      socket.setTimeout(() => socket.close(), 150000);
    });

    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);

      const blob = JSON.stringify(msg);

      // child creation: a new child session / spawn / task event after our send.
      if (obs.promptSent && /(child.*session|spawn|subagent|task.*(create|start)|delegate)/i.test(blob)) {
        if (!obs.childObserved) childSeenAtMs = Date.now();
        obs.childObserved = true;
        const ck = deepFindFirst(msg, /child.*key|runId|taskId|sessionKey/i);
        if (ck && !rec.facts.receipts.childKeyOrRunId) rec.setFact('receipts.childKeyOrRunId', ck);
      }

      // SILENT-WAKE RECEIPT: a fresh parent turn/run STARTING on the parent
      // session AFTER the child was observed = the wake the silent-wake return
      // triggered.
      //
      // EVENT-NAME (🔍 Cael byte-verified vs the live gateway surface,
      // VERIFIED-GATEWAY-SURFACE.md): the gateway does NOT push `turn.start`/
      // `run.start` as client subscription events (internal source refs only —
      // keying on them would NEVER fire). The woken successor turn surfaces as a
      // fresh **`session.message`** event on the subscribed session (via
      // `sessions.messages.subscribe`); `sessions.changed` is a secondary signal.
      if (obs.promptSent && obs.childObserved) {
        const evt = (msg.type === 'event' && msg.event) ? String(msg.event) : '';
        const evtSession = (msg.params && msg.params.sessionKey) ||
          (msg.data && msg.data.sessionKey) || null;
        const isParentWake =
          (/session\.message/i.test(evt) || /sessions?\.changed/i.test(evt)) &&
          (evtSession === cfg.sessionKey || blob.includes(cfg.sessionKey));
        // require it to be AFTER the child spawn (a wake, not the original send echo)
        if (isParentWake && childSeenAtMs && Date.now() > childSeenAtMs + 250) {
          if (!obs.parentWoke) {
            obs.parentWoke = true;
            rec.note('wake', `parent woke (fresh session.message on ${cfg.sessionKey}) after child spawn → silent-wake receipt`);
            rec.setFact('receipts.parentWoke', true);
          }
        }
      }

      // OPTIONAL transcript echo (normal-mode shape; absent-under-silent-wake is OK):
      if (obs.promptSent && blob.includes(returnNeedle)) {
        obs.parentReturnObserved = true;
        rec.note('return', `parent transcript carried "${returnNeedle}" (echo path; not required under silent-wake)`);
      }

      const tid = deepFindTraceId(msg);
      if (tid && !obs.traceId) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
    });

    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  check(res, { 'R-CD-TOKEN: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.setFact('fired.continue_delegate_token', {
    promptSent: obs.promptSent, child: obs.childObserved,
    parentWoke: obs.parentWoke, transcriptReturn: obs.parentReturnObserved,
  });
  rec.note('observe', `promptSent=${obs.promptSent} child=${obs.childObserved} parentWoke=${obs.parentWoke} transcriptReturn=${obs.parentReturnObserved}`);

  RESULT = finalize(rec, cfg, [classifyContinueDelegateToken(obs)]);
}

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
function deepFindFirst(obj, re, depth = 0) {
  if (!obj || depth > 6) return null;
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (re.test(k) && (typeof obj[k] === 'string' || typeof obj[k] === 'number')) return obj[k];
      const r = deepFindFirst(obj[k], re, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function finalize(rec, cfg, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `R-CD-TOKEN candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness', scenario: 'r_cd_token', row: 'R-CD-TOKEN', form: 'token',
    generatedAt: new Date().toISOString(), result: RESULT, HUMAN_VERDICT_REQUIRED: true,
    note: 'BOTH-FORMS: TOKEN/bracket form (independent parser path). TOOL sibling = R-CD-1. ' +
          'silent-wake receipt = fresh parent turn (WAKE), not transcript echo (R-CD-owner correction).',
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  return [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: R-CD-TOKEN ([[CONTINUE_DELEGATE | silent-wake]])',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    '   both-forms    : BRACKET parser path — independent from the tool',
    '   receipts wanted: child spawned + parent WAKE (silent-wake) [+ optional transcript echo] + trace',
    '──────────────────────────────────────────────',
  ].join('\n') + '\n';
}
