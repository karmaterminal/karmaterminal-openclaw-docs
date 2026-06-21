// _combined-suite.js — OPTIONAL single-invocation runner for the milestone-1
// scenarios (open-Q #4). The DEFAULT remains one-file-per-scenario (see README:
// independent runnability + a clean `--summary-export` per row). This file is the
// follow-up the notes sketch: run preflight then the fire-rows in ONE `k6 run`
// via a k6 `scenarios{}` config with `startTime` staggering.
//
// ⚠️ READ THIS BEFORE USING — the honest k6-model caveat:
//   k6 multiplexes scenarios by mapping each to an exported `exec` function in
//   ONE module namespace. The per-row files (00..04) each use module-scope state
//   (`let RESULT`), their OWN `export const options`, and their OWN
//   `handleSummary` — only ONE `options`/`handleSummary` can win per `k6 run`.
//   So you CANNOT simply `import` their defaults and get five independent
//   summary.json files from one invocation. This combined runner therefore:
//     (a) defines the staggering + the SAFE_TO_FIRE gate + the serialize-fire
//         discipline here (the orchestration), and
//     (b) re-uses the SHARED libs (lib/gateway.js, lib/verdict.js) — NOT the
//         per-row module state — so each scenario fn here is self-contained.
//   The trade-off: this file duplicates a little fire/observe logic from the
//   per-row files. That duplication is intentional and called out so a reviewer
//   knows the per-file scenarios remain the source of truth; this is the
//   convenience wrapper. If the per-row logic changes, update here too (a TODO
//   to refactor the shared fire/observe steps into lib/ if this runner is kept).
//
// SAFETY (NON-NEGOTIABLE):
//   - preflight runs FIRST (startTime 0), read-only, always.
//   - fire rows are SERIALIZED via startTime, NEVER parallel — firing two
//     continuations at one session concurrently is exactly the guardrail the
//     runbook forbids. Each fire row gets a wide, non-overlapping window.
//   - fire rows still require SAFE_TO_FIRE=1. Without it, every fire scenario
//     records a safety note and does nothing (same as the per-row default).
//   - request_compaction and any future compaction row (R-RC, chained-depth)
//     MUST NOT be added to a parallel combined run. They are tool-only, opt-in,
//     and serialized one-at-a-time in their OWN invocation. Do not bolt them on
//     here. This runner is milestone-1 smokes only.
//
// RUN (preflight-only — safe; fire rows self-skip without SAFE_TO_FIRE):
//   OPENCLAW_GATEWAY_TOKEN=*** OPENCLAW_SESSION_KEY=main \
//   k6 run proof-harness/k6/scenarios/_combined-suite.js
//
// RUN (full serialized suite — quiet seat at CANDIDATE_SHA, intentional):
//   SAFE_TO_FIRE=1 OPENCLAW_GATEWAY_TOKEN=*** \
//   OPENCLAW_SESSION_KEY=main \
//   OPENCLAW_TOKEN_SESSION_KEY=<dedicated-test-session> \
//   CANDIDATE_SHA=<40-char> SEAT_NAME=elliott-legion PROOF_NONCE=suite-$(date +%s) \
//   k6 run proof-harness/k6/scenarios/_combined-suite.js | tee k6-stdout.ndjson
//
// NB on summaries: a single combined run emits ONE summary.json with all rows
// nested under `result.rows`. The post-processor (summary-to-evidence.mjs) is
// row-oriented; to author per-row PROOFS/ dirs from a combined run, either run
// the per-row files (recommended for evidence-grade proofs) or extend the
// post-processor to iterate `result.rows` (flagged as a follow-up).

import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { env, connectFrame, send, requireToken, newRecorder } from '../lib/gateway.js';
import {
  classifyContinueWorkTool,
  classifyContinueWorkToken,
  classifyContinueDelegateTool,
  classifyContinueDelegateToken,
  classifyToolVisibility,
  rollup,
  label,
  INCONCLUSIVE,
  LIMIT,
} from '../lib/verdict.js';

