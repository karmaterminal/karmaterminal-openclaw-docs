import {
  fingerprint16,
  isHexOfLength,
  RECEIPT_INTEGRITY_ALGORITHM,
  sealReceipt,
  verifyReceiptSeal,
} from './receipt-seal.mjs';

export const TARGETED_RETURN_RECEIPT_SCHEMA = 'openclaw.k6.targeted-return-receipt.v1';
export const TARGETED_RETURN_MARKER = '[continuation:targeted-return]';
export const TARGETED_RETURN_INTEGRITY_ALGORITHM = RECEIPT_INTEGRITY_ALGORITHM;

const DELIVERED_RE = /\[continuation:targeted-return\]\s+Delivered to\s+(.+?)\s+from\s+(\S+)/i;
const ISO_RE = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/;
const FP16 = (value) => isHexOfLength(value, 16);

export function fingerprintIdentity(value) {
  return fingerprint16(value);
}

export function parseJournalLineTimestampMs(line) {
  const text = String(line || '');
  const match = text.match(ISO_RE);
  if (!match) return null;
  const ms = Date.parse(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Parse one payload-free gateway targeted-return delivery line.
 * Returns raw identities for private binding only — never publish these.
 */
export function parseTargetedReturnDeliveryLine(line) {
  const text = String(line || '');
  if (!text.includes(TARGETED_RETURN_MARKER)) return null;
  const match = text.match(DELIVERED_RE);
  if (!match) return null;
  const targets = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const childSessionKey = match[2].trim();
  if (targets.length === 0 || !childSessionKey) return null;
  return {
    line: text,
    timestampMs: parseJournalLineTimestampMs(text),
    targetSessionKeys: targets,
    childSessionKey,
  };
}

export function collectTargetedReturnDeliveries(journalText) {
  const lines = String(journalText || '').split(/\r?\n/);
  const deliveries = [];
  for (const line of lines) {
    const delivery = parseTargetedReturnDeliveryLine(line);
    if (delivery) deliveries.push(delivery);
  }
  return deliveries;
}

function inWindow(timestampMs, windowStartMs, windowEndMs) {
  if (!Number.isFinite(timestampMs)) return false;
  if (Number.isFinite(windowStartMs) && timestampMs < windowStartMs) return false;
  if (Number.isFinite(windowEndMs) && timestampMs > windowEndMs) return false;
  return true;
}

/** Canonical closed fields bound by the gateway-token HMAC seal. */
export function canonicalTargetedReturnReceipt(receipt) {
  return JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authority: receipt.authority,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    structuralOk: receipt.structuralOk === true,
    window: receipt.window || null,
    targetMatchCount: receipt.targetMatchCount,
    parentMatchCount: receipt.parentMatchCount,
    deliveryCountInWindow: receipt.deliveryCountInWindow,
    deliveryCountTotal: receipt.deliveryCountTotal,
    childBound: receipt.childBound === true,
    bindings: receipt.bindings,
  });
}

function seal(receipt, key) {
  return sealReceipt(receipt, key, canonicalTargetedReturnReceipt);
}

/**
 * Bind exact target/parent/child/window against payload-free gateway receipts.
 *
 * Default (R-CD-4 / single-target): PASS requires exactly one in-window delivery
 * whose target list includes the expected target, whose child matches, and zero
 * matching parent deliveries.
 *
 * Tree fanout (R-CD-CHAINED-DEPTH-2): intermediate ancestors are expected
 * co-targets. Require root/target presence from the exact child; do not fail
 * solely because an intermediate ancestor also received the delivery. Still
 * fail closed on missing root, wrong child, or duplicate root-bearing lines.
 * Child identity and completion gates stay independent of this authority.
 *
 * Structural gates (tool accepted, unique child, completion sentinels) are an
 * independent boolean. PASS requires structuralOk === true AND journal match.
 * The receipt is HMAC-sealed to OPENCLAW_GATEWAY_TOKEN like R-CD-2/R-CD-TOKEN.
 *
 * `journalAvailable` separates two statements that an empty journal otherwise
 * collapses into one. "The gateway journal was captured and contains no
 * matching delivery" is a claim about the product. "No gateway journal was
 * read" is a claim about the evidence. Reporting the second as `no-delivery`
 * makes an absent log look like a proven absence of routing, which is the same
 * success-shaped hole as a silently missing trace — only inverted.
 */
