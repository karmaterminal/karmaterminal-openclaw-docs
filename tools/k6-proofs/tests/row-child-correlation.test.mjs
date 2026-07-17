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

test('rejects a stale outer child key paired with an unrelated nested current-row task', () => {
  const mixedEvent = {
    childSessionKey: 'terra-child-from-earlier-row',
    task: {
      text: 'Proof nonce R-CD-MODEL-TOOL-new',
    },
  };

  assert.equal(childSessionKeyForRow(mixedEvent, 'R-CD-MODEL-TOOL-new'), null);
});

test('accepts a direct spawn record that binds its child key and task nonce', () => {
  const spawnEvent = {
    childSessionKey: 'luna-child-for-current-row',
    task: 'Proof nonce R-CD-MODEL-TOOL-new',
  };

  assert.equal(childSessionKeyForRow(spawnEvent, 'R-CD-MODEL-TOOL-new'), 'luna-child-for-current-row');
});

test('selects the one nested record whose own payload carries the current nonce', () => {
  const aggregateEvent = {
    records: [
      {
        childSessionKey: 'terra-child-from-earlier-row',
        task: 'Proof nonce R-CD-MODEL-TOKEN-old',
      },
      {
        childSessionKey: 'luna-child-for-current-row',
        task: 'Proof nonce R-CD-MODEL-TOOL-new',
      },
    ],
  };

  assert.equal(childSessionKeyForRow(aggregateEvent, 'R-CD-MODEL-TOOL-new'), 'luna-child-for-current-row');
});

test('fails closed when two different child keys are both bound to the row nonce', () => {
  const ambiguousEvent = {
    records: [
      {
        childSessionKey: 'luna-child-a',
        task: 'Proof nonce R-CD-MODEL-TOOL-new',
      },
      {
        childSessionKey: 'luna-child-b',
        task: 'Proof nonce R-CD-MODEL-TOOL-new',
      },
    ],
  };

  assert.equal(childSessionKeyForRow(ambiguousEvent, 'R-CD-MODEL-TOOL-new'), null);
});