// ---- staggering ----------------------------------------------------------
// Each fire row needs the full agent turn + continuation delay + observe window.
// We give each a generous slot and start them back-to-back (NEVER overlapping).
// Numbers are conservative; widen if a slow seat truncates an observe window.
const SLOT = 160; // seconds per fire row (matches the per-row ~3m maxDuration budget)
const PREFLIGHT_AT = '0s';
const R_CW_1_AT = '10s'; // preflight is quick (read-only); fire rows start after it
const R_CW_TOKEN_AT = `${10 + SLOT}s`;
const R_CD_1_AT = `${10 + SLOT * 2}s`;
const R_CD_TOKEN_AT = `${10 + SLOT * 3}s`;

export const options = {
  // One scenario per row, SERIALIZED by startTime. Same VU=1/iters=1 shape as the
  // per-row files. maxDuration per scenario bounds each slot.
  scenarios: {
    preflight: {
      executor: 'shared-iterations', exec: 'preflight',
      vus: 1, iterations: 1, startTime: PREFLIGHT_AT, maxDuration: '30s',
    },
    r_cw_1: {
      executor: 'shared-iterations', exec: 'rCw1',
      vus: 1, iterations: 1, startTime: R_CW_1_AT, maxDuration: `${SLOT}s`,
    },
    r_cw_token: {
      executor: 'shared-iterations', exec: 'rCwToken',
      vus: 1, iterations: 1, startTime: R_CW_TOKEN_AT, maxDuration: `${SLOT}s`,
    },
    r_cd_1: {
      executor: 'shared-iterations', exec: 'rCd1',
      vus: 1, iterations: 1, startTime: R_CD_1_AT, maxDuration: `${SLOT}s`,
    },
    r_cd_token: {
      executor: 'shared-iterations', exec: 'rCdToken',
      vus: 1, iterations: 1, startTime: R_CD_TOKEN_AT, maxDuration: `${SLOT}s`,
    },
  },
  thresholds: {
    proof_failures: ['count==0'],
    preflight_setup_failures: ['count==0'],
  },
};

const failures = new Counter('proof_failures');
const setupFailures = new Counter('preflight_setup_failures');

// Per-row results land here; handleSummary nests them under result.rows.
const ROWS = {};

const CONTINUATION_TOOLS = ['continue_work', 'continue_delegate', 'request_compaction'];

// =====================================================================
// preflight (read-only) — startTime 0
// =====================================================================
export function preflight() {
  const cfg = env();
  const meta = { scenario: 'preflight', row: 'preflight', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);
  if (!requireToken(cfg, rec)) {
    setupFailures.add(1);
    ROWS.preflight = finalize(rec, cfg, [label(INCONCLUSIVE, 'preflight', { reason: 'no-token' }, 'Set token.')]);
    return;
  }

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read'] }));
      socket.setTimeout(() => send(socket, rec, 'health'), 400);
      socket.setTimeout(() => send(socket, rec, 'sessions.list'), 800);
      socket.setTimeout(() => send(socket, rec, 'tools.effective', { sessionKey: cfg.sessionKey }), 1300);
      socket.setTimeout(() => socket.close(), 6000);
    });
    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (msg && msg.type === 'res' && msg.result && rec.facts.authOk === null) {
        rec.setFact('authOk', true); rec.setFact('connected', true);
      }
    });
    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); setupFailures.add(1); });
  });
  if (!check(res, { 'preflight: websocket upgraded (101)': (r) => r && r.status === 101 })) setupFailures.add(1);

  const steps = [];
  const toolsRes = responseForMethod(rec, 'tools.effective');
  const visibleTools = extractToolNames(toolsRes);
  rec.setFact('receipts.effectiveToolNames', visibleTools);
  for (const t of CONTINUATION_TOOLS) {
    const visible = visibleTools.includes(t);
    rec.setFact(`toolsVisible.${t}`, visible);
    steps.push(classifyToolVisibility(t, visible, `session '${cfg.sessionKey}'`));
  }
  if (!toolsRes) {
    steps.push(label(INCONCLUSIVE, 'preflight', { reason: 'no tools.effective response' },
      'Verify the method name against the deployed SHA and re-run.'));
  }
  ROWS.preflight = finalize(rec, cfg, steps);
}

