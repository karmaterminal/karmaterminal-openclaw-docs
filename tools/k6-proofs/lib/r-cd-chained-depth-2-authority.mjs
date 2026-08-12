import { createHmac } from 'node:crypto';
import {
  TARGETED_RETURN_INTEGRITY_ALGORITHM,
  canonicalTargetedReturnReceipt,
  fingerprintIdentity,
  resolveTargetedReturnAuthority,
} from './targeted-return-receipt.mjs';

export {
  resolveTargetedReturnAuthority,
  fingerprintIdentity,
};

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

const HARNESS_MARKER = '[k6-proof-harness]';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function directSessionKey(eventData) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) return null;
  const candidates = [eventData.sessionKey, eventData.session]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : null;
}

function directMessageRole(eventData) {
  const message = eventData?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  return typeof message.role === 'string' ? message.role : null;
}

function directMessageText(eventData) {
  const message = eventData?.message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return null;
  const textParts = message.content
    .filter((part) => (
      part
      && typeof part === 'object'
      && !Array.isArray(part)
      && part.type === 'text'
      && typeof part.text === 'string'
    ))
    .map((part) => part.text);
  return textParts.length > 0 ? textParts.join('\n') : null;
}

function hasExactGrandchildMarker(eventData, nonce) {
  const messageText = directMessageText(eventData);
  if (!messageText || messageText.includes(HARNESS_MARKER)) return false;
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_-])GRANDCHILD-DONE\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`,
  );
  return pattern.test(messageText);
}

/**
 * Diagnostic-only root marker observation.
 *
 * Grandchild→root silent-wake routing authority is the shared payload-free
 * `[continuation:targeted-return]` collector, not transcript system text.
 */
export function rCdChainRootDiagnosticMarker({ eventName, eventData, rootSessionKey, nonce }) {
  if (eventName !== 'session.message') return null;
  if (!rootSessionKey || !nonce) return null;
  if (directSessionKey(eventData) !== rootSessionKey) return null;
  if (directMessageRole(eventData) !== 'system') return null;
  if (!hasExactGrandchildMarker(eventData, nonce)) return null;
  return {
    eventName,
    rootSessionFingerprint: fingerprintIdentity(rootSessionKey),
    nonceFingerprint: fingerprintIdentity(nonce),
    marker: 'GRANDCHILD-DONE',
    role: 'system',
    authoritative: false,
  };
}

/** @deprecated transcript markers are not routing authority */
export function rCdChainRootReturnCandidate(args) {
  return rCdChainRootDiagnosticMarker(args);
}

/**
 * Message-marker receipts never establish root routing authority.
 */
export function rCdChainRootReturnReceipt(_candidate, _hops) {
  return null;
}

/**
 * Require two distinct nonce-bound hop identities before journal authority
 * can finalize grandchild→root routing.
 */
export function rCdChainHopIdentities({ childSessionKey, grandchildSessionKey } = {}) {
  if (!childSessionKey || !grandchildSessionKey) {
    return { ok: false, reason: 'missing-hop' };
  }
  if (childSessionKey === grandchildSessionKey) {
    return { ok: false, reason: 'indistinct-hops' };
  }
  return {
    ok: true,
    childSessionKey,
    grandchildSessionKey,
    childFingerprint: fingerprintIdentity(childSessionKey),
    grandchildFingerprint: fingerprintIdentity(grandchildSessionKey),
  };
}

/**
 * Nested depth-2 call must request fanoutMode=tree so grandchild completion
 * routes up the ancestry to root. Outer parent→child call stays unchanged.
 */
export function rCdChainNestedDelegateSpec({ nonce, mode = 'silent-wake' } = {}) {
  if (typeof nonce !== 'string' || nonce.length === 0) return null;
  return {
    mode,
    fanoutMode: 'tree',
    task: `Grandchild nonce ${nonce}: reply exactly GRANDCHILD-DONE ${nonce} only after you arrive. Do not mutate files.`,
  };
}

export function rCdChainPromptTemplate() {
  return (
    "Proof chain nonce {{nonce}}: you are depth-1. Fire your own continue_delegate(" +
    "mode='silent-wake', fanoutMode='tree', " +
    "task='Grandchild nonce {{nonce}}: reply exactly GRANDCHILD-DONE {{nonce}} only after you arrive. Do not mutate files.'" +
    "). After the nested continue_delegate tool result reports scheduled, reply exactly " +
    'CHILD-DONE {{nonce}} CHILD-DELEGATE-SCHEDULED.'
  );
}

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
