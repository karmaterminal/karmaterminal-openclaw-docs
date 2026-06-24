/**
 * k6 PROOFS — Gateway connection helpers
 * 
 * Provides WebSocket operator connection to the OpenClaw gateway
 * for proof-row automation.
 */

import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Custom metrics for proof runs
export const proofDuration = new Trend('proof_row_duration', true);
export const proofPass = new Counter('proof_row_pass');
export const proofFail = new Counter('proof_row_fail');
export const proofPassRate = new Rate('proof_row_pass_rate');

// Gateway connection config (override via env)
const GATEWAY_URL = __ENV.GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = __ENV.GATEWAY_TOKEN || '';

/**
 * Connect to gateway operator WebSocket
 * Returns the socket for sending/receiving frames
 */
export function connectGateway(opts = {}) {
  const url = opts.url || GATEWAY_URL;
  const token = opts.token || GATEWAY_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  return { url, headers };
}

/**
 * Send a JSON frame and wait for response matching a predicate
 */
export function sendAndWait(socket, frame, predicate, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for response')), timeoutMs);
    
    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (predicate(data)) {
          clearTimeout(timeout);
          resolve(data);
        }
      } catch (e) {
        // ignore non-JSON frames
      }
    });
    
    socket.send(JSON.stringify(frame));
  });
}

/**
 * Record a proof row result
 */
export function recordResult(rowName, passed, durationMs) {
  proofDuration.add(durationMs, { row: rowName });
  if (passed) {
    proofPass.add(1, { row: rowName });
  } else {
    proofFail.add(1, { row: rowName });
  }
  proofPassRate.add(passed ? 1 : 0, { row: rowName });
}

/**
 * Generate a unique nonce for correlation
 */
export function generateNonce() {
  return `proof-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
