import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rCdChainRootReturnCandidate,
  rCdChainRootReturnReceipt,
} from '../lib/r-cd-chained-depth-2-authority.mjs';

const nonce = 'R-CD-CHAIN-EXACT-NONCE';
const root = 'agent:main:r-cd-chain-root';

function systemEvent(text, sessionKey = root) {
  return { sessionKey, message: { role: 'system', content: [{ type: 'text', text }] } };
}

test('depth-2 chain binds an explicit root system receipt to both hop identities', () => {
  const candidate = rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: systemEvent(`GRANDCHILD-DONE ${nonce}`),
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
    marker: `GRANDCHILD-DONE ${nonce}`,
    role: 'system',
    childSessionKey: 'agent:main:subagent:child',
    grandchildSessionKey: 'agent:main:subagent:grandchild',
  });
});

test('depth-2 chain rejects ordinary GRANDCHILD-DONE assistant output', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: root,
      message: { role: 'assistant', content: `GRANDCHILD-DONE ${nonce}` },
    },
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects a correct marker delivered outside the root', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: systemEvent(`GRANDCHILD-DONE ${nonce}`, 'agent:main:subagent:child'),
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects prompt echoes and nonce-prefix lookalikes', () => {
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: systemEvent(`[k6-proof-harness] expect GRANDCHILD-DONE ${nonce}`),
    rootSessionKey: root,
    nonce,
  }), null);
  assert.equal(rCdChainRootReturnCandidate({
    eventName: 'session.message',
    eventData: systemEvent(`GRANDCHILD-DONE ${nonce}-STALE`),
    rootSessionKey: root,
    nonce,
  }), null);
});

test('depth-2 chain rejects a marker present only in sibling or nested metadata', () => {
  const eventData = systemEvent('unrelated root system message');
  eventData.metadata = { returnMarker: `GRANDCHILD-DONE ${nonce}` };
  eventData.message.metadata = { echoedMarker: `GRANDCHILD-DONE ${nonce}` };
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
    eventData: systemEvent(`GRANDCHILD-DONE ${nonce}`),
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
