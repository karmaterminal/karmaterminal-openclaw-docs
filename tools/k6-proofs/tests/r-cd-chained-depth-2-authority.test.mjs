import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rCdChainRootReturnCandidate,
  rCdChainObservationState,
  rCdChainRootReturnReceipt,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

const nonce = 'R-CD-CHAIN-EXACT-NONCE';
const root = 'agent:main:r-cd-chain-root';

function assistantEvent(text, sessionKey = root) {
  return { sessionKey, message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

test('depth-2 chain binds an explicit root consumption ack to both hop identities', () => {
  const candidate = rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`ROOT-CHAIN-ACK ${nonce}`),
    rootSessionKey: root,
    nonce,
  });
  assert.deepEqual(rCdChainRootReturnReceipt(candidate, {
    childSessionKey: 'agent:main:subagent:child',
    grandchildSessionKey: 'agent:main:subagent:grandchild',
  }), {
    eventName: 'session.message',
    rootSessionKey: root,
    nonce,
    marker: `ROOT-CHAIN-ACK ${nonce}`,
    role: 'assistant',
    childSessionKey: 'agent:main:subagent:child',
    grandchildSessionKey: 'agent:main:subagent:grandchild',
  });
});

test('depth-2 chain rejects ordinary GRANDCHILD-DONE assistant output', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`GRANDCHILD-DONE ${nonce}`),
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects a correct marker delivered outside the root', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`ROOT-CHAIN-ACK ${nonce}`, 'agent:main:subagent:child'),
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects prompt echoes and nonce-prefix lookalikes', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`[k6-proof-harness] expect ROOT-CHAIN-ACK ${nonce}`),
    rootSessionKey: root,
    nonce,
  }), null);
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`ROOT-CHAIN-ACK ${nonce}-STALE`),
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects a marker present only in sibling or nested metadata', () => {
  const eventData = assistantEvent('unrelated root assistant message');
  eventData.metadata = { returnMarker: `ROOT-CHAIN-ACK ${nonce}` };
  eventData.message.metadata = { echoedMarker: `ROOT-CHAIN-ACK ${nonce}` };
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData,
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain withholds return authority without two distinct hop identities', () => {
  const candidate = rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: assistantEvent(`ROOT-CHAIN-ACK ${nonce}`),
    rootSessionKey: root,
    nonce,
  });
  assert.equal(rCdChainRootReturnReceipt(candidate, {
    childSessionKey: 'agent:main:subagent:child',
    grandchildSessionKey: null,
  }), null);
  assert.equal(rCdChainRootReturnReceipt(candidate, {
    childSessionKey: 'agent:main:subagent:same',
    grandchildSessionKey: 'agent:main:subagent:same',
  }), null);
});

test('depth-2 chain gives root return a fresh post-grandchild observation window', () => {
  const dispatchAcceptedAt = 1_000;
  const grandchildObservedAt = 149_000;
  const waiting = rCdChainObservationState({
    now: 150_001,
    dispatchAcceptedAt,
    grandchildObservedAt,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  });
  assert.deepEqual(waiting, {
    phase: 'awaiting-root-return',
    deadlineAtMs: 269_000,
    timedOut: false,
  });
  assert.equal(rCdChainObservationState({
    now: 269_000,
    dispatchAcceptedAt,
    grandchildObservedAt,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'root-return-timeout');
});

test('depth-2 chain distinguishes descendant timeout, root timeout, and recovery', () => {
  assert.equal(rCdChainObservationState({
    now: 151_000,
    dispatchAcceptedAt: 1_000,
    grandchildObservedAt: null,
    rootReturnReceipt: null,
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'descendant-timeout');
  assert.equal(rCdChainObservationState({
    now: 200_000,
    dispatchAcceptedAt: 1_000,
    grandchildObservedAt: 50_000,
    rootReturnReceipt: { marker: 'bound' },
    descendantTimeoutMs: 150_000,
    rootReturnTimeoutMs: 120_000,
  }).phase, 'complete');
});
