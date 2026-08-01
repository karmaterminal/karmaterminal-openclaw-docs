/**
 * Single place where a report or metrics consumer resolves the authoritative
 * outcome of one proof run directory.
 *
 * Rows that own a row-scoped resolver may only be displayed or exported through
 * their signed receipt. The receipt must be declared by run-result.json, must
 * digest-match the persisted file, must validate against the gateway key, and —
 * for R-CD-MODEL-TOOL — must bind to the independent runner envelope
 * (runner-metadata.json plus the run directory identity). Anything missing,
 * stale, malformed, replayed, or mismatched is downgraded, never displayed.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';
import { validateRcdTokenAuthoritativeReceipt } from '../lib/r-cd-token-authoritative-receipt.mjs';
import { validateRcdModelToolAuthoritativeReceipt } from '../lib/r-cd-model-tool-authoritative-receipt.mjs';

const SHA_256 = /^[a-f0-9]{64}$/iu;
const TRACE_ID = /^[a-f0-9]{32}$/iu;

export function authoritativeReceiptContract(rowId) {
  if (rowId === 'R-CD-2') {
    return {
      file: 'r-cd-2-authoritative-receipt.json',
      verdictSource: 'r-cd-2-authoritative-receipt',
      invalidOutcome: 'PARTIAL-candidate',
      validate: (receipt, key) => validateRcd2AuthoritativeReceipt(receipt, key),
    };
  }
  if (rowId === 'R-CD-TOKEN') {
    return {
      file: 'r-cd-token-authoritative-receipt.json',
      verdictSource: 'r-cd-token-authoritative-receipt',
      invalidOutcome: 'PARTIAL-candidate',
      validate: (receipt, key) => validateRcdTokenAuthoritativeReceipt(receipt, key),
      bindsBuildIdentity: true,
    };
  }
  if (rowId === 'R-CD-MODEL-TOOL') {
    return {
      file: 'r-cd-model-tool-authoritative-receipt.json',
      verdictSource: 'r-cd-model-tool-authoritative-receipt',
      // Invalid model-tool authority is never a behavioural claim of any kind.
      invalidOutcome: 'NO-VERDICT',
      validate: (receipt, key, envelope) =>
        validateRcdModelToolAuthoritativeReceipt(receipt, key, envelope),
      requiresRunnerEnvelope: true,
      requiresTraceBinding: true,
    };
  }
  return null;
}

/**
 * @returns null when the row has no row-scoped resolver, otherwise
 *          { enforced: true, valid, outcome, verdictSource, reason }.
 */
export function resolveAuthoritativeRowOutcome({
  runDir,
  rowId,
  runResult,
  metadata,
  signingKey,
}) {
  const contract = authoritativeReceiptContract(rowId);
  if (!contract) return null;
  const declared = runResult?.authoritativeReceipt;
  const fail = (reason) => ({
    enforced: true,
    valid: false,
    outcome: contract.invalidOutcome,
    verdictSource: contract.verdictSource,
    reason,
  });

  if (runResult?.verdictSource !== contract.verdictSource ||
      declared?.file !== contract.file ||
      !SHA_256.test(declared?.sha256 || '')) {
    return fail('missing-authoritative-receipt-declaration');
  }

  let raw;
  try {
    raw = readFileSync(path.join(runDir, declared.file));
  } catch {
    return fail('missing-authoritative-receipt-file');
  }
  if (createHash('sha256').update(raw).digest('hex') !== declared.sha256) {
    return fail('authoritative-receipt-digest-mismatch');
  }

  let receipt;
  try {
    receipt = JSON.parse(raw.toString('utf8'));
  } catch {
    return fail('malformed-authoritative-receipt');
  }

  const envelope = {
    metadata,
    runId: path.basename(runDir),
    traceId: runResult?.observability?.traceId,
  };
  if (contract.requiresRunnerEnvelope && !metadata) {
    return fail('missing-runner-envelope');
  }
  const integrity = contract.validate(receipt, signingKey, envelope);
  if (!integrity.valid) return fail(integrity.reason || 'invalid-authoritative-receipt');
  // A behavioural verdict must be anchored to the trace the run itself
  // published. Without that independent trace id the receipt's topology is
  // only self-reported, so the verdict is not displayable authority.
  if (contract.requiresTraceBinding && integrity.verdict !== null &&
      !TRACE_ID.test(envelope.traceId || '')) {
    return fail('missing-run-result-trace-binding');
  }
  if (integrity.verdict !== runResult?.verdict) {
    return fail('authoritative-receipt-verdict-mismatch');
  }
  if (contract.bindsBuildIdentity && (
    receipt.binding?.candidateSha !== metadata?.candidateSha ||
    receipt.binding?.runtimeBuildSha !== metadata?.runtimeBuildSha ||
    metadata?.candidateSha !== metadata?.runtimeBuildSha
  )) {
    return fail('authoritative-receipt-build-identity-mismatch');
  }

  return {
    enforced: true,
    valid: true,
    outcome: integrity.verdict === null ? 'NO-VERDICT' : integrity.verdict,
    verdictSource: contract.verdictSource,
    reason: null,
  };
}