// =====================================================================
// R-CW-1 — typed continue_work() (TOOL). Fires only with SAFE_TO_FIRE=1.
// =====================================================================
export function rCw1() {
  const cfg = env();
  const meta = { scenario: 'r_cw_1', row: 'R-CW-1', form: 'tool', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);
  if (!gateOrToken(cfg, rec, 'R-CW-1', (steps) => { ROWS.r_cw_1 = finalize(rec, cfg, steps); })) return;

  const obs = { accepted: null, successorTurnObserved: false, chainCorrelated: false, traceId: null };
  const nonce = cfg.nonce;
  let fireId = null;
  let turnsAfterFire = 0;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      socket.setTimeout(() => send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }), 500);
      socket.setTimeout(() => {
        const idem = `R-CW-1/${cfg.candidateSha}/${cfg.seatName}/${nonce}`;
        fireId = send(socket, rec, 'tools.invoke', {
          name: 'continue_work',
          sessionKey: cfg.sessionKey,
          args: { reason: `proof R-CW-1 nonce ${nonce} (combined-suite)`, delaySeconds: 1 },
          idempotencyKey: idem,
        }, 'fire');
        rec.note('fire', `invoked continue_work (idem=${idem}, nonce=${nonce})`);
      }, 1200);
      socket.setTimeout(() => socket.close(), (SLOT - 5) * 1000);
    });
    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);
      if (msg.type === 'res' && fireId && msg.id === fireId) {
        obs.accepted = msg.ok === true || (msg.result !== undefined && !msg.error);
        const tid = deepFindTraceId(msg);
        if (tid) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
      }
      const blob = JSON.stringify(msg);
      if (obs.accepted && /turn[_-]?start|run[_-]?start|continuation/i.test(blob) && blob.includes(cfg.sessionKey)) {
        turnsAfterFire += 1;
        obs.successorTurnObserved = true;
        if (blob.includes(nonce) || /chain|parent|continuation/i.test(blob)) obs.chainCorrelated = true;
      }
    });
    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });
  check(res, { 'R-CW-1: websocket upgraded (101)': (r) => r && r.status === 101 });
  if (turnsAfterFire > 1) rec.note('warn', `>1 successor turn (${turnsAfterFire}) — spec §test-1 ERRONEOUS shape; flag for human`);
  rec.note('observe', `accepted=${obs.accepted} successor=${obs.successorTurnObserved} chain=${obs.chainCorrelated} turns=${turnsAfterFire}`);
  ROWS.r_cw_1 = finalize(rec, cfg, [classifyContinueWorkTool(obs)]);
}

