import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  classifyRcdModelToolVerdict,
  RCD_MODEL_TOOL_REQUIRED_MODEL,
} from './r-cd-model-tool-verdict.js';

export const R_CD_MODEL_TOOL_RECEIPT_SCHEMA =
  'openclaw.k6.r-cd-model-tool-authoritative-receipt.v2';
export const R_CD_MODEL_TOOL_AUTHORITATIVE_SOURCE = 'r-cd-model-tool-row-scoped-resolver';

const HEX_16 = /^[a-f0-9]{16}$/i;
const HEX_32 = /^[a-f0-9]{32}$/i;
const HEX_64 = /^[a-f0-9]{64}$/i;
const SHA_40 = /^[a-f0-9]{40}$/i;

// The receipt is a closed document. Every key on every level is enumerated
// here, every enumerated key is signed, and anything else is a rejection: an
// unsigned or unknown field must never travel with row authority.
const RECEIPT_KEYS = [
  'schema', 'row', 'authoritativeSource', 'candidateOnly', 'foldRequiresReview',
  'verdict', 'failureCategory', 'binding', 'lifecycle', 'execution', 'integrity',
];
const BINDING_KEYS = [
  'candidateSha', 'runtimeBuildSha', 'run', 'runner', 'trace',
  'localEvidenceFingerprint', 'topologyFingerprint',
];
const RUN_KEYS = ['rowId', 'seat', 'scenario', 'runId', 'matrixId', 'startedAt'];
const RUNNER_KEYS = [
  'repository', 'docsRef', 'manifestPath', 'manifestSha256', 'scenarioPath', 'scenarioSha256',
];
const TRACE_KEYS = [
  'traceId', 'chainId', 'dispatchSpanId', 'fireSpanId',
  'childHarnessSpanId', 'childRunSpanId', 'callSpanIds',
];
const LIFECYCLE_KEYS = [
  'rowBound', 'requestedModelBound', 'manifestModelBound', 'dispatchAccepted',
  'parentScheduledSentinel', 'childSessionObserved', 'returnPayloadObserved',
  'disposableSessionVerified',
];
const EXECUTION_KEYS = [
  'targetIdentity', 'traceId', 'chainId', 'childHarnessSpanId', 'childRunSpanId', 'calls',
];
const CALL_KEYS = ['spanId', 'status', 'provider', 'model', 'identity', 'complete'];
const INTEGRITY_KEYS = ['algorithm', 'signature'];

// The runner writes a placeholder when it cannot read the deployed build
// identity. A placeholder is the absence of a runtime build binding, not a
// binding, so it can never carry row authority.
const UNVERIFIED_BUILD_STAMPS = new Set(['unverified', 'unknown', 'none', 'n/a', 'null']);

const NO_VERDICT_CATEGORIES = new Set([
  'missing-continuation-topology',
  'invalid-continuation-topology',
  'missing-model-execution',
  'ambiguous-model-execution',
  'incomplete-model-execution',
  'incomplete-row-lifecycle',
  'invalid-model-request',
  'runner-or-build-identity-mismatch',
]);

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprint = (value) =>
  createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 16);

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

const nullableString = (value) => value === null || typeof value === 'string';

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function scenarioName(value) {
  const name = text(value);
  return name ? name.replace(/\.js$/u, '') : null;
}

function emptyRun() {
  return { rowId: null, seat: null, scenario: null, runId: null, matrixId: null, startedAt: null };
}

function emptyRunner() {
  return {
    repository: null,
    docsRef: null,
    manifestPath: null,
    manifestSha256: null,
    scenarioPath: null,
    scenarioSha256: null,
  };
}

/**
 * Project the runner's own pre-dispatch envelope (runner-metadata.json plus the
 * run directory identity) into the binding the receipt must carry. Returns null
 * when the envelope cannot establish candidate, runtime build, and run identity,
 * which is itself a NO-VERDICT condition.
 */
