import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayLifecycleRunId } from '../../lib/gateway-lifecycle.js';

test('R-CD-2 accepts only the documented top-level gateway lifecycle runId', () => {
  assert.equal(gatewayLifecycleRunId({ runId: 'send-run-1', stream: 'lifecycle' }), 'send-run-1');
  for (const value of [
    {},
    { run_id: 'legacy-looking' },
    { turnId: 'tool-turn' },
    { data: { runId: 'nested-attempt' } },
    { runId: '' },
  ]) {
    assert.equal(gatewayLifecycleRunId(value), null);
  }
});
