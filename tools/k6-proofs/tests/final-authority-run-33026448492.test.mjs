import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../lib/r-cd-2-authoritative-receipt.mjs';
import {
  rCdChainTaskLedgerReceipt,
} from '../lib/r-cd-chained-depth-2-authority.mjs';
import {
  parseTokenReturnEvent,
  parseTokenReturnTranscriptMessage,
  tokenOriginCursorFromMessages,
} from '../lib/r-cd-token-contract.js';

const fixture = JSON.parse(await readFile(
  new URL('./fixtures/final-authority-run-33026448492.json', import.meta.url),
  'utf8',
));
const signingKey = 'final-authority-run-33026448492-test-key';
const hash = (value) => createHash('sha256')
  .update(String(value))
  .digest('hex')
  .slice(0, 16);

test('run 33026448492 R-CD-2 shape binds through the unique nonce-reason trace', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence: fixture.rCd2.evidence,
    correlation: fixture.rCd2.correlation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, signingKey).valid, true);
});

test('run 33026448492 depth shape accepts the recovered final task ledger', () => {
  const receipt = rCdChainTaskLedgerReceipt(fixture.depth.tasks, {
    rootSessionKey: fixture.depth.rootSessionKey,
    nonce: fixture.depth.nonce,
    dispatchAcceptedAtMs: fixture.depth.dispatchAcceptedAtMs,
  });
  assert.equal(receipt?.taskCount, 2);
  assert.equal(receipt?.recoveryWakeScheduled, true);
  assert.equal(receipt?.maxDepth, 2);
});

test('run 33026448492 token shape recovers the pre-subscription public return', () => {
  const token = fixture.token;
  const cursor = tokenOriginCursorFromMessages(token.messages, {
    expectedOriginRunId: token.originRunId,
  });
  assert.equal(cursor?.messageSeq, 2);
  const returnMessage = token.messages[1];
  const eventData = {
    sessionKey: token.targetSessionKey,
    message: returnMessage,
  };
  assert.equal(parseTokenReturnEvent(eventData, {
    expectedTargetSessionKey: token.targetSessionKey,
    expectedDelegateChildSessionKey: token.delegateChildSessionKey,
    expectedDelegateRunId: token.delegateRunId,
    expectedSentinel: token.sentinel,
    originCursor: cursor.messageSeq,
    subscriptionAcceptedAtMs: token.subscriptionAcceptedAtMs,
    observedAtMs: token.observedAtMs,
    hash,
  }), null);
  const receipt = parseTokenReturnTranscriptMessage(returnMessage, {
    expectedTargetSessionKey: token.targetSessionKey,
    expectedDelegateChildSessionKey: token.delegateChildSessionKey,
    expectedDelegateRunId: token.delegateRunId,
    expectedSentinel: token.sentinel,
    originCursor: cursor.messageSeq,
    observedAtMs: token.observedAtMs,
    hash,
  });
  assert.equal(receipt?.messageSeq, 3);
  assert.equal(receipt?.targetSessionHash, hash(token.targetSessionKey));
  assert.equal(receipt?.sourceSessionHash, hash(token.delegateChildSessionKey));
});

test('run 33026448492 fixture retains no private identifiers', () => {
  assert.equal(fixture.sanitization.privateSessionKeysReplaced, true);
  assert.equal(fixture.sanitization.privateRunIdsReplaced, true);
  assert.equal(fixture.sanitization.privateTaskIdsReplaced, true);
  assert.equal(fixture.sanitization.rowNonceReplaced, true);
  const serialized = JSON.stringify(fixture);
  assert.doesNotMatch(
    serialized,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
});
