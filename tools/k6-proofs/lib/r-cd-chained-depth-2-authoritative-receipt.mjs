import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { R_CD_CHAIN_TASK_LEDGER_SCHEMA } from './r-cd-chained-depth-2-authority.mjs';

export const R_CD_CHAIN_AUTHORITATIVE_RECEIPT_SCHEMA =
  'openclaw.k6.r-cd-chained-depth-2-authoritative-receipt.v1';

const ROW = 'R-CD-CHAINED-DEPTH-2';
const SOURCE = 'r-cd-chained-depth-2-row-scoped-resolver';
const FAILURE_CATEGORIES = new Set([
  'candidate-identity-mismatch',
  'missing-or-invalid-task-ledger',
  'missing-or-invalid-root-consumption',
  'missing-or-invalid-continuation-topology',
]);

const hex = (value, length) => (
  typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value)
);
const fingerprint = (value) => (
  createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
);
const binding = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function canonical(receipt) {
  const { integrity: _integrity, ...signed } = receipt;
  return JSON.stringify(signed);
}

function hasExactKeys(value, expected) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

const BINDING_KEYS = [
  'candidateSha',
  'runtimeBuildSha',
  'localEvidenceFingerprint',
  'topologyFingerprint',
];
const INTEGRITY_KEYS = ['algorithm', 'signature'];
const LIFECYCLE_KEYS = [
  'typedTool',
  'mode',
  'taskCount',
  'completedTaskCount',
  'deliveredTaskCount',
  'uniqueTaskCount',
  'uniqueTaskRunCount',
  'maxDepth',
  'paginationExhausted',
  'stableSnapshotCount',
  'recoveryWakeScheduled',
  'rootStructuredInputObserved',
  'rootToolResultAccepted',
  'rootLifecycleEndObserved',
  'sameConsumptionRun',
  'postReturnOrdering',
  'assistantSentinelObserved',
  'nonceFingerprint',
  'rootSessionFingerprint',
  'childSessionFingerprint',
  'grandchildSessionFingerprint',
  'childTaskFingerprint',
  'grandchildTaskFingerprint',
  'childRunFingerprint',
  'grandchildRunFingerprint',
  'dispatchRunFingerprint',
  'consumptionRunFingerprint',
  'traceFingerprint',
  'chainFingerprint',
];
const PASS_RECEIPT_KEYS = [
  'schema',
  'row',
  'authoritativeSource',
  'candidateOnly',
  'foldRequiresReview',
  'verdict',
  'binding',
  'lifecycle',
  'integrity',
];
const FAILURE_RECEIPT_KEYS = [
  'schema',
  'row',
  'authoritativeSource',
  'candidateOnly',
  'foldRequiresReview',
  'binding',
  'verdict',
  'failureCategory',
  'integrity',
];

function seal(receipt, key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('missing gateway signing key');
  }
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', key).update(canonical(receipt)).digest('hex'),
    },
  };
}

function candidateIdentityPasses(evidence) {
  return hex(evidence?.candidateSha, 40) &&
    hex(evidence?.runtimeBuildSha, 40) &&
    evidence.candidateSha === evidence.runtimeBuildSha;
}

function taskLedgerPasses(ledger) {
  return ledger?.schema === R_CD_CHAIN_TASK_LEDGER_SCHEMA &&
    typeof ledger.nonce === 'string' &&
    ledger.nonce.length > 0 &&
    typeof ledger.rootSessionKey === 'string' &&
    typeof ledger.childSessionKey === 'string' &&
    typeof ledger.grandchildSessionKey === 'string' &&
    new Set([
      ledger.rootSessionKey,
      ledger.childSessionKey,
      ledger.grandchildSessionKey,
    ]).size === 3 &&
    Array.isArray(ledger.taskIds) &&
    ledger.taskIds.length === 2 &&
    new Set(ledger.taskIds).size === 2 &&
    ledger.taskIds.every((value) => typeof value === 'string' && value.length > 0) &&
    Array.isArray(ledger.runIds) &&
    ledger.runIds.length === 2 &&
    new Set(ledger.runIds).size === 2 &&
    ledger.runIds.every((value) => typeof value === 'string' && value.length > 0) &&
    ledger.taskCount === 2 &&
    ledger.completedTaskCount === 2 &&
    ledger.deliveredTaskCount === 2 &&
    ledger.maxDepth === 2 &&
    ledger.recoveryWakeScheduled === true &&
    Number.isFinite(ledger.dispatchAcceptedAtMs) &&
    ledger.dispatchAcceptedAtMs <= ledger.completedAtMs &&
    Number.isFinite(ledger.completedAtMs);
}