// =====================================================================
// R-CW-TOKEN — bare CONTINUE_WORK:1 (TOKEN). Targets the dedicated token session.
// =====================================================================
export function rCwToken() {
  const cfg = env();
  const sessionKey = tokenSessionKey(cfg);
  const meta = { scenario: 'r_cw_token', row: 'R-CW-TOKEN', form: 'token', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);
  if (!gateOrToken(cfg, rec, 'R-CW-TOKEN', (steps) => { ROWS.r_cw_token = finalizeWithSession(rec, cfg, sessionKey, steps); })) return;

  const obs = { promptSent: false, hop2Observed: false, nonceEchoedInHop2: false, traceId: null };
  const nonce = cfg.nonce;
  const hop2Needle = `PROOF-HOP2 ${nonce}`;
  let turnsAfterSend = 0;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      socket.setTimeout(() => send(socket, rec, 'sessions.messages.subscribe', { sessionKey }), 500);
      socket.setTimeout(() => {
        send(socket, rec, 'sessions.send', { sessionKey, text: buildCwTokenPrompt(nonce) }, 'send');
        obs.promptSent = true;
        rec.note('send', `injected R-CW-TOKEN driving prompt (nonce ${nonce}) -> session '${sessionKey}'`);
      }, 1200);
      socket.setTimeout(() => socket.close(), (SLOT - 5) * 1000);
    });
    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);
      const blob = JSON.stringify(msg);
      if (obs.promptSent && blob.includes(hop2Needle)) {
        obs.hop2Observed = true; obs.nonceEchoedInHop2 = true;
        rec.note('hop2', `hop-2 detected carrying nonce: "${hop2Needle}"`);
      }
      if (obs.promptSent && /turn[_-]?start|run[_-]?start|continuation/i.test(blob) && blob.includes(sessionKey)) {
        turnsAfterSend += 1;
        if (turnsAfterSend >= 2 && !obs.hop2Observed) {
          obs.hop2Observed = true;
          rec.note('hop2', 'a second turn began after send (hop-2 likely) -- nonce not yet matched');
        }
      }
      const tid = deepFindTraceId(msg);
      if (tid && !obs.traceId) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
    });
    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });
  check(res, { 'R-CW-TOKEN: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.note('observe', `promptSent=${obs.promptSent} hop2=${obs.hop2Observed} nonceEchoed=${obs.nonceEchoedInHop2}`);
  ROWS.r_cw_token = finalizeWithSession(rec, cfg, sessionKey, [classifyContinueWorkToken(obs)]);
}

// =====================================================================
// R-CD-1 — typed continue_delegate() (TOOL).
// =====================================================================
export function rCd1() {
  const cfg = env();
  const meta = { scenario: 'r_cd_1', row: 'R-CD-1', form: 'tool', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);
  if (!gateOrToken(cfg, rec, 'R-CD-1', (steps) => { ROWS.r_cd_1 = finalize(rec, cfg, steps); })) return;

  const obs = { accepted: null, taskLedgerEntry: false, childKeyOrRunId: null, parentReturnObserved: false, traceId: null };
  const nonce = cfg.nonce;
  const returnNeedle = `DONE ${nonce}`;
  let fireId = null;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      socket.setTimeout(() => send(socket, rec, 'sessions.messages.subscribe', { sessionKey: cfg.sessionKey }), 500);
      socket.setTimeout(() => send(socket, rec, 'tasks.list', {}), 800);
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
      socket.setTimeout(() => send(socket, rec, 'tasks.list', {}), 6000);
      socket.setTimeout(() => send(socket, rec, 'tasks.list', {}), 20000);
      socket.setTimeout(() => socket.close(), (SLOT - 5) * 1000);
    });
    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);
      if (msg.type === 'res' && fireId && msg.id === fireId) {
        obs.accepted = msg.ok === true || (msg.result !== undefined && !msg.error);
        const tid = deepFindTraceId(msg);
        if (tid) { obs.traceId = tid; rec.setFact('receipts.traceId', tid); }
      }
      const blob = JSON.stringify(msg);
      if (/task/i.test(blob) && (blob.includes(nonce) || /delegate|continuation/i.test(blob))) {
        obs.taskLedgerEntry = true;
        const childKey = (msg.params && (msg.params.childSessionKey || msg.params.sessionKey || msg.params.runId))
          || deepFindFirst(msg, /child.*key|runId|taskId/i);
        if (childKey && !obs.childKeyOrRunId) { obs.childKeyOrRunId = childKey; rec.setFact('receipts.childKeyOrRunId', childKey); }
      }
      if (obs.accepted && blob.includes(returnNeedle)) {
        obs.parentReturnObserved = true;
        rec.note('return', `parent received delegate return carrying: "${returnNeedle}"`);
      }
    });
    socket.on('error', (e) => { rec.note('error', `ws error: ${e && e.error ? e.error() : e}`); failures.add(1); });
  });
  check(res, { 'R-CD-1: websocket upgraded (101)': (r) => r && r.status === 101 });
  rec.note('observe', `accepted=${obs.accepted} taskLedger=${obs.taskLedgerEntry} child=${obs.childKeyOrRunId} return=${obs.parentReturnObserved}`);
  ROWS.r_cd_1 = finalize(rec, cfg, [classifyContinueDelegateTool(obs)]);
}