export function rcdModelToolRunnerBinding(metadata, runId) {
  const rowId = text(metadata?.row);
  const candidateSha = text(metadata?.candidateSha);
  const runtimeBuildSha = text(metadata?.runtimeBuildSha);
  const seat = text(metadata?.seat);
  const scenario = scenarioName(metadata?.scenario);
  const declaredRunId = text(metadata?.runId);
  const directoryRunId = text(runId);
  if (rowId !== 'R-CD-MODEL-TOOL' ||
      !candidateSha || !SHA_40.test(candidateSha) ||
      !runtimeBuildSha ||
      UNVERIFIED_BUILD_STAMPS.has(runtimeBuildSha.toLowerCase()) ||
      !seat || !scenario) {
    return null;
  }
  // Runner metadata is part of the authority, not decoration: a receipt that
  // cannot say which repository, ref, manifest, and scenario produced it has
  // not bound the runner at all.
  const runner = {
    repository: text(metadata?.repository),
    docsRef: text(metadata?.docsRef),
    manifestPath: text(metadata?.manifestPath),
    manifestSha256: text(metadata?.manifestSha256),
    scenarioPath: text(metadata?.scenarioPath),
    scenarioSha256: text(metadata?.scenarioSha256),
  };
  if (RUNNER_KEYS.some((key) => runner[key] === null)) return null;
  if (!HEX_64.test(runner.manifestSha256) || !HEX_64.test(runner.scenarioSha256)) return null;
  // Run identity must be stated twice, independently: once by the runner that
  // wrote runner-metadata.json and once by the directory the artifacts live in.
  // A single statement is not an envelope, and disagreement means the receipt
  // is being re-homed into a run it does not describe.
  if (!declaredRunId || !directoryRunId || declaredRunId !== directoryRunId) return null;
  const resolvedRunId = directoryRunId;
  return {
    candidateSha,
    runtimeBuildSha,
    run: {
      rowId,
      seat,
      scenario,
      runId: resolvedRunId,
      matrixId: text(metadata?.matrixId),
      startedAt: text(metadata?.startedAt),
    },
    runner: {
      repository: runner.repository,
      docsRef: runner.docsRef,
      manifestPath: runner.manifestPath,
      manifestSha256: runner.manifestSha256,
      scenarioPath: runner.scenarioPath,
      scenarioSha256: runner.scenarioSha256,
    },
  };
}

function traceBinding(correlation) {
  const execution = correlation?.modelExecution;
  return {
    traceId: text(correlation?.traceId),
    chainId: text(correlation?.chainId),
    dispatchSpanId: text(correlation?.dispatchSpanId),
    fireSpanId: text(correlation?.fireSpanId),
    childHarnessSpanId: text(execution?.childHarnessSpanId),
    childRunSpanId: text(execution?.childRunSpanId),
    callSpanIds: (Array.isArray(execution?.calls) ? execution.calls : [])
      .map((call) => text(call?.spanId))
      .filter((value) => value !== null),
  };
}

function canonical(receipt) {
  const binding = receipt.binding;
  return JSON.stringify({
    schema: receipt.schema,
    row: receipt.row,
    authoritativeSource: receipt.authoritativeSource,
    candidateOnly: receipt.candidateOnly,
    foldRequiresReview: receipt.foldRequiresReview,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory ?? null,
    binding: {
      candidateSha: binding.candidateSha,
      runtimeBuildSha: binding.runtimeBuildSha,
      run: Object.fromEntries(RUN_KEYS.map((key) => [key, binding.run[key]])),
      runner: Object.fromEntries(RUNNER_KEYS.map((key) => [key, binding.runner[key]])),
      trace: {
        ...Object.fromEntries(
          TRACE_KEYS.filter((key) => key !== 'callSpanIds')
            .map((key) => [key, binding.trace[key]]),
        ),
        callSpanIds: [...binding.trace.callSpanIds],
      },
      localEvidenceFingerprint: binding.localEvidenceFingerprint,
      topologyFingerprint: binding.topologyFingerprint,
    },
    lifecycle: receipt.lifecycle
      ? Object.fromEntries(LIFECYCLE_KEYS.map((key) => [key, receipt.lifecycle[key]]))
      : null,
    execution: receipt.execution
      ? {
          targetIdentity: receipt.execution.targetIdentity,
          traceId: receipt.execution.traceId,
          chainId: receipt.execution.chainId,
          childHarnessSpanId: receipt.execution.childHarnessSpanId,
          childRunSpanId: receipt.execution.childRunSpanId,
          calls: receipt.execution.calls.map((call) =>
            Object.fromEntries(CALL_KEYS.map((key) => [key, call[key]]))),
        }
      : null,
  });
}

function seal(receipt, key) {
  if (typeof key !== 'string' || !key) throw new Error('missing gateway signing key');
  return {
    ...receipt,
    integrity: {
      algorithm: 'hmac-sha256-gateway-token-v1',
      signature: createHmac('sha256', key).update(canonical(receipt)).digest('hex'),
    },
  };
}