function rootConsumptionPasses(consumption, ledger) {
  return consumption?.authority === 'structured-post-return-consumption' &&
    consumption.rootSessionKey === ledger.rootSessionKey &&
    consumption.nonce === ledger.nonce &&
    consumption.childSessionKey === ledger.childSessionKey &&
    consumption.grandchildSessionKey === ledger.grandchildSessionKey &&
    JSON.stringify(consumption.taskIds) === JSON.stringify(ledger.taskIds) &&
    JSON.stringify(consumption.runIds) === JSON.stringify(ledger.runIds) &&
    typeof consumption.consumptionRunId === 'string' &&
    consumption.consumptionRunId.length > 0 &&
    !ledger.runIds.includes(consumption.consumptionRunId) &&
    Number.isFinite(consumption.taskCompletedAtMs) &&
    Number.isFinite(consumption.consumptionRunStartedAtMs) &&
    Number.isFinite(consumption.consumptionInputAtMs) &&
    Number.isFinite(consumption.consumptionAcceptedAtMs) &&
    Number.isFinite(consumption.consumptionTerminalAtMs) &&
    consumption.taskCompletedAtMs === ledger.completedAtMs &&
    consumption.consumptionRunStartedAtMs >= ledger.completedAtMs &&
    consumption.consumptionInputAtMs >= consumption.consumptionRunStartedAtMs &&
    consumption.consumptionAcceptedAtMs >= consumption.consumptionInputAtMs &&
    consumption.consumptionTerminalAtMs >= consumption.consumptionAcceptedAtMs &&
    Number.isSafeInteger(consumption.inputMessageSeq) &&
    Number.isSafeInteger(consumption.acceptedMessageSeq) &&
    consumption.acceptedMessageSeq > consumption.inputMessageSeq &&
    typeof consumption.assistantSentinelObserved === 'boolean';
}

function topologyPasses(correlation, evidence) {
  return correlation?.row === ROW &&
    correlation?.continuation?.tool === 'continue_delegate' &&
    correlation?.delegate?.mode === 'silent-wake' &&
    hex(correlation?.traceId, 32) &&
    typeof correlation?.chainId === 'string' &&
    correlation.chainId.length > 0 &&
    hex(correlation?.dispatchSpanId, 16) &&
    hex(correlation?.fireSpanId, 16) &&
    correlation.dispatchSpanId !== correlation.fireSpanId &&
    Array.isArray(correlation?.toolSpanIds) &&
    correlation.toolSpanIds.length === 1 &&
    hex(correlation.toolSpanIds[0], 16) &&
    correlation?.reason?.hash === evidence?.reason_hash &&
    correlation?.reason?.length === evidence?.reason_length;
}

function behaviorPasses(evidence, ledger, consumption) {
  return evidence?.row === ROW &&
    evidence.parent_dispatch_accepted === true &&
    evidence.dispatch_run_captured === true &&
    evidence.task_pagination_exhausted === true &&
    evidence.tasks_list_rejected === 0 &&
    Number.isInteger(evidence.task_snapshot_stable_count) &&
    evidence.task_snapshot_stable_count >= 2 &&
    typeof evidence.accepted_dispatch_run_id === 'string' &&
    evidence.accepted_dispatch_run_id.length > 0 &&
    evidence.accepted_dispatch_run_id !== consumption.consumptionRunId &&
    evidence.child_spawned === true &&
    evidence.grandchild_spawned === true &&
    evidence.child_waiting_sentinel === true &&
    evidence.depth1_recovery_wake_scheduled === true &&
    evidence.child_done_sentinel === true &&
    evidence.grandchild_done_sentinel === true &&
    evidence.chain_return_received === true &&
    evidence.max_depth_observed === 2 &&
    evidence.child_session === ledger.childSessionKey &&
    evidence.grandchild_session === ledger.grandchildSessionKey;
}

function failureCategory(evidence, correlation) {
  if (!candidateIdentityPasses(evidence)) return 'candidate-identity-mismatch';
  if (!taskLedgerPasses(evidence?.task_ledger_receipt)) {
    return 'missing-or-invalid-task-ledger';
  }
  if (!rootConsumptionPasses(
    evidence?.root_return_receipt,
    evidence.task_ledger_receipt,
  ) || !behaviorPasses(
    evidence,
    evidence.task_ledger_receipt,
    evidence?.root_return_receipt || {},
  )) {
    return 'missing-or-invalid-root-consumption';
  }
  if (!topologyPasses(correlation, evidence)) {
    return 'missing-or-invalid-continuation-topology';
  }
  return null;
}