// =====================================================================
// R-CD-TOKEN — [[CONTINUE_DELEGATE: ... | silent-wake]] bracket (TOKEN/bracket).
// =====================================================================
export function rCdToken() {
  const cfg = env();
  const sessionKey = tokenSessionKey(cfg);
  const meta = { scenario: 'r_cd_token', row: 'R-CD-TOKEN', form: 'bracket', seat: cfg.seatName, sha: cfg.candidateSha };
  const rec = newRecorder(meta);
  if (!gateOrToken(cfg, rec, 'R-CD-TOKEN', (steps) => { ROWS.r_cd_token = finalizeWithSession(rec, cfg, sessionKey, steps); })) return;

  const obs = { promptSent: false, childObserved: false, parentReturnObserved: false, parentWoke: false, traceId: null };
  const nonce = cfg.nonce;
  const returnNeedle = `DONE ${nonce}`;
  let childSeenAtMs = null;

  const res = ws.connect(cfg.wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(connectFrame({ token: cfg.token, scopes: ['operator.read', 'operator.write'] }));
      socket.setTimeout(() => send(socket, rec, 'sessions.messages.subscribe', { sessionKey }), 500);
      socket.setTimeout(() => send(socket, rec, 'tasks.list', {}), 800);
      socket.setTimeout(() => {
        send(socket, rec, 'sessions.send', { sessionKey, text: buildCdBracketPrompt(nonce) }, 'send');
        obs.promptSent = true;
        rec.note('send', `injected R-CD-TOKEN bracket-driving prompt (nonce ${nonce}) -> session '${sessionKey}'`);
      }, 1200);
      socket.setTimeout(() => send(socket, rec, 'tasks.list', {}), 12000);
      socket.setTimeout(() => socket.close(), (SLOT - 5) * 1000);
    });
    socket.on('message', (raw) => {
      const msg = rec.record(raw);
      if (!msg) return;
      if (msg.type === 'res' && msg.ok === false) failures.add(1);
      const blob = JSON.stringify(msg);
      // child spawn signal: a new child session / spawn / task event after our send.
      if (obs.promptSent && /(child.*session|spawn|subagent|task.*(create|start)|delegate)/i.test(blob)) {
        if (!obs.childObserved) childSeenAtMs = Date.now();
        obs.childObserved = true;
        const ck = deepFindFirst(msg, /child.*key|runId|taskId|sessionKey/i);
        if (ck && !(rec.facts.receipts && rec.facts.receipts.childKeyOrRunId)) rec.setFact('receipts.childKeyOrRunId', ck);
      }
      // SILENT-WAKE RECEIPT (R-CD-owner correction, mirrors 04-r-cd-token.js): a
      // FRESH parent turn/run starting on the parent session AFTER the child was
      // observed is the wake the silent-wake return triggered. The transcript
      // echo is OPTIONAL under silent-wake; the WAKE is the load-bearing receipt.
      if (obs.promptSent && obs.childObserved) {
        const isParentTurnStart =
          /(turn.*start|run.*start|generation.*start|agent.*turn|message.*(received|start))/i.test(blob) &&
          (blob.includes(sessionKey) || (msg.params && msg.params.sessionKey === sessionKey));
        if (isParentTurnStart && childSeenAtMs && Date.now() > childSeenAtMs + 250 && !obs.parentWoke) {
          obs.parentWoke = true;
          rec.note('wake', `parent woke (fresh turn/run on ${sessionKey}) after child spawn -> silent-wake receipt`);
          rec.setFact('receipts.parentWoke', true);
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
  rec.note('observe', `promptSent=${obs.promptSent} child=${obs.childObserved} parentWoke=${obs.parentWoke} transcriptReturn=${obs.parentReturnObserved}`);
  ROWS.r_cd_token = finalizeWithSession(rec, cfg, sessionKey, [classifyContinueDelegateToken(obs)]);
}

// =====================================================================
// shared helpers (mirrors the per-row files; kept local on purpose — see header)
// =====================================================================

// Token-form rows target a DEDICATED test session, never the live main session.
// Resolve from OPENCLAW_TOKEN_SESSION_KEY; fall back to the main sessionKey with
// a loud note (the per-row manifest marks this REPLACE-WITH-DEDICATED-TEST-SESSION).
function tokenSessionKey(cfg) {
  return __ENV.OPENCLAW_TOKEN_SESSION_KEY || cfg.sessionKey;
}

// Gate guard shared by every fire row: missing token => INCONCLUSIVE setup;
// SAFE_TO_FIRE!=1 => HONEST-LIMIT safety-gate-closed (no fire). Returns false
// (and finalizes via the provided sink) when the row must NOT proceed.
function gateOrToken(cfg, rec, rowId, sink) {
  if (!requireToken(cfg, rec)) {
    sink([label(INCONCLUSIVE, rowId, { reason: 'no-token' }, 'Set token.')]);
    return false;
  }
  if (!cfg.safeToFire) {
    rec.note('safety', `SAFE_TO_FIRE!=1 — ${rowId} will NOT fire. Scaffold-safe default.`);
    sink([label(LIMIT, rowId, { reason: 'safety-gate-closed' },
      'Harness safety gate prevented the fire (by design). Not a SUT verdict.')]);
    return false;
  }
  return true;
}

function buildCwTokenPrompt(nonce) {
  return [
    `PROOF HARNESS R-CW-TOKEN. Do not mutate any files or call external tools.`,
    `On THIS turn, reply with a single short line, then end your reply with EXACTLY this terminal token on its own final line:`,
    `CONTINUE_WORK:1`,
    `On your NEXT turn (hop-2), reply with exactly: PROOF-HOP2 ${nonce}`,
    `(The bare CONTINUE_WORK:1 token at the end of this turn should drive that next turn.)`,
  ].join('\n');
}

function buildCdBracketPrompt(nonce) {
  return [
    `PROOF HARNESS R-CD-TOKEN. Do not mutate any files or call external tools.`,
    `Reply with a single short line, then end your reply with EXACTLY this terminal bracket on its own final line:`,
    `[[CONTINUE_DELEGATE: Reply with exactly "DONE ${nonce}" and nothing else. Do not mutate files or call external tools. | silent-wake]]`,
    `(The bracket should spawn a child that returns "DONE ${nonce}" to you.)`,
  ].join('\n');
}

// find the buffered response for a given method (combined-suite has no per-call
// id tracking helper exposed, so we scan correlations by method name).
function responseForMethod(rec, method) {
  for (const id of Object.keys(rec.correlations)) {
    if (rec.correlations[id].method === method) return rec.correlations[id].res;
  }
  return null;
}

function extractToolNames(res) {
  if (!res) return [];
  const r = res.result !== undefined ? res.result : res;
  const arr = Array.isArray(r) ? r : (r && (r.tools || r.effective || r.available)) || [];
  return (Array.isArray(arr) ? arr : []).map((x) => (typeof x === 'string' ? x : (x && (x.name || x.tool)))).filter(Boolean);
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
  return finalizeWithSession(rec, cfg, cfg.sessionKey, steps);
}

function finalizeWithSession(rec, cfg, sessionKey, steps) {
  const roll = rollup(steps);
  rec.note('verdict', `${rec.snapshot().meta.row} candidate=${roll.rowVerdict} (HUMAN REVIEW REQUIRED)`);
  return {
    meta: rec.snapshot().meta, rowCandidate: roll, facts: rec.facts, notes: rec.notes,
    config: { wsUrl: cfg.wsUrl, sessionKey, candidateSha: cfg.candidateSha, seat: cfg.seatName, nonce: cfg.nonce },
    frameCount: rec.frames.length,
  };
}

// One combined summary with every row nested under result.rows. NOTE: this is a
// single summary.json — see the header NB about per-row PROOFS/ authoring.
export function handleSummary(data) {
  const out = {
    harness: 'k6-proof-harness',
    scenario: '_combined-suite',
    generatedAt: new Date().toISOString(),
    HUMAN_VERDICT_REQUIRED: true,
    note: 'COMBINED single-invocation runner (open-Q #4). Per-file scenarios remain the source of truth + the recommended evidence-grade path. Fire rows are SERIALIZED via startTime, never parallel.',
    result: { rows: ROWS },
  };
  return { 'summary.json': JSON.stringify(out, null, 2), stdout: renderText(out) };
}

function renderText(out) {
  const rows = (out.result && out.result.rows) || {};
  const lines = [
    '==============================================',
    ' k6 proof-harness :: COMBINED SUITE (milestone-1, SERIALIZED)',
    '   (per-file scenarios remain the evidence-grade path; this is the wrapper)',
  ];
  for (const k of Object.keys(rows)) {
    const r = rows[k];
    const rv = r && r.rowCandidate ? r.rowCandidate.rowVerdict : 'UNKNOWN';
    lines.push(`   - ${k.padEnd(12)} : ${rv}`);
  }
  lines.push('   (HUMAN VERDICT REQUIRED — k6 labels candidates, never finalizes)');
  lines.push('==============================================');
  return lines.join('\n') + '\n';
}
