import { createHash } from 'node:crypto';
import {
  canonicalJson,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

export const REQUIRED_PRODUCT_SHA = '7cb9d71f622250bedbf565e327bd7d7b9d90b567';
export const DEPENDENCY_RECEIPT_SCHEMA = 'openclaw.k6.signed-producer-dependency.v1';
export const PROCESS_RECEIPT_SCHEMA = 'openclaw.k6.signed-process-terminal.v1';
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const commonFields = ['schema', 'issuer', 'receiptId', 'rowId', 'verdict', 'candidateSha',
  'runtimeSha', 'docsSha', 'runId', 'producerEvidenceId', 'artifactDigests',
  'issuedAt', 'expiresAt', 'integrity'];
const processFields = ['candidateTree', 'argvSha256', 'scriptSha256', 'suiteExitCode', 'checks'];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export function canonicalProducerReceipt(receipt) {
  const { integrity, ...body } = receipt;
  return canonicalJson(body);
}
export function signProducerReceipt(receipt, signingKey) {
  return sealSignedObserverReceipt({ receipt, signingKey, canonicalize: canonicalProducerReceipt });
}
export function validateProducerReceipt(receipt, {
  schema, rowId, candidateSha, docsSha, runId, trustedIssuers = {}, nowMs = Date.now(),
}) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
      receipt.schema !== schema || receipt.rowId !== rowId ||
      Object.keys(receipt).some((key) => !commonFields.includes(key) &&
        !(schema === PROCESS_RECEIPT_SCHEMA && processFields.includes(key))) ||
      !identifier.test(receipt.issuer || '') ||
      !Object.hasOwn(trustedIssuers, receipt.issuer) ||
      !identifier.test(receipt.receiptId || '') ||
      !identifier.test(runId || '') || receipt.runId !== runId ||
      !sha.test(docsSha || '') || receipt.docsSha !== docsSha ||
      candidateSha !== REQUIRED_PRODUCT_SHA || receipt.candidateSha !== candidateSha ||
      receipt.runtimeSha !== candidateSha || receipt.verdict !== 'PASS' ||
      !identifier.test(receipt.producerEvidenceId || '') ||
      !receipt.artifactDigests || Array.isArray(receipt.artifactDigests) ||
      !Object.keys(receipt.artifactDigests).length ||
      !Object.entries(receipt.artifactDigests).every(([key, value]) =>
        identifier.test(key) && key !== '.' && key !== '..' && digest.test(value || '')) ||
      typeof receipt.issuedAt !== 'string' || typeof receipt.expiresAt !== 'string') return false;
  const issued = Date.parse(receipt.issuedAt);
  const expires = Date.parse(receipt.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) ||
      issued > nowMs || expires <= nowMs || expires <= issued ||
      expires - issued > 60 * 60 * 1000 || nowMs - issued > 60 * 60 * 1000 ||
      new Date(issued).toISOString() !== receipt.issuedAt ||
      new Date(expires).toISOString() !== receipt.expiresAt) return false;
  return validateSignedObserverReceiptIntegrity({
    receipt, signingKey: trustedIssuers[receipt.issuer], canonicalize: canonicalProducerReceipt,
  });
}

export const PROCESS_REQUIRED_CHECKS = {
  'R-CW-MULTI-COLLAPSE': [
    'newest-drives', 'within-grace-older-drives', 'stale-queued-older-folds',
    'running-never-folds', 'baseline-restored',
  ],
  'R-CW-5': ['matrixPassed', 'dispatchPassed', 'toolSurfacePassed', 'noRejectedHopSpawn'],
  'R-CW-6': ['matrixPassed', 'dispatchPassed', 'runtimeSurfacePassed', 'structuredChainCapped',
    'noRejectedHopSpawn', 'durableRecoveryPassed', 'typedSurfacePassed',
    'exactCandidateDisposableWorktree', 'candidatePackageManagerVersionMatchesExecuting',
    'installedLockMatchesCandidate', 'verifiedDependencyTreeContainsLocalExecutables'],
  'R-CW-7': ['propagationSuite', 'baseline-restored'],
};

export function validateProcessReceipt(receipt, bindings) {
  const checks = PROCESS_REQUIRED_CHECKS[bindings.rowId];
  return validateProducerReceipt(receipt, { ...bindings, schema: PROCESS_RECEIPT_SCHEMA }) &&
    sha.test(bindings.candidateTree || '') && receipt.candidateTree === bindings.candidateTree &&
    digest.test(bindings.argvSha256 || '') && receipt.argvSha256 === bindings.argvSha256 &&
    digest.test(bindings.scriptSha256 || '') && receipt.scriptSha256 === bindings.scriptSha256 &&
    receipt.suiteExitCode === 0 && Array.isArray(checks) &&
    checks.every((name) => receipt.checks?.[name] === true);
}