export function resolveRcdChainAuthoritativeReceipt({
  evidence,
  correlation,
  signingKey,
}) {
  const ledger = evidence?.task_ledger_receipt;
  const consumption = evidence?.root_return_receipt;
  const base = {
    schema: R_CD_CHAIN_AUTHORITATIVE_RECEIPT_SCHEMA,
    row: ROW,
    authoritativeSource: SOURCE,
    candidateOnly: true,
    foldRequiresReview: true,
    binding: {
      candidateSha: evidence?.candidateSha || null,
      runtimeBuildSha: evidence?.runtimeBuildSha || null,
      localEvidenceFingerprint: binding({
        row: evidence?.row || null,
        candidate: evidence?.candidateSha || null,
        runtime: evidence?.runtimeBuildSha || null,
        nonce: ledger?.nonce || null,
        root: ledger?.rootSessionKey || null,
        child: ledger?.childSessionKey || null,
        grandchild: ledger?.grandchildSessionKey || null,
        tasks: ledger?.taskIds || null,
        taskRuns: ledger?.runIds || null,
        taskDispatchAt: ledger?.dispatchAcceptedAtMs || null,
        taskCompletedAt: ledger?.completedAtMs || null,
        dispatchRun: evidence?.accepted_dispatch_run_id || null,
        consumptionRun: consumption?.consumptionRunId || null,
        consumptionRunStartedAt: consumption?.consumptionRunStartedAtMs || null,
        consumptionInputAt: consumption?.consumptionInputAtMs || null,
        consumptionAcceptedAt: consumption?.consumptionAcceptedAtMs || null,
        consumptionTerminalAt: consumption?.consumptionTerminalAtMs || null,
        inputMessageSeq: consumption?.inputMessageSeq ?? null,
        acceptedMessageSeq: consumption?.acceptedMessageSeq ?? null,
        toolCall: evidence?.root_return_acceptance?.toolCallId || null,
      }),
      topologyFingerprint: binding({
        trace: correlation?.traceId || null,
        chain: correlation?.chainId || null,
        tool: correlation?.continuation?.tool || null,
        mode: correlation?.delegate?.mode || null,
        dispatch: correlation?.dispatchSpanId || null,
        fire: correlation?.fireSpanId || null,
        reasonHash: correlation?.reason?.hash || null,
        reasonLength: correlation?.reason?.length || null,
      }),
    },
  };

  const category = failureCategory(evidence, correlation);
  if (category) {
    return seal({
      ...base,
      verdict: category === 'candidate-identity-mismatch'
        ? 'FAIL-candidate'
        : 'PARTIAL-candidate',
      failureCategory: category,
    }, signingKey);
  }

  return seal({
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      typedTool: 'continue_delegate',
      mode: 'silent-wake',
      taskCount: 2,
      completedTaskCount: 2,
      deliveredTaskCount: 2,
      uniqueTaskCount: 2,
      uniqueTaskRunCount: 2,
      maxDepth: 2,
      paginationExhausted: true,
      stableSnapshotCount: evidence.task_snapshot_stable_count,
      recoveryWakeScheduled: true,
      rootStructuredInputObserved: true,
      rootToolResultAccepted: true,
      rootLifecycleEndObserved: true,
      sameConsumptionRun: true,
      postReturnOrdering: true,
      assistantSentinelObserved: consumption.assistantSentinelObserved,
      nonceFingerprint: fingerprint(ledger.nonce),
      rootSessionFingerprint: fingerprint(ledger.rootSessionKey),
      childSessionFingerprint: fingerprint(ledger.childSessionKey),
      grandchildSessionFingerprint: fingerprint(ledger.grandchildSessionKey),
      childTaskFingerprint: fingerprint(ledger.taskIds[0]),
      grandchildTaskFingerprint: fingerprint(ledger.taskIds[1]),
      childRunFingerprint: fingerprint(ledger.runIds[0]),
      grandchildRunFingerprint: fingerprint(ledger.runIds[1]),
      dispatchRunFingerprint: fingerprint(evidence.accepted_dispatch_run_id),
      consumptionRunFingerprint: fingerprint(consumption.consumptionRunId),
      traceFingerprint: fingerprint(correlation.traceId),
      chainFingerprint: fingerprint(correlation.chainId),
    },
  }, signingKey);
}

