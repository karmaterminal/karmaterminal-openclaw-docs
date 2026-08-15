import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  digest64,
  fingerprint16,
  fingerprintValue16,
  isHexOfLength,
  RECEIPT_INTEGRITY_ALGORITHM,
  receiptSignature,
  sealReceipt,
  verifyReceiptSeal,
} from '../../lib/receipt-seal.mjs';
import {
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../../lib/r-cd-2-authoritative-receipt.mjs';
import {
  resolveTargetedReturnAuthority,
  validateTargetedReturnReceipt,
} from '../../lib/targeted-return-receipt.mjs';

const KEY = 'gateway-token-under-test';
const canonical = (receipt) => JSON.stringify({ row: receipt.row, verdict: receipt.verdict });

test('primitives keep the exact shapes every row already published', () => {
  assert.equal(isHexOfLength('abcdef0123456789', 16), true);
  assert.equal(isHexOfLength('ABCDEF0123456789', 16), true);
  assert.equal(isHexOfLength('abcdef012345678', 16), false);
  assert.equal(isHexOfLength(null, 16), false);

  assert.match(fingerprint16('agent:main:k6'), /^[a-f0-9]{16}$/);
  assert.equal(fingerprint16(''), null);
  assert.equal(fingerprint16(null), null);
  assert.match(fingerprintValue16(null), /^[a-f0-9]{16}$/, 'value fingerprint never returns null');
  assert.match(digest64({ a: 1 }), /^[a-f0-9]{64}$/);
});

test('sealing is the documented gateway-token HMAC over the row canonical form', () => {
  const receipt = { row: 'R-TEST', verdict: 'PASS-candidate' };
  const sealed = sealReceipt(receipt, KEY, canonical);
  assert.equal(sealed.integrity.algorithm, RECEIPT_INTEGRITY_ALGORITHM);
  assert.equal(
    sealed.integrity.signature,
    createHmac('sha256', KEY).update(canonical(receipt)).digest('hex'),
  );
  assert.deepEqual(verifyReceiptSeal(sealed, KEY, canonical), { valid: true });
});

test('sealing without a key throws instead of emitting an unsigned receipt', () => {
  assert.throws(() => sealReceipt({ row: 'R-TEST' }, '', canonical), /missing gateway signing key/);
  assert.throws(() => sealReceipt({ row: 'R-TEST' }, undefined, canonical), /missing gateway signing key/);
  assert.throws(() => receiptSignature('anything', null), /missing gateway signing key/);
});

test('verification fails closed on every malformed input instead of throwing', () => {
  const sealed = sealReceipt({ row: 'R-TEST', verdict: 'PASS-candidate' }, KEY, canonical);
  assert.deepEqual(verifyReceiptSeal(sealed, '', canonical), { valid: false, reason: 'missing-signing-key' });
  assert.deepEqual(verifyReceiptSeal(sealed, undefined, canonical), { valid: false, reason: 'missing-signing-key' });
  assert.deepEqual(verifyReceiptSeal(sealed, 'other-key', canonical), { valid: false, reason: 'invalid-integrity' });
  assert.deepEqual(
    verifyReceiptSeal({ ...sealed, integrity: { algorithm: 'plain-sha256', signature: sealed.integrity.signature } }, KEY, canonical),
    { valid: false, reason: 'invalid-shape' },
  );
  assert.deepEqual(
    verifyReceiptSeal({ ...sealed, integrity: { algorithm: RECEIPT_INTEGRITY_ALGORITHM, signature: 'deadbeef' } }, KEY, canonical),
    { valid: false, reason: 'invalid-shape' },
  );
  assert.deepEqual(verifyReceiptSeal(null, KEY, canonical), { valid: false, reason: 'invalid-shape' });
});

test('a tampered closed field invalidates the seal', () => {
  const sealed = sealReceipt({ row: 'R-TEST', verdict: 'PARTIAL-candidate' }, KEY, canonical);
  const promoted = { ...sealed, verdict: 'PASS-candidate' };
  assert.deepEqual(verifyReceiptSeal(promoted, KEY, canonical), { valid: false, reason: 'invalid-integrity' });
});

test('R-CD-2 validation fails closed on a missing key rather than throwing', () => {
  const receipt = resolveRcd2AuthoritativeReceipt({ evidence: {}, correlation: null, signingKey: KEY });
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  // Before consolidation this call threw a raw TypeError out of the resolver.
  assert.deepEqual(validateRcd2AuthoritativeReceipt(receipt, undefined), { valid: false, reason: 'missing-signing-key' });
  assert.deepEqual(validateRcd2AuthoritativeReceipt(receipt, ''), { valid: false, reason: 'missing-signing-key' });
  assert.equal(validateRcd2AuthoritativeReceipt(receipt, KEY).valid, true);
  assert.deepEqual(validateRcd2AuthoritativeReceipt(receipt, 'wrong-key'), { valid: false, reason: 'invalid-integrity' });
});

test('a seal from one row cannot certify another row', () => {
  const rcd2 = resolveRcd2AuthoritativeReceipt({ evidence: {}, correlation: null, signingKey: KEY });
  const targeted = resolveTargetedReturnAuthority({
    journalText: '',
    targetSessionKey: 'agent:main:target',
    childSessionKey: 'agent:main:child',
    row: 'R-CD-4',
    signingKey: KEY,
  });
  // Both are sealed with the same gateway token, yet each validator closes over
  // its own canonical field list, so the signatures are not interchangeable.
  const swapped = { ...targeted, integrity: rcd2.integrity };
  assert.deepEqual(validateTargetedReturnReceipt(swapped, KEY, 'R-CD-4'), { valid: false, reason: 'invalid-integrity' });
  assert.notEqual(rcd2.integrity.signature, targeted.integrity.signature);
});

test('targeted-return PARTIAL cannot be hand-promoted to PASS', () => {
  const partial = resolveTargetedReturnAuthority({
    journalText: '',
    targetSessionKey: 'agent:main:target',
    childSessionKey: 'agent:main:child',
    row: 'R-CD-4',
    signingKey: KEY,
  });
  assert.equal(partial.verdict, 'PARTIAL-candidate');
  const forged = { ...partial, verdict: 'PASS-candidate', failureCategory: null, targetMatchCount: 1 };
  assert.deepEqual(validateTargetedReturnReceipt(forged, KEY, 'R-CD-4'), { valid: false, reason: 'invalid-integrity' });
});
