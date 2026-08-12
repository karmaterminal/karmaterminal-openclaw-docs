/**
 * Gateway WebSocket helpers for k6 proof harness.
 * Provides connect/auth, request framing, ID tracking, and event subscription.
 *
 * Protocol note: Gateway WS responses use { type: "res", id, payload?, error? }
 * NOT { result }. Track request IDs to correlate responses.
 *
 * ⚠️ Param name inconsistency across WS methods:
 *   tools.effective → { sessionKey }
 *   sessions.messages.subscribe → { key }
 *   sessions.send → { key }
 *   Don't assume uniformity; check per-method.
 */

/**
 * Build a JSON-RPC-style request frame for the OpenClaw Gateway WS protocol.
 * Returns { id, frame } so the caller can track the request ID.
 */
export function buildRequest(method, params = {}) {
  const id = `${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const frame = JSON.stringify({ type: 'req', id, method, params });
  return { id, method, frame };
}

/**
 * Legacy compat: returns just the frame string.
 */
export function frame(method, params = {}) {
  return buildRequest(method, params).frame;
}

/**
 * Build the initial connect frame for operator auth.
 */
export function connectFrame(token) {
  return frame('connect', {
    minProtocol: 3,
    maxProtocol: 4,
    client: {
      id: __ENV.HARNESS_CLIENT_ID || 'gateway-client',
      version: '0.2.0',
      platform: 'linux',
      mode: __ENV.HARNESS_CLIENT_MODE || 'backend',
    },
    role: 'operator',
    scopes: ['operator.read', 'operator.write', 'session.control'],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token },
    userAgent: 'k6-proof-harness/0.2.0',
  });
}

/**
 * Generate a unique nonce for proof correlation.
 */
export function nonce(rowId) {
  return `${rowId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Request tracker: maps request IDs to their method names for response correlation.
 */
export class RequestTracker {
  constructor() {
    this._pending = {};
  }

  /** Send a tracked request on the socket. Returns the request ID. */
  send(socket, method, params = {}) {
    const { id, frame } = buildRequest(method, params);
    this._pending[id] = { method, sentAt: Date.now() };
    socket.send(frame);
    return id;
  }

  /** Classify an inbound message against pending requests. */
  classify(msg) {
    if (msg.type === 'res' && msg.id && this._pending[msg.id]) {
      const req = this._pending[msg.id];
      delete this._pending[msg.id];
      return {
        kind: 'response',
        method: req.method,
        ok: !msg.error,
        payload: msg.payload || null,
        error: msg.error || null,
        latencyMs: Date.now() - req.sentAt,
      };
    }
    if (msg.type === 'event') {
      return { kind: 'event', event: msg.event || msg.method, data: msg.payload || msg.data || msg };
    }
    // Connect ack or untracked
    return { kind: 'other', raw: msg };
  }
}

/**
 * Redaction: strip sensitive fields from event payloads before writing to artifacts.
 * Only allowlisted fields survive into public NDJSON.
 */
const EVENT_ALLOWLIST = new Set([
  'type', 'id', 'method', 'event',
  // Payload fields safe for public
  'ok', 'status', 'uptime', 'sessionKey', 'taskId', 'runId',
  'childSessionKey', 'traceId', 'spanId', 'tools', 'name',
  'state', 'reason', 'delaySeconds', 'mode',
  // Timing
  'ts', 'timestamp', 'startedAt', 'completedAt', 'duration',
]);

export function redactEvent(event) {
  if (typeof event !== 'object' || event === null) return event;
  const out = {};
  for (const [key, value] of Object.entries(event)) {
    if (EVENT_ALLOWLIST.has(key)) {
      out[key] = typeof value === 'object' ? redactEvent(value) : value;
    }
  }
  return out;
}

/**
 * Detect a WebSocket upgrade that never actually happened.
 *
 * WHY THIS EXISTS (rig fault #8, 2026-08-10)
 * ------------------------------------------
 * k6's `ws.connect()` does not throw when the gateway refuses the upgrade.
 * It returns a response and simply never invokes the socket callback. Every
 * scenario in this suite assigned that response to `const res` and then
 * ignored it, so a refused connection produced exactly the same artefact as
 * a genuine proof failure:
 *
 *     duration ~0 ms, every evidence flag false, no trace, no error
 *
 * On 2026-08-10 the gateway on silas restarted mid-run. Three rows that had
 * previously PASSed (R-CW-TOKEN, R-CW-DELEGATE-SELF-CONTINUATION, R-CD-3)
 * were recorded as failures and reported as such. Re-running them against a
 * healthy gateway flipped all three back to PASS — R-CW-TOKEN went from
 * 0 ms/all-false to PASS in 12,605 ms. The evidence had been describing the
 * harness, not the feature.
 *
 * A successful RFC 6455 upgrade is exactly HTTP 101. Anything else is a rig
 * fault and must never be published as a statement about continuation:
 *   0    TCP refused / DNS failure — gateway not listening at all
 *   401  token rejected (expired OPENCLAW_TOKEN)
 *   426  server declined the upgrade
 *   5xx  gateway alive but broken
 *
 * Returns null when the connection is sound, or a structured fault object to
 * be attached to the evidence as `connect_failed`. Callers deliberately do
 * not throw: the evidence file must still be written so the aggregator can
 * see *why* the row is empty.
 */
export function assertConnected(res) {
  const status = res && typeof res.status === 'number' ? res.status : 0;
  if (status === 101) return null;
  return {
    ws_status: status,
    detail:
      status === 0
        ? 'connection refused before upgrade — gateway not listening on the proof port'
        : `gateway refused the WebSocket upgrade with HTTP ${status}`,
    meaning:
      'RIG FAULT, not a proof result. This row measured the harness, not the feature. Do not publish it as evidence either way.',
    remedy:
      'confirm gateway uptime spans the entire run window before trusting any row: ps -o lstart= -p <gateway pid>',
  };
}
