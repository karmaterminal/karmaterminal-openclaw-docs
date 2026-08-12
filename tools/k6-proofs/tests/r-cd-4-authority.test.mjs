import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R_CD_4_DURATION_THRESHOLD_MS,
  R_CD_4_OBSERVATION_WINDOW_MS,
  rCd4ChildAuthority,
  rCd4DiagnosticMarkerCandidate,
  rCd4HistoryObservation,
  rCd4JournalReturnAuthority,
  rCd4ReturnCandidate,
  rCd4ReturnReceipt,
  rCd4SessionMessageObservation,
  rCd4TaskIdentityToken,
  rCd4TaskObservation,
  rCd4TaskPrompt,
} from '../lib/r-cd-4-authority.mjs';

const nonce = 'R-CD-4-EXACT-NONCE';
const target = 'agent:main:r-cd-4-target';
const parent = 'agent:main:r-cd-4-parent';
const child = 'agent:main:subagent:child';

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
  assert.equal(rCd4ChildAuthority([
    'agent:main:subagent:child-a',
    'agent:main:subagent:child-b',
  ]).ambiguous, true);
});

test('R-CD-4 task prompt keeps the compact token in the traced reason', () => {
  const prompt = rCd4TaskPrompt(
    'RCD4:{{nonceSuffix16}} Proof nonce {{nonce}}: return the marker.',
    nonce,
  );
  assert.equal(prompt, `RCD4:${nonce.slice(-16)} Proof nonce ${nonce}: return the marker.`);
  assert.ok(prompt.startsWith(rCd4TaskIdentityToken(nonce)));
});

test('R-CD-4 transcript TARGET-RECEIVED is diagnostic only and never delivery authority', () => {
  const marker = rCd4DiagnosticMarkerCandidate({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    expectedSessionKey: target,
    nonce,
  });
  assert.equal(marker.authoritative, false);
  assert.equal(rCd4ReturnReceipt(marker, child), null);
  // Deprecated alias still cannot promote PASS.
  assert.equal(rCd4ReturnReceipt(rCd4ReturnCandidate({
    eventName: 'session.message',
    eventData: { sessionKey: target, message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` } },
    expectedSessionKey: target,
    nonce,
  }), child), null);
});

test('R-CD-4 session/history observations never populate authoritative candidates', () => {
  const observation = rCd4SessionMessageObservation({
    eventName: 'session.message',
    eventData: {
      sessionKey: target,
      message: { role: 'system', content: `TARGET-RECEIVED ${nonce}` },
    },
    targetSessionKey: target,
    parentSessionKey: parent,
    nonce,
    elapsedMs: 1000,
    wakeGateMs: 5000,
  });
  assert.equal(observation.targetCandidate, null);
  assert.equal(observation.parentCandidate, null);
  assert.equal(observation.targetDiagnosticMarker?.authoritative, false);

  const history = rCd4HistoryObservation({
    messages: [{ role: 'system', content: `TARGET-RECEIVED ${nonce}` }],
    sessionKey: target,
    targetSessionKey: target,
    parentSessionKey: parent,
    nonce,
    elapsedMs: 6000,
    wakeGateMs: 5000,
  });
  assert.equal(history.targetCandidate, null);
  assert.equal(history.targetDiagnosticMarker?.marker, 'TARGET-RECEIVED');
});

test('R-CD-4 journal authority PASSes on exact target delivery and rejects parent', () => {
  const signingKey = 'r-cd-4-unit-gateway-token';
  const ts = '2026-08-09T17:13:29.848-07:00';
  const start = Date.parse('2026-08-09T17:13:00.000-07:00');
  const end = Date.parse('2026-08-09T17:14:00.000-07:00');
  const journal = `${ts} node: [continuation:targeted-return] Delivered to ${target} from ${child}\n`;
  const pass = rCd4JournalReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: start,
    windowEndMs: end,
    signingKey,
  });
  assert.equal(pass.verdict, 'PASS-candidate');
  assert.equal(pass.structuralOk, true);
  assert.equal(pass.integrity?.algorithm, 'hmac-sha256-gateway-token-v1');

  const withParent = rCd4JournalReturnAuthority({
    journalText: journal + `${ts} node: [continuation:targeted-return] Delivered to ${parent} from ${child}\n`,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: start,
    windowEndMs: end,
    signingKey,
  });
  assert.equal(withParent.failureCategory, 'parent-delivery');
});

test('R-CD-4 accepts tasks.list child authority only from a nonce-bound childSessionKey', () => {
  const taskIdentityToken = rCd4TaskIdentityToken(nonce);
  const title = `[continuation:chain-hop:1] Delegated task (turn 1/3): ${taskIdentityToken} Proof nonce ${nonce}`
    .slice(0, 80);
  assert.deepEqual(rCd4TaskObservation({
    sessionKey: parent,
    childSessionKey: child,
    title,
    status: 'completed',
    traceId: 'a'.repeat(32),
  }, nonce), {
    childSessionKey: child,
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
  assert.equal(observation.childSessionKey, null);
});
