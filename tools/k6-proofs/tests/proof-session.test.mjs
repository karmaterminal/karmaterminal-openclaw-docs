import test from 'node:test';
import assert from 'node:assert/strict';

// k6 runtime globals the shared session helpers reach through `gateway-ws.js`.
// Declaring them here is also the contract check: anything these helpers need
// beyond k6 globals would be a Node dependency and must never appear.
globalThis.__VU = 1;
globalThis.__ITER = 0;
globalThis.__ENV = {};

const {
  disposableSessionKey,
  normalizedProofName,
  recordClassifiedEvent,
  GatewayHandshake,
  HANDSHAKE_SOURCE,
} = await import('../lib/proof-session.js');
const { RequestTracker, connectFrame } = await import('../lib/gateway-ws.js');

/** Minimal stand-in for the k6 WebSocket object used by scenarios. */
function fakeSocket() {
  const timers = [];
  return {
    sent: [],
    timers,
    send(frame) { this.sent.push(frame); },
    setTimeout(fn, ms) { timers.push({ fn, ms }); },
    fireTimers() { const pending = timers.splice(0); for (const t of pending) t.fn(); },
  };
}

test('disposable session keys normalize to one canonical form', () => {
  assert.equal(disposableSessionKey('r-cd-4-parent', 'R-CD-4-1786-AbC'), 'r-cd-4-parent-r-cd-4-1786-abc');
  assert.equal(disposableSessionKey('r-cw-1', 'nonce_with.dots/and:colons'),
    'r-cw-1-nonce-with-dots-and-colons');
  assert.equal(normalizedProofName('task-prefix', 'NONCE'), 'task-prefix-nonce');
});

test('key derivation fails closed rather than inventing a key', () => {
  assert.equal(disposableSessionKey('', 'nonce'), null);
  assert.equal(disposableSessionKey('prefix', ''), null);
  assert.equal(disposableSessionKey('prefix', null), null);
  assert.equal(disposableSessionKey(undefined, undefined), null);
  assert.equal(normalizedProofName('prefix', 42), null);
});

