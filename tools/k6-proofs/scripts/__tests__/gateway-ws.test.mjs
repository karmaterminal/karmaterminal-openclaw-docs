import assert from 'node:assert/strict';
import test from 'node:test';

import { connectFrame, withSessionCreateOwner } from '../../lib/gateway-ws.js';
import { HARNESS_CLIENT_IDENTITY } from '../../lib/gateway-client-identity.mjs';
import { READINESS_CLIENT } from '../target-readiness.mjs';

test('disposable session creation inherits an agent-prefixed proof selector', () => {
  assert.deepEqual(
    withSessionCreateOwner(
      { key: 'r-cd-1-nonce', label: 'k6 R-CD-1' },
      { OPENCLAW_SESSION_KEY: 'agent:main:main' },
    ),
    { key: 'r-cd-1-nonce', label: 'k6 R-CD-1', agentId: 'main' },
  );
});

test('explicit session creation ownership is preserved', () => {
  const params = { key: 'r-cd-1-nonce', agentId: 'research' };
  assert.equal(
    withSessionCreateOwner(params, { OPENCLAW_SESSION_KEY: 'agent:main:main' }),
    params,
  );
});

test('an agent-prefixed disposable key is already explicitly owned', () => {
  const params = { key: 'agent:research:r-cd-1-nonce' };
  assert.equal(
    withSessionCreateOwner(params, { OPENCLAW_SESSION_KEY: 'agent:main:main' }),
    params,
  );
});

test('single-agent unscoped selectors retain legacy behavior', () => {
  const params = { key: 'r-cd-1-nonce' };
  assert.equal(withSessionCreateOwner(params, { OPENCLAW_SESSION_KEY: 'main' }), params);
});

// k6 provides these globals; connectFrame reads them at call time.
function withK6Globals(env, fn) {
  const saved = { __ENV: globalThis.__ENV, __VU: globalThis.__VU, __ITER: globalThis.__ITER };
  Object.assign(globalThis, { __ENV: env, __VU: 1, __ITER: 0 });
  try {
    return fn();
  } finally {
    Object.assign(globalThis, saved);
  }
}

test('row scenarios and target readiness connect with one client identity', () => {
  const frame = JSON.parse(withK6Globals({}, () => connectFrame('scenario-token')));
  assert.deepEqual(HARNESS_CLIENT_IDENTITY, { id: 'gateway-client', mode: 'backend' });
  assert.deepEqual(
    { id: frame.params.client.id, mode: frame.params.client.mode },
    HARNESS_CLIENT_IDENTITY,
  );
  assert.deepEqual(
    { id: READINESS_CLIENT.id, mode: READINESS_CLIENT.mode },
    HARNESS_CLIENT_IDENTITY,
  );
  assert.equal(frame.params.role, 'operator');
  assert.equal(frame.params.device, undefined);
  assert.equal(frame.params.auth.token, 'scenario-token');
});
