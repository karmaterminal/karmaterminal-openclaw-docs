/**
 * Shared k6-safe session mechanics for continuation proof rows.
 *
 * k6-safe: this module and everything it imports must stay free of Node
 * builtins and Node globals. k6 resolves a scenario's whole ESM graph before a
 * VU starts, so one `node:` edge anywhere below a scenario aborts the run at
 * initialization (exit 107) before a single frame is sent — the failure that
 * produced R-CD-4's empty PARTIAL.
 *
 * Rows keep their own semantics. What lives here is the mechanical part every
 * WS row re-implemented: how a disposable session key is derived, how a
 * classified frame is recorded into public evidence, and how a row knows the
 * gateway is ready to accept its first request.
 */

import { connectRequest } from './gateway-ws.js';

/** Characters a gateway session key may contain in this harness. */
const SESSION_KEY_ALLOWED = /[^a-z0-9-]/g;

/**
 * Canonical `<prefix>-<suffix>` harness identifier.
 *
 * Session keys and child task names share one normalization: lowercase, with
 * everything outside `[a-z0-9-]` collapsed to `-`. Twenty-two call sites across
 * nineteen scenarios carried it inline. Divergence here is not cosmetic: a row
 * whose normalization differs creates a session or task under a name its own
 * negative controls no longer recognize.
 */
export function normalizedProofName(prefix, suffix) {
  if (typeof prefix !== 'string' || prefix.length === 0) return null;
  if (typeof suffix !== 'string' || suffix.length === 0) return null;
  const name = `${prefix}-${suffix}`.toLowerCase().replace(SESSION_KEY_ALLOWED, '-');
  return name.length > 0 ? name : null;
}

/** Canonical disposable session key. */
export function disposableSessionKey(prefix, nonce) {
  return normalizedProofName(prefix, nonce);
}

/**
 * Append one allowlist-redacted frame record to a row's public evidence.
 *
 * The identical push block appeared in every WS scenario. Centralizing it
 * keeps `redacted_events` a single shape that `evidence-writer.mjs` can trust,
 * and keeps the redaction call from being accidentally dropped in a new row.
 *
 * Rows that need a stricter or differently-sourced redaction keep it: pass
 * `options.redactData` and this helper unifies only the record shape, never the
 * row's own redaction decision. R-CD-SILENT, R-CW-2, R-CW-3 and R-RC-1 each
 * redact from a different source, and those differences are load-bearing.
 */
export function recordClassifiedEvent(evidence, classified, redactEvent, options = {}) {
  if (!evidence || !Array.isArray(evidence.redacted_events)) return null;
  const data = typeof options.redactData === 'function'
    ? options.redactData(classified)
    : (classified.payload ? redactEvent(classified.payload) : null);
  const record = {
    ts: Date.now(),
    kind: classified.kind,
    method: classified.method || null,
    event: classified.event || null,
    ok: classified.ok !== undefined ? classified.ok : null,
    data,
  };
  evidence.redacted_events.push(record);
  return record;
}

/** Handshake readiness sources, recorded so the path taken is never implicit. */
export const HANDSHAKE_SOURCE = {
  CONNECT_ACK: 'connect-ack',
  CONNECT_REJECTED: 'connect-rejected',
  DEADLINE_FALLBACK: 'deadline-fallback',
};

/**
 * Response-driven gateway handshake with a bounded, recorded fallback.
 *
 * Every WS row previously sent an untracked `connect` frame and then guessed —
 * `socket.setTimeout(startProofFlow, 500)` or `setTimeout(createSession, 250)`
 * — that authentication had completed. The guess was structural, not
 * incidental: `connectFrame()` returned only the frame string, discarding the
 * request id, so no row could correlate the acknowledgement even if it wanted
 * to.
 *
 * This class tracks the connect request, so a row starts the moment the
 * gateway acknowledges. The old fixed delay survives only as an upper bound:
 * if no acknowledgement arrives, the row proceeds exactly when it used to and
 * records `deadline-fallback`, so a slow or silent handshake stays visible in
 * evidence instead of being absorbed into an unexplained downstream failure.
 */
export class GatewayHandshake {
  constructor({ tracker, fallbackMs = 500, onReady = null, evidence = null } = {}) {
    this._tracker = tracker;
    this._fallbackMs = Number.isFinite(fallbackMs) && fallbackMs >= 0 ? fallbackMs : 500;
    this._onReady = typeof onReady === 'function' ? onReady : null;
    // The receipt is only worth producing if something records it. A row that
    // silently takes `deadline-fallback` on every run — because the gateway
    // never answers `connect` at all — would otherwise emit evidence
    // byte-identical to a healthy run, which is the exact success-shaped hole
    // the handshake exists to close.
    this._evidence = evidence && typeof evidence === 'object' ? evidence : null;
    this._fired = false;
    this.sentAt = null;
    this.readySource = null;
    this.readyLatencyMs = null;
    this.ackObserved = false;
    this.ackOk = null;
    this._publish();
  }

  /** Send the tracked connect frame and arm the bounded fallback. */
  begin(socket, token) {
    const request = connectRequest(token);
    if (this._tracker && typeof this._tracker.register === 'function') {
      this._tracker.register(request);
    }
    this.sentAt = Date.now();
    socket.send(request.frame);
    socket.setTimeout(() => this._fire(HANDSHAKE_SOURCE.DEADLINE_FALLBACK), this._fallbackMs);
    return request.id;
  }

  /**
   * Offer a classified frame to the handshake.
   * Returns true when the frame was the connect acknowledgement.
   */
  observe(classified) {
    if (!classified || classified.kind !== 'response' || classified.method !== 'connect') return false;
    this.ackObserved = true;
    this.ackOk = classified.ok === true;
    // A rejected connect still releases the row: its own request-level checks
    // are the authority on the failure, and suppressing them here would turn a
    // visible auth rejection into an unexplained silent timeout.
    this._fire(this.ackOk ? HANDSHAKE_SOURCE.CONNECT_ACK : HANDSHAKE_SOURCE.CONNECT_REJECTED);
    return true;
  }

  /** True once the row has been released to start its proof flow. */
  get ready() {
    return this._fired;
  }

  /** Public-safe handshake summary for a row's evidence block. */
  receipt() {
    return {
      ready: this._fired,
      readySource: this.readySource,
      readyLatencyMs: this.readyLatencyMs,
      connectAckObserved: this.ackObserved,
      connectAccepted: this.ackOk,
      fallbackMs: this._fallbackMs,
    };
  }

  _publish() {
    if (this._evidence) this._evidence.handshake = this.receipt();
  }

  _fire(source) {
    if (this._fired) return;
    this._fired = true;
    this.readySource = source;
    this.readyLatencyMs = this.sentAt === null ? null : Date.now() - this.sentAt;
    this._publish();
    if (this._onReady) this._onReady(source);
  }
}