function topologyPasses(correlation, evidence) {
  return correlation?.row === 'R-CD-MODEL-TOOL' &&
    correlation?.continuation?.tool === 'continue_delegate' &&
    correlation?.delegate?.mode === 'normal' &&
    correlation?.sameTrace === true &&
    correlation?.distinctSpans === true &&
    HEX_32.test(correlation?.traceId || '') &&
    HEX_16.test(correlation?.dispatchSpanId || '') &&
    HEX_16.test(correlation?.fireSpanId || '') &&
    correlation.dispatchSpanId !== correlation.fireSpanId &&
    HEX_32.test(evidence?.accepted_send_trace_id || '') &&
    correlation.rowBinding?.acceptedSendTraceId === evidence.accepted_send_trace_id &&
    correlation.traceId === evidence.accepted_send_trace_id;
}

function lifecycle(evidence) {
  return {
    rowBound: evidence?.row === 'R-CD-MODEL-TOOL',
    requestedModelBound:
      evidence?.requested_model_byte === RCD_MODEL_TOOL_REQUIRED_MODEL,
    manifestModelBound: evidence?.manifest_model_matches_required === true,
    dispatchAccepted: evidence?.dispatch_accepted === true,
    parentScheduledSentinel: evidence?.parent_scheduled_sentinel === true,
    childSessionObserved: evidence?.child_session_observed === true,
    returnPayloadObserved: evidence?.return_payload === true,
    disposableSessionVerified:
      evidence?.disposable_session_required !== true || evidence?.session_created === true,
  };
}

function lifecyclePasses(value) {
  return LIFECYCLE_KEYS.every((key) => value?.[key] === true);
}

function failureCategory(correlation, classification, lifecycleReceipt, evidence, runnerBinding) {
  if (!runnerBinding) return 'runner-or-build-identity-mismatch';
  if (!correlation) return 'missing-continuation-topology';
  if (!lifecycleReceipt.rowBound ||
      !lifecycleReceipt.requestedModelBound ||
      !lifecycleReceipt.manifestModelBound) {
    return 'invalid-model-request';
  }
  if (!topologyPasses(correlation, evidence)) {
    return 'invalid-continuation-topology';
  }
  if (correlation.modelExecution?.bound !== true) {
    return Number(correlation.modelExecution?.childHarnessCount) > 1
      ? 'ambiguous-model-execution'
      : 'missing-model-execution';
  }
  if (classification.verdict === 'FAIL-candidate') return 'execution-model-mismatch';
  if (correlation.modelExecution?.complete !== true) return 'incomplete-model-execution';
  if (!lifecyclePasses(lifecycleReceipt)) return 'incomplete-row-lifecycle';
  return 'incomplete-model-execution';
}

export function resolveRcdModelToolAuthoritativeReceipt({
  evidence,
  correlation,
  metadata,
  runId,
  signingKey,
}) {
  const lifecycleReceipt = lifecycle(evidence);
  const runnerBinding = rcdModelToolRunnerBinding(metadata, runId);
  const classification = runnerBinding
    ? classifyRcdModelToolVerdict({
        ...evidence,
        modelExecution: topologyPasses(correlation, evidence) ? correlation.modelExecution : null,
      })
    : { verdict: null, reason: 'runner or build identity envelope is missing or invalid' };
  const base = {
    schema: R_CD_MODEL_TOOL_RECEIPT_SCHEMA,
    row: 'R-CD-MODEL-TOOL',
    authoritativeSource: R_CD_MODEL_TOOL_AUTHORITATIVE_SOURCE,
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: classification.verdict,
    failureCategory:
      classification.verdict === 'PASS-candidate'
        ? null
        : failureCategory(correlation, classification, lifecycleReceipt, evidence, runnerBinding),
    binding: {
      candidateSha: runnerBinding?.candidateSha ?? null,
      runtimeBuildSha: runnerBinding?.runtimeBuildSha ?? null,
      run: runnerBinding?.run ?? emptyRun(),
      runner: runnerBinding?.runner ?? emptyRunner(),
      trace: traceBinding(correlation),
      localEvidenceFingerprint: digest({
        row: evidence?.row || null,
        nonce: fingerprint(evidence?.nonce),
        session: fingerprint(evidence?.child_session_key),
        dispatchAccepted: lifecycleReceipt.dispatchAccepted,
        acceptedSendTrace: fingerprint(evidence?.accepted_send_trace_id),
        parentScheduledSentinel: lifecycleReceipt.parentScheduledSentinel,
        childSessionObserved: lifecycleReceipt.childSessionObserved,
        returnPayloadObserved: lifecycleReceipt.returnPayloadObserved,
        disposableSessionVerified: lifecycleReceipt.disposableSessionVerified,
      }),
      topologyFingerprint: digest({
        trace: correlation?.traceId || null,
        chain: correlation?.chainId || null,
        dispatch: correlation?.dispatchSpanId || null,
        fire: correlation?.fireSpanId || null,
        reason: correlation?.reason || null,
        rowBinding: correlation?.rowBinding || null,
        execution: correlation?.modelExecution || null,
      }),
    },
    lifecycle: lifecycleReceipt,
    // Without a run identity the receipt is not authority for anything, so it
    // must not carry a model-execution claim that a reader could quote.
    execution: runnerBinding && correlation?.modelExecution?.bound === true
      ? {
          targetIdentity: RCD_MODEL_TOOL_REQUIRED_MODEL,
          traceId: correlation.traceId,
          chainId: correlation.chainId,
          childHarnessSpanId: correlation.modelExecution.childHarnessSpanId,
          childRunSpanId: correlation.modelExecution.childRunSpanId,
          calls: (correlation.modelExecution.calls || []).map((call) =>
            Object.fromEntries(CALL_KEYS.map((key) => [key, call?.[key] ?? null]))),
        }
      : null,
  };
  return seal(base, signingKey);
}

