// 03-r-cd-1-tool.js — Scenario 3: R-CD-1 typed continue_delegate() smoke.
//
// GOAL (notes §"Scenario 3", spec §test-5): dispatch a delegate and observe
// schedule → spawn → return. PASS-candidate receipts: tool accepted + a task-
// ledger entry (delegate/background task) + a child session key or run id +
// parent receives the delegate completion + a trace showing dispatch→child run.
//
// The delegate task is a NON-MUTATING nonce task (reply with DONE + nonce only).
//
// ⚠️ FIRES A REAL DELEGATE. Gated behind SAFE_TO_FIRE=1. Bare `k6 run`
//    preflights + records a safety note + exits.
//
// RUN (quiet seat at CANDIDATE_SHA):
//   SAFE_TO_FIRE=1 OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=main \
//   PROOF_NONCE=cd1-$(date +%s) k6 run --summary-export=summary.json \
//   proof-harness/k6/scenarios/03-r-cd-1-tool.js
//
// BOTH-FORMS sibling = R-CD-TOKEN (04-r-cd-token.js), the bracket-parser path.

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder, onConnectChallenge } from '../lib/gateway.js';
import { classifyContinueDelegateTool, rollup, label, INCONCLUSIVE, LIMIT } from '../lib/verdict.js';

export const options = {
  scenarios: {
    r_cd_1_tool: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '3m' },
  },
  thresholds: { proof_failures: ['count==0'], proof_row_duration: ['p(95)<180000'] },
};

const failures = new Counter('proof_failures');
let RESULT = null;

export default function () {
  const cfg = env();
  const meta = { scenario: 'r_cd_1_tool', row: 'R-CD-1', form: 'tool', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);

  if (!requireToken(cfg, rec)) {
    RESULT = finalize(rec, cfg, [label(INCONCLUSIVE, 'R-CD-1', { reason: 'no-token' }, 'Set token.')]);
    return;
  }
  if (!cfg.safeToFire) {
    rec.note('safety', 'SAFE_TO_FIRE!=1 — refusing to invoke continue_delegate. Scaffold-safe default.');
    RESULT = finalize(rec, cfg, [label(LIMIT, 'R-CD-1', { reason: 'safety-gate-closed' },
      'Harness safety gate prevented the fire (by design). Not a SUT verdict.')]);
    return;
  }

  const obs = { accepted: null, taskLedgerEntry: false, childKeyOrRunId: null, parentReturnObserved: false, traceId: null };
  const nonce = cfg.nonce;
  const returnNeedle = `DONE ${nonce}`;
  let fireId = null;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    // CHALLENGE-FIRST (Cael FIX #1, VERIFIED-GATEWAY-SURFACE.md): wait for the
    // gateway's `connect.challenge` push before sending connect (raw
    // connect-on-open is rejected). Subscribe + poll the ledger + fire AFTER
    // connect is accepted.
    const onChallenge = onConnectChallenge(
      { token: cfg.token, scopes: ['operator.read', 'operator.write'] },
      () => {
        rec.note('connect', 'connect.challenge received → sent operator connect (read+write)');
        socket.setTimeout(() => { send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }); }, 500);
        // Also watch the task ledger via tasks.list polling.
        socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 800);

        socket.setTimeout(() => {
          const idem = `R-CD-1/${cfg.candidateSha}/${cfg.seatName}/${nonce}`;
          fireId = send(socket, rec, 'tools.invoke', {
            name: 'continue_delegate',
            sessionKey: cfg.sessionKey,
            args: {
              task: `Proof nonce ${nonce}: reply with exactly "DONE ${nonce}" and nothing else; do NOT mutate files or call external tools.`,
              mode: 'normal',
              delaySeconds: 1,
            },
            idempotencyKey: idem,
          }, 'fire');
          rec.note('fire', `invoked continue_delegate (idem=${idem}, nonce=${nonce})`);
        }, 1200);

        // Poll the task ledger a couple more times to catch the spawned task + its
        // child/run id while the delegate runs.
        socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 6000);
        socket.setTimeout(() => { send(socket, rec, 'tasks.list', {}); }, 20000);

        // Delegate spawn + child run + return can take a while; hold the socket.
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

      if (msg.type === 'res' && fireId && msg.id === fireId) {
        obs.accepted = msg.ok === true || (msg.result !== undefined && !msg.error);
        const tid = deepFindTraceId(msg);
        if (tid) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
      }

      const blob = JSON.stringify(msg);

      // task-ledger detection: a tasks.list/tasks.get response or a task.* event
      // mentioning continue_delegate / our nonce / a delegate task kind.
      if (/task/i.test(blob) && (blob.includes(nonce) || /delegate|continuation/i.test(blob))) {
        obs.taskLedgerEntry = true;
        const childKey = (msg.params && (msg.params.childSessionKey || msg.params.sessionKey || msg.params.runId))
          || deepFindFirst(msg, /child.*key|runId|taskId/i);
        if (childKey && !obs.childKeyOrRunId) { obs.childKeyOrRunId = childKey; rec.setFact('receipts.childKeyOrRunId', childKey); }
      }

      // parent return: the child's "DONE <nonce>" surfacing back in the parent
      // session transcript is the strong return signal.
      if (obs.accepted && blob.includes(returnNeedle)) {
        obs.parentReturnObserved = true;
        rec.note('return', `parent received delegate return carrying: "${returnNeedle}"`);
      }
    });

    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });

  check(res, { 'R-CD-1: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.setFact('fired.continue_delegate_tool', { ok: obs.accepted, child: obs.childKeyOrRunId, traceId: obs.traceId });
  rec.note('observe', `accepted=${obs.accepted} taskLedger=${obs.taskLedgerEntry} child=${obs.childKeyOrRunId} return=${obs.parentReturnObserved}`);

  RESULT = finalize(rec, cfg, [classifyContinueDelegateTool(obs)]);
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
  rec.note('verdict', `R-CD-1 candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey: cfg.sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness', scenario: 'r_cd_1_tool', row: 'R-CD-1', form: 'tool',
    generatedAt: new Date().toISOString(), result: RESULT, HUMAN_VERDICT_REQUIRED: true,
    note: 'BOTH-FORMS: TOOL form. TOKEN sibling = R-CD-TOKEN (04-r-cd-token.js).',
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rv = out.result && out.result.rowCandidate ? out.result.rowCandidate.rowVerdict : 'UNKNOWN';
  return [
    '──────────────────────────────────────────────',
    ' k6 proof-harness :: R-CD-1 (typed continue_delegate)',
    `   row candidate : ${rv}   (HUMAN VERDICT REQUIRED)`,
    '   receipts wanted: accepted + task-ledger + child + parent-return + trace',
    '   both-forms    : TOOL form (token sibling = R-CD-TOKEN)',
    '──────────────────────────────────────────────',
  ].join('\n') + '\n';
}
