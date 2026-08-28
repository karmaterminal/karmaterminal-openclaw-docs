import { createHash } from 'node:crypto';
import {
  evaluateIsolatedRuntimePlugin,
  publicRuntimePluginReceipt,
} from './isolated-runtime-plugin-contract.mjs';
import {
  GATEWAY_HMAC_RECEIPT_ALGORITHM,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';
import {
  expandReturnCovenantExecutions,
  RETURN_COVENANT_CASES,
  RETURN_COVENANT_DATABASE_PROFILES,
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_ROW_ID,
  returnCovenantExecutionKey,
  validateReturnCovenantPlan,
} from './return-covenant-scenario-contract.mjs';

export const RETURN_COVENANT_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-observation.v1';
export const RETURN_COVENANT_CLEANUP_SCHEMA =
  'openclaw.k6.return-covenant-cleanup.v1';
export const RETURN_COVENANT_RECEIPT_SCHEMA =
  'openclaw.k6.return-covenant-authoritative-receipt.v1';
export { RETURN_COVENANT_EVIDENCE_PREFIX };

const SHA_40 = /^[a-f0-9]{40}$/u;
const HEX_16 = /^[a-f0-9]{16}$/u;
const HEX_64 = /^[a-f0-9]{64}$/u;
const EFFECT_NAMES = ['promptAdoptions', 'wakes', 'channelDeliveries'];
const RETAINED_NAMES = [
  'delegates',
  'queueItems',
  'temporarySessions',
  'gateways',
  'fixtureProcesses',
];
const FORBIDDEN_ADMISSIONS = {
  'forbidden-delete-recreate': 'stale',
  'forbidden-owner-reassignment': 'unauthorized',
  'forbidden-member-access-removal': 'unauthorized',
  'forbidden-restrictive-visibility': 'unauthorized',
  'forbidden-explicit-revocation': 'revoked',
};
const FORBIDDEN_QUEUE_STATUSES = {
  stale: 'stale-acknowledged',
  unauthorized: 'unauthorized-acknowledged',
  revoked: 'revoked-acknowledged',
};

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fingerprint(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function addError(errors, code, message) {
  errors.push({ code, message });
}

function exactEffects(left, right) {
  return EFFECT_NAMES.every((name) => left?.[name] === right?.[name]);
}

function zeroEffects(value) {
  return EFFECT_NAMES.every((name) => value?.[name] === 0);
}

function publicObservation(observation, validation) {
  return {
    caseId: observation?.caseId || null,
    form: observation?.form || null,
    kind: observation?.kind || null,
    applicability: observation?.applicability || 'executed',
    validation: validation.valid ? 'pass' : 'fail',
    failureCategories: [...new Set(validation.errors.map((error) => error.code))].sort(),
    startedAt: observation?.startedAt || null,
    endedAt: observation?.endedAt || null,
    returnMode: observation?.returnMode || null,
    lifecycleEdge: observation?.lifecycle?.edge || null,
    database: {
      profile: observation?.database?.profile || null,
      sourceSchemaVersion: observation?.database?.sourceSchemaVersion ?? null,
      targetSchemaVersion: observation?.database?.targetSchemaVersion ?? null,
      fixtureReceiptFingerprint: fingerprint(
        observation?.database?.canonicalFixtureReceiptId,
      ),
      freshInstall: observation?.database?.freshInstall === true,
      migrationApplied: observation?.database?.migrationApplied === true,
      reopenIdempotent: observation?.database?.reopenIdempotent === true,
    },
    identity: {
      logicalSessionFingerprint: fingerprint(observation?.logicalSessionKey),
      preSessionFingerprint: fingerprint(observation?.lifecycle?.preSessionId),
      postSessionFingerprint: fingerprint(observation?.lifecycle?.postSessionId),
      successorFingerprint: fingerprint(observation?.lifecycle?.successorIdentity),
      acceptedDispatchFingerprint: fingerprint(observation?.dispatch?.receiptId),
      heldResultFingerprint: fingerprint(observation?.dispatch?.heldResultId),
      queueRecordFingerprint: fingerprint(observation?.delivery?.queue?.recordId),
      lifecycleReceiptFingerprint: fingerprint(observation?.lifecycle?.receiptId),
      restartReceiptFingerprint: fingerprint(observation?.lifecycle?.restart?.receiptId),
    },
    authority: {
      capturedGenerationFingerprint: fingerprint(
        observation?.dispatch?.capturedAuthorityGeneration,
      ),
      currentGenerationFingerprint: fingerprint(
        observation?.authorityDiagnostic?.currentAuthorityGeneration,
      ),
      heldResultGenerationFingerprint: fingerprint(
        observation?.delivery?.heldResultAuthorityGeneration,
      ),
      relation: observation?.applicability === 'not-exposed'
        ? 'not-applicable'
        :
        observation?.dispatch?.capturedAuthorityGeneration ===
        observation?.authorityDiagnostic?.currentAuthorityGeneration
          ? 'unchanged'
          : 'advanced',
      diagnosticSource:
        observation?.authorityDiagnostic?.source ||
        observation?.capability?.source ||
        null,
      diagnosticSurfaceFingerprint: fingerprint(
        observation?.authorityDiagnostic?.surface,
      ),
    },
    delivery: {
      admission: observation?.delivery?.admission || null,
      queueStatus: observation?.delivery?.queue?.status || null,
      acknowledged: observation?.delivery?.queue?.acknowledged === true,
      removed: observation?.delivery?.queue?.removed === true,
      retryScheduled: observation?.delivery?.queue?.retryScheduled === true,
      expectedEffects: observation?.effects?.expected || null,
      observedEffects: observation?.effects?.observed || null,
      effectsDistinguishable: observation?.effects?.distinguishable === true,
      effectSourceFingerprints: Object.fromEntries(
        EFFECT_NAMES.map((name) => [
          name,
          fingerprint(observation?.effects?.sources?.[name]),
        ]),
      ),
      settlementWindowMs: observation?.settlement?.windowMs ?? null,
      settlementComplete: observation?.settlement?.complete === true,
      successorTranscriptMatches:
        observation?.scans?.successorTranscriptMatches ?? null,
      trustedSystemEventMatches:
        observation?.scans?.trustedSystemEventMatches ?? null,
    },
  };
}

export function validateReturnCovenantObservation({
  observation,
  plan,
  execution,
}) {
  const errors = [];
  if (!isObject(observation)) {
    return {
      valid: false,
      errors: [{ code: 'observation-shape', message: 'observation must be an object' }],
    };
  }
  if (
    observation.schema !== RETURN_COVENANT_OBSERVATION_SCHEMA ||
    observation.rowId !== RETURN_COVENANT_ROW_ID ||
    observation.runId !== plan.runId ||
    observation.caseId !== execution.caseId ||
    observation.form !== execution.form ||
    observation.kind !== execution.kind
  ) {
    addError(errors, 'observation-shape', 'observation identity does not match execution');
  }
  for (const name of ['candidateSha', 'runtimeBuildSha', 'docsHarnessSha']) {
    if (observation[name] !== plan.target[name]) {
      addError(errors, 'identity-mismatch', `${name} differs from the frozen target`);
    }
  }
  if (observation.runtimeBuildSha !== observation.candidateSha) {
    addError(errors, 'identity-mismatch', 'runtime build differs from product SHA');
  }
  if (
    !validTimestamp(observation.startedAt) ||
    !validTimestamp(observation.endedAt) ||
    Date.parse(observation.endedAt) < Date.parse(observation.startedAt)
  ) {
    addError(errors, 'observation-shape', 'observation timestamps are invalid');
  }
  if (
    observation.returnMode !== execution.returnMode ||
    observation.logicalSessionKey !== execution.testCase.logicalSessionKey
  ) {
    addError(errors, 'observation-shape', 'return mode or logical session differs');
  }

  const profile = RETURN_COVENANT_DATABASE_PROFILES[execution.databaseProfile];
  if (
    observation.database?.profile !== execution.databaseProfile ||
    observation.database?.sourceSchemaVersion !== profile.sourceSchemaVersion ||
    observation.database?.targetSchemaVersion !== profile.targetSchemaVersion ||
    observation.database?.fixtureShape !== profile.fixtureShape ||
    observation.database?.productOwnedFixture !== true ||
    typeof observation.database?.canonicalFixtureReceiptId !== 'string'
  ) {
    addError(errors, 'fixture-not-product-owned', 'database fixture receipt is incomplete');
  }
  if (
    (profile.sourceSchemaVersion === null && observation.database?.freshInstall !== true) ||
    (profile.sourceSchemaVersion === 18 && observation.database?.migrationApplied !== true) ||
    (
      execution.databaseProfile === 'idempotent-v19-reopen' &&
      observation.database?.reopenIdempotent !== true
    )
  ) {
    addError(errors, 'fixture-not-product-owned', 'schema setup operation is not proven');
  }
  if (
    observation.isolation?.home !== true ||
    observation.isolation?.state !== true ||
    observation.isolation?.config !== true ||
    observation.isolation?.syntheticData !== true
  ) {
    addError(errors, 'observation-shape', 'isolated runtime receipt is incomplete');
  }

  if (
    observation.caseId === 'forbidden-explicit-revocation' &&
    observation.applicability === 'not-exposed'
  ) {
    if (
      observation.capability?.source !== 'product-owned' ||
      observation.capability?.revocationApiExposed !== false ||
      observation.capability?.productSha !== plan.target.candidateSha ||
      typeof observation.capability?.surface !== 'string' ||
      !zeroEffects(observation.effects?.observed) ||
      observation.scans?.successorTranscriptMatches !== 0 ||
      observation.scans?.trustedSystemEventMatches !== 0
    ) {
      addError(
        errors,
        'observation-shape',
        'not-exposed revocation capability receipt is incomplete',
      );
    }
    return { valid: errors.length === 0, errors };
  }

  if (
    observation.dispatch?.accepted !== true ||
    observation.dispatch?.completionHeld !== true ||
    typeof observation.dispatch?.receiptId !== 'string' ||
    typeof observation.dispatch?.heldResultId !== 'string' ||
    typeof observation.dispatch?.capturedAuthorityGeneration !== 'string'
  ) {
    addError(errors, 'dispatch-not-held', 'accepted dispatch was not held');
  }
  if (
    observation.lifecycle?.edge !== execution.lifecycleEdge ||
    observation.lifecycle?.occurredAfterAcceptance !== true ||
    observation.lifecycle?.completedBeforeRelease !== true ||
    typeof observation.lifecycle?.postSessionId !== 'string' ||
    typeof observation.lifecycle?.successorIdentity !== 'string' ||
    typeof observation.lifecycle?.receiptId !== 'string'
  ) {
    addError(errors, 'observation-shape', 'lifecycle ordering or successor is incomplete');
  }
  if (
    observation.authorityDiagnostic?.source !== 'product-owned' ||
    typeof observation.authorityDiagnostic?.surface !== 'string' ||
    observation.authorityDiagnostic?.capturedAuthorityGeneration !==
      observation.dispatch?.capturedAuthorityGeneration ||
    typeof observation.authorityDiagnostic?.currentAuthorityGeneration !== 'string'
  ) {
    addError(
      errors,
      'authority-generation-mismatch',
      'authority diagnostic does not bind the captured generation',
    );
  }
  if (
    observation.delivery?.acceptedDispatchReceiptId !==
      observation.dispatch?.receiptId ||
    observation.delivery?.heldResultAuthorityGeneration !==
      observation.dispatch?.capturedAuthorityGeneration ||
    observation.delivery?.resultReleased !== true
  ) {
    addError(errors, 'dispatch-not-held', 'released result lost its accepted authority');
  }
  if (
    observation.effects?.distinguishable !== true ||
    !exactEffects(observation.effects?.expected, execution.expectedEffects) ||
    EFFECT_NAMES.some((name) =>
      typeof observation.effects?.sources?.[name] !== 'string' ||
      observation.effects.sources[name].length === 0) ||
    new Set(EFFECT_NAMES.map((name) => observation.effects.sources[name])).size !==
      EFFECT_NAMES.length
  ) {
    addError(errors, 'effect-count-mismatch', 'effect counters are not independently bound');
  }
  if (
    observation.settlement?.complete !== true ||
    observation.settlement?.bounded !== true ||
    !Number.isInteger(observation.settlement?.windowMs) ||
    observation.settlement.windowMs < plan.settlementWindowMs
  ) {
    addError(errors, 'queue-not-settled', 'bounded settlement receipt is incomplete');
  }
  if (
    observation.scans?.successorTranscriptMatches !== 0 ||
    observation.scans?.trustedSystemEventMatches !== 0
  ) {
    addError(errors, 'forbidden-payload-retained', 'stale result remains observable');
  }

  const captured = observation.dispatch?.capturedAuthorityGeneration;
  const current = observation.authorityDiagnostic?.currentAuthorityGeneration;
  if (execution.kind === 'allowed') {
    if (
      captured !== current ||
      observation.lifecycle?.generationAdvanced !== false ||
      observation.lifecycle?.effectiveAuthorityUnchanged !== true
    ) {
      addError(
        errors,
        'authority-generation-mismatch',
        'allowed lifecycle did not preserve effective authority',
      );
    }
    if (
      observation.delivery?.admission !== 'adopted' ||
      observation.delivery?.queue?.status !== 'adopted' ||
      observation.delivery?.queue?.acknowledged !== true ||
      observation.delivery?.queue?.removed !== true ||
      observation.delivery?.queue?.retryScheduled !== false
    ) {
      addError(errors, 'queue-not-settled', 'allowed result was not adopted exactly once');
    }
    if (!exactEffects(observation.effects?.observed, execution.expectedEffects)) {
      addError(errors, 'effect-count-mismatch', 'allowed final effects differ');
    }
    if (
      observation.caseId === 'allowed-late-materialization' &&
      observation.lifecycle?.preSessionId !== null
    ) {
      addError(errors, 'observation-shape', 'late materialization must begin absent');
    }
    if (
      observation.caseId !== 'allowed-late-materialization' &&
      typeof observation.lifecycle?.preSessionId !== 'string'
    ) {
      addError(errors, 'observation-shape', 'allowed lifecycle is missing pre-session identity');
    }
    if (
      observation.caseId === 'allowed-session-id-rollover' &&
      observation.lifecycle?.preSessionId === observation.lifecycle?.postSessionId
    ) {
      addError(errors, 'observation-shape', 'rollover did not change session identity');
    }
    if (
      observation.caseId === 'allowed-gateway-restart-replay' &&
      (
        observation.lifecycle?.restart?.stoppedAfterAcceptance !== true ||
        observation.lifecycle?.restart?.restartedBeforeRelease !== true ||
        observation.lifecycle?.restart?.replayRecovered !== true ||
        typeof observation.lifecycle?.restart?.receiptId !== 'string'
      )
    ) {
      addError(errors, 'observation-shape', 'gateway restart replay is not proven');
    }
  } else {
    const expectedAdmission = FORBIDDEN_ADMISSIONS[observation.caseId];
    if (
      captured === current ||
      observation.lifecycle?.generationAdvanced !== true ||
      observation.lifecycle?.effectiveAuthorityUnchanged !== false
    ) {
      addError(
        errors,
        'authority-generation-mismatch',
        'forbidden lifecycle did not advance recipient authority',
      );
    }
    if (
      observation.delivery?.admission !== expectedAdmission ||
      observation.delivery?.queue?.status !==
        FORBIDDEN_QUEUE_STATUSES[expectedAdmission] ||
      observation.delivery?.queue?.acknowledged !== true ||
      observation.delivery?.queue?.removed !== true ||
      observation.delivery?.queue?.retryScheduled !== false
    ) {
      addError(errors, 'queue-not-settled', 'forbidden result was not terminally removed');
    }
    if (!zeroEffects(observation.effects?.expected) || !zeroEffects(observation.effects?.observed)) {
      addError(errors, 'stale-side-effect', 'forbidden result reached a final side effect');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateReturnCovenantObservationSet({
  plan,
  observations,
}) {
  const errors = [];
  const validations = [];
  const expected = expandReturnCovenantExecutions(plan);
  const byKey = new Map();
  for (const observation of Array.isArray(observations) ? observations : []) {
    const key = returnCovenantExecutionKey(observation?.caseId, observation?.form);
    const entries = byKey.get(key) || [];
    entries.push(observation);
    byKey.set(key, entries);
  }
  for (const execution of expected) {
    const key = returnCovenantExecutionKey(execution.caseId, execution.form);
    const entries = byKey.get(key) || [];
    if (entries.length === 0) {
      const error = { code: 'observation-missing', message: `missing ${key}` };
      errors.push(error);
      validations.push({ execution, observation: null, valid: false, errors: [error] });
      continue;
    }
    if (entries.length > 1) {
      const error = { code: 'observation-duplicate', message: `duplicated ${key}` };
      errors.push(error);
      validations.push({
        execution,
        observation: entries[0],
        valid: false,
        errors: [error],
      });
      continue;
    }
    const validation = validateReturnCovenantObservation({
      observation: entries[0],
      plan,
      execution,
    });
    validations.push({ execution, observation: entries[0], ...validation });
    errors.push(...validation.errors);
    byKey.delete(key);
  }
  for (const key of byKey.keys()) {
    errors.push({ code: 'observation-unexpected', message: `unexpected ${key}` });
  }
  return {
    valid: errors.length === 0,
    errors,
    validations,
    expectedCount: expected.length,
    observedCount: Array.isArray(observations) ? observations.length : 0,
  };
}

export function validateReturnCovenantCleanup({ cleanup, plan }) {
  const errors = [];
  if (
    cleanup?.schema !== RETURN_COVENANT_CLEANUP_SCHEMA ||
    cleanup?.rowId !== RETURN_COVENANT_ROW_ID ||
    cleanup?.runId !== plan.runId ||
    cleanup?.candidateSha !== plan.target.candidateSha ||
    cleanup?.docsHarnessSha !== plan.target.docsHarnessSha
  ) {
    addError(errors, 'cleanup-failure', 'cleanup identity is incomplete');
  }
  if (
    !validTimestamp(cleanup?.startedAt) ||
    !validTimestamp(cleanup?.endedAt) ||
    Date.parse(cleanup?.endedAt) < Date.parse(cleanup?.startedAt)
  ) {
    addError(errors, 'cleanup-failure', 'cleanup timestamps are invalid');
  }
  for (const name of RETAINED_NAMES) {
    if (cleanup?.retained?.[name] !== 0) {
      addError(errors, 'cleanup-failure', `cleanup retained ${name}`);
    }
  }
  for (const name of ['homeRemoved', 'stateRemoved', 'configRemoved']) {
    if (cleanup?.[name] !== true) {
      addError(errors, 'cleanup-failure', `${name} is not proven`);
    }
  }
  if (
    cleanup?.fixtureProcessStopped !== true ||
    cleanup?.gatewayProcessStopped !== true ||
    cleanup?.allCaseHandlesClosed !== true
  ) {
    addError(errors, 'cleanup-failure', 'fixture or gateway process remains');
  }
  return { valid: errors.length === 0, errors };
}

export function parseReturnCovenantEvidenceLog(log) {
  const records = String(log)
    .split(/\r?\n/u)
    .flatMap((line) => {
      const offset = line.indexOf(RETURN_COVENANT_EVIDENCE_PREFIX);
      if (offset < 0) return [];
      return [JSON.parse(line.slice(offset + RETURN_COVENANT_EVIDENCE_PREFIX.length))];
    });
  if (records.length !== 1) {
    throw new Error(
      `expected exactly one return-covenant evidence record, observed ${records.length}`,
    );
  }
  if (
    records[0]?.schema !== 'openclaw.k6.return-covenant-observation-set.v1' ||
    !Array.isArray(records[0]?.observations)
  ) {
    throw new Error('return-covenant evidence record has an invalid shape');
  }
  return records[0];
}

function canonicalReceipt(receipt) {
  const { integrity: _integrity, ...unsigned } = receipt;
  return JSON.stringify(unsigned);
}

function privateForbiddenValues(plan, observations) {
  const values = [plan.runId, plan.syntheticChannelKey];
  for (const entry of plan.cases) values.push(entry.logicalSessionKey);
  for (const observation of observations) {
    values.push(
      observation?.logicalSessionKey,
      observation?.dispatch?.receiptId,
      observation?.dispatch?.heldResultId,
      observation?.dispatch?.capturedAuthorityGeneration,
      observation?.authorityDiagnostic?.currentAuthorityGeneration,
      observation?.lifecycle?.preSessionId,
      observation?.lifecycle?.postSessionId,
      observation?.lifecycle?.successorIdentity,
      observation?.delivery?.queue?.recordId,
      observation?.resultMarker,
    );
  }
  return [...new Set(values.filter((value) =>
    typeof value === 'string' && value.length >= 8))];
}

export function resolveReturnCovenantAuthoritativeReceipt({
  plan,
  observations,
  cleanup,
  runtimeConfig,
  signingKey,
}) {
  const planErrors = validateReturnCovenantPlan(plan)
    .map((message) => ({ code: 'plan-invalid', message }));
  const observationSet = planErrors.length === 0
    ? validateReturnCovenantObservationSet({ plan, observations })
    : {
      valid: false,
      errors: planErrors,
      validations: [],
      expectedCount: RETURN_COVENANT_CASES.length * 2,
      observedCount: Array.isArray(observations) ? observations.length : 0,
    };
  const cleanupValidation = validateReturnCovenantCleanup({ cleanup, plan });
  const runtimeEvaluation = evaluateIsolatedRuntimePlugin({
    config: runtimeConfig,
    configAvailable: isObject(runtimeConfig),
  });
  const failureCategories = new Set([
    ...planErrors.map((error) => error.code),
    ...observationSet.errors.map((error) => error.code),
    ...cleanupValidation.errors.map((error) => error.code),
  ]);
  if (!runtimeEvaluation.sufficient) {
    failureCategories.add('isolated-runtime-unavailable');
  }

  const receipt = {
    schema: RETURN_COVENANT_RECEIPT_SCHEMA,
    row: RETURN_COVENANT_ROW_ID,
    authoritativeSource: 'return-covenant-row-scoped-observer',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: failureCategories.size === 0 ? 'PASS-candidate' : 'FAIL-candidate',
    failureCategories: [...failureCategories].sort(),
    target: {
      candidateSha: plan?.target?.candidateSha || null,
      runtimeBuildSha: plan?.target?.runtimeBuildSha || null,
      docsHarnessSha: plan?.target?.docsHarnessSha || null,
    },
    binding: {
      runFingerprint: fingerprint(plan?.runId),
      planSha256: digest(plan),
      observationSetSha256: digest(observations),
      cleanupSha256: digest(cleanup),
    },
    runtimePlugin: publicRuntimePluginReceipt(runtimeEvaluation),
    matrix: {
      requiredCases: RETURN_COVENANT_CASES.length,
      requiredFormsPerCase: 2,
      expectedObservations: observationSet.expectedCount,
      observedObservations: observationSet.observedCount,
      cases: observationSet.validations.map((validation) =>
        publicObservation(validation.observation, validation)),
    },
    cleanup: {
      status: cleanupValidation.valid ? 'pass' : 'fail',
      completedAt: cleanup?.endedAt || null,
      retained: Object.fromEntries(
        RETAINED_NAMES.map((name) => [name, cleanup?.retained?.[name] ?? null]),
      ),
      homeRemoved: cleanup?.homeRemoved === true,
      stateRemoved: cleanup?.stateRemoved === true,
      configRemoved: cleanup?.configRemoved === true,
      fixtureProcessStopped: cleanup?.fixtureProcessStopped === true,
      gatewayProcessStopped: cleanup?.gatewayProcessStopped === true,
      allCaseHandlesClosed: cleanup?.allCaseHandlesClosed === true,
    },
    redaction: {
      status: 'pass',
      forbiddenValuesScanned: privateForbiddenValues(plan, observations).length,
      forbiddenValueMatches: 0,
      rawIdentifiersPublished: false,
    },
  };

  const publicBytes = JSON.stringify(receipt);
  const leaked = privateForbiddenValues(plan, observations)
    .filter((value) => publicBytes.includes(value));
  if (leaked.length > 0 || /Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}/u.test(publicBytes)) {
    throw new Error('public return-covenant receipt failed forbidden-value scan');
  }
  return sealSignedObserverReceipt({
    receipt,
    signingKey,
    canonicalize: canonicalReceipt,
  });
}

export function validateReturnCovenantAuthoritativeReceipt(receipt, signingKey) {
  if (
    !receipt ||
    receipt.schema !== RETURN_COVENANT_RECEIPT_SCHEMA ||
    receipt.row !== RETURN_COVENANT_ROW_ID ||
    receipt.authoritativeSource !== 'return-covenant-row-scoped-observer' ||
    receipt.candidateOnly !== true ||
    receipt.foldRequiresReview !== true ||
    !SHA_40.test(receipt.target?.candidateSha || '') ||
    receipt.target?.runtimeBuildSha !== receipt.target.candidateSha ||
    !SHA_40.test(receipt.target?.docsHarnessSha || '') ||
    !HEX_16.test(receipt.binding?.runFingerprint || '') ||
    !HEX_64.test(receipt.binding?.planSha256 || '') ||
    !HEX_64.test(receipt.binding?.observationSetSha256 || '') ||
    !HEX_64.test(receipt.binding?.cleanupSha256 || '') ||
    receipt.integrity?.algorithm !== GATEWAY_HMAC_RECEIPT_ALGORITHM
  ) {
    return { valid: false, reason: 'invalid-shape' };
  }
  if (!validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey,
    canonicalize: canonicalReceipt,
  })) {
    return { valid: false, reason: 'invalid-integrity' };
  }
  const cases = receipt.matrix?.cases;
  const passShape =
    receipt.matrix?.requiredCases === RETURN_COVENANT_CASES.length &&
    receipt.matrix?.requiredFormsPerCase === 2 &&
    receipt.matrix?.expectedObservations === RETURN_COVENANT_CASES.length * 2 &&
    receipt.matrix?.observedObservations === RETURN_COVENANT_CASES.length * 2 &&
    Array.isArray(cases) &&
    cases.length === RETURN_COVENANT_CASES.length * 2 &&
    cases.every((entry) =>
      entry.validation === 'pass' &&
      entry.failureCategories.length === 0 &&
      entry.authority.diagnosticSource === 'product-owned' &&
      entry.delivery.effectsDistinguishable === true &&
      entry.delivery.settlementComplete === true) &&
    receipt.cleanup?.status === 'pass' &&
    RETAINED_NAMES.every((name) => receipt.cleanup.retained?.[name] === 0) &&
    receipt.runtimePlugin?.sufficient === true &&
    receipt.runtimePlugin?.source === 'isolated-target-config' &&
    receipt.redaction?.status === 'pass' &&
    receipt.redaction?.forbiddenValueMatches === 0 &&
    receipt.redaction?.rawIdentifiersPublished === false;
  if (receipt.verdict === 'PASS-candidate') {
    return passShape && receipt.failureCategories.length === 0
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-pass-matrix' };
  }
  return receipt.verdict === 'FAIL-candidate' &&
    Array.isArray(receipt.failureCategories) &&
    receipt.failureCategories.length > 0
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-failure' };
}