function closedShape(receipt) {
  if (!exactKeys(receipt, RECEIPT_KEYS)) return false;
  if (receipt.schema !== R_CD_MODEL_TOOL_RECEIPT_SCHEMA ||
      receipt.row !== 'R-CD-MODEL-TOOL' ||
      receipt.authoritativeSource !== R_CD_MODEL_TOOL_AUTHORITATIVE_SOURCE ||
      receipt.candidateOnly !== true ||
      receipt.foldRequiresReview !== true) {
    return false;
  }
  if (![null, 'PASS-candidate', 'FAIL-candidate'].includes(receipt.verdict)) return false;
  if (!nullableString(receipt.failureCategory)) return false;

  const binding = receipt.binding;
  if (!exactKeys(binding, BINDING_KEYS)) return false;
  if (!nullableString(binding.candidateSha) ||
      (binding.candidateSha !== null && !SHA_40.test(binding.candidateSha))) {
    return false;
  }
  if (!nullableString(binding.runtimeBuildSha)) return false;
  if (!exactKeys(binding.run, RUN_KEYS) ||
      !RUN_KEYS.every((key) => nullableString(binding.run[key]))) {
    return false;
  }
  if (!exactKeys(binding.runner, RUNNER_KEYS) ||
      !RUNNER_KEYS.every((key) => nullableString(binding.runner[key]))) {
    return false;
  }
  if (!exactKeys(binding.trace, TRACE_KEYS)) return false;
  if (!TRACE_KEYS.filter((key) => key !== 'callSpanIds')
    .every((key) => nullableString(binding.trace[key]))) {
    return false;
  }
  if (!Array.isArray(binding.trace.callSpanIds) ||
      !binding.trace.callSpanIds.every((value) => typeof value === 'string')) {
    return false;
  }
  if (!HEX_64.test(binding.localEvidenceFingerprint || '') ||
      !HEX_64.test(binding.topologyFingerprint || '')) {
    return false;
  }

  if (receipt.lifecycle !== null &&
      (!exactKeys(receipt.lifecycle, LIFECYCLE_KEYS) ||
        !LIFECYCLE_KEYS.every((key) => typeof receipt.lifecycle[key] === 'boolean'))) {
    return false;
  }
  if (receipt.execution !== null) {
    if (!exactKeys(receipt.execution, EXECUTION_KEYS)) return false;
    if (!Array.isArray(receipt.execution.calls)) return false;
    if (!receipt.execution.calls.every((call) => exactKeys(call, CALL_KEYS))) return false;
  }
  if (!exactKeys(receipt.integrity, INTEGRITY_KEYS)) return false;
  return receipt.integrity.algorithm === 'hmac-sha256-gateway-token-v1' &&
    HEX_64.test(receipt.integrity.signature || '');
}

function bindingMatchesEnvelope(binding, expected) {
  return binding.candidateSha === expected.candidateSha &&
    binding.runtimeBuildSha === expected.runtimeBuildSha &&
    RUN_KEYS.every((key) => binding.run[key] === expected.run[key]) &&
    RUNNER_KEYS.every((key) => binding.runner[key] === expected.runner[key]);
}

