import assert from 'node:assert/strict';
import test from 'node:test';
import { childSessionKeyForRow } from '../lib/row-child-correlation.mjs';

test('rejects an earlier row child even when its event carries a child key', () => {
  const staleEvent = {
    childSessionKey: 'terra-child-from-r-cd-model-token',
    task: { text: 'Proof nonce R-CD-MODEL-TOKEN-old' },
  };

  assert.equal(childSessionKeyForRow(staleEvent, 'R-CD-MODEL-TOOL-new'), null);
});

test('accepts only the child key from the current row nonce', () => {
  const rowEvent = {
    task: {
      childSessionKey: 'luna-child-for-current-row',
      text: 'Proof nonce R-CD-MODEL-TOOL-new',
    },
  };

  assert.equal(childSessionKeyForRow(rowEvent, 'R-CD-MODEL-TOOL-new'), 'luna-child-for-current-row');
});