test('the shared derivation reproduces the inline form every scenario carried', () => {
  const inline = (prefix, nonce) => `${prefix}-${nonce}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  for (const [prefix, nonce] of [
    ['r-cd-1', 'R-CD-1-1786788707904-ab12cd34'],
    ['r-cd-4-target', 'R-CD-4-1786788852-xy'],
    ['r-cw-token', 'R-CW-TOKEN-1786-Zz'],
    ['r-rc-2', 'R-RC-2-1786-9'],
  ]) {
    assert.equal(disposableSessionKey(prefix, nonce), inline(prefix, nonce));
  }
});

test('classified frames record in one shape with the row redaction applied', () => {
  const evidence = { redacted_events: [] };
  const redactEvent = (payload) => ({ sessionKey: payload.sessionKey });
  recordClassifiedEvent(evidence, {
    kind: 'response',
    method: 'sessions.create',
    ok: true,
    payload: { sessionKey: 'agent:main:k6', secret: 'do-not-copy' },
  }, redactEvent);
  assert.equal(evidence.redacted_events.length, 1);
  const [record] = evidence.redacted_events;
  assert.equal(record.kind, 'response');
  assert.equal(record.method, 'sessions.create');
  assert.equal(record.event, null);
  assert.equal(record.ok, true);
  assert.deepEqual(record.data, { sessionKey: 'agent:main:k6' });
  assert.ok(Number.isFinite(record.ts));
});

test('a row-specific redactor is preserved, not replaced by the generic one', () => {
  const evidence = { redacted_events: [] };
  const generic = () => ({ leaked: 'generic-redaction-used' });
  recordClassifiedEvent(evidence, { kind: 'event', event: 'session.message', data: { a: 1 } }, generic, {
    redactData: (frame) => ({ rowScoped: frame.event }),
  });
  assert.deepEqual(evidence.redacted_events[0].data, { rowScoped: 'session.message' });
});

test('recording refuses to invent an evidence array', () => {
  assert.equal(recordClassifiedEvent(null, { kind: 'other' }, () => null), null);
  assert.equal(recordClassifiedEvent({}, { kind: 'other' }, () => null), null);
});

test('handshake releases the row on the tracked connect acknowledgement', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  let ready = 0;
  const handshake = new GatewayHandshake({ tracker, fallbackMs: 500, onReady: () => { ready += 1; } });

  const id = handshake.begin(socket, 'token-value');
  assert.equal(socket.sent.length, 1);
  assert.equal(JSON.parse(socket.sent[0]).method, 'connect');
  assert.equal(ready, 0, 'row must not start before the gateway answers');

  const classified = tracker.classify({ type: 'res', id, payload: { ok: true } });
  assert.equal(classified.kind, 'response');
  assert.equal(classified.method, 'connect');
  assert.equal(handshake.observe(classified), true);
  assert.equal(ready, 1);
  assert.equal(handshake.ready, true);
  assert.equal(handshake.receipt().readySource, HANDSHAKE_SOURCE.CONNECT_ACK);
  assert.equal(handshake.receipt().connectAccepted, true);
});

test('a silent gateway still releases the row at the recorded upper bound', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  let ready = 0;
  const handshake = new GatewayHandshake({ tracker, fallbackMs: 250, onReady: () => { ready += 1; } });
  handshake.begin(socket, 'token-value');
  assert.equal(ready, 0);
  assert.deepEqual(socket.timers.map((t) => t.ms), [250], 'fallback preserves the original guard budget');
  socket.fireTimers();
  assert.equal(ready, 1);
  assert.equal(handshake.receipt().readySource, HANDSHAKE_SOURCE.DEADLINE_FALLBACK);
  assert.equal(handshake.receipt().connectAckObserved, false);
});

test('the row is released exactly once even when both paths trigger', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  let ready = 0;
  const handshake = new GatewayHandshake({ tracker, fallbackMs: 250, onReady: () => { ready += 1; } });
  const id = handshake.begin(socket, 'token-value');
  socket.fireTimers();
  handshake.observe(tracker.classify({ type: 'res', id, payload: {} }));
  socket.fireTimers();
  assert.equal(ready, 1, 'a duplicate release would double-create disposable sessions');
  assert.equal(handshake.receipt().readySource, HANDSHAKE_SOURCE.DEADLINE_FALLBACK);
});

test('a rejected connect releases the row and records the rejection', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  let ready = 0;
  const handshake = new GatewayHandshake({ tracker, fallbackMs: 500, onReady: () => { ready += 1; } });
  const id = handshake.begin(socket, 'bad-token');
  handshake.observe(tracker.classify({ type: 'res', id, error: { code: 'unauthorized' } }));
  assert.equal(ready, 1, 'suppressing the start would hide an auth rejection behind a timeout');
  assert.equal(handshake.receipt().readySource, HANDSHAKE_SOURCE.CONNECT_REJECTED);
  assert.equal(handshake.receipt().connectAccepted, false);
});

test('unrelated frames never satisfy the handshake', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  let ready = 0;
  const handshake = new GatewayHandshake({ tracker, fallbackMs: 500, onReady: () => { ready += 1; } });
  handshake.begin(socket, 'token-value');
  const sendId = tracker.send(socket, 'sessions.send', { key: 'k' });
  assert.equal(handshake.observe(tracker.classify({ type: 'res', id: sendId, payload: {} })), false);
  assert.equal(handshake.observe(tracker.classify({ type: 'event', event: 'session.message' })), false);
  assert.equal(handshake.observe(tracker.classify({ type: 'res', id: 'unknown' })), false);
  assert.equal(ready, 0);
  assert.equal(handshake.ready, false);
});

test('an untracked connect frame cannot be correlated — the defect this replaces', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  socket.send(connectFrame('token-value'));
  const sent = JSON.parse(socket.sent[0]);
  const classified = tracker.classify({ type: 'res', id: sent.id, payload: {} });
  assert.equal(classified.kind, 'other', 'legacy connectFrame discards the id, so the ack is untrackable');
});

test('the handshake receipt reaches the row evidence, not just the object', () => {
  // Documented as recorded in evidence; if nothing writes it, a gateway that
  // never acknowledges connect produces evidence byte-identical to a healthy
  // run — the success-shaped hole the handshake exists to close.
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  const evidence = { row: 'R-TEST', redacted_events: [] };
  const handshake = new GatewayHandshake({ tracker, evidence, fallbackMs: 250 });

  assert.ok(evidence.handshake, 'the receipt is present before the socket opens');
  assert.equal(evidence.handshake.ready, false);
  assert.equal(evidence.handshake.readySource, null);

  const id = handshake.begin(socket, 'token-value');
  handshake.observe(tracker.classify({ type: 'res', id, payload: {} }));
  assert.equal(evidence.handshake.ready, true);
  assert.equal(evidence.handshake.readySource, HANDSHAKE_SOURCE.CONNECT_ACK);
  assert.equal(evidence.handshake.connectAckObserved, true);
  assert.ok(Number.isFinite(evidence.handshake.readyLatencyMs));
});

test('a silent gateway is visible in evidence rather than indistinguishable', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  const evidence = { row: 'R-TEST', redacted_events: [] };
  const handshake = new GatewayHandshake({ tracker, evidence, fallbackMs: 500 });
  handshake.begin(socket, 'token-value');
  socket.fireTimers();
  assert.equal(evidence.handshake.readySource, HANDSHAKE_SOURCE.DEADLINE_FALLBACK);
  assert.equal(evidence.handshake.connectAckObserved, false);
  assert.equal(evidence.handshake.connectAccepted, null);
  assert.equal(evidence.handshake.fallbackMs, 500);
});

test('the handshake receipt carries no identities', () => {
  const tracker = new RequestTracker();
  const socket = fakeSocket();
  const evidence = { row: 'R-TEST', redacted_events: [] };
  const handshake = new GatewayHandshake({ tracker, evidence, fallbackMs: 250 });
  handshake.begin(socket, 'super-secret-gateway-token');
  socket.fireTimers();
  const serialized = JSON.stringify(evidence.handshake);
  assert.ok(!serialized.includes('super-secret-gateway-token'));
  for (const value of Object.values(evidence.handshake)) {
    assert.ok(
      value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string',
      'the receipt must stay scalar and publishable',
    );
  }
});