function traceBindingIsExact(trace) {
  return HEX_32.test(trace.traceId || '') &&
    typeof trace.chainId === 'string' && trace.chainId.length > 0 &&
    HEX_16.test(trace.dispatchSpanId || '') &&
    HEX_16.test(trace.fireSpanId || '') &&
    trace.dispatchSpanId !== trace.fireSpanId &&
    HEX_16.test(trace.childHarnessSpanId || '') &&
    HEX_16.test(trace.childRunSpanId || '') &&
    trace.callSpanIds.length > 0 &&
    trace.callSpanIds.every((value) => HEX_16.test(value));
}

/**
 * @param receipt  the receipt document as persisted next to the run artifacts
 * @param key      the gateway signing key
 * @param envelope { metadata, runId, traceId } read independently from
 *                 runner-metadata.json, the run directory name, and
 *                 run-result.json. Bindings are compared against this envelope,
 *                 never against values copied out of the receipt itself.
 */
export function validateRcdModelToolAuthoritativeReceipt(receipt, key, envelope) {
  if (!receipt || typeof key !== 'string' || !key || !closedShape(receipt)) {
    return { valid: false, reason: 'invalid-shape' };
  }
  const expectedSignature = createHmac('sha256', key).update(canonical(receipt)).digest('hex');
  if (!timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receipt.integrity.signature, 'hex'),
  )) {
    return { valid: false, reason: 'invalid-integrity' };
  }

  const expected = rcdModelToolRunnerBinding(envelope?.metadata, envelope?.runId);
  if (!expected) return { valid: false, reason: 'missing-authority-envelope' };
  if (!bindingMatchesEnvelope(receipt.binding, expected)) {
    return { valid: false, reason: 'binding-mismatch' };
  }
  if (receipt.verdict === null) {
    // A NO-VERDICT receipt asserts nothing, and a broken trace binding is one of
    // the conditions it exists to report, so it is not additionally trace-bound.
    return NO_VERDICT_CATEGORIES.has(receipt.failureCategory)
      ? { valid: true, verdict: null }
      : { valid: false, reason: 'invalid-no-verdict-category' };
  }

  const envelopeTraceId = text(envelope?.traceId);
  if (envelopeTraceId && receipt.binding.trace.traceId !== envelopeTraceId) {
    return { valid: false, reason: 'trace-binding-mismatch' };
  }

  if (!traceBindingIsExact(receipt.binding.trace)) {
    return { valid: false, reason: 'invalid-trace-binding' };
  }

  const execution = receipt.execution;
  const calls = Array.isArray(execution?.calls) ? execution.calls : [];
  const executionShape = execution?.targetIdentity === RCD_MODEL_TOOL_REQUIRED_MODEL &&
    HEX_32.test(execution?.traceId || '') &&
    typeof execution?.chainId === 'string' &&
    execution.chainId.length > 0 &&
    HEX_16.test(execution?.childHarnessSpanId || '') &&
    HEX_16.test(execution?.childRunSpanId || '') &&
    calls.length > 0 &&
    calls.every((call) =>
      HEX_16.test(call?.spanId || '') &&
      ['UNSET', 'OK'].includes(call?.status) &&
      typeof call?.provider === 'string' &&
      typeof call?.model === 'string' &&
      call?.complete === true &&
      call.identity === (call.model.startsWith(`${call.provider}/`)
        ? call.model
        : `${call.provider}/${call.model}`));
  if (!executionShape) return { valid: false, reason: 'invalid-execution-shape' };

  const trace = receipt.binding.trace;
  const executionMatchesTrace = execution.traceId === trace.traceId &&
    execution.chainId === trace.chainId &&
    execution.childHarnessSpanId === trace.childHarnessSpanId &&
    execution.childRunSpanId === trace.childRunSpanId &&
    calls.length === trace.callSpanIds.length &&
    calls.every((call, index) => call.spanId === trace.callSpanIds[index]);
  if (!executionMatchesTrace) return { valid: false, reason: 'trace-topology-mismatch' };

  const identities = calls.map((call) => call.identity);
  if (receipt.verdict === 'PASS-candidate') {
    const pass = lifecyclePasses(receipt.lifecycle) &&
      identities.every((identity) => identity === RCD_MODEL_TOOL_REQUIRED_MODEL) &&
      receipt.failureCategory == null;
    return pass
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-pass-authority' };
  }
  const fail = receipt.failureCategory === 'execution-model-mismatch' &&
    identities.some((identity) => identity !== RCD_MODEL_TOOL_REQUIRED_MODEL);
  return fail
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-fail-authority' };
}
