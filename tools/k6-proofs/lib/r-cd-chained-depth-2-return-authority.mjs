import { createHmac } from 'node:crypto';
import {
  TARGETED_RETURN_INTEGRITY_ALGORITHM,
  canonicalTargetedReturnReceipt,
  fingerprintIdentity,
  resolveTargetedReturnAuthority,
} from './targeted-return-receipt.mjs';
import { rCdChainHopIdentities } from './r-cd-chained-depth-2-authority.mjs';

function sealPartial(receipt, signingKey) {
  if (typeof signingKey !== 'string' || signingKey.length === 0) {
    throw new Error('missing gateway signing key');
  }
  return {
    ...receipt,
    integrity: {
      algorithm: TARGETED_RETURN_INTEGRITY_ALGORITHM,
      signature: createHmac('sha256', signingKey)
        .update(canonicalTargetedReturnReceipt(receipt))
        .digest('hex'),
    },
  };
}

/**
 * Node-only finalizer for the post-run journal receipt. The k6 scenario imports
 * only structural observers; this module owns gateway-token HMAC work.
 */
export function rCdChainJournalReturnAuthority(args) {
  const hops = rCdChainHopIdentities({
    childSessionKey: args.childSessionKey,
    grandchildSessionKey: args.grandchildSessionKey,
  });
  if (!hops.ok) {
    return sealPartial({
      schema: 'openclaw.k6.targeted-return-receipt.v1',
      row: 'R-CD-CHAINED-DEPTH-2',
      authority: 'gateway-journal-targeted-return',
      candidateOnly: true,
      foldRequiresReview: true,
      verdict: 'PARTIAL-candidate',
      failureCategory: hops.reason,
      structuralOk: false,
      targetMatchCount: 0,
      parentMatchCount: 0,
      deliveryCountInWindow: 0,
      deliveryCountTotal: 0,
      childBound: false,
      window: {
        startMs: Number.isFinite(args.windowStartMs) ? args.windowStartMs : null,
        endMs: Number.isFinite(args.windowEndMs) ? args.windowEndMs : null,
      },
      bindings: {
        targetSessionFingerprint: fingerprintIdentity(args.rootSessionKey),
        parentSessionFingerprint: fingerprintIdentity(args.childSessionKey),
        childSessionFingerprint: fingerprintIdentity(args.grandchildSessionKey),
        deliveryLineFingerprint: null,
        deliveredTargetFingerprints: [],
      },
    }, args.signingKey);
  }
  // Grandchild is the delivering child; root must appear among tree targets.
  // Intermediate depth-1 is an expected co-target under fanoutMode=tree.
  return resolveTargetedReturnAuthority({
    journalText: args.journalText,
    targetSessionKey: args.rootSessionKey,
    parentSessionKey: args.childSessionKey,
    childSessionKey: args.grandchildSessionKey,
    windowStartMs: args.windowStartMs,
    windowEndMs: args.windowEndMs,
    row: 'R-CD-CHAINED-DEPTH-2',
    allowIntermediateAncestorTargets: true,
    structuralOk: args.structuralOk !== false,
    signingKey: args.signingKey,
  });
}