export function resolveTargetedReturnAuthority({
  journalText,
  targetSessionKey,
  parentSessionKey = null,
  childSessionKey = null,
  windowStartMs = null,
  windowEndMs = null,
  row = null,
  allowIntermediateAncestorTargets = false,
  structuralOk = true,
  journalAvailable = null,
  signingKey,
} = {}) {
  const journalRead = journalAvailable === null
    ? typeof journalText === 'string' && journalText.trim().length > 0
    : journalAvailable === true;
  const deliveries = collectTargetedReturnDeliveries(journalText);
  const windowed = deliveries.filter((delivery) =>
    inWindow(delivery.timestampMs, windowStartMs, windowEndMs));

  const childBound = typeof childSessionKey === 'string' && childSessionKey.length > 0;
  const matchingChild = (delivery) => (
    !childBound || delivery.childSessionKey === childSessionKey
  );

  const targetMatches = windowed.filter((delivery) => (
    matchingChild(delivery) &&
    delivery.targetSessionKeys.includes(targetSessionKey)
  ));
  // Single-target rows fail closed on parent delivery. Tree fanout expects
  // intermediate ancestors, so those deliveries are never parent-failure.
  const parentMatches = (!allowIntermediateAncestorTargets &&
    parentSessionKey && parentSessionKey !== targetSessionKey)
    ? windowed.filter((delivery) => (
      matchingChild(delivery) &&
      delivery.targetSessionKeys.includes(parentSessionKey)
    ))
    : [];

  let failureCategory = null;
  if (!targetSessionKey) failureCategory = 'missing-target';
  else if (!childBound) failureCategory = 'missing-child';
  else if (targetMatches.length === 0) {
    const anyTargetAnyChild = windowed.filter((d) => d.targetSessionKeys.includes(targetSessionKey));
    const anyChildOutOfWindow = deliveries.filter((d) => (
      d.childSessionKey === childSessionKey &&
      d.targetSessionKeys.includes(targetSessionKey) &&
      !inWindow(d.timestampMs, windowStartMs, windowEndMs)
    ));
    if (anyChildOutOfWindow.length > 0) failureCategory = 'out-of-window';
    else if (anyTargetAnyChild.length > 0) failureCategory = 'wrong-child';
    else if (deliveries.length > 0) failureCategory = 'no-matching-delivery';
    else if (!journalRead) failureCategory = 'journal-unavailable';
    else failureCategory = 'no-delivery';
  } else if (targetMatches.length > 1) failureCategory = 'duplicate-target';
  else if (!allowIntermediateAncestorTargets && parentMatches.length > 0) {
    failureCategory = 'parent-delivery';
  }

  const journalPass = failureCategory === null &&
    targetMatches.length === 1 &&
    (allowIntermediateAncestorTargets || parentMatches.length === 0) &&
    childBound;
  const structural = structuralOk === true;
  if (!structural) {
    failureCategory = failureCategory || 'structural-gates-incomplete';
  }
  const pass = journalPass && structural;
  const primary = targetMatches[0] || null;

  return seal({
    schema: TARGETED_RETURN_RECEIPT_SCHEMA,
    row: row || null,
    authority: 'gateway-journal-targeted-return',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: pass ? 'PASS-candidate' : 'PARTIAL-candidate',
    failureCategory: pass ? null : failureCategory,
    structuralOk: structural,
    window: {
      startMs: Number.isFinite(windowStartMs) ? windowStartMs : null,
      endMs: Number.isFinite(windowEndMs) ? windowEndMs : null,
    },
    targetMatchCount: targetMatches.length,
    parentMatchCount: parentMatches.length,
    deliveryCountInWindow: windowed.length,
    deliveryCountTotal: deliveries.length,
    childBound,
    bindings: {
      targetSessionFingerprint: fingerprintIdentity(targetSessionKey),
      parentSessionFingerprint: fingerprintIdentity(parentSessionKey),
      childSessionFingerprint: fingerprintIdentity(childSessionKey),
      deliveryLineFingerprint: primary ? fingerprintIdentity(primary.line) : null,
      deliveredTargetFingerprints: primary
        ? primary.targetSessionKeys.map((key) => fingerprintIdentity(key)).filter(Boolean)
        : [],
    },
  }, signingKey);
}

