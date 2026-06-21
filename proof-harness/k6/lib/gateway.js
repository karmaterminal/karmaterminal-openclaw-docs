// gateway.js — shared OpenClaw Gateway WebSocket helpers for the k6 proof-harness.
//
// SCOPE: deterministic fire-and-observe plumbing only. This module does NOT
// decide PASS/FAIL — it opens an authenticated operator WS, sends JSON-RPC-like
// frames, correlates responses by id, and buffers every inbound frame so a
// scenario (and the post-processor) can classify receipts against the
// CONTINUATION-BEHAVIOR-SPEC definitions.
//
// ⚠️ VERIFY-AGAINST-DEPLOYED-SHA: the method names below (connect, health,
// sessions.list, tools.effective, tools.invoke, sessions.send, tasks.list,
// tasks.get, *.subscribe) and the `connect` frame shape are transcribed from
// openclaw-bootstrap/.specify/notes/k6-for-proofs-deterministic-elements.md
// and the OpenClaw Gateway protocol docs. Before a REAL proof run, confirm each
// method/tool name and the connect envelope against the SHA actually deployed on
// the seat (e.g. via `tools.catalog` + a manual `connect` probe). The notes flag
// this explicitly; treat names here as "documented, not yet byte-verified live".
//
// SECURITY: the operator token is read from env (OPENCLAW_GATEWAY_TOKEN) and is
// never written to disk, logged at info level, or embedded in any artifact. Keep
// gateway traffic on loopback / tailnet only. See README.md "Security model".

import ws from 'k6/ws';

// ---- frame construction ---------------------------------------------------

