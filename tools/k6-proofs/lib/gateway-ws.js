/**
 * Gateway WebSocket helpers for k6 proof harness.
 * Provides connect/auth, request framing, ID tracking, and event subscription.
 *
 * Protocol note: Gateway WS responses use { type: "res", id, payload?, error? }
 * NOT { result }. Track request IDs to correlate responses.
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
    scopes: ['operator.read', 'operator.write'],
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
  'ok', 'status', 'uptime', 'taskId', 'runId',
  'traceId', 'spanId', 'tools', 'name',
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
