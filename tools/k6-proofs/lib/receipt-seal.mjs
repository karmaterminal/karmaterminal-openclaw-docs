import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * One HMAC receipt boundary for every authoritative proof receipt.
 *
 * Node-only post-run module. Never import it from a k6 scenario graph: it is
 * the gateway-token signing boundary, and k6 resolves a scenario's whole ESM
 * graph before a VU starts.
 *
 * R-CD-2, R-CD-TOKEN and the targeted-return authority each carried a private
 * copy of the same five primitives (hex shape, 16-hex fingerprint, 64-hex
 * digest, seal, verify). The copies had drifted: only the targeted-return
 * validator rejected a missing signing key and guarded the `timingSafeEqual`
 * length precondition, so `validateRcd2AuthoritativeReceipt(receipt)` with no
 * key threw a raw TypeError out of the resolver instead of failing closed with
 * a reason. Verdict semantics are unchanged; the canonical JSON each row seals
 * still belongs to that row.
 */

export const RECEIPT_INTEGRITY_ALGORITHM = 'hmac-sha256-gateway-token-v1';

const HEX_64 = /^[a-f0-9]{64}$/i;

/** True when `value` is a hex string of exactly `length` characters. */
export function isHexOfLength(value, length) {
  return typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
}

/** Public-safe 16-hex identity fingerprint. Null for anything unusable. */
export function fingerprint16(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/** Public-safe 16-hex fingerprint of a stringified value, never null. */
export function fingerprintValue16(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

/** 64-hex digest of a structured binding object. */
export function digest64(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireSigningKey(signingKey) {
  if (typeof signingKey !== 'string' || signingKey.length === 0) {
    throw new Error('missing gateway signing key');
  }
  return signingKey;
}

/** Compute the receipt signature over a row's own canonical serialization. */
export function receiptSignature(canonicalText, signingKey) {
  return createHmac('sha256', requireSigningKey(signingKey)).update(canonicalText).digest('hex');
}

/**
 * Attach the gateway-token HMAC seal. `canonicalize` stays row-owned so a row
 * keeps deciding exactly which fields are closed by its signature.
 */
export function sealReceipt(receipt, signingKey, canonicalize) {
  return {
    ...receipt,
    integrity: {
      algorithm: RECEIPT_INTEGRITY_ALGORITHM,
      signature: receiptSignature(canonicalize(receipt), signingKey),
    },
  };
}

/**
 * Constant-time seal verification that fails closed instead of throwing.
 *
 * Returns a `{ valid, reason }` result for every input, including a missing
 * key, a wrong algorithm, or a malformed signature — the cases where the old
 * per-row copies diverged.
 */
export function verifyReceiptSeal(receipt, signingKey, canonicalize) {
  if (typeof signingKey !== 'string' || signingKey.length === 0) {
    return { valid: false, reason: 'missing-signing-key' };
  }
  if (receipt?.integrity?.algorithm !== RECEIPT_INTEGRITY_ALGORITHM ||
      !HEX_64.test(receipt?.integrity?.signature || '')) {
    return { valid: false, reason: 'invalid-shape' };
  }
  let expected;
  try {
    expected = createHmac('sha256', signingKey).update(canonicalize(receipt)).digest('hex');
  } catch {
    return { valid: false, reason: 'invalid-shape' };
  }
  const actual = receipt.integrity.signature.toLowerCase();
  if (expected.length !== actual.length) return { valid: false, reason: 'invalid-integrity' };
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
    ? { valid: true }
    : { valid: false, reason: 'invalid-integrity' };
}
