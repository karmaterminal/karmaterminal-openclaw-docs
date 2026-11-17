import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import { connectFrame, withSessionCreateOwner } from '../../lib/gateway-ws.js';
// Namespace imports, so a symbol a tree does not export yet fails only the test that reads it.
import * as identity from '../../lib/gateway-client-identity.mjs';
import * as readiness from '../target-readiness.mjs';

const { HARNESS_CLIENT_IDENTITY } = identity;
const { READINESS_CLIENT } = readiness;

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

test('readiness watches exactly the environment variables connectFrame reads for its identity', () => {
  assert.deepEqual(identity.HARNESS_CLIENT_OVERRIDE_ENV, ['HARNESS_CLIENT_ID', 'HARNESS_CLIENT_MODE']);
  const source = readFileSync(new URL('../../lib/gateway-ws.js', import.meta.url), 'utf8');
  assert.deepEqual(
    [...new Set([...source.matchAll(/__ENV\.(HARNESS_[A-Z_]+)/gu)].map((match) => match[1]))].sort(),
    [...identity.HARNESS_CLIENT_OVERRIDE_ENV].sort(),
  );
  // They do replace the identity, which is why readiness refuses to pass while one is set.
  const frame = JSON.parse(withK6Globals(
    { HARNESS_CLIENT_ID: 'cli', HARNESS_CLIENT_MODE: 'cli' },
    () => connectFrame('scenario-token'),
  ));
  assert.deepEqual({ id: frame.params.client.id, mode: frame.params.client.mode }, { id: 'cli', mode: 'cli' });

  assert.deepEqual(readiness.harnessClientOverrides({}), []);
  assert.deepEqual(readiness.harnessClientOverrides({ PATH: '/bin', HARNESS_CLIENT_IDS: 'x' }), []);
  assert.deepEqual(readiness.harnessClientOverrides({ HARNESS_CLIENT_MODE: '' }), ['HARNESS_CLIENT_MODE']);
  assert.deepEqual(
    readiness.harnessClientOverrides({ HARNESS_CLIENT_MODE: 'backend', HARNESS_CLIENT_ID: 'gateway-client' }),
    ['HARNESS_CLIENT_ID', 'HARNESS_CLIENT_MODE'],
  );
});
