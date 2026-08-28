import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

export { canonicalJson };

export const GATEWAY_HMAC_RECEIPT_ALGORITHM = 'hmac-sha256-gateway-token-v1';

const HEX_64 = /^[a-f0-9]{64}$/iu;

function validSigningKey(value) {
  return typeof value === 'string' && value.length > 0;
}

export function sealSignedObserverReceipt({
  receipt,
  signingKey,
  canonicalize,
  algorithm = GATEWAY_HMAC_RECEIPT_ALGORITHM,
}) {
  if (!validSigningKey(signingKey)) {
    throw new Error('missing gateway signing key');
  }
  if (typeof canonicalize !== 'function') {
    throw new Error('canonical receipt serializer is required');
  }
  return {
    ...receipt,
    integrity: {
      algorithm,
      signature: createHmac('sha256', signingKey)
        .update(canonicalize(receipt))
        .digest('hex'),
    },
  };
}

export function validateSignedObserverReceiptIntegrity({
  receipt,
  signingKey,
  canonicalize,
  algorithm = GATEWAY_HMAC_RECEIPT_ALGORITHM,
}) {
  if (
    !receipt ||
    !validSigningKey(signingKey) ||
    typeof canonicalize !== 'function' ||
    receipt.integrity?.algorithm !== algorithm ||
    !HEX_64.test(receipt.integrity?.signature || '')
  ) {
    return false;
  }
  const expected = createHmac('sha256', signingKey)
    .update(canonicalize(receipt))
    .digest('hex');
  return timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  );
}
