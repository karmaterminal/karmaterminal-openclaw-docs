import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R_CD_4_DURATION_THRESHOLD_MS,
  R_CD_4_OBSERVATION_WINDOW_MS,
  rCd4ChildAuthority,
  rCd4ReturnCandidate,
  rCd4ReturnReceipt,
  rCd4SessionMessageObservation,
  rCd4ShouldScheduleEarlyClose,
  rCd4TaskIdentityToken,
  rCd4TaskObservation,
  rCd4TaskPrompt,
} from '../lib/r-cd-4-authority.mjs';

const nonce = 'R-CD-4-EXACT-NONCE';
const target = 'agent:main:r-cd-4-target';
const parent = 'agent:main:r-cd-4-parent';

test('R-CD-4 duration threshold leaves headroom after the full observation window', () => {
  assert.ok(R_CD_4_DURATION_THRESHOLD_MS > R_CD_4_OBSERVATION_WINDOW_MS);
  assert.ok(R_CD_4_DURATION_THRESHOLD_MS < 120_000);
});

test('R-CD-4 child authority fails closed across conflicting observations', () => {
  assert.deepEqual(rCd4ChildAuthority(['agent:main:subagent:child-a']), {
    observedChildSessionKeys: ['agent:main:subagent:child-a'],
    childSessionKey: 'agent:main:subagent:child-a',
    ambiguous: false,
  });
  assert.deepEqual(rCd4ChildAuthority([
    'agent:main:subagent:child-a',
    'agent:main:subagent:child-b',
    'agent:main:subagent:child-a',
  ]), {
    observedChildSessionKeys: [
      'agent:main:subagent:child-a',
      'agent:main:subagent:child-b',
    ],
    childSessionKey: null,
    ambiguous: true,
  });
});

test('R-CD-4 task prompt keeps the compact token in the traced reason', () => {
  const prompt = rCd4TaskPrompt(
    'RCD4:{{nonceSuffix16}} Proof nonce {{nonce}}: return the marker.',
    nonce,
  );
  assert.equal(prompt, `RCD4:${nonce.slice(-16)} Proof nonce ${nonce}: return the marker.`);
  assert.ok(prompt.startsWith(rCd4TaskIdentityToken(nonce)));
});

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

test('R-CD-4 retains an authoritative target receipt before the generic wake gate', () => {
  const observation = rCd4SessionMessageObservation({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    targetSessionKey: target,
    parentSessionKey: parent,
    nonce,
    elapsedMs: 1_000,
    wakeGateMs: 5_000,
  });
  assert.equal(observation.genericWakeObserved, false);
  assert.equal(observation.parentCandidate, null);
  assert.equal(observation.targetCandidate?.sessionKey, target);
  assert.notEqual(rCd4ReturnReceipt(
    observation.targetCandidate,
    'agent:main:subagent:child',
  ), null);
});

test('R-CD-4 retains an early parent receipt so a later target cannot false-PASS', () => {
  const earlyParent = rCd4SessionMessageObservation({
    eventName: 'session.message',
    eventData: {
      sessionKey: parent,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    targetSessionKey: target,
    parentSessionKey: parent,
    nonce,
    elapsedMs: 1_000,
    wakeGateMs: 5_000,
  });
  const laterTarget = rCd4SessionMessageObservation({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    targetSessionKey: target,
    parentSessionKey: parent,
    nonce,
    elapsedMs: 6_000,
    wakeGateMs: 5_000,
  });
  const child = 'agent:main:subagent:child';
  assert.equal(earlyParent.genericWakeObserved, false);
  assert.notEqual(rCd4ReturnReceipt(earlyParent.parentCandidate, child), null);
  assert.notEqual(rCd4ReturnReceipt(laterTarget.targetCandidate, child), null);
});

test('R-CD-4 accepts tasks.list child authority only from a nonce-bound childSessionKey', () => {
  const taskIdentityToken = rCd4TaskIdentityToken(nonce);
  const title = `[continuation:chain-hop:1] Delegated task (turn 1/3): ${taskIdentityToken} Proof nonce ${nonce}`
    .slice(0, 80);
  assert.ok(title.includes(taskIdentityToken));
  assert.deepEqual(rCd4TaskObservation({
    sessionKey: parent,
    childSessionKey: 'agent:main:subagent:child',
    title,
    status: 'completed',
    traceId: 'a'.repeat(32),
  }, nonce), {
    childSessionKey: 'agent:main:subagent:child',
    completed: true,
    traceId: 'a'.repeat(32),
  });
});

test('R-CD-4 rejects requester sessionKey and nested nonce as tasks.list child authority', () => {
  const observation = rCd4TaskObservation({
    sessionKey: 'agent:main:requester',
    childSessionKey: 'agent:main:subagent:stale-child',
    status: 'completed',
    metadata: {
      childSessionKey: 'agent:main:subagent:nested-current-child',
      task: `unrelated ${nonce}`,
    },
  }, nonce);
  assert.deepEqual(observation, {
    childSessionKey: null,
    completed: false,
    traceId: null,
  });
  const targetCandidate = rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  });
  assert.equal(rCd4ReturnReceipt(targetCandidate, observation.childSessionKey), null);
});

test('R-CD-4 rejects nonce-bearing routing keys with an unrelated stale child', () => {
  assert.deepEqual(rCd4TaskObservation({
    sessionKey: `agent:main:r-cd-4-parent-${nonce}`,
    childSessionKey: 'agent:main:subagent:stale-child',
    title: 'unrelated completed task',
    status: 'completed',
  }, nonce), {
    childSessionKey: null,
    completed: false,
    traceId: null,
  });

  assert.deepEqual(rCd4TaskObservation({
    sessionKey: 'agent:main:requester',
    childSessionKey: `agent:main:subagent:stale-${nonce}`,
    title: 'unrelated completed task',
    status: 'completed',
  }, nonce), {
    childSessionKey: null,
    completed: false,
    traceId: null,
  });
});

test('R-CD-4 keeps observing after a target receipt but closes early on parent failure', () => {
  const child = 'agent:main:subagent:child';
  const targetReceipt = rCd4ReturnReceipt(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  }), child);
  const parentReceipt = rCd4ReturnReceipt(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: parent,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: parent,
    nonce,
  }), child);

  assert.equal(rCd4ShouldScheduleEarlyClose({ parentReturnReceipt: null }), false);
  assert.equal(rCd4ShouldScheduleEarlyClose({
    targetReturnReceipt: targetReceipt,
    parentReturnReceipt: null,
  }), false);
  assert.equal(rCd4ShouldScheduleEarlyClose({ parentReturnReceipt: parentReceipt }), true);
});
