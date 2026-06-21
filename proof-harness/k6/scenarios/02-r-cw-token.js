// 02-r-cw-token.js — Scenario 2: R-CW-TOKEN bare-token CONTINUE_WORK:1 smoke.
//
// GOAL (notes §"Scenario 2", spec §test-2, BOTH-FORMS MANDATE): cover the
// response-token path INDEPENDENTLY from the typed tool. Inject a prompt
// instructing the agent to end its reply with a terminal `CONTINUE_WORK:1` token
// and include a NONCE in its hop-2 reply; then observe that a continuation
// actually FIRES (hop-2) carrying the nonce — not merely that the token is
// stripped from output.
//
// WHY IT MATTERS: tokens.ts parses the bare token from finalized reply text — a
// DIFFERENT code path than runOutcome.continueWorkRequest (the tool). #952
// escaped a week of proofs because a tool-only proof was blind to exactly this
// path. lightContext subagents have NO tool — the token is their only path.
//
// ⚠️ FIRES A REAL CONTINUATION (via the agent's own next turn). Gated behind
//    SAFE_TO_FIRE=1. Bare `k6 run` preflights + records a safety note + exits.
//
// RUN (quiet seat at CANDIDATE_SHA):
//   SAFE_TO_FIRE=1 OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=<a-test-session> \
//   PROOF_NONCE=cwtok-$(date +%s) k6 run --summary-export=summary.json \
//   proof-harness/k6/scenarios/02-r-cw-token.js
//
// NB: target a DEDICATED test session, not a live working session — this injects
// a prompt that drives the agent. The both-forms TOOL sibling is R-CW-1.

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder, onConnectChallenge } from '../lib/gateway.js';
import { classifyContinueWorkToken, rollup, label, INCONCLUSIVE, LIMIT } from '../lib/verdict.js';

export const options = {
  scenarios: {
    r_cw_token: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '3m' },
  },
  thresholds: { proof_failures: ['count==0'], proof_row_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
let RESULT = null;

// The prompt we inject. It must (a) be deterministic, (b) ask for a terminal
// bare token, (c) ask the hop-2 reply to echo the nonce so we can prove hop-2
// carried THIS election. The agent is instructed NOT to mutate anything.
function buildPrompt(nonce) {
  return [
    `PROOF HARNESS R-CW-TOKEN. Do not mutate any files or call external tools.`,
    `On THIS turn, reply with a single short line, then end your reply with EXACTLY this terminal token on its own final line:`,
    `CONTINUE_WORK:1`,
    `On your NEXT turn (hop-2), reply with exactly: PROOF-HOP2 ${nonce}`,
    `(The bare CONTINUE_WORK:1 token at the end of this turn should drive that next turn.)`,
  ].join('\n');
}

export default function () {
  const cfg = env();
  const meta = { scenario: 'r_cw_token', row: 'R-CW-TOKEN', form: 'token', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'R-CW-TOKEN', { reason: 'no-token' }, 'Set token.')]);
    return;
  }
  if (!cfg.safeToFire) {
    rec.note('safety', 'SAFE_TO_FIRE!=1 — refusing to inject the driving prompt. Scaffold-safe default.');
    RESULT = finalize(rec, cfg, [label(LIMIT, 'R-CW-TOKEN', { reason: 'safety-gate-closed' },
      'Harness safety gate prevented the fire (by design). Not a SUT verdict.')]);
    return;
  }

  const obs = { promptSent: false, hop2Observed: false, nonceEchoedInHop2: false, traceId: null };
  const nonce = cfg.nonce;
  const hop2Needle = `PROOF-HOP2 ${nonce}`;
  let turnsAfterSend = 0;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    // CHALLENGE-FIRST (Cael FIX #1, VERIFIED-GATEWAY-SURFACE.md): wait for the
    // gateway's `connect.challenge` push before sending connect (raw
    // connect-on-open is rejected). Subscribe + inject the prompt AFTER connect.
    const onChallenge = onConnectChallenge(
      { token: cfg.token, scopes: ['operator.read', 'operator.write'] },
      () => {
        rec.note('connect', 'connect.challenge received → sent operator connect (read+write)');
        socket.setTimeout(() => { send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }); }, 500);

        socket.setTimeout(() => {
          send(socket, rec, 'sessions.send', { sessionKey: cfg.sessionKey, text: buildPrompt(nonce) }, 'send');
          obs.promptSent = true;
          rec.note('send', `injected R-CW-TOKEN driving prompt (nonce ${nonce})`);
        }, 1200);

        // Token path needs the agent to take turn-1 (emit the token) THEN hop-2.
        // Hold longer than the tool path: model turn + delay + hop-2 turn.
        socket.setTimeout(() => socket.close(), 150000);
      },
    );

    socket.on('open', () => {
      // Wait for connect.challenge before sending connect (challenge-first).
      rec.note('open', 'ws open — awaiting connect.challenge before sending connect');
    });

    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (onChallenge(socket, msg)) return; // consumed the connect.challenge frame
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);

      const blob = JSON.stringify(msg);

      // Detect the nonce in any inbound transcript text → that's hop-2 firing
      // AND carrying this election (the strong PASS signal). The needle is
      // unique so this is robust to the exact event envelope.
      if (obs.promptSent && blob.includes(hop2Needle)) {
        obs.hop2Observed = true;
        obs.nonceEchoedInHop2 = true;
        rec.note('hop2', `hop-2 detected carrying nonce: "${hop2Needle}"`);
      }

      // Weaker signal: a turn/run-start event after our send (hop-2 may fire even
      // if the model phrased the echo differently). Count turns to disambiguate.
      if (obs.promptSent && /turn[_-]?start|run[_-]?start|continuation/i.test(blob) && blob.includes(cfg.sessionKey)) {
        turnsAfterSend += 1;
        if (turnsAfterSend >= 2 && !obs.hop2Observed) {
          obs.hop2Observed = true; // a second turn began ⇒ a hop-2 occurred
          rec.note('hop2', 'a second turn began after send (hop-2 likely) — nonce not yet matched');
        }
      }

      const tid = deepFindTraceId(msg);
      if (tid && !obs.traceId) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
    });

    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  check(res, { 'R-CW-TOKEN: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.setFact('fired.continue_work_token', { promptSent: obs.promptSent, hop2: obs.hop2Observed, nonce: obs.nonceEchoedInHop2 });
  rec.note('observe', `promptSent=${obs.promptSent} hop2=${obs.hop2Observed} nonceEchoed=${obs.nonceEchoedInHop2}`);

  RESULT = finalize(rec, cfg, [classifyContinueWorkToken(obs)]);
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

function finalize(rec, cfg, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `R-CW-TOKEN candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness', scenario: 'r_cw_token', row: 'R-CW-TOKEN', form: 'token',
    generatedAt: new Date().toISOString(), result: RESULT, HUMAN_VERDICT_REQUIRED: true,
    note: 'BOTH-FORMS: this is the TOKEN form (the path #952 broke on). TOOL sibling = R-CW-1.',
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  return [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: R-CW-TOKEN (bare CONTINUE_WORK:1)',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    '   both-forms    : TOKEN form — INDEPENDENT path from the tool (#952)',
    '   PASS signal   : hop-2 fired AND carried the nonce (not just token-stripped)',
    '──────────────────────────────────────────────',
  ].join('\n') + '\n';
}