// Monotonic-ish id generator. Correlation is by this id across req -> res.
// VU+ITER+time+rand keeps ids unique across virtual users and iterations.
export function newId(tag) {
  const t = tag ? `${tag}-` : '';
  return `${t}${__VU}-${__ITER}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// A standard request frame. The gateway protocol (per the notes) uses
//   { type: 'req', id, method, params }
// and replies with
//   { type: 'res', id, ok, result | error }
// plus unsolicited event frames (type: 'event' / method-named pushes) for
// subscriptions. We do not assume the exact event envelope here — scenarios
// buffer ALL inbound frames and match heuristically + by id.
export function reqFrame(method, params = {}, id = null) {
  return JSON.stringify({
    type: 'req',
    id: id || newId(method.replace(/\W+/g, '_')),
    method,
    params,
  });
}

// The mandatory first frame: operator connect with identity/role/scopes/auth.
// Shape mirrors the notes' skeleton. minProtocol/maxProtocol bracket the
// negotiated gateway protocol version — adjust to the deployed range if the
// connect is rejected with a protocol-mismatch error.
export function connectFrame({ token, scopes }) {
  return reqFrame('connect', {
    minProtocol: 3,
    maxProtocol: 4,
    client: {
      id: 'k6-proof-harness',
      version: '0.1.0',
      platform: 'linux',
      mode: 'operator',
    },
    role: 'operator',
    // operator.read for inventory/subscribe; operator.write only for the fire
    // scenarios. Scenarios pass the minimum scope they need.
    scopes: scopes || ['operator.read'],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token }, // token from env; NEVER hard-coded.
    userAgent: 'k6-proof-harness/0.1.0',
  }, 'connect');
}

// ---- env / config ---------------------------------------------------------

export function env() {
  return {
    wsUrl: __ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789',
    token: __ENV.OPENCLAW_GATEWAY_TOKEN, // required for any authed call
    sessionKey: __ENV.OPENCLAW_SESSION_KEY || 'main',
    // Per-row knobs the manifest/CI can override:
    rowId: __ENV.PROOF_ROW || 'unspecified',
    candidateSha: __ENV.CANDIDATE_SHA || 'UNVERIFIED-SHA',
    seatName: __ENV.SEAT_NAME || 'unknown-seat',
    nonce: __ENV.PROOF_NONCE || `k6-${Date.now()}`,
    // Hard safety gate: a fire scenario refuses to invoke a continuation tool
    // unless SAFE_TO_FIRE === '1'. Default is OFF so a bare `k6 run` cannot
    // accidentally drive a live continuation. See README "Safety gates".
    safeToFire: __ENV.SAFE_TO_FIRE === '1',
  };
}

// Fail-closed token check. Returns true if a token is present; scenarios should
// classify a missing token as a HARNESS-SETUP issue (not a FAIL of the SUT).
export function requireToken(cfg, recorder) {
  if (!cfg.token) {
    recorder.note('setup', 'OPENCLAW_GATEWAY_TOKEN is unset — cannot authenticate. ' +
      'This is a HARNESS-SETUP condition, not a SUT verdict.');
    return false;
  }
  return true;
}

// ---- inbound-frame recorder -----------------------------------------------
//
// Buffers every inbound frame plus structured notes. The post-processor reads
// the JSON this produces (printed to k6 stdout as one NDJSON line per event,
// AND returned in the k6 summary via handleSummary in each scenario) to author
// gateway-events.ndjson and the EVIDENCE.md draft.
export function newRecorder(meta) {
  const frames = [];      // every inbound raw frame, parsed when possible
  const notes = [];       // harness-level structured observations
  const correlations = {}; // id -> { method, sentAt, res, resAt }
  const facts = {         // booleans/values scenarios assert against the SPEC
    connected: false,
    authOk: null,
    toolsVisible: {},     // toolName -> bool
    fired: {},            // logical step -> { ok, id, raw }
    receipts: {},         // named receipt -> value (traceId, taskId, childKey…)
  };

  function record(rawText) {
    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch (_e) { /* keep raw */ }
    const evt = { at: Date.now(), raw: rawText, parsed };
    frames.push(evt);
    // NDJSON to stdout for live capture + post-processing ingestion.
    // (Token never appears in inbound frames; safe to echo.)
    console.log(`NDJSON ${JSON.stringify({ kind: 'frame', ...meta, ...evt })}`);
    // Correlate responses by id.
    if (parsed && parsed.type === 'res' && parsed.id && correlations[parsed.id]) {
      correlations[parsed.id].res = parsed;
      correlations[parsed.id].resAt = evt.at;
    }
    return parsed;
  }

  function track(id, method) {
    correlations[id] = { method, sentAt: Date.now(), res: null, resAt: null };
  }

  function note(kind, message, data) {
    const n = { at: Date.now(), kind, message, data: data || null };
    notes.push(n);
    console.log(`NDJSON ${JSON.stringify({ kind: 'note', ...meta, ...n })}`);
  }

  function setFact(path, value) {
    // shallow dotted-path set for the small `facts` shape above
    const parts = path.split('.');
    let cur = facts;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function snapshot() {
    return { meta, facts, notes, correlations, frameCount: frames.length, frames };
  }

  return { record, track, note, setFact, facts, frames, notes, correlations, snapshot };
}

// ---- send helper that auto-tracks correlation -----------------------------
export function send(socket, recorder, method, params, idTag) {
  const id = newId(idTag || method.replace(/\W+/g, '_'));
  recorder.track(id, method);
  socket.send(reqFrame(method, params, id));
  return id;
}

// Look up the response for a tracked id (after a wait window has elapsed).
export function responseFor(recorder, id) {
  const c = recorder.correlations[id];
  return c ? c.res : null;
}

// Heuristic: did a tracked call succeed? Tolerates the two likely shapes
//   { type:'res', ok:true, result } and { type:'res', error }.
export function callOk(recorder, id) {
  const res = responseFor(recorder, id);
  if (!res) return null; // no response yet / lost
  if (res.ok === true) return true;
  if (res.ok === false) return false;
  if (res.error) return false;
  if (res.result !== undefined) return true;
  return null;
}
