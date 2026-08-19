import assert from 'node:assert/strict';
import test from 'node:test';

import { withSessionCreateOwner } from '../../lib/gateway-ws.js';

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