export function assertPublicSafeTargetedReturnReceipt(receipt) {
  const serialized = JSON.stringify(receipt);
  if (/\bagent:[A-Za-z0-9:_-]{6,}\b/.test(serialized)) {
    throw new Error('targeted-return receipt leaked a raw session key');
  }
  if (serialized.includes('TARGET-RECEIVED') || serialized.includes('GRANDCHILD-DONE')) {
    throw new Error('targeted-return receipt leaked message-body marker text');
  }
  if (serialized.includes('[k6-proof-harness]')) {
    throw new Error('targeted-return receipt leaked harness prompt text');
  }
  return true;
}

/**
 * Authoritative receipt validator for candidate envelope routing.
 * Requires the gateway-token HMAC seal (same contract as R-CD-2/R-CD-TOKEN).
 * PASS demands structuralOk === true plus closed journal counts/fingerprints.
 */
export function validateTargetedReturnReceipt(receipt, signingKey, expectedRow = null) {
  try {
    if (!receipt || receipt.schema !== TARGETED_RETURN_RECEIPT_SCHEMA) {
      return { valid: false, reason: 'invalid-schema' };
    }
    if (expectedRow && receipt.row !== expectedRow) {
      return { valid: false, reason: 'row-mismatch' };
    }
    if (receipt.row !== 'R-CD-4' && receipt.row !== 'R-CD-CHAINED-DEPTH-2') {
      return { valid: false, reason: 'unsupported-row' };
    }
    if (receipt.authority !== 'gateway-journal-targeted-return') {
      return { valid: false, reason: 'invalid-authority' };
    }
    if (receipt.candidateOnly !== true || receipt.foldRequiresReview !== true) {
      return { valid: false, reason: 'review-flags' };
    }
    if (receipt.verdict !== 'PASS-candidate' && receipt.verdict !== 'PARTIAL-candidate') {
      return { valid: false, reason: 'invalid-verdict' };
    }
    if (typeof signingKey !== 'string' || signingKey.length === 0) {
      return { valid: false, reason: 'missing-signing-key' };
    }
    if (receipt.integrity?.algorithm !== TARGETED_RETURN_INTEGRITY_ALGORITHM ||
        !isHexOfLength(receipt.integrity?.signature, 64)) {
      return { valid: false, reason: 'invalid-shape' };
    }
    const sealed = verifyReceiptSeal(receipt, signingKey, canonicalTargetedReturnReceipt);
    if (!sealed.valid) return sealed;

    if (receipt.verdict === 'PASS-candidate') {
      if (receipt.structuralOk !== true) {
        return { valid: false, reason: 'pass-structural-ok' };
      }
      if (receipt.targetMatchCount !== 1 || receipt.parentMatchCount !== 0 || receipt.childBound !== true) {
        return { valid: false, reason: 'pass-counts' };
      }
      if (receipt.failureCategory != null) return { valid: false, reason: 'pass-failure-category' };
      if (!FP16(receipt.bindings?.targetSessionFingerprint)) {
        return { valid: false, reason: 'missing-target-fingerprint' };
      }
      if (!FP16(receipt.bindings?.childSessionFingerprint)) {
        return { valid: false, reason: 'missing-child-fingerprint' };
      }
      if (!FP16(receipt.bindings?.deliveryLineFingerprint)) {
        return { valid: false, reason: 'missing-delivery-fingerprint' };
      }
    } else if (receipt.verdict === 'PARTIAL-candidate') {
      if (typeof receipt.failureCategory !== 'string' || receipt.failureCategory.length === 0) {
        return { valid: false, reason: 'invalid-failure-category' };
      }
    }

    assertPublicSafeTargetedReturnReceipt(receipt);
    return { valid: true, verdict: receipt.verdict };
  } catch (error) {
    return { valid: false, reason: error.message || 'invalid' };
  }
}