export function validateRcdChainAuthoritativeReceipt(receipt, signingKey) {
  const failureReceipt = receipt?.verdict === 'PARTIAL-candidate' ||
    receipt?.verdict === 'FAIL-candidate';
  if (!hasExactKeys(
    receipt,
    failureReceipt ? FAILURE_RECEIPT_KEYS : PASS_RECEIPT_KEYS,
  ) ||
      !hasExactKeys(receipt.binding, BINDING_KEYS) ||
      !hasExactKeys(receipt.integrity, INTEGRITY_KEYS) ||
      (!failureReceipt && !hasExactKeys(receipt.lifecycle, LIFECYCLE_KEYS)) ||
      receipt.schema !== R_CD_CHAIN_AUTHORITATIVE_RECEIPT_SCHEMA ||
      receipt.row !== ROW ||
      receipt.authoritativeSource !== SOURCE ||
      receipt.candidateOnly !== true ||
      receipt.foldRequiresReview !== true ||
      !hex(receipt.binding?.candidateSha, 40) ||
      !hex(receipt.binding?.runtimeBuildSha, 40) ||
      !hex(receipt.binding?.localEvidenceFingerprint, 64) ||
      !hex(receipt.binding?.topologyFingerprint, 64) ||
      receipt.integrity?.algorithm !== 'hmac-sha256-gateway-token-v1' ||
      !hex(receipt.integrity?.signature, 64) ||
      typeof signingKey !== 'string' ||
      signingKey.length === 0) {
    return { valid: false, reason: 'invalid-shape' };
  }
  const expected = createHmac('sha256', signingKey).update(canonical(receipt)).digest('hex');
  if (!timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  )) {
    return { valid: false, reason: 'invalid-integrity' };
  }
  if (receipt.verdict === 'PARTIAL-candidate' || receipt.verdict === 'FAIL-candidate') {
    if (!FAILURE_CATEGORIES.has(receipt.failureCategory)) {
      return { valid: false, reason: 'invalid-failure-category' };
    }
    const sameBuild = receipt.binding.candidateSha === receipt.binding.runtimeBuildSha;
    if ((receipt.failureCategory === 'candidate-identity-mismatch') === sameBuild) {
      return { valid: false, reason: 'invalid-candidate-binding' };
    }
    return { valid: true, verdict: receipt.verdict };
  }

  const lifecycle = receipt.lifecycle;
  const pass = receipt.verdict === 'PASS-candidate' &&
    receipt.binding.candidateSha === receipt.binding.runtimeBuildSha &&
    lifecycle?.typedTool === 'continue_delegate' &&
    lifecycle.mode === 'silent-wake' &&
    lifecycle.taskCount === 2 &&
    lifecycle.completedTaskCount === 2 &&
    lifecycle.deliveredTaskCount === 2 &&
    lifecycle.uniqueTaskCount === 2 &&
    lifecycle.uniqueTaskRunCount === 2 &&
    lifecycle.maxDepth === 2 &&
    lifecycle.paginationExhausted === true &&
    Number.isInteger(lifecycle.stableSnapshotCount) &&
    lifecycle.stableSnapshotCount >= 2 &&
    [
      'recoveryWakeScheduled',
      'rootStructuredInputObserved',
      'rootToolResultAccepted',
      'rootLifecycleEndObserved',
      'sameConsumptionRun',
      'postReturnOrdering',
    ].every((key) => lifecycle[key] === true) &&
    typeof lifecycle.assistantSentinelObserved === 'boolean' &&
    [
      'nonceFingerprint',
      'rootSessionFingerprint',
      'childSessionFingerprint',
      'grandchildSessionFingerprint',
      'childTaskFingerprint',
      'grandchildTaskFingerprint',
      'childRunFingerprint',
      'grandchildRunFingerprint',
      'dispatchRunFingerprint',
      'consumptionRunFingerprint',
      'traceFingerprint',
      'chainFingerprint',
    ].every((key) => hex(lifecycle[key], 16)) &&
    new Set([
      lifecycle.rootSessionFingerprint,
      lifecycle.childSessionFingerprint,
      lifecycle.grandchildSessionFingerprint,
    ]).size === 3 &&
    lifecycle.dispatchRunFingerprint !== lifecycle.consumptionRunFingerprint;
  return pass
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-pass-lifecycle' };
}
