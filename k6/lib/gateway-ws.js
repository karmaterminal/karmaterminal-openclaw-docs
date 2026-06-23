/**
 * Gateway WebSocket helpers for k6 proof harness.
 * Provides connect/auth, request framing, and event subscription.
 */

/**
 * Build a JSON-RPC-style request frame for the OpenClaw Gateway WS protocol.
 */
export function frame(method, params = {}) {
  return JSON.stringify({
    type: 'req',
    id: `${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    params,
  });
}

/**
 * Build the initial connect frame for operator auth.
 */
export function connectFrame(token) {
  return frame('connect', {
    minProtocol: 3,
    maxProtocol: 4,
    client: {
      id: 'k6-proof-harness',
      version: '0.1.0',
      platform: 'linux',
      mode: 'operator',
    },
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token },
    userAgent: 'k6-proof-harness/0.1.0',
  });
}

/**
 * Generate a unique nonce for proof correlation.
 */
export function nonce(rowId) {
  return `${rowId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
