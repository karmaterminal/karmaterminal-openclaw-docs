import test from 'node:test';
import assert from 'node:assert/strict';
import { rCd4ReturnCandidate, rCd4ReturnReceipt } from '../lib/r-cd-4-authority.mjs';

const nonce = 'R-CD-4-EXACT-NONCE';
const target = 'agent:main:r-cd-4-target';
const parent = 'agent:main:r-cd-4-parent';

test('R-CD-4 accepts only the exact target marker and binds child identity', () => {
  const candidate = rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  });
  assert.deepEqual(rCd4ReturnReceipt(candidate, 'agent:main:subagent:child'), {
    eventName: 'session.message',
    sessionKey: target,
    nonce,
    marker: `TARGET-RECEIVED ${nonce}`,
    role: 'system',
    childSessionKey: 'agent:main:subagent:child',
  });
});

test('R-CD-4 rejects an unrelated delayed target message', () => {
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: { sessionKey: target, message: { role: 'system', content: 'ordinary delayed target output' } },
    expectedSessionKey: target,
    nonce,
  }), null);
});

test('R-CD-4 rejects prompt echo and nonce-prefix lookalikes', () => {
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `[k6-proof-harness] ask for TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  }), null);
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: { sessionKey: target, message: { role: 'system', content: `TARGET-RECEIVED ${nonce}-STALE` } },
    expectedSessionKey: target,
    nonce,
  }), null);
});

test('R-CD-4 never routes from a nested session-key mention', () => {
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: { sessionKey: parent, message: { role: 'system', content: `for ${target}: TARGET-RECEIVED ${nonce}` } },
    expectedSessionKey: target,
    nonce,
  }), null);
});

test('R-CD-4 withholds a marker candidate until child identity is available', () => {
  const candidate = rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: { sessionKey: target, message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` } },
    expectedSessionKey: target,
    nonce,
  });
  assert.equal(rCd4ReturnReceipt(candidate, null), null);
});

test('R-CD-4 rejects an assistant-authored marker in the target session', () => {
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'assistant', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  }), null);
});

test('R-CD-4 rejects a marker present only in sibling or nested metadata', () => {
  const eventData = {
    sessionKey: target,
    message: {
      role: 'system',
      content: [{ type: 'text', text: 'unrelated target system message' }],
      metadata: { echoedMarker: `TARGET-RECEIVED ${nonce}` },
    },
    metadata: { returnMarker: `TARGET-RECEIVED ${nonce}` },
  };
  assert.equal(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData,
    expectedSessionKey: target,
    nonce,
  }), null);
});
