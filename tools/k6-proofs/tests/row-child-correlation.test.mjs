import assert from 'node:assert/strict';
import test from 'node:test';
import {
  childSessionKeyForRow,
  childSessionKeysForRow,
  compactTaskIdentityToken,
  renderRowTaskTemplate,
} from '../lib/row-child-correlation.mjs';

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

test('rejects nonce-bearing routing keys as child authority', () => {
  const rowNonce = 'R-CD-MODEL-TOOL-new';
  assert.equal(childSessionKeyForRow({
    sessionKey: `agent:main:parent-${rowNonce}`,
    childSessionKey: 'luna-stale-child',
  }, rowNonce), null);
  assert.equal(childSessionKeyForRow({
    sessionKey: 'agent:main:requester',
    childSessionKey: `luna-stale-${rowNonce}`,
  }, rowNonce), null);
});

test('accepts a bounded nested task summary through an explicit compact row token', () => {
  const rowNonce = 'R-CD-4-EXACT-NONCE-WITH-LONG-RANDOM-SUFFIX';
  const taskIdentityToken = `RCD4:${rowNonce.slice(-16)}`;
  const title = `[continuation:chain-hop:1] Delegated task (turn 1/3): ${taskIdentityToken} ${rowNonce}`
    .slice(0, 80);
  assert.equal(childSessionKeyForRow({
    action: 'upserted',
    task: {
      sessionKey: `agent:main:r-cd-4-parent-${rowNonce}`,
      childSessionKey: 'luna-child-for-current-row',
      title,
    },
  }, rowNonce, [taskIdentityToken]), 'luna-child-for-current-row');
});

test('renders a compact identity token inside the bounded task title prefix', () => {
  const rowNonce = 'R-CD-MODEL-TOOL-1787124114519-6b39vz9h';
  const taskIdentityToken = compactTaskIdentityToken('MTOOL', rowNonce);
  const task = renderRowTaskTemplate(
    'MTOOL:{{nonceSuffix16}} Proof nonce {{nonce}}: report runtime identity.',
    rowNonce,
  );
  const title = `[continuation:chain-hop:1] Delegated task (turn 1/200): ${task}`.slice(0, 80);

  assert.equal(taskIdentityToken, 'MTOOL:4114519-6b39vz9h');
  assert.match(title, /MTOOL:4114519-6b39vz9h/);
  assert.equal(childSessionKeyForRow({
    tasks: [{ title, childSessionKey: 'model-tool-child' }],
  }, rowNonce, [taskIdentityToken]), 'model-tool-child');
});

test('rejects invalid compact task identity inputs', () => {
  assert.equal(compactTaskIdentityToken('too-long-prefix', 'R-CD-MODEL-TOOL-1234567890123456'), null);
  assert.equal(compactTaskIdentityToken('MTOOL', 'short'), null);
  assert.equal(renderRowTaskTemplate(null, 'nonce'), null);
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

test('rejects nested metadata as child authority without shadowing a real task record', () => {
  const rowNonce = 'R-CD-MODEL-TOOL-new';
  const metadataOnly = {
    metadata: {
      childSessionKey: 'stale-child-from-metadata',
      title: `Proof nonce ${rowNonce}`,
    },
  };
  assert.equal(childSessionKeyForRow(metadataOnly, rowNonce), null);

  const eventWithRealTask = {
    ...metadataOnly,
    task: {
      childSessionKey: 'luna-child-for-current-row',
      title: `Proof nonce ${rowNonce}`,
    },
  };
  assert.equal(
    childSessionKeyForRow(eventWithRealTask, rowNonce),
    'luna-child-for-current-row',
  );
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
  assert.deepEqual(
    childSessionKeysForRow(ambiguousEvent, 'R-CD-MODEL-TOOL-new'),
    ['luna-child-a', 'luna-child-b'],
  );
});
