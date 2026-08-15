import { resolveTargetedReturnAuthority } from './targeted-return-receipt.mjs';

/**
 * Node-only finalizer for the post-run journal receipt. Keep it out of k6 VU
 * dependency graphs: it seals and validates the gateway-token HMAC boundary.
 */
export function rCd4JournalReturnAuthority(args) {
  return resolveTargetedReturnAuthority({
    ...args,
    row: args.row || 'R-CD-4',
    signingKey: args.signingKey,
  });
}
