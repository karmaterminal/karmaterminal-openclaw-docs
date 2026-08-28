import { createHash, createHmac } from 'node:crypto';
import {
  evaluateIsolatedRuntimePlugin,
  publicRuntimePluginReceipt,
} from './isolated-runtime-plugin-contract.mjs';
import {
  canonicalJson,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';
import {
  buildReturnCovenantRetentionRequest,
  expectedReturnCovenantEffects,
  expandReturnCovenantExecutions,
  RETURN_COVENANT_CASES,
  RETURN_COVENANT_DATABASE_PROFILES,
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_RETENTION_OBSERVATION_SCHEMA,
  RETURN_COVENANT_RETENTION_QUERY_LIMIT,
  RETURN_COVENANT_RETENTION_RESOURCES,
  RETURN_COVENANT_RETENTION_RESPONSE_SCHEMA,
  RETURN_COVENANT_ROW_ID,
  RETURN_COVENANT_TEARDOWN_PREFIX,
  returnCovenantExecutionKey,
  validateReturnCovenantDriverAttestation,
  validateReturnCovenantPlan,
} from './return-covenant-scenario-contract.mjs';

export const RETURN_COVENANT_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-observation.v1';
export const RETURN_COVENANT_CLEANUP_SCHEMA =
  'openclaw.k6.return-covenant-cleanup.v1';
export const RETURN_COVENANT_RECEIPT_SCHEMA =
  'openclaw.k6.return-covenant-authoritative-receipt.v1';
export const RETURN_COVENANT_INTEGRITY_ALGORITHM =
  'hmac-sha256-proof-launch-key-v1';
export const RETURN_COVENANT_CAPABILITY_SCHEMA =
  'openclaw.k6.return-covenant-capability-inventory.v1';
export {
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_TEARDOWN_PREFIX,
};

const SHA_40 = /^[a-f0-9]{40}$/u;
const HEX_16 = /^[a-f0-9]{16}$/u;
const HEX_64 = /^[a-f0-9]{64}$/u;
const RESULT_MARKER = /^RCV-[a-f0-9]{32}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const EFFECT_NAMES = ['promptAdoptions', 'wakes', 'channelDeliveries'];
const RETAINED_NAMES = [
  'delegates',
  'queueItems',
  'temporarySessions',
  'gateways',
  'fixtureProcesses',
];
const OBSERVED_RETENTION_NAMES = RETAINED_NAMES.slice(0, 3);
export const RETURN_COVENANT_RETENTION_AUTHORITY = Object.freeze({
  resourceState: 'docs-owned-gateway-observation',
  processState: 'trusted-launcher-proc-observation',
  caseHandles: 'docs-owned-phase-chain-ledger',
  candidateCleanup: 'untrusted-diagnostic-only',
});
const RETENTION_AUTHORITY = RETURN_COVENANT_RETENTION_AUTHORITY;
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
const CASE_BY_ID = new Map(RETURN_COVENANT_CASES.map((entry) => [entry.id, entry]));
const FORMS = new Set(['typed-tool', 'bracket-token']);
const SAFE_RUNTIME_IDS = new Set(['codex', 'openclaw', 'auto']);
const SAFE_ADMISSIONS = new Set(['adopted', 'stale', 'unauthorized', 'revoked']);
const SAFE_QUEUE_STATUSES = new Set([
  'adopted',
  'stale-acknowledged',
  'unauthorized-acknowledged',
  'revoked-acknowledged',
]);

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function digest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function fingerprint(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function validTimestamp(value) {
  return typeof value === 'string' &&
    CANONICAL_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function safeHex(value, pattern) {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

function nonEmpty(value, minimum = 1) {
  return typeof value === 'string' && value.trim().length >= minimum;
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

function safeEffects(value) {
  return Object.fromEntries(
    EFFECT_NAMES.map((name) => [
      name,
      Number.isInteger(value?.[name]) ? value[name] : null,
    ]),
  );
}

function safeRuntimePluginReceipt(evaluation, configObserved) {
  const receipt = publicRuntimePluginReceipt(evaluation);
  return {
    ...receipt,
    runtime: SAFE_RUNTIME_IDS.has(receipt.runtime) ? receipt.runtime : null,
    pluginId: SAFE_RUNTIME_IDS.has(receipt.pluginId) ? receipt.pluginId : null,
    configObserved,
    selectedModelFingerprint: fingerprint(evaluation.selectedModelRef),
  };
}

function publicObservation(observation, phaseChain, validation) {
  const execution = validation?.execution;
  return {
    caseId: CASE_BY_ID.has(execution?.caseId) ? execution.caseId : null,
    form: FORMS.has(execution?.form) ? execution.form : null,
    kind: execution?.kind === 'allowed' || execution?.kind === 'forbidden'
      ? execution.kind
      : null,
    applicability:
      observation?.applicability === 'not-exposed' ? 'not-exposed' : 'executed',
    validation: validation.valid ? 'pass' : 'fail',
    failureCategories: [...new Set(validation.errors.map((error) => error.code))].sort(),
    startedAt: validTimestamp(observation?.startedAt) ? observation.startedAt : null,
    endedAt: validTimestamp(observation?.endedAt) ? observation.endedAt : null,
    returnMode: ['normal', 'silent', 'silent-wake', 'post-compaction']
      .includes(execution?.returnMode)
      ? execution.returnMode
      : null,
    lifecycleEdge:
      execution?.lifecycleEdge ||
      null,
    markerFingerprint: fingerprint(observation?.resultMarker),
    origin: {
      source:
        observation?.dispatch?.originEvidence?.source === 'product-owned'
          ? 'product-owned'
          : null,
      observedForm: FORMS.has(observation?.dispatch?.originEvidence?.observedForm)
        ? observation.dispatch.originEvidence.observedForm
        : null,
      receiptFingerprint: fingerprint(
        observation?.dispatch?.originEvidence?.receiptId,
      ),
      typedToolExecutions: Number.isInteger(
        observation?.dispatch?.originEvidence?.typedToolExecutions,
      )
        ? observation.dispatch.originEvidence.typedToolExecutions
        : null,
      bracketParses: Number.isInteger(
        observation?.dispatch?.originEvidence?.bracketParses,
      )
        ? observation.dispatch.originEvidence.bracketParses
        : null,
      rawFinalText: observation?.dispatch?.originEvidence?.rawFinalText === true,
    },
    chain: {
      caseHandleFingerprint: fingerprint(phaseChain?.caseHandle),
      prepareReceiptFingerprint: fingerprint(phaseChain?.prepare?.receiptId),
      dispatchReceiptFingerprint: fingerprint(phaseChain?.dispatch?.receiptId),
      transitionReceiptFingerprint: fingerprint(phaseChain?.transition?.receiptId),
      releaseReceiptFingerprint: fingerprint(phaseChain?.release?.receiptId),
      cleanupReceiptFingerprint: fingerprint(phaseChain?.cleanup?.receiptId),
      phaseProofsValid: validation?.phaseProofsValid === true,
    },
    capability: observation?.applicability === 'not-exposed'
      ? {
        inventoryComplete: observation?.capability?.inventoryComplete === true,
        revocationApiExposed: observation?.capability?.revocationApiExposed === true,
        receiptFingerprint: fingerprint(observation?.capability?.receiptId),
        surfaceFingerprint: fingerprint(observation?.capability?.surface),
      }
      : null,
    database: {
      profile: RETURN_COVENANT_DATABASE_PROFILES[observation?.database?.profile]
        ? observation.database.profile
        : null,
      sourceSchemaVersion:
        observation?.database?.sourceSchemaVersion === null ||
        Number.isInteger(observation?.database?.sourceSchemaVersion)
          ? observation.database.sourceSchemaVersion
          : null,
      targetSchemaVersion: Number.isInteger(
        observation?.database?.targetSchemaVersion,
      )
        ? observation.database.targetSchemaVersion
        : null,
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
      originalGatewayStartFingerprint: fingerprint(
        observation?.lifecycle?.restart?.originalGatewayStartFingerprint,
      ),
      replacementGatewayStartFingerprint: fingerprint(
        observation?.lifecycle?.restart?.replacementGatewayStartFingerprint,
      ),
      replacementGatewayPidFingerprint: fingerprint(
        String(observation?.lifecycle?.restart?.replacementGatewayPid || ''),
      ),
      restartProcessGroupFingerprint: fingerprint(
        String(observation?.lifecycle?.restart?.processGroupId || ''),
      ),
      deletionReceiptFingerprint: fingerprint(
        observation?.lifecycle?.operations?.deletionReceiptId,
      ),
      recreationReceiptFingerprint: fingerprint(
        observation?.lifecycle?.operations?.recreationReceiptId,
      ),
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
      admission: SAFE_ADMISSIONS.has(observation?.delivery?.admission)
        ? observation.delivery.admission
        : null,
      queueStatus: SAFE_QUEUE_STATUSES.has(observation?.delivery?.queue?.status)
        ? observation.delivery.queue.status
        : null,
      acknowledged: observation?.delivery?.queue?.acknowledged === true,
      removed: observation?.delivery?.queue?.removed === true,
      retryScheduled: observation?.delivery?.queue?.retryScheduled === true,
      expectedEffects: safeEffects(observation?.effects?.expected),
      observedEffects: safeEffects(observation?.effects?.observed),
      effectsDistinguishable: observation?.effects?.distinguishable === true,
      effectSourceFingerprints: Object.fromEntries(
        EFFECT_NAMES.map((name) => [
          name,
          fingerprint(observation?.effects?.sources?.[name]),
        ]),
      ),
      settlementWindowMs: observation?.settlement?.windowMs ?? null,
      settlementComplete: observation?.settlement?.complete === true,
      productSettlementElapsedMs: Number.isFinite(
        observation?.settlement?.monotonicElapsedMs,
      )
        ? observation.settlement.monotonicElapsedMs
        : null,
      harnessSettlementElapsedMs: Number.isFinite(
        phaseChain?.harnessTiming?.elapsedMs,
      )
        ? phaseChain.harnessTiming.elapsedMs
        : null,
      successorTranscriptMatches: Number.isInteger(
        observation?.scans?.successorTranscript?.matches,
      )
        ? observation.scans.successorTranscript.matches
        : null,
      trustedSystemEventMatches: Number.isInteger(
        observation?.scans?.trustedSystemEvents?.matches,
      )
        ? observation.scans.trustedSystemEvents.matches
        : null,
      successorTranscriptScanFingerprint: fingerprint(
        observation?.scans?.successorTranscript?.receiptId,
      ),
      trustedSystemEventScanFingerprint: fingerprint(
        observation?.scans?.trustedSystemEvents?.receiptId,
      ),
    },
  };
}

function rawObservationHasClosedShape(observation) {
  const notExposed = observation?.applicability === 'not-exposed';
  const commonKeys = [
    'schema',
    'rowId',
    'runId',
    'caseId',
    'form',
    'kind',
    'candidateSha',
    'runtimeBuildSha',
    'docsHarnessSha',
    'runtimeConfigSha256',
    'startedAt',
    'endedAt',
    'returnMode',
    'logicalSessionKey',
    'caseHandle',
    'database',
    'isolation',
    'effects',
    'settlement',
    'scans',
  ];
  const topKeys = notExposed
    ? [...commonKeys, 'applicability', 'capability']
    : [
      ...commonKeys,
      'resultMarker',
      'dispatch',
      'lifecycle',
      'authorityDiagnostic',
      'delivery',
      ...(observation?.applicability === 'executed' ? ['applicability'] : []),
    ];
  const lifecycleKeys = [
    'edge',
    'occurredAfterAcceptance',
    'completedBeforeRelease',
    'preSessionId',
    'postSessionId',
    'successorIdentity',
    'receiptId',
    'acceptedDispatchReceiptId',
    'generationAdvanced',
    'effectiveAuthorityUnchanged',
    ...(observation?.lifecycle?.restart ? ['restart'] : []),
    ...(observation?.lifecycle?.operations ? ['operations'] : []),
  ];
  return exactKeys(observation, topKeys) &&
    exactKeys(observation.database, [
      'profile',
      'sourceSchemaVersion',
      'targetSchemaVersion',
      'fixtureShape',
      'productOwnedFixture',
      'canonicalFixtureReceiptId',
      'freshInstall',
      'migrationApplied',
      'reopenIdempotent',
    ]) &&
    exactKeys(observation.isolation, ['home', 'state', 'config', 'syntheticData']) &&
    exactKeys(observation.effects, ['distinguishable', 'sources', 'expected', 'observed']) &&
    exactKeys(observation.effects.sources, EFFECT_NAMES) &&
    exactKeys(observation.effects.expected, EFFECT_NAMES) &&
    exactKeys(observation.effects.observed, EFFECT_NAMES) &&
    exactKeys(observation.settlement, notExposed
      ? ['bounded', 'complete', 'windowMs']
      : [
        'bounded',
        'complete',
        'windowMs',
        'releasedAt',
        'scansCompletedAt',
        'elapsedMs',
        'monotonicElapsedMs',
      ]) &&
    exactKeys(observation.scans, [
      'resultMarker',
      'successorTranscript',
      'trustedSystemEvents',
    ]) &&
    exactKeys(observation.scans.successorTranscript, [
      'source',
      'marker',
      'matches',
      'receiptId',
    ]) &&
    exactKeys(observation.scans.trustedSystemEvents, [
      'source',
      'marker',
      'matches',
      'receiptId',
    ]) &&
    (notExposed
      ? exactKeys(observation.capability, [
        'schema',
        'source',
        'productSha',
        'runtimeBuildSha',
        'runtimeConfigSha256',
        'docsHarnessSha',
        'runId',
        'caseId',
        'form',
        'inventoryComplete',
        'revocationApiExposed',
        'surface',
        'receiptId',
      ])
      : (
        exactKeys(observation.dispatch, [
          'caseHandle',
          'prepareReceiptId',
          'accepted',
          'completionHeld',
          'receiptId',
          'heldResultId',
          'capturedAuthorityGeneration',
          'resultMarker',
          'originEvidence',
        ]) &&
        exactKeys(observation.dispatch.originEvidence, [
          'source',
          'observedForm',
          'receiptId',
          'typedToolExecutions',
          'bracketParses',
          'rawFinalText',
        ]) &&
        exactKeys(observation.lifecycle, lifecycleKeys) &&
        (!observation.lifecycle.restart || exactKeys(
          observation.lifecycle.restart,
          [
            'stoppedAfterAcceptance',
            'restartedBeforeRelease',
            'replayRecovered',
            'receiptId',
            'originalGatewayPid',
            'originalGatewayStartFingerprint',
            'replacementGatewayPid',
            'replacementGatewayStartFingerprint',
            'gatewayCommandSha256',
            'runtimeConfigSha256',
            'processGroupId',
            'replacementGatewayEndpoint',
          ],
        )) &&
        (!observation.lifecycle.operations || exactKeys(
          observation.lifecycle.operations,
          [
            'deletionObserved',
            'deletionReceiptId',
            'recreationObserved',
            'recreationReceiptId',
          ],
        )) &&
        exactKeys(observation.authorityDiagnostic, [
          'source',
          'surface',
          'capturedAuthorityGeneration',
          'currentAuthorityGeneration',
        ]) &&
        exactKeys(observation.delivery, [
          'acceptedDispatchReceiptId',
          'heldResultAuthorityGeneration',
          'caseHandle',
          'transitionReceiptId',
          'releaseReceiptId',
          'resultReleased',
          'admission',
          'queue',
        ]) &&
        exactKeys(observation.delivery.queue, [
          'recordId',
          'status',
          'acknowledged',
          'removed',
          'retryScheduled',
        ])
      ));
}

export function validateReturnCovenantObservation({
  observation,
  plan,
  execution,
  phaseChain,
  driverAttestation,
  gatewayLifecycle,
}) {
  const errors = [];
  if (!isObject(observation)) {
    return {
      valid: false,
      errors: [{ code: 'observation-shape', message: 'observation must be an object' }],
    };
  }
  if (!rawObservationHasClosedShape(observation)) {
    addError(errors, 'observation-shape', 'observation violates the closed schema');
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
  if (
    phaseChain?.caseId !== execution.caseId ||
    phaseChain?.form !== execution.form ||
    !nonEmpty(phaseChain?.caseHandle, 8) ||
    observation.caseHandle !== phaseChain?.caseHandle ||
    phaseChain?.prepare?.caseHandle !== phaseChain.caseHandle ||
    !nonEmpty(phaseChain?.prepare?.receiptId, 8) ||
    phaseChain?.cleanup?.caseHandle !== phaseChain.caseHandle ||
    phaseChain?.cleanup?.closed !== true ||
    !nonEmpty(phaseChain?.cleanup?.receiptId, 8)
  ) {
    addError(errors, 'phase-chain-mismatch', 'prepare or cleanup chain is incomplete');
  }
  for (const name of [
    'candidateSha',
    'runtimeBuildSha',
    'docsHarnessSha',
    'runtimeConfigSha256',
  ]) {
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
    !nonEmpty(observation.database?.canonicalFixtureReceiptId, 8) ||
    observation.database?.canonicalFixtureReceiptId !==
      phaseChain?.prepare?.receiptId
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
      observation.capability?.schema !== RETURN_COVENANT_CAPABILITY_SCHEMA ||
      observation.capability?.source !== 'product-owned' ||
      observation.capability?.revocationApiExposed !== false ||
      observation.capability?.productSha !== plan.target.candidateSha ||
      observation.capability?.runtimeBuildSha !== plan.target.runtimeBuildSha ||
      observation.capability?.docsHarnessSha !== plan.target.docsHarnessSha ||
      observation.capability?.runId !== plan.runId ||
      observation.capability?.caseId !== execution.caseId ||
      observation.capability?.form !== execution.form ||
      observation.capability?.inventoryComplete !== true ||
      !nonEmpty(observation.capability?.surface, 8) ||
      !nonEmpty(observation.capability?.receiptId, 8) ||
      observation.capability?.receiptId !== phaseChain?.prepare?.capabilityReceiptId ||
      observation.effects?.distinguishable !== true ||
      !exactEffects(observation.effects?.expected, execution.expectedEffects) ||
      EFFECT_NAMES.some((name) =>
        !nonEmpty(observation.effects?.sources?.[name], 8)) ||
      new Set(EFFECT_NAMES.map((name) => observation.effects.sources[name])).size !==
        EFFECT_NAMES.length ||
      !zeroEffects(observation.effects?.observed) ||
      observation.settlement?.complete !== true ||
      observation.settlement?.bounded !== true ||
      observation.settlement?.windowMs < plan.settlementWindowMs ||
      observation.scans?.resultMarker !== null ||
      observation.scans?.successorTranscript?.source !== 'product-owned' ||
      observation.scans?.successorTranscript?.marker !== null ||
      observation.scans?.successorTranscript?.matches !== 0 ||
      !nonEmpty(observation.scans?.successorTranscript?.receiptId, 8) ||
      observation.scans?.trustedSystemEvents?.source !== 'product-owned' ||
      observation.scans?.trustedSystemEvents?.marker !== null ||
      observation.scans?.trustedSystemEvents?.matches !== 0 ||
      !nonEmpty(observation.scans?.trustedSystemEvents?.receiptId, 8)
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
    !nonEmpty(observation.dispatch?.receiptId, 8) ||
    !nonEmpty(observation.dispatch?.heldResultId, 8) ||
    !nonEmpty(observation.dispatch?.capturedAuthorityGeneration, 16) ||
    !RESULT_MARKER.test(observation.dispatch?.resultMarker || '') ||
    !RESULT_MARKER.test(observation.resultMarker || '') ||
    observation.dispatch.resultMarker !== observation.resultMarker ||
    observation.dispatch.caseHandle !== phaseChain?.caseHandle ||
    observation.dispatch.prepareReceiptId !== phaseChain?.prepare?.receiptId ||
    phaseChain?.dispatch?.caseHandle !== phaseChain?.caseHandle ||
    phaseChain?.dispatch?.prepareReceiptId !== phaseChain?.prepare?.receiptId ||
    phaseChain?.dispatch?.accepted !== true ||
    phaseChain?.dispatch?.completionHeld !== true ||
    phaseChain?.dispatch?.receiptId !== observation.dispatch.receiptId ||
    phaseChain?.dispatch?.heldResultId !== observation.dispatch.heldResultId ||
    phaseChain?.dispatch?.capturedAuthorityGeneration !==
      observation.dispatch.capturedAuthorityGeneration ||
    phaseChain?.dispatch?.resultMarker !== observation.resultMarker
  ) {
    addError(errors, 'dispatch-not-held', 'accepted dispatch was not held');
  }
  const expectedTypedExecutions = execution.form === 'typed-tool' ? 1 : 0;
  const expectedBracketParses = execution.form === 'bracket-token' ? 1 : 0;
  if (
    observation.dispatch?.originEvidence?.source !== 'product-owned' ||
    observation.dispatch?.originEvidence?.observedForm !== execution.form ||
    !nonEmpty(observation.dispatch?.originEvidence?.receiptId, 8) ||
    observation.dispatch?.originEvidence?.typedToolExecutions !==
      expectedTypedExecutions ||
    observation.dispatch?.originEvidence?.bracketParses !==
      expectedBracketParses ||
    observation.dispatch?.originEvidence?.rawFinalText !==
      (execution.form === 'bracket-token') ||
    phaseChain?.dispatch?.originEvidence?.receiptId !==
      observation.dispatch.originEvidence.receiptId ||
    phaseChain?.dispatch?.originEvidence?.observedForm !== execution.form ||
    phaseChain?.dispatch?.originEvidence?.typedToolExecutions !==
      expectedTypedExecutions ||
    phaseChain?.dispatch?.originEvidence?.bracketParses !==
      expectedBracketParses ||
    canonicalJson(phaseChain?.dispatch?.originEvidence) !==
      canonicalJson(observation.dispatch.originEvidence)
  ) {
    addError(errors, 'origin-form-mismatch', 'product origin does not prove the requested form');
  }
  if (
    observation.lifecycle?.edge !== execution.lifecycleEdge ||
    observation.lifecycle?.occurredAfterAcceptance !== true ||
    observation.lifecycle?.completedBeforeRelease !== true ||
    !nonEmpty(observation.lifecycle?.postSessionId, 8) ||
    !nonEmpty(observation.lifecycle?.successorIdentity, 8) ||
    !nonEmpty(observation.lifecycle?.receiptId, 8) ||
    observation.lifecycle?.acceptedDispatchReceiptId !==
      observation.dispatch?.receiptId ||
    phaseChain?.transition?.caseHandle !== phaseChain?.caseHandle ||
    phaseChain?.transition?.lifecycleOccurred !== true ||
    phaseChain?.transition?.acceptedDispatchReceiptId !==
      observation.dispatch?.receiptId ||
    phaseChain?.transition?.capturedAuthorityGeneration !==
      observation.dispatch?.capturedAuthorityGeneration ||
    phaseChain?.transition?.receiptId !== observation.lifecycle?.receiptId
  ) {
    addError(errors, 'observation-shape', 'lifecycle ordering or successor is incomplete');
  }
  if (
    observation.authorityDiagnostic?.source !== 'product-owned' ||
    !nonEmpty(observation.authorityDiagnostic?.surface, 8) ||
    observation.authorityDiagnostic?.capturedAuthorityGeneration !==
      observation.dispatch?.capturedAuthorityGeneration ||
    !nonEmpty(observation.authorityDiagnostic?.currentAuthorityGeneration, 16)
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
    observation.delivery?.resultReleased !== true ||
    observation.delivery?.caseHandle !== phaseChain?.caseHandle ||
    observation.delivery?.transitionReceiptId !== phaseChain?.transition?.receiptId ||
    observation.delivery?.releaseReceiptId !== phaseChain?.release?.receiptId ||
    phaseChain?.release?.caseHandle !== phaseChain?.caseHandle ||
    phaseChain?.release?.released !== true ||
    phaseChain?.release?.acceptedDispatchReceiptId !==
      observation.dispatch?.receiptId ||
    phaseChain?.release?.transitionReceiptId !==
      phaseChain?.transition?.receiptId ||
    phaseChain?.release?.heldResultId !== observation.dispatch?.heldResultId ||
    phaseChain?.release?.resultMarker !== observation.resultMarker ||
    phaseChain?.release?.capturedAuthorityGeneration !==
      observation.dispatch?.capturedAuthorityGeneration ||
    !nonEmpty(phaseChain?.release?.receiptId, 8)
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
    !validTimestamp(observation.settlement?.releasedAt) ||
    !validTimestamp(observation.settlement?.scansCompletedAt) ||
    Date.parse(observation.settlement.releasedAt) <
      Date.parse(observation.startedAt) ||
    Date.parse(observation.settlement.scansCompletedAt) >
      Date.parse(observation.endedAt) ||
    Date.parse(observation.settlement.scansCompletedAt) -
      Date.parse(observation.settlement.releasedAt) <
        observation.settlement.windowMs ||
    observation.settlement?.elapsedMs !==
      Date.parse(observation.settlement.scansCompletedAt) -
        Date.parse(observation.settlement.releasedAt) ||
    observation.settlement.elapsedMs < observation.settlement.windowMs ||
    !Number.isFinite(observation.settlement?.monotonicElapsedMs) ||
    observation.settlement.monotonicElapsedMs < observation.settlement.windowMs ||
    !Number.isFinite(phaseChain?.harnessTiming?.releasedAtMs) ||
    !Number.isFinite(phaseChain?.harnessTiming?.observedAtMs) ||
    phaseChain.harnessTiming.observedAtMs -
      phaseChain.harnessTiming.releasedAtMs <
        observation.settlement.windowMs ||
    phaseChain.harnessTiming?.elapsedMs <
      observation.settlement.windowMs ||
    Math.abs(
      phaseChain.harnessTiming.elapsedMs -
        (
          phaseChain.harnessTiming.observedAtMs -
          phaseChain.harnessTiming.releasedAtMs
        ),
    ) > 0.001
  ) {
    addError(errors, 'settlement-too-short', 'settlement window did not actually elapse');
  }
  if (
    observation.scans?.resultMarker !== observation.resultMarker ||
    observation.scans?.successorTranscript?.source !== 'product-owned' ||
    observation.scans?.successorTranscript?.marker !== observation.resultMarker ||
    observation.scans?.successorTranscript?.matches !== 0 ||
    !nonEmpty(observation.scans?.successorTranscript?.receiptId, 8) ||
    observation.scans?.trustedSystemEvents?.source !== 'product-owned' ||
    observation.scans?.trustedSystemEvents?.marker !== observation.resultMarker ||
    observation.scans?.trustedSystemEvents?.matches !== 0 ||
    !nonEmpty(observation.scans?.trustedSystemEvents?.receiptId, 8)
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
      !nonEmpty(observation.lifecycle?.preSessionId, 8)
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
        !nonEmpty(observation.lifecycle?.restart?.receiptId, 8) ||
        observation.lifecycle.restart.receiptId !==
          phaseChain?.transition?.restartReceiptId ||
        !Array.isArray(gatewayLifecycle) ||
        gatewayLifecycle.length < 3 ||
        observation.lifecycle.restart.originalGatewayPid !==
          gatewayLifecycle[execution.form === 'typed-tool' ? 0 : 1]
            ?.namespacePid ||
        observation.lifecycle.restart.originalGatewayStartFingerprint !==
          gatewayLifecycle[execution.form === 'typed-tool' ? 0 : 1]
            ?.namespaceStartFingerprint ||
        !Number.isInteger(observation.lifecycle.restart.replacementGatewayPid) ||
        observation.lifecycle.restart.replacementGatewayPid ===
          observation.lifecycle.restart.originalGatewayPid ||
        observation.lifecycle.restart.replacementGatewayPid !==
          gatewayLifecycle[execution.form === 'typed-tool' ? 1 : 2]
            ?.namespacePid ||
        !HEX_64.test(
          observation.lifecycle.restart.replacementGatewayStartFingerprint || '',
        ) ||
        observation.lifecycle.restart.replacementGatewayStartFingerprint ===
          observation.lifecycle.restart.originalGatewayStartFingerprint ||
        observation.lifecycle.restart.replacementGatewayStartFingerprint !==
          gatewayLifecycle[execution.form === 'typed-tool' ? 1 : 2]
            ?.namespaceStartFingerprint ||
        observation.lifecycle.restart.gatewayCommandSha256 !==
          driverAttestation?.gatewayCommand?.sha256 ||
        observation.lifecycle.restart.runtimeConfigSha256 !==
          driverAttestation?.runtimeConfigSha256 ||
        observation.lifecycle.restart.processGroupId !==
          driverAttestation?.isolation?.processGroupId ||
        !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(
          observation.lifecycle.restart.replacementGatewayEndpoint || '',
        ) ||
        canonicalJson(phaseChain?.transition?.restart) !==
          canonicalJson(observation.lifecycle.restart) ||
        !gatewayLifecycle.some((entry) =>
          entry?.verified === true &&
          entry.namespacePid ===
            observation.lifecycle.restart.replacementGatewayPid &&
          entry.namespaceStartFingerprint ===
            observation.lifecycle.restart.replacementGatewayStartFingerprint &&
          Array.isArray(entry.endpoints) &&
          entry.endpoints.includes(
            observation.lifecycle.restart.replacementGatewayEndpoint,
          ) &&
          HEX_64.test(entry.socketFingerprint || '')) ||
        gatewayLifecycle[execution.form === 'typed-tool' ? 0 : 1]
          ?.exitedAtMonotonicMs >=
          gatewayLifecycle[execution.form === 'typed-tool' ? 1 : 2]
            ?.firstSeenMonotonicMs
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
      observation.caseId === 'forbidden-delete-recreate' &&
      (
        !nonEmpty(observation.lifecycle?.preSessionId, 8) ||
        observation.lifecycle.preSessionId === observation.lifecycle.postSessionId ||
        observation.lifecycle?.operations?.deletionObserved !== true ||
        observation.lifecycle?.operations?.recreationObserved !== true ||
        !nonEmpty(observation.lifecycle?.operations?.deletionReceiptId, 8) ||
        !nonEmpty(observation.lifecycle?.operations?.recreationReceiptId, 8) ||
        phaseChain?.transition?.operations?.deletionReceiptId !==
          observation.lifecycle.operations.deletionReceiptId ||
        phaseChain?.transition?.operations?.recreationReceiptId !==
          observation.lifecycle.operations.recreationReceiptId ||
        canonicalJson(phaseChain?.transition?.operations) !==
          canonicalJson(observation.lifecycle.operations)
      )
    ) {
      addError(errors, 'observation-shape', 'delete/recreate lifecycle is incomplete');
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

function requireUniqueValues(errors, label, values) {
  if (values.some((value) => !nonEmpty(value, 8))) {
    addError(errors, 'phase-chain-mismatch', `${label} contains an empty identifier`);
  }
  if (new Set(values).size !== values.length) {
    addError(errors, 'phase-chain-mismatch', `${label} contains a reused identifier`);
  }
}

function validatePhaseProof({
  phase,
  receipt,
  proof,
  driverAttestation,
}) {
  const errors = [];
  if (receipt === undefined || receipt === null || !isObject(proof)) {
    return {
      valid: false,
      errors: [{
        code: 'phase-proof-mismatch',
        message: `${phase} receipt or proof is missing`,
      }],
    };
  }
  const receiptSha256 = digest(receipt);
  const signatureBase = {
    phase,
    requestNonce: proof?.requestNonce,
    receiptSha256,
    attestationSha256: driverAttestation?.attestationSha256,
    launchNonceFingerprint: driverAttestation?.launchNonceFingerprint,
    processStartFingerprint: driverAttestation?.process?.startFingerprint,
    endpointSocketFingerprint:
      driverAttestation?.process?.endpointSocketFingerprint,
    runtimeConfigSha256: driverAttestation?.runtimeConfigSha256,
  };
  const expectedSignature = nonEmpty(driverAttestation?.phaseSigningKey, 32)
    ? createHmac('sha256', driverAttestation.phaseSigningKey)
      .update(canonicalJson(signatureBase))
      .digest('hex')
    : null;
  if (
    proof?.attestationSha256 !== signatureBase.attestationSha256 ||
    proof?.launchNonceFingerprint !== signatureBase.launchNonceFingerprint ||
    proof?.processStartFingerprint !== signatureBase.processStartFingerprint ||
    proof?.endpointSocketFingerprint !==
      signatureBase.endpointSocketFingerprint ||
    proof?.runtimeConfigSha256 !== signatureBase.runtimeConfigSha256 ||
    !HEX_64.test(proof?.requestNonce || '') ||
    proof?.receiptSha256 !== receiptSha256 ||
    proof?.signature !== expectedSignature
  ) {
    addError(errors, 'phase-proof-mismatch', `${phase} proof-of-possession is invalid`);
  }
  return { valid: errors.length === 0, errors };
}

export function deriveReturnCovenantCaseHandleClosure({
  plan,
  evidence,
  driverAttestation,
}) {
  const errors = [];
  const expected = expandReturnCovenantExecutions(plan);
  const phaseChains = Array.isArray(evidence?.phaseChains)
    ? evidence.phaseChains
    : [];
  const chainsByKey = new Map();
  for (const chain of phaseChains) {
    const key = returnCovenantExecutionKey(chain?.caseId, chain?.form);
    const entries = chainsByKey.get(key) || [];
    entries.push(chain);
    chainsByKey.set(key, entries);
  }
  const caseHandles = [];
  for (const execution of expected) {
    const key = returnCovenantExecutionKey(execution.caseId, execution.form);
    const entries = chainsByKey.get(key) || [];
    if (entries.length !== 1) {
      addError(
        errors,
        'phase-chain-mismatch',
        `${key} must have exactly one phase-chain ledger entry`,
      );
      if (entries[0]?.caseHandle) caseHandles.push(entries[0].caseHandle);
      chainsByKey.delete(key);
      continue;
    }
    const [chain] = entries;
    if (
      !nonEmpty(chain?.caseHandle, 8) ||
      chain?.prepare?.caseHandle !== chain.caseHandle ||
      chain?.cleanup?.caseHandle !== chain.caseHandle ||
      chain?.cleanup?.closed !== true ||
      !nonEmpty(chain?.cleanup?.receiptId, 8)
    ) {
      addError(
        errors,
        'phase-chain-mismatch',
        `${key} does not close its prepared case handle`,
      );
    }
    const cleanupProof = validatePhaseProof({
      phase: 'cleanup',
      receipt: chain?.cleanup,
      proof: chain?.proofs?.cleanup,
      driverAttestation,
    });
    errors.push(...cleanupProof.errors);
    if (nonEmpty(chain?.caseHandle, 8)) caseHandles.push(chain.caseHandle);
    chainsByKey.delete(key);
  }
  for (const key of chainsByKey.keys()) {
    addError(
      errors,
      'phase-chain-mismatch',
      `unexpected phase-chain ledger entry ${key}`,
    );
  }
  if (
    caseHandles.length !== expected.length ||
    new Set(caseHandles).size !== caseHandles.length
  ) {
    addError(
      errors,
      'phase-chain-mismatch',
      'case-handle ledger coverage is missing or duplicated',
    );
  }
  return {
    allCaseHandlesClosed: errors.length === 0,
    caseHandles,
    errors,
  };
}

export function validateReturnCovenantRetentionObservation({
  plan,
  evidence,
  driverAttestation,
  gatewayLifecycle,
}) {
  const errors = [];
  const observation = evidence?.retentionObservation;
  let parsedResponse = null;
  let matchedGateway = null;
  const retained = Object.fromEntries(
    OBSERVED_RETENTION_NAMES.map((name) => [name, null]),
  );
  if (
    !exactKeys(observation, [
      'schema',
      'status',
      'failureReason',
      'request',
      'target',
      'timing',
      'response',
    ]) ||
    observation?.schema !== RETURN_COVENANT_RETENTION_OBSERVATION_SCHEMA ||
    observation?.status !== 'observed' ||
    observation?.failureReason !== null
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'docs-owned resource observation is missing, unsupported, or incomplete',
    );
  }

  const requestNonce = observation?.request?.requestNonce;
  const expectedRequest = HEX_64.test(requestNonce || '')
    ? buildReturnCovenantRetentionRequest({
      plan,
      evidence,
      requestNonce,
    })
    : null;
  if (
    expectedRequest === null ||
    !exactKeys(observation?.request, Object.keys(expectedRequest || {})) ||
    canonicalJson(observation?.request) !== canonicalJson(expectedRequest)
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource observation request is not bound to the run and exact case/form ledger',
    );
  }

  const timing = observation?.timing;
  const latestCaseObservationAt = Math.max(
    ...((evidence?.observations || []).map((entry) =>
      validTimestamp(entry?.endedAt) ? Date.parse(entry.endedAt) : Number.NaN)),
  );
  if (
    !exactKeys(timing, [
      'requestedAt',
      'observedAt',
      'requestedAtMonotonicMs',
      'observedAtMonotonicMs',
    ]) ||
    !validTimestamp(timing?.requestedAt) ||
    !validTimestamp(timing?.observedAt) ||
    !Number.isFinite(latestCaseObservationAt) ||
    Date.parse(timing.requestedAt) < latestCaseObservationAt ||
    Date.parse(timing.observedAt) < Date.parse(timing.requestedAt) ||
    Date.parse(timing.observedAt) - Date.parse(timing.requestedAt) > 5_000 ||
    !Number.isFinite(timing?.requestedAtMonotonicMs) ||
    !Number.isFinite(timing?.observedAtMonotonicMs) ||
    timing.observedAtMonotonicMs < timing.requestedAtMonotonicMs ||
    timing.observedAtMonotonicMs - timing.requestedAtMonotonicMs > 5_000 ||
    !validTimestamp(evidence?.endedAt) ||
    Date.parse(evidence.endedAt) < Date.parse(timing?.observedAt || '')
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource observation timing is stale or outside the settled evidence window',
    );
  }

  const target = observation?.target;
  const lifecycle = Array.isArray(gatewayLifecycle) ? gatewayLifecycle : [];
  const finalGateway = lifecycle.at(-1);
  if (
    !exactKeys(target, [
      'source',
      'endpoint',
      'namespacePid',
      'namespaceStartFingerprint',
    ]) ||
    ![
      'trusted-launcher-attested-gateway',
      'phase-chain-final-gateway',
    ].includes(target?.source) ||
    !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(target?.endpoint || '') ||
    !Number.isInteger(target?.namespacePid) ||
    !HEX_64.test(target?.namespaceStartFingerprint || '') ||
    finalGateway?.verified !== true ||
    finalGateway?.namespacePid !== target?.namespacePid ||
    finalGateway?.namespaceStartFingerprint !==
      target?.namespaceStartFingerprint ||
    !finalGateway?.endpoints?.includes(target?.endpoint) ||
    !HEX_64.test(finalGateway?.socketFingerprint || '')
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource observation gateway identity does not match the final /proc lifecycle',
    );
  } else {
    matchedGateway = finalGateway;
  }

  const response = observation?.response;
  if (
    !exactKeys(response, [
      'status',
      'contentType',
      'body',
      'bodySha256',
      'byteLength',
    ]) ||
    response?.status !== 200 ||
    !/^application\/json(?:;|$)/iu.test(response?.contentType || '') ||
    typeof response?.body !== 'string' ||
    response.body.length === 0 ||
    Buffer.byteLength(response.body) !== response?.byteLength ||
    response.byteLength > 1_048_576 ||
    createHash('sha256').update(response.body).digest('hex') !==
      response?.bodySha256
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource inspection transport or raw-response binding is invalid',
    );
  } else {
    try {
      parsedResponse = JSON.parse(response.body);
    } catch {
      addError(
        errors,
        'unverified-resource-retention',
        'resource inspection response is malformed JSON',
      );
    }
  }

  if (
    !exactKeys(parsedResponse, [
      'schema',
      'rowId',
      'runId',
      'candidateSha',
      'runtimeBuildSha',
      'runtimeConfigSha256',
      'requestNonce',
      'observedAt',
      'gateway',
      'resources',
    ]) ||
    parsedResponse?.schema !== RETURN_COVENANT_RETENTION_RESPONSE_SCHEMA ||
    parsedResponse?.rowId !== plan.rowId ||
    parsedResponse?.runId !== plan.runId ||
    parsedResponse?.candidateSha !== plan.target.candidateSha ||
    parsedResponse?.runtimeBuildSha !== plan.target.runtimeBuildSha ||
    parsedResponse?.runtimeConfigSha256 !== plan.target.runtimeConfigSha256 ||
    parsedResponse?.requestNonce !== requestNonce ||
    !validTimestamp(parsedResponse?.observedAt) ||
    Date.parse(parsedResponse?.observedAt || '') <
      Date.parse(timing?.requestedAt || '') ||
    Date.parse(parsedResponse?.observedAt || '') >
      Date.parse(timing?.observedAt || '') ||
    !exactKeys(parsedResponse?.gateway, [
      'endpoint',
      'namespacePid',
      'namespaceStartFingerprint',
    ]) ||
    parsedResponse?.gateway?.endpoint !== target?.endpoint ||
    parsedResponse?.gateway?.namespacePid !== target?.namespacePid ||
    parsedResponse?.gateway?.namespaceStartFingerprint !==
      target?.namespaceStartFingerprint ||
    !exactKeys(
      parsedResponse?.resources,
      RETURN_COVENANT_RETENTION_RESOURCES.map((entry) => entry.category),
    )
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource inspection response identity is stale, mismatched, or partial',
    );
  }

  const itemIds = [];
  for (const { category, method } of RETURN_COVENANT_RETENTION_RESOURCES) {
    const resource = parsedResponse?.resources?.[category];
    const items = Array.isArray(resource?.items) ? resource.items : [];
    if (
      !exactKeys(resource, [
        'method',
        'complete',
        'total',
        'nextCursor',
        'items',
      ]) ||
      resource?.method !== method ||
      resource?.complete !== true ||
      resource?.nextCursor !== null ||
      !Number.isInteger(resource?.total) ||
      resource.total !== items.length ||
      items.length >= RETURN_COVENANT_RETENTION_QUERY_LIMIT ||
      items.some((item) =>
        !exactKeys(item, ['id', 'runId', 'status']) ||
        !nonEmpty(item?.id, 8) ||
        item?.runId !== plan.runId ||
        !nonEmpty(item?.status, 1))
    ) {
      addError(
        errors,
        'unverified-resource-retention',
        `${category} inspection is malformed, partial, or count-overflowed`,
      );
    }
    itemIds.push(...items.map((item) => item?.id));
    retained[category] = items.length;
  }
  if (
    itemIds.some((value) => !nonEmpty(value, 8)) ||
    new Set(itemIds).size !== itemIds.length
  ) {
    addError(
      errors,
      'unverified-resource-retention',
      'resource inspection returned missing or duplicated resource identities',
    );
  }
  if (errors.length > 0) {
    for (const name of OBSERVED_RETENTION_NAMES) retained[name] = null;
  }
  return {
    valid: errors.length === 0,
    errors,
    retained,
    matchedGateway,
  };
}

export function deriveReturnCovenantTrustedRetention(params) {
  const validation = validateReturnCovenantRetentionObservation(params);
  const observation = params.evidence?.retentionObservation;
  return {
    ...validation,
    resourceObservation: {
      status: validation.valid
        ? 'verified'
        : 'unverified-resource-retention',
      evidenceSha256: digest(observation ?? null),
      responseSha256: HEX_64.test(observation?.response?.bodySha256 || '')
        ? observation.response.bodySha256
        : null,
      observedAt: validTimestamp(observation?.timing?.observedAt)
        ? observation.timing.observedAt
        : null,
      gatewayPid: validation.matchedGateway?.pid ?? null,
      gatewayStartFingerprint:
        validation.matchedGateway?.startFingerprint ?? null,
      gatewaySocketFingerprint:
        validation.matchedGateway?.socketFingerprint ?? null,
      gatewayEndpoint:
        validation.matchedGateway?.endpoints?.includes(
          observation?.target?.endpoint,
        )
          ? observation.target.endpoint
          : null,
    },
  };
}

function phaseProofsForExecution(observation, phaseChain) {
  const notExposed = observation?.applicability === 'not-exposed';
  return [
    {
      phase: 'prepare',
      receipt: {
        prepare: phaseChain?.prepare,
        observation: notExposed ? observation : null,
      },
      proof: phaseChain?.proofs?.prepare,
    },
    ...(!notExposed
      ? [
        {
          phase: 'dispatch',
          receipt: phaseChain?.dispatch,
          proof: phaseChain?.proofs?.dispatch,
        },
        {
          phase: 'transition',
          receipt: phaseChain?.transition,
          proof: phaseChain?.proofs?.transition,
        },
        {
          phase: 'release',
          receipt: phaseChain?.release,
          proof: phaseChain?.proofs?.release,
        },
        {
          phase: 'observe',
          receipt: { settled: true, observation },
          proof: phaseChain?.proofs?.observe,
        },
      ]
      : []),
    {
      phase: 'cleanup',
      receipt: phaseChain?.cleanup,
      proof: phaseChain?.proofs?.cleanup,
    },
  ];
}

export function validateReturnCovenantObservationSet({
  plan,
  evidence,
  driverAttestation,
  gatewayLifecycle,
}) {
  const errors = [];
  const validations = [];
  const expected = expandReturnCovenantExecutions(plan);
  const observations = Array.isArray(evidence?.observations) ? evidence.observations : [];
  const phaseChains = Array.isArray(evidence?.phaseChains) ? evidence.phaseChains : [];
  if (
    evidence?.schema !== 'openclaw.k6.return-covenant-observation-set.v1' ||
    evidence?.rowId !== plan.rowId ||
    evidence?.runId !== plan.runId ||
    !validTimestamp(evidence?.startedAt) ||
    !validTimestamp(evidence?.endedAt) ||
    Date.parse(evidence?.endedAt) < Date.parse(evidence?.startedAt)
  ) {
    addError(errors, 'observation-shape', 'evidence envelope identity is incomplete');
  }
  if (
    evidence?.scenarioFailures !== 0 ||
    !Array.isArray(evidence?.executionErrors) ||
    evidence.executionErrors.length !== 0
  ) {
    addError(errors, 'scenario-failure', 'scenario or per-case cleanup reported a failure');
  }
  if (
    evidence?.k6ExitCode !== 0 ||
    evidence?.runtimeConfigSha256 !== plan.target.runtimeConfigSha256 ||
    evidence?.cleanupRun?.completed !== true ||
    !nonEmpty(evidence?.cleanupRun?.receiptId, 8) ||
    evidence?.cleanupRun?.observationSetSha256 !== digest(observations) ||
    evidence?.cleanupRun?.phaseChainSha256 !== digest(phaseChains) ||
    evidence?.cleanupRun?.driverAttestationSha256 !==
      driverAttestation?.attestationSha256 ||
    evidence?.cleanupRun?.runtimeConfigSha256 !== plan.target.runtimeConfigSha256
    ||
    evidence?.teardown?.schema !== 'openclaw.k6.return-covenant-teardown.v1' ||
    evidence?.teardown?.runId !== plan.runId ||
    evidence?.teardown?.rowId !== plan.rowId ||
    evidence?.teardown?.completed !== true ||
    evidence?.teardown?.cleanupRunReceiptId !== evidence?.cleanupRun?.receiptId
    ||
    canonicalJson(evidence?.teardown?.cleanupRun) !==
      canonicalJson(evidence?.cleanupRun)
  ) {
    addError(errors, 'scenario-failure', 'k6 or run cleanup receipt is incomplete');
  }
  const attestationErrors = validateReturnCovenantDriverAttestation({
    plan,
    attestation: driverAttestation,
    endpoint: driverAttestation?.endpoint,
  });
  if (isObject(driverAttestation)) {
    const {
      attestationSha256,
      ...unsignedAttestation
    } = driverAttestation;
    if (attestationSha256 !== digest(unsignedAttestation)) {
      attestationErrors.push('driver attestation digest is invalid');
    }
    if (
      createHash('sha256')
        .update(String(driverAttestation.phaseChallenge || ''))
        .digest('hex') !== driverAttestation.launchNonceFingerprint
    ) {
      attestationErrors.push('driver launch challenge fingerprint is invalid');
    }
    if (
      createHash('sha256')
        .update(String(driverAttestation.phaseSigningKey || ''))
        .digest('hex') !== driverAttestation.phaseKeyFingerprint
    ) {
      attestationErrors.push('driver phase signing key fingerprint is invalid');
    }
  }
  if (
    attestationErrors.length > 0 ||
    evidence?.driverAttestationSha256 !== driverAttestation?.attestationSha256
  ) {
    addError(errors, 'driver-attestation-mismatch', 'driver attestation is missing or mismatched');
  }

  const observationsByKey = new Map();
  for (const observation of Array.isArray(observations) ? observations : []) {
    const key = returnCovenantExecutionKey(observation?.caseId, observation?.form);
    const entries = observationsByKey.get(key) || [];
    entries.push(observation);
    observationsByKey.set(key, entries);
  }
  const chainsByKey = new Map();
  for (const chain of phaseChains) {
    const key = returnCovenantExecutionKey(chain?.caseId, chain?.form);
    const entries = chainsByKey.get(key) || [];
    entries.push(chain);
    chainsByKey.set(key, entries);
  }
  for (const execution of expected) {
    const key = returnCovenantExecutionKey(execution.caseId, execution.form);
    const entries = observationsByKey.get(key) || [];
    const chains = chainsByKey.get(key) || [];
    if (entries.length === 0 || chains.length === 0) {
      const error = { code: 'observation-missing', message: `missing ${key}` };
      errors.push(error);
      validations.push({
        execution,
        observation: entries[0] || null,
        phaseChain: chains[0] || null,
        valid: false,
        errors: [error],
      });
      continue;
    }
    if (entries.length > 1 || chains.length > 1) {
      const error = { code: 'observation-duplicate', message: `duplicated ${key}` };
      errors.push(error);
      validations.push({
        execution,
        observation: entries[0],
        phaseChain: chains[0],
        driverAttestation,
        gatewayLifecycle,
        valid: false,
        errors: [error],
      });
      continue;
    }
    const validation = validateReturnCovenantObservation({
      observation: entries[0],
      plan,
      execution,
      phaseChain: chains[0],
      driverAttestation,
      gatewayLifecycle,
    });
    const phaseProofs = phaseProofsForExecution(entries[0], chains[0]);
    const phaseProofErrors = phaseProofs.flatMap((entry) =>
      validatePhaseProof({ ...entry, driverAttestation }).errors);
    validation.errors.push(...phaseProofErrors);
    validation.valid = validation.errors.length === 0;
    validations.push({
      execution,
      observation: entries[0],
      phaseChain: chains[0],
      phaseProofsValid: phaseProofErrors.length === 0,
      ...validation,
    });
    errors.push(...validation.errors);
    observationsByKey.delete(key);
    chainsByKey.delete(key);
  }
  for (const entry of [
    {
      phase: 'cleanup-run',
      receipt: evidence?.cleanupRun,
      proof: evidence?.cleanupRunProof,
    },
    {
      phase: 'cleanup-run',
      receipt: evidence?.teardown?.cleanupRun,
      proof: evidence?.teardown?.cleanupRunProof,
    },
  ]) {
    errors.push(...validatePhaseProof({ ...entry, driverAttestation }).errors);
  }
  for (const key of new Set([...observationsByKey.keys(), ...chainsByKey.keys()])) {
    errors.push({ code: 'observation-unexpected', message: `unexpected ${key}` });
  }
  requireUniqueValues(errors, 'case handles', phaseChains.map((chain) => chain?.caseHandle));
  requireUniqueValues(
    errors,
    'prepare receipts',
    phaseChains.map((chain) => chain?.prepare?.receiptId),
  );
  requireUniqueValues(
    errors,
    'cleanup receipts',
    phaseChains.map((chain) => chain?.cleanup?.receiptId),
  );
  const executed = validations.filter((entry) =>
    entry.observation?.applicability !== 'not-exposed');
  for (const [label, values] of [
    ['dispatch receipts', executed.map((entry) => entry.phaseChain?.dispatch?.receiptId)],
    ['held results', executed.map((entry) => entry.phaseChain?.dispatch?.heldResultId)],
    ['transition receipts', executed.map((entry) => entry.phaseChain?.transition?.receiptId)],
    ['release receipts', executed.map((entry) => entry.phaseChain?.release?.receiptId)],
    ['queue records', executed.map((entry) => entry.observation?.delivery?.queue?.recordId)],
    ['result markers', executed.map((entry) => entry.observation?.resultMarker)],
    [
      'captured authority generations',
      executed.map((entry) => entry.observation?.dispatch?.capturedAuthorityGeneration),
    ],
    [
      'successor transcript scans',
      validations.map((entry) =>
        entry.observation?.scans?.successorTranscript?.receiptId),
    ],
    [
      'origin receipts',
      executed.map((entry) =>
        entry.observation?.dispatch?.originEvidence?.receiptId),
    ],
    [
      'trusted system-event scans',
      validations.map((entry) =>
        entry.observation?.scans?.trustedSystemEvents?.receiptId),
    ],
  ]) {
    requireUniqueValues(errors, label, values);
  }
  const revocationValidations = validations.filter((entry) =>
    entry.execution.caseId === 'forbidden-explicit-revocation');
  const revocationApplicabilities = new Set(revocationValidations.map((entry) =>
    entry.observation?.applicability || 'executed'));
  const expectedRevocationApplicability =
    driverAttestation?.revocationCapability?.revocationApiExposed === true
      ? 'executed'
      : 'not-exposed';
  if (
    revocationValidations.length !== 2 ||
    revocationApplicabilities.size !== 1 ||
    !revocationApplicabilities.has(expectedRevocationApplicability)
  ) {
    addError(
      errors,
      'revocation-capability-mismatch',
      'revocation applicability differs between forms or from run capability',
    );
  }
  if (expectedRevocationApplicability === 'not-exposed') {
    const capabilityReceiptIds = new Set(revocationValidations.map((entry) =>
      entry.observation?.capability?.receiptId));
    const capabilitySurfaces = new Set(revocationValidations.map((entry) =>
      entry.observation?.capability?.surface));
    if (
      capabilityReceiptIds.size !== 1 ||
      !capabilityReceiptIds.has(driverAttestation?.revocationCapability?.receiptId) ||
      capabilitySurfaces.size !== 1 ||
      !capabilitySurfaces.has(driverAttestation?.revocationCapability?.surface)
    ) {
      addError(
        errors,
        'revocation-capability-mismatch',
        'revocation N/A observations do not share the run capability receipt',
      );
    }
  }
  const allCanonicalIdentities = [
    ...phaseChains.flatMap((chain) => [
      chain?.prepare?.receiptId,
      chain?.dispatch?.receiptId,
      chain?.transition?.receiptId,
      chain?.release?.receiptId,
      chain?.cleanup?.receiptId,
    ]),
    ...executed.flatMap((entry) => [
      entry.observation?.dispatch?.heldResultId,
      entry.observation?.dispatch?.capturedAuthorityGeneration,
      ...(entry.execution.kind === 'forbidden'
        ? [entry.observation?.authorityDiagnostic?.currentAuthorityGeneration]
        : []),
      ...(entry.observation?.lifecycle?.restart?.receiptId
        ? [
          entry.observation.lifecycle.restart.receiptId,
          entry.observation.lifecycle.restart.replacementGatewayStartFingerprint,
          `gateway-pid:${entry.observation.lifecycle.restart.replacementGatewayPid}`,
        ]
        : []),
      ...(entry.observation?.lifecycle?.operations
        ? [
          entry.observation.lifecycle.operations.deletionReceiptId,
          entry.observation.lifecycle.operations.recreationReceiptId,
        ]
        : []),
      entry.observation?.dispatch?.originEvidence?.receiptId,
      entry.observation?.delivery?.queue?.recordId,
      entry.observation?.resultMarker,
    ]),
    ...validations.flatMap((entry) => [
      entry.observation?.scans?.successorTranscript?.receiptId,
      entry.observation?.scans?.trustedSystemEvents?.receiptId,
    ]),
    ...(expectedRevocationApplicability === 'not-exposed'
      ? [driverAttestation?.revocationCapability?.receiptId]
      : []),
  ].filter((value) => value !== undefined && value !== null);
  requireUniqueValues(errors, 'global canonical identities', allCanonicalIdentities);
  const requestNonces = [
    ...phaseChains.flatMap((chain) =>
      Object.values(chain?.proofs || {}).map((proof) => proof?.requestNonce)),
    evidence?.cleanupRunProof?.requestNonce,
    evidence?.teardown?.cleanupRunProof?.requestNonce,
  ];
  requireUniqueValues(errors, 'phase request nonces', requestNonces);
  return {
    valid: errors.length === 0,
    errors,
    validations,
    expectedCount: expected.length,
    observedCount: observations.length,
    phaseChainCount: phaseChains.length,
  };
}

export function validateReturnCovenantCleanup({
  cleanup,
  plan,
  evidence,
  driverAttestation,
  directCleanup,
  observerSigningKey,
}) {
  const errors = [];
  const closure = deriveReturnCovenantCaseHandleClosure({
    plan,
    evidence,
    driverAttestation,
  });
  const retention = deriveReturnCovenantTrustedRetention({
    plan,
    evidence,
    driverAttestation,
    gatewayLifecycle: cleanup?.gatewayLifecycle,
  });
  errors.push(...closure.errors);
  errors.push(...retention.errors);
  if (
    !exactKeys(cleanup, [
      'schema',
      'rowId',
      'runId',
      'candidateSha',
      'runtimeBuildSha',
      'docsHarnessSha',
      'runtimeConfigSha256',
      'startedAt',
      'endedAt',
      'retained',
      'retentionAuthority',
      'resourceObservation',
      'homeRemoved',
      'stateRemoved',
      'configRemoved',
      'fixtureProcessStopped',
      'gatewayProcessStopped',
      'allCaseHandlesClosed',
      'caseHandles',
      'observationSetSha256',
      'phaseChainSha256',
      'driverAttestationSha256',
      'runCleanupReceiptId',
      'snapshotMatchedCandidateAfterRun',
      'runRootRemoved',
      'driverExitCode',
      'processGroupEmpty',
      'unexpectedProcessGroupMembers',
      'gatewayLifecycle',
      'k6',
      'isolationFingerprint',
      'launcherIntegrity',
    ]) ||
    cleanup?.schema !== RETURN_COVENANT_CLEANUP_SCHEMA ||
    cleanup?.rowId !== RETURN_COVENANT_ROW_ID ||
    cleanup?.runId !== plan.runId ||
    cleanup?.candidateSha !== plan.target.candidateSha ||
    cleanup?.runtimeBuildSha !== plan.target.runtimeBuildSha ||
    cleanup?.docsHarnessSha !== plan.target.docsHarnessSha ||
    cleanup?.runtimeConfigSha256 !== plan.target.runtimeConfigSha256
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
  if (
    !validTimestamp(evidence?.endedAt) ||
    Date.parse(cleanup?.startedAt) < Date.parse(evidence.endedAt) ||
    cleanup?.observationSetSha256 !== digest(evidence?.observations) ||
    cleanup?.phaseChainSha256 !== digest(evidence?.phaseChains) ||
    cleanup?.driverAttestationSha256 !== driverAttestation?.attestationSha256 ||
    !Array.isArray(cleanup?.caseHandles) ||
    JSON.stringify([...cleanup.caseHandles].sort()) !==
      JSON.stringify([...closure.caseHandles].sort()) ||
    cleanup?.allCaseHandlesClosed !== closure.allCaseHandlesClosed ||
    cleanup?.runCleanupReceiptId !== evidence?.cleanupRun?.receiptId
  ) {
    addError(errors, 'cleanup-failure', 'cleanup is not bound to the completed evidence set');
  }
  if (
    !exactKeys(cleanup?.retained, RETAINED_NAMES) ||
    !exactKeys(cleanup?.retentionAuthority, Object.keys(RETENTION_AUTHORITY)) ||
    canonicalJson(cleanup?.retentionAuthority) !==
      canonicalJson(RETENTION_AUTHORITY) ||
    !exactKeys(cleanup?.resourceObservation, [
      'status',
      'evidenceSha256',
      'responseSha256',
      'observedAt',
      'gatewayPid',
      'gatewayStartFingerprint',
      'gatewaySocketFingerprint',
      'gatewayEndpoint',
    ]) ||
    canonicalJson(cleanup?.resourceObservation) !==
      canonicalJson(retention.resourceObservation)
  ) {
    addError(
      errors,
      'cleanup-failure',
      'trusted retention authority or observation binding is incomplete',
    );
  }
  for (const name of OBSERVED_RETENTION_NAMES) {
    if (cleanup?.retained?.[name] !== retention.retained[name]) {
      addError(
        errors,
        'cleanup-failure',
        `${name} count differs from the docs-owned gateway observation`,
      );
    }
  }
  const retainedGateways = Array.isArray(cleanup?.gatewayLifecycle)
    ? cleanup.gatewayLifecycle.filter((entry) =>
      entry?.retainedAtCleanup === true).length
    : null;
  if (
    cleanup?.retained?.gateways !== retainedGateways ||
    !Number.isInteger(cleanup?.retained?.fixtureProcesses) ||
    cleanup.retained.fixtureProcesses < 0
  ) {
    addError(
      errors,
      'cleanup-failure',
      'process retention counts differ from trusted launcher observations',
    );
  }
  for (const name of RETAINED_NAMES) {
    if (Number.isInteger(cleanup?.retained?.[name]) && cleanup.retained[name] > 0) {
      addError(errors, 'resource-retention', `cleanup retained ${name}`);
    }
  }
  for (const name of ['homeRemoved', 'stateRemoved', 'configRemoved']) {
    if (cleanup?.[name] !== true) {
      addError(errors, 'cleanup-failure', `${name} is not proven`);
    }
  }
  if (
    cleanup?.fixtureProcessStopped !==
      (cleanup?.retained?.fixtureProcesses === 0) ||
    cleanup?.gatewayProcessStopped !== (cleanup?.retained?.gateways === 0) ||
    cleanup?.allCaseHandlesClosed !== true
  ) {
    addError(errors, 'cleanup-failure', 'process or case-handle closure is incomplete');
  }
  const {
    launcherIntegrity,
    ...unsignedCleanup
  } = isObject(cleanup) ? cleanup : {};
  const gatewayListenerFingerprints = Array.isArray(cleanup?.gatewayLifecycle)
    ? cleanup.gatewayLifecycle.flatMap((entry) =>
      Array.isArray(entry?.listenerFingerprints)
        ? entry.listenerFingerprints
        : [])
    : [];
  const gatewayEndpoints = Array.isArray(cleanup?.gatewayLifecycle)
    ? cleanup.gatewayLifecycle.flatMap((entry) =>
      Array.isArray(entry?.endpoints) ? entry.endpoints : [])
    : [];
  const expectedCleanupSignature = nonEmpty(observerSigningKey, 32)
    ? createHmac('sha256', observerSigningKey)
      .update(canonicalJson(unsignedCleanup))
      .digest('hex')
    : null;
  if (
    launcherIntegrity?.algorithm !== 'hmac-sha256-launch-key-v1' ||
    launcherIntegrity?.signature !== expectedCleanupSignature ||
    cleanup?.snapshotMatchedCandidateAfterRun !== true ||
    cleanup?.runRootRemoved !== true ||
    cleanup?.driverExitCode !== 0 ||
    cleanup?.processGroupEmpty !== true ||
    cleanup?.unexpectedProcessGroupMembers !== 0 ||
    !/^k6 v2\.0\.0\b/u.test(cleanup?.k6?.version || '') ||
    !HEX_64.test(cleanup?.k6?.sha256 || '') ||
    !HEX_64.test(cleanup?.k6?.pathFingerprint || '') ||
    !Array.isArray(cleanup?.gatewayLifecycle) ||
    cleanup.gatewayLifecycle.length < 3 ||
    cleanup.gatewayLifecycle.some((entry) =>
      !Number.isInteger(entry?.pid) ||
      !HEX_64.test(entry?.startFingerprint || '') ||
      !Number.isInteger(entry?.namespacePid) ||
      !HEX_64.test(entry?.namespaceStartFingerprint || '') ||
      !Array.isArray(entry?.endpoints) ||
      entry.endpoints.length < 1 ||
      entry.endpoints.some((endpoint) =>
        !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(endpoint)) ||
      !HEX_64.test(entry?.socketFingerprint || '') ||
      !Array.isArray(entry?.listenerFingerprints) ||
      entry.listenerFingerprints.length < 1 ||
      entry.listenerFingerprints.some((value) => !HEX_64.test(value || '')) ||
      !['direct-environ', 'namespace-inherited']
        .includes(entry?.verificationSource) ||
      !Number.isFinite(entry?.firstSeenMonotonicMs) ||
      !Number.isFinite(entry?.lastSeenMonotonicMs) ||
      !Number.isFinite(entry?.exitedAtMonotonicMs) ||
      entry.firstSeenMonotonicMs > entry.lastSeenMonotonicMs ||
      entry.lastSeenMonotonicMs > entry.exitedAtMonotonicMs ||
      entry?.retainedAtCleanup !== false ||
      entry?.verified !== true) ||
    new Set(gatewayListenerFingerprints).size !==
      gatewayListenerFingerprints.length ||
    new Set(gatewayEndpoints).size !== gatewayEndpoints.length ||
    gatewayListenerFingerprints.some((value) =>
      driverAttestation?.process?.listenerFingerprints?.includes(value)) ||
    cleanup.gatewayLifecycle.some((entry, index, entries) =>
      index > 0 &&
      (
        entries[index - 1].exitedAtMonotonicMs >=
          entry.firstSeenMonotonicMs ||
        entries[index - 1].pid === entry.pid
      )) ||
    cleanup.gatewayLifecycle[0]?.pid !==
      driverAttestation?.isolation?.gatewayPid ||
    cleanup.gatewayLifecycle[0]?.startFingerprint !==
      driverAttestation?.gateway?.startFingerprint ||
    cleanup?.isolationFingerprint !==
      driverAttestation?.isolation?.runRootFingerprint ||
    directCleanup?.schema !==
      'openclaw.k6.return-covenant-direct-cleanup.v1' ||
    directCleanup?.verified !== true ||
    directCleanup?.runRootRemoved !== true ||
    directCleanup?.homeRemoved !== true ||
    directCleanup?.stateRemoved !== true ||
    directCleanup?.configRemoved !== true ||
    directCleanup?.snapshotRemoved !== true ||
    directCleanup?.driverStopped !== true ||
    directCleanup?.gatewayStopped !== true ||
    directCleanup?.sandboxStopped !== true ||
    directCleanup?.processGroupEmpty !== true ||
    directCleanup?.isolationFingerprint !==
      driverAttestation?.isolation?.runRootFingerprint
  ) {
    addError(errors, 'cleanup-failure', 'direct launcher cleanup verification failed');
  }
  return { valid: errors.length === 0, errors };
}

export function parseReturnCovenantEvidenceLog(log) {
  const lines = String(log).split(/\r?\n/u);
  const records = lines.flatMap((line) => {
      const offset = line.indexOf(RETURN_COVENANT_EVIDENCE_PREFIX);
      if (offset < 0) return [];
      return [JSON.parse(line.slice(offset + RETURN_COVENANT_EVIDENCE_PREFIX.length))];
    });
  const teardowns = lines.flatMap((line) => {
    const offset = line.indexOf(RETURN_COVENANT_TEARDOWN_PREFIX);
    if (offset < 0) return [];
    return [JSON.parse(line.slice(offset + RETURN_COVENANT_TEARDOWN_PREFIX.length))];
  });
  if (records.length !== 1) {
    throw new Error(
      `expected exactly one return-covenant evidence record, observed ${records.length}`,
    );
  }
  if (
    records[0]?.schema !== 'openclaw.k6.return-covenant-observation-set.v1' ||
    !Array.isArray(records[0]?.observations) ||
    !Array.isArray(records[0]?.phaseChains) ||
    !Array.isArray(records[0]?.executionErrors) ||
    !Number.isInteger(records[0]?.scenarioFailures)
  ) {
    throw new Error('return-covenant evidence record has an invalid shape');
  }
  if (teardowns.length !== 1) {
    throw new Error(
      `expected exactly one return-covenant teardown record, observed ${teardowns.length}`,
    );
  }
  return { ...records[0], teardown: teardowns[0] };
}

function canonicalReceipt(receipt) {
  const { integrity: _integrity, ...unsigned } = receipt;
  return canonicalJson(unsigned);
}

function privateForbiddenValues(plan, evidence, driverAttestation) {
  const observations = evidence?.observations || [];
  const values = [plan.runId, plan.syntheticChannelKey];
  for (const entry of plan.cases) values.push(entry.logicalSessionKey);
  for (const observation of observations) {
    values.push(
      observation?.logicalSessionKey,
      observation?.dispatch?.receiptId,
      observation?.dispatch?.heldResultId,
      observation?.dispatch?.capturedAuthorityGeneration,
      observation?.dispatch?.originEvidence?.receiptId,
      observation?.authorityDiagnostic?.currentAuthorityGeneration,
      observation?.lifecycle?.preSessionId,
      observation?.lifecycle?.postSessionId,
      observation?.lifecycle?.successorIdentity,
      observation?.delivery?.queue?.recordId,
      observation?.resultMarker,
      observation?.scans?.successorTranscript?.receiptId,
      observation?.scans?.trustedSystemEvents?.receiptId,
      observation?.capability?.receiptId,
    );
  }
  for (const chain of evidence?.phaseChains || []) {
    values.push(
      chain?.caseHandle,
      chain?.prepare?.receiptId,
      chain?.dispatch?.receiptId,
      chain?.dispatch?.heldResultId,
      chain?.transition?.receiptId,
      chain?.release?.receiptId,
      chain?.cleanup?.receiptId,
    );
  }
  values.push(driverAttestation?.phaseChallenge);
  values.push(
    driverAttestation?.phaseSigningKey,
    driverAttestation?.isolation?.runRoot,
    driverAttestation?.isolation?.homePath,
    driverAttestation?.isolation?.statePath,
    driverAttestation?.isolation?.configPath,
    driverAttestation?.isolation?.snapshotPath,
  );
  return [...new Set(values.filter((value) =>
    typeof value === 'string' && value.length >= 8))];
}

export function resolveReturnCovenantAuthoritativeReceipt({
  plan,
  evidence,
  cleanup,
  runtimeConfig,
  driverAttestation,
  directCleanup,
  signingKey,
}) {
  if (
    !nonEmpty(signingKey, 32) ||
    createHash('sha256').update(signingKey).digest('hex') !==
      driverAttestation?.launcher?.observerKeyFingerprint
  ) {
    throw new Error('observer signing key must be the attested proof launch key');
  }
  const planErrors = validateReturnCovenantPlan(plan)
    .map((message) => ({ code: 'plan-invalid', message }));
  const observationSet = planErrors.length === 0
    ? validateReturnCovenantObservationSet({
      plan,
      evidence,
      driverAttestation,
      gatewayLifecycle: cleanup?.gatewayLifecycle,
    })
    : {
      valid: false,
      errors: planErrors,
      validations: [],
      expectedCount: RETURN_COVENANT_CASES.length * 2,
      observedCount: Array.isArray(evidence?.observations)
        ? evidence.observations.length
        : 0,
      phaseChainCount: Array.isArray(evidence?.phaseChains)
        ? evidence.phaseChains.length
        : 0,
    };
  const cleanupValidation = validateReturnCovenantCleanup({
    cleanup,
    plan,
    evidence,
    driverAttestation,
    directCleanup,
    observerSigningKey: signingKey,
  });
  const runtimeEvaluation = evaluateIsolatedRuntimePlugin({
    config: runtimeConfig,
    configAvailable: isObject(runtimeConfig),
  });
  const runtimeConfigSha256 = isObject(runtimeConfig)
    ? digest(runtimeConfig)
    : null;
  const failureCategories = new Set([
    ...planErrors.map((error) => error.code),
    ...observationSet.errors.map((error) => error.code),
    ...cleanupValidation.errors.map((error) => error.code),
  ]);
  if (
    !isObject(runtimeConfig) ||
    runtimeConfigSha256 !== plan?.target?.runtimeConfigSha256 ||
    driverAttestation?.runtimeConfigSha256 !== runtimeConfigSha256 ||
    cleanup?.runtimeConfigSha256 !== runtimeConfigSha256 ||
    !nonEmpty(runtimeEvaluation.selectedModelRef, 3) ||
    !runtimeEvaluation.sufficient
  ) {
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
      runtimeConfigSha256: plan?.target?.runtimeConfigSha256 || null,
    },
    binding: {
      runFingerprint: fingerprint(plan?.runId),
      planSha256: digest(plan),
      evidenceSha256: digest(evidence),
      observationSetSha256: digest(evidence?.observations),
      phaseChainSha256: digest(evidence?.phaseChains),
      retentionObservationSha256: digest(
        evidence?.retentionObservation ?? null,
      ),
      cleanupSha256: digest(cleanup),
      driverAttestationSha256: digest(driverAttestation),
      runtimeConfigSha256,
      directCleanupSha256: digest(directCleanup),
    },
    driver: {
      status: observationSet.errors.some((error) =>
        error.code === 'driver-attestation-mismatch') ? 'fail' : 'pass',
      attestationSha256: safeHex(
        driverAttestation?.attestationSha256,
        HEX_64,
      ),
      attestationFingerprint: fingerprint(driverAttestation?.attestationSha256),
      endpointFingerprint: fingerprint(driverAttestation?.endpoint),
      commandPathFingerprint: fingerprint(
        driverAttestation?.command?.relativePath,
      ),
      commandSha256: safeHex(driverAttestation?.command?.sha256, HEX_64),
      gitBlob: safeHex(
        driverAttestation?.command?.gitBlob,
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u,
      ),
      sourceHeadSha: safeHex(driverAttestation?.source?.headSha, SHA_40),
      docsHeadSha: safeHex(driverAttestation?.source?.docsHeadSha, SHA_40),
      gatewayCommandPathFingerprint: fingerprint(
        driverAttestation?.gatewayCommand?.relativePath,
      ),
      gatewayCommandSha256: safeHex(
        driverAttestation?.gatewayCommand?.sha256,
        HEX_64,
      ),
      gatewayGitBlob: safeHex(
        driverAttestation?.gatewayCommand?.gitBlob,
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u,
      ),
      gatewayArgsFingerprint: fingerprint(
        canonicalJson(driverAttestation?.gatewayCommand?.args),
      ),
      trustedLauncher:
        driverAttestation?.launcher?.createdByTrustedLauncher === true,
      launcherFingerprint: fingerprint(
        driverAttestation?.launcher?.launcherProcessFingerprint,
      ),
      isolationFingerprint: fingerprint(
        driverAttestation?.isolation?.runRootFingerprint,
      ),
      processCommandBound:
        driverAttestation?.process?.commandContainsVerifiedDriver === true,
      endpointOwnedByProcess:
        driverAttestation?.process?.endpointOwnedByVerifiedProcess === true,
      endpointSocketFingerprint: fingerprint(
        driverAttestation?.process?.endpointSocketFingerprint,
      ),
      gatewayProcessBound:
        driverAttestation?.gateway?.processBound === true,
      gatewayStartFingerprint: fingerprint(
        driverAttestation?.gateway?.startFingerprint,
      ),
      gatewayConfigPathFingerprint: safeHex(
        driverAttestation?.gateway?.configPathFingerprint,
        HEX_64,
      ),
      gatewayEndpointFingerprint: fingerprint(
        driverAttestation?.gateway?.endpoint,
      ),
      gatewaySocketFingerprint: fingerprint(
        driverAttestation?.gateway?.socketFingerprint,
      ),
      runtimeConfigSha256: safeHex(
        driverAttestation?.runtimeConfigSha256,
        HEX_64,
      ),
      revocationCapability: {
        inventoryComplete:
          driverAttestation?.revocationCapability?.inventoryComplete === true,
        revocationApiExposed:
          driverAttestation?.revocationCapability?.revocationApiExposed === true,
        receiptFingerprint: fingerprint(
          driverAttestation?.revocationCapability?.receiptId,
        ),
        surfaceFingerprint: fingerprint(
          driverAttestation?.revocationCapability?.surface,
        ),
      },
      readyReceiptSha256: safeHex(
        driverAttestation?.readyReceiptSha256,
        HEX_64,
      ),
    },
    runtimePlugin: safeRuntimePluginReceipt(
      runtimeEvaluation,
      isObject(runtimeConfig),
    ),
    matrix: {
      requiredCases: RETURN_COVENANT_CASES.length,
      requiredFormsPerCase: 2,
      expectedObservations: observationSet.expectedCount,
      observedObservations: observationSet.observedCount,
      observedPhaseChains: observationSet.phaseChainCount,
      cases: observationSet.validations.map((validation) =>
        publicObservation(
          validation.observation,
          validation.phaseChain,
          validation,
        )),
    },
    cleanup: {
      status: cleanupValidation.valid ? 'pass' : 'fail',
      completedAt: validTimestamp(cleanup?.endedAt) ? cleanup.endedAt : null,
      retained: Object.fromEntries(
        RETAINED_NAMES.map((name) => [
          name,
          Number.isInteger(cleanup?.retained?.[name])
            ? cleanup.retained[name]
            : null,
        ]),
      ),
      retentionAuthority: Object.fromEntries(
        Object.entries(RETENTION_AUTHORITY).map(([name, expected]) => [
          name,
          cleanup?.retentionAuthority?.[name] === expected ? expected : null,
        ]),
      ),
      resourceObservation: {
        status: [
          'verified',
          'unverified-resource-retention',
        ].includes(cleanup?.resourceObservation?.status)
          ? cleanup.resourceObservation.status
          : null,
        evidenceSha256: safeHex(
          cleanup?.resourceObservation?.evidenceSha256,
          HEX_64,
        ),
        responseSha256: safeHex(
          cleanup?.resourceObservation?.responseSha256,
          HEX_64,
        ),
        observedAt: validTimestamp(cleanup?.resourceObservation?.observedAt)
          ? cleanup.resourceObservation.observedAt
          : null,
        gatewayPidFingerprint: fingerprint(
          String(cleanup?.resourceObservation?.gatewayPid || ''),
        ),
        gatewayStartFingerprint: fingerprint(
          cleanup?.resourceObservation?.gatewayStartFingerprint,
        ),
        gatewaySocketFingerprint: fingerprint(
          cleanup?.resourceObservation?.gatewaySocketFingerprint,
        ),
        gatewayEndpointFingerprint: fingerprint(
          cleanup?.resourceObservation?.gatewayEndpoint,
        ),
      },
      homeRemoved: cleanup?.homeRemoved === true,
      stateRemoved: cleanup?.stateRemoved === true,
      configRemoved: cleanup?.configRemoved === true,
      fixtureProcessStopped: cleanup?.fixtureProcessStopped === true,
      gatewayProcessStopped: cleanup?.gatewayProcessStopped === true,
      allCaseHandlesClosed: cleanup?.allCaseHandlesClosed === true,
      observationSetSha256: safeHex(cleanup?.observationSetSha256, HEX_64),
      phaseChainSha256: safeHex(cleanup?.phaseChainSha256, HEX_64),
      driverAttestationSha256: safeHex(
        cleanup?.driverAttestationSha256,
        HEX_64,
      ),
      runCleanupReceiptFingerprint: fingerprint(cleanup?.runCleanupReceiptId),
      runtimeConfigSha256: safeHex(cleanup?.runtimeConfigSha256, HEX_64),
      snapshotMatchedCandidateAfterRun:
        cleanup?.snapshotMatchedCandidateAfterRun === true,
      runRootRemoved: cleanup?.runRootRemoved === true,
      driverExitCode: Number.isInteger(cleanup?.driverExitCode)
        ? cleanup.driverExitCode
        : null,
      isolationFingerprint: fingerprint(cleanup?.isolationFingerprint),
      launcherIntegrityValid: cleanupValidation.errors.every((error) =>
        error.message !== 'direct launcher cleanup verification failed'),
      directCleanupVerified: directCleanup?.verified === true,
      processGroupEmpty: cleanup?.processGroupEmpty === true,
      unexpectedProcessGroupMembers: Number.isInteger(
        cleanup?.unexpectedProcessGroupMembers,
      )
        ? cleanup.unexpectedProcessGroupMembers
        : null,
      gatewayLifecycleCount: Array.isArray(cleanup?.gatewayLifecycle)
        ? cleanup.gatewayLifecycle.length
        : null,
      gatewayLifecycleFingerprint: fingerprint(
        digest(cleanup?.gatewayLifecycle),
      ),
      k6Version: /^k6 v2\.0\.0\b/u.test(cleanup?.k6?.version || '')
        ? cleanup.k6.version
        : null,
      k6Sha256: safeHex(cleanup?.k6?.sha256, HEX_64),
      k6PathFingerprint: safeHex(cleanup?.k6?.pathFingerprint, HEX_64),
    },
    redaction: {
      status: 'pass',
      forbiddenValuesScanned:
        privateForbiddenValues(plan, evidence, driverAttestation).length,
      forbiddenValueMatches: 0,
      rawIdentifiersPublished: false,
    },
  };

  const publicBytes = JSON.stringify(receipt);
  const leaked = privateForbiddenValues(plan, evidence, driverAttestation)
    .filter((value) => publicBytes.includes(value));
  if (leaked.length > 0 || /Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}/u.test(publicBytes)) {
    throw new Error('public return-covenant receipt failed forbidden-value scan');
  }
  return sealSignedObserverReceipt({
    receipt,
    signingKey,
    canonicalize: canonicalReceipt,
    algorithm: RETURN_COVENANT_INTEGRITY_ALGORITHM,
  });
}

function exactKeys(value, keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((name, index) => name === expected[index]);
}

function validFingerprint(value) {
  return HEX_16.test(value || '');
}

function validPublicEffects(value, expected) {
  return exactKeys(value, EFFECT_NAMES) && exactEffects(value, expected);
}

function closedPublicCaseShape(entry) {
  const capabilityShape = entry?.capability === null ||
    (
      exactKeys(entry?.capability, [
        'inventoryComplete',
        'revocationApiExposed',
        'receiptFingerprint',
        'surfaceFingerprint',
      ]) &&
      typeof entry.capability.inventoryComplete === 'boolean' &&
      typeof entry.capability.revocationApiExposed === 'boolean' &&
      (entry.capability.receiptFingerprint === null ||
        validFingerprint(entry.capability.receiptFingerprint)) &&
      (entry.capability.surfaceFingerprint === null ||
        validFingerprint(entry.capability.surfaceFingerprint))
    );
  return exactKeys(entry, [
    'caseId',
    'form',
    'kind',
    'applicability',
    'validation',
    'failureCategories',
    'startedAt',
    'endedAt',
    'returnMode',
    'lifecycleEdge',
    'markerFingerprint',
    'origin',
    'chain',
    'capability',
    'database',
    'identity',
    'authority',
    'delivery',
  ]) &&
    exactKeys(entry.origin, [
      'source',
      'observedForm',
      'receiptFingerprint',
      'typedToolExecutions',
      'bracketParses',
      'rawFinalText',
    ]) &&
    exactKeys(entry.chain, [
      'caseHandleFingerprint',
      'prepareReceiptFingerprint',
      'dispatchReceiptFingerprint',
      'transitionReceiptFingerprint',
      'releaseReceiptFingerprint',
      'cleanupReceiptFingerprint',
      'phaseProofsValid',
    ]) &&
    exactKeys(entry.database, [
      'profile',
      'sourceSchemaVersion',
      'targetSchemaVersion',
      'fixtureReceiptFingerprint',
      'freshInstall',
      'migrationApplied',
      'reopenIdempotent',
    ]) &&
    exactKeys(entry.identity, [
      'logicalSessionFingerprint',
      'preSessionFingerprint',
      'postSessionFingerprint',
      'successorFingerprint',
      'acceptedDispatchFingerprint',
      'heldResultFingerprint',
      'queueRecordFingerprint',
      'lifecycleReceiptFingerprint',
      'restartReceiptFingerprint',
      'originalGatewayStartFingerprint',
      'replacementGatewayStartFingerprint',
      'replacementGatewayPidFingerprint',
      'restartProcessGroupFingerprint',
      'deletionReceiptFingerprint',
      'recreationReceiptFingerprint',
    ]) &&
    exactKeys(entry.authority, [
      'capturedGenerationFingerprint',
      'currentGenerationFingerprint',
      'heldResultGenerationFingerprint',
      'relation',
      'diagnosticSource',
      'diagnosticSurfaceFingerprint',
    ]) &&
    exactKeys(entry.delivery, [
      'admission',
      'queueStatus',
      'acknowledged',
      'removed',
      'retryScheduled',
      'expectedEffects',
      'observedEffects',
      'effectsDistinguishable',
      'effectSourceFingerprints',
      'settlementWindowMs',
      'settlementComplete',
      'productSettlementElapsedMs',
      'harnessSettlementElapsedMs',
      'successorTranscriptMatches',
      'trustedSystemEventMatches',
      'successorTranscriptScanFingerprint',
      'trustedSystemEventScanFingerprint',
    ]) &&
    exactKeys(entry.delivery.expectedEffects, EFFECT_NAMES) &&
    exactKeys(entry.delivery.observedEffects, EFFECT_NAMES) &&
    exactKeys(entry.delivery.effectSourceFingerprints, EFFECT_NAMES) &&
    capabilityShape &&
    (entry.caseId === null || CASE_BY_ID.has(entry.caseId)) &&
    (entry.form === null || FORMS.has(entry.form)) &&
    (entry.kind === null || entry.kind === 'allowed' || entry.kind === 'forbidden') &&
    (entry.applicability === 'executed' || entry.applicability === 'not-exposed') &&
    (entry.validation === 'pass' || entry.validation === 'fail') &&
    (
      entry.returnMode === null ||
      ['normal', 'silent', 'silent-wake', 'post-compaction'].includes(entry.returnMode)
    ) &&
    (
      entry.lifecycleEdge === null ||
      RETURN_COVENANT_CASES.some((definition) =>
        definition.lifecycleEdge === entry.lifecycleEdge)
    ) &&
    (entry.database.profile === null ||
      Object.hasOwn(RETURN_COVENANT_DATABASE_PROFILES, entry.database.profile)) &&
    (
      entry.origin.source === null ||
      entry.origin.source === 'product-owned'
    ) &&
    (entry.origin.observedForm === null || FORMS.has(entry.origin.observedForm)) &&
    (entry.origin.receiptFingerprint === null ||
      validFingerprint(entry.origin.receiptFingerprint)) &&
    (entry.origin.typedToolExecutions === null ||
      Number.isInteger(entry.origin.typedToolExecutions)) &&
    (entry.origin.bracketParses === null ||
      Number.isInteger(entry.origin.bracketParses)) &&
    typeof entry.origin.rawFinalText === 'boolean' &&
    (
      entry.authority.relation === 'unchanged' ||
      entry.authority.relation === 'advanced' ||
      entry.authority.relation === 'not-applicable'
    ) &&
    (
      entry.authority.diagnosticSource === null ||
      entry.authority.diagnosticSource === 'product-owned'
    ) &&
    (entry.delivery.admission === null ||
      SAFE_ADMISSIONS.has(entry.delivery.admission)) &&
    (entry.delivery.queueStatus === null ||
      SAFE_QUEUE_STATUSES.has(entry.delivery.queueStatus)) &&
    (entry.markerFingerprint === null || validFingerprint(entry.markerFingerprint)) &&
    (entry.startedAt === null || validTimestamp(entry.startedAt)) &&
    (entry.endedAt === null || validTimestamp(entry.endedAt)) &&
    (
      entry.database.sourceSchemaVersion === null ||
      Number.isInteger(entry.database.sourceSchemaVersion)
    ) &&
    (
      entry.database.targetSchemaVersion === null ||
      Number.isInteger(entry.database.targetSchemaVersion)
    ) &&
    (entry.database.fixtureReceiptFingerprint === null ||
      validFingerprint(entry.database.fixtureReceiptFingerprint)) &&
    typeof entry.database.freshInstall === 'boolean' &&
    typeof entry.database.migrationApplied === 'boolean' &&
    typeof entry.database.reopenIdempotent === 'boolean' &&
    [
      entry.authority.capturedGenerationFingerprint,
      entry.authority.currentGenerationFingerprint,
      entry.authority.heldResultGenerationFingerprint,
      entry.authority.diagnosticSurfaceFingerprint,
    ]
      .every((value) => value === null || validFingerprint(value)) &&
    typeof entry.delivery.acknowledged === 'boolean' &&
    typeof entry.delivery.removed === 'boolean' &&
    typeof entry.delivery.retryScheduled === 'boolean' &&
    typeof entry.delivery.effectsDistinguishable === 'boolean' &&
    typeof entry.delivery.settlementComplete === 'boolean' &&
    [
      entry.delivery.settlementWindowMs,
      entry.delivery.successorTranscriptMatches,
      entry.delivery.trustedSystemEventMatches,
    ].every((value) => value === null || Number.isInteger(value)) &&
    (
      entry.delivery.productSettlementElapsedMs === null ||
      Number.isFinite(entry.delivery.productSettlementElapsedMs)
    ) &&
    (
      entry.delivery.harnessSettlementElapsedMs === null ||
      Number.isFinite(entry.delivery.harnessSettlementElapsedMs)
    ) &&
    [
      entry.chain.caseHandleFingerprint,
      entry.chain.prepareReceiptFingerprint,
      entry.chain.dispatchReceiptFingerprint,
      entry.chain.transitionReceiptFingerprint,
      entry.chain.releaseReceiptFingerprint,
      entry.chain.cleanupReceiptFingerprint,
      ...Object.values(entry.identity),
    ]
      .every((value) => value === null || validFingerprint(value)) &&
    typeof entry.chain.phaseProofsValid === 'boolean' &&
    Object.values(entry.delivery.effectSourceFingerprints)
      .every((value) => value === null || validFingerprint(value)) &&
    [...Object.values(entry.delivery.expectedEffects),
      ...Object.values(entry.delivery.observedEffects)]
      .every((value) => value === null || Number.isInteger(value)) &&
    Array.isArray(entry.failureCategories) &&
    entry.failureCategories.every((value) =>
      typeof value === 'string' && /^[a-z0-9-]+$/u.test(value));
}

function validPublicCase(entry) {
  const definition = CASE_BY_ID.get(entry?.caseId);
  if (
    !definition ||
    !FORMS.has(entry.form) ||
    entry.kind !== definition.kind ||
    entry.lifecycleEdge !== definition.lifecycleEdge ||
    entry.validation !== 'pass' ||
    !Array.isArray(entry.failureCategories) ||
    entry.failureCategories.length !== 0 ||
    !validTimestamp(entry.startedAt) ||
    !validTimestamp(entry.endedAt) ||
    Date.parse(entry.endedAt) < Date.parse(entry.startedAt) ||
    !exactKeys(entry, [
      'caseId',
      'form',
      'kind',
      'applicability',
      'validation',
      'failureCategories',
      'startedAt',
      'endedAt',
      'returnMode',
      'lifecycleEdge',
      'markerFingerprint',
      'origin',
      'chain',
      'capability',
      'database',
      'identity',
      'authority',
      'delivery',
    ]) ||
    !exactKeys(entry.origin, [
      'source',
      'observedForm',
      'receiptFingerprint',
      'typedToolExecutions',
      'bracketParses',
      'rawFinalText',
    ]) ||
    !exactKeys(entry.chain, [
      'caseHandleFingerprint',
      'prepareReceiptFingerprint',
      'dispatchReceiptFingerprint',
      'transitionReceiptFingerprint',
      'releaseReceiptFingerprint',
      'cleanupReceiptFingerprint',
      'phaseProofsValid',
    ]) ||
    !exactKeys(entry.database, [
      'profile',
      'sourceSchemaVersion',
      'targetSchemaVersion',
      'fixtureReceiptFingerprint',
      'freshInstall',
      'migrationApplied',
      'reopenIdempotent',
    ]) ||
    !exactKeys(entry.identity, [
      'logicalSessionFingerprint',
      'preSessionFingerprint',
      'postSessionFingerprint',
      'successorFingerprint',
      'acceptedDispatchFingerprint',
      'heldResultFingerprint',
      'queueRecordFingerprint',
      'lifecycleReceiptFingerprint',
      'restartReceiptFingerprint',
      'originalGatewayStartFingerprint',
      'replacementGatewayStartFingerprint',
      'replacementGatewayPidFingerprint',
      'restartProcessGroupFingerprint',
      'deletionReceiptFingerprint',
      'recreationReceiptFingerprint',
    ]) ||
    !exactKeys(entry.authority, [
      'capturedGenerationFingerprint',
      'currentGenerationFingerprint',
      'heldResultGenerationFingerprint',
      'relation',
      'diagnosticSource',
      'diagnosticSurfaceFingerprint',
    ]) ||
    !exactKeys(entry.delivery, [
      'admission',
      'queueStatus',
      'acknowledged',
      'removed',
      'retryScheduled',
      'expectedEffects',
      'observedEffects',
      'effectsDistinguishable',
      'effectSourceFingerprints',
      'settlementWindowMs',
      'settlementComplete',
      'productSettlementElapsedMs',
      'harnessSettlementElapsedMs',
      'successorTranscriptMatches',
      'trustedSystemEventMatches',
      'successorTranscriptScanFingerprint',
      'trustedSystemEventScanFingerprint',
    ])
  ) {
    return false;
  }

  const profile = RETURN_COVENANT_DATABASE_PROFILES[entry.database.profile];
  if (
    !profile ||
    entry.database.sourceSchemaVersion !== profile.sourceSchemaVersion ||
    entry.database.targetSchemaVersion !== profile.targetSchemaVersion ||
    !validFingerprint(entry.database.fixtureReceiptFingerprint) ||
    entry.database.freshInstall !== (profile.sourceSchemaVersion === null) ||
    entry.database.migrationApplied !== (profile.sourceSchemaVersion === 18) ||
    entry.database.reopenIdempotent !==
      (entry.database.profile === 'idempotent-v19-reopen') ||
    !validFingerprint(entry.identity.logicalSessionFingerprint) ||
    !validFingerprint(entry.chain.caseHandleFingerprint) ||
    !validFingerprint(entry.chain.prepareReceiptFingerprint) ||
    !validFingerprint(entry.chain.cleanupReceiptFingerprint)
    || entry.chain.phaseProofsValid !== true
  ) {
    return false;
  }
  const expectedEffects = expectedReturnCovenantEffects(entry);
  if (
    !validPublicEffects(entry.delivery.expectedEffects, expectedEffects) ||
    !validPublicEffects(entry.delivery.observedEffects, expectedEffects) ||
    entry.delivery.effectsDistinguishable !== true ||
    !exactKeys(entry.delivery.effectSourceFingerprints, EFFECT_NAMES) ||
    !EFFECT_NAMES.every((name) =>
      validFingerprint(entry.delivery.effectSourceFingerprints[name])) ||
    new Set(Object.values(entry.delivery.effectSourceFingerprints)).size !==
      EFFECT_NAMES.length ||
    !Number.isInteger(entry.delivery.settlementWindowMs) ||
    entry.delivery.settlementWindowMs < 1_000 ||
    entry.delivery.settlementWindowMs > 30_000 ||
    entry.delivery.settlementComplete !== true ||
    (
      entry.applicability !== 'not-exposed' &&
      (
        !Number.isFinite(entry.delivery.productSettlementElapsedMs) ||
        entry.delivery.productSettlementElapsedMs <
          entry.delivery.settlementWindowMs ||
        !Number.isFinite(entry.delivery.harnessSettlementElapsedMs) ||
        entry.delivery.harnessSettlementElapsedMs <
          entry.delivery.settlementWindowMs
      )
    ) ||
    entry.delivery.successorTranscriptMatches !== 0 ||
    entry.delivery.trustedSystemEventMatches !== 0
  ) {
    return false;
  }

  if (entry.applicability === 'not-exposed') {
    return entry.caseId === 'forbidden-explicit-revocation' &&
      entry.markerFingerprint === null &&
      exactKeys(entry.capability, [
        'inventoryComplete',
        'revocationApiExposed',
        'receiptFingerprint',
        'surfaceFingerprint',
      ]) &&
      entry.capability.inventoryComplete === true &&
      entry.capability.revocationApiExposed === false &&
      validFingerprint(entry.capability.receiptFingerprint) &&
      validFingerprint(entry.capability.surfaceFingerprint) &&
      entry.authority.relation === 'not-applicable' &&
      entry.authority.diagnosticSource === 'product-owned' &&
      entry.origin.source === null &&
      entry.origin.observedForm === null &&
      entry.origin.receiptFingerprint === null &&
      entry.origin.typedToolExecutions === null &&
      entry.origin.bracketParses === null &&
      entry.origin.rawFinalText === false &&
      entry.chain.dispatchReceiptFingerprint === null &&
      entry.chain.transitionReceiptFingerprint === null &&
      entry.chain.releaseReceiptFingerprint === null &&
      zeroEffects(entry.delivery.expectedEffects) &&
      zeroEffects(entry.delivery.observedEffects);
  }

  const expectedAdmission = definition.kind === 'allowed'
    ? 'adopted'
    : FORBIDDEN_ADMISSIONS[entry.caseId];
  const expectedQueue = definition.kind === 'allowed'
    ? 'adopted'
    : FORBIDDEN_QUEUE_STATUSES[expectedAdmission];
  const executedFingerprints = [
    entry.markerFingerprint,
    entry.chain.dispatchReceiptFingerprint,
    entry.chain.transitionReceiptFingerprint,
    entry.chain.releaseReceiptFingerprint,
    entry.identity.postSessionFingerprint,
    entry.identity.successorFingerprint,
    entry.identity.acceptedDispatchFingerprint,
    entry.identity.heldResultFingerprint,
    entry.identity.queueRecordFingerprint,
    entry.identity.lifecycleReceiptFingerprint,
    entry.authority.capturedGenerationFingerprint,
    entry.authority.currentGenerationFingerprint,
    entry.authority.heldResultGenerationFingerprint,
    entry.authority.diagnosticSurfaceFingerprint,
    entry.delivery.successorTranscriptScanFingerprint,
    entry.delivery.trustedSystemEventScanFingerprint,
    entry.origin.receiptFingerprint,
  ];
  return entry.applicability === 'executed' &&
    entry.capability === null &&
    executedFingerprints.every(validFingerprint) &&
    entry.authority.diagnosticSource === 'product-owned' &&
    entry.origin.source === 'product-owned' &&
    entry.origin.observedForm === entry.form &&
    entry.origin.typedToolExecutions === (entry.form === 'typed-tool' ? 1 : 0) &&
    entry.origin.bracketParses === (entry.form === 'bracket-token' ? 1 : 0) &&
    entry.origin.rawFinalText === (entry.form === 'bracket-token') &&
    entry.authority.relation ===
      (definition.kind === 'allowed' ? 'unchanged' : 'advanced') &&
    entry.authority.heldResultGenerationFingerprint ===
      entry.authority.capturedGenerationFingerprint &&
    (
      definition.kind === 'allowed'
        ? entry.authority.currentGenerationFingerprint ===
          entry.authority.capturedGenerationFingerprint
        : entry.authority.currentGenerationFingerprint !==
          entry.authority.capturedGenerationFingerprint
    ) &&
    entry.identity.acceptedDispatchFingerprint ===
      entry.chain.dispatchReceiptFingerprint &&
    entry.identity.lifecycleReceiptFingerprint ===
      entry.chain.transitionReceiptFingerprint &&
    entry.delivery.admission === expectedAdmission &&
    entry.delivery.queueStatus === expectedQueue &&
    entry.delivery.acknowledged === true &&
    entry.delivery.removed === true &&
    entry.delivery.retryScheduled === false &&
    (
      entry.caseId === 'allowed-late-materialization'
        ? entry.identity.preSessionFingerprint === null
        : validFingerprint(entry.identity.preSessionFingerprint)
    ) &&
    (
      entry.caseId === 'allowed-gateway-restart-replay'
        ? validFingerprint(entry.identity.restartReceiptFingerprint) &&
          validFingerprint(entry.identity.originalGatewayStartFingerprint) &&
          validFingerprint(entry.identity.replacementGatewayStartFingerprint) &&
          validFingerprint(entry.identity.replacementGatewayPidFingerprint) &&
          validFingerprint(entry.identity.restartProcessGroupFingerprint) &&
          entry.identity.originalGatewayStartFingerprint !==
            entry.identity.replacementGatewayStartFingerprint
        : entry.identity.restartReceiptFingerprint === null &&
          entry.identity.originalGatewayStartFingerprint === null &&
          entry.identity.replacementGatewayStartFingerprint === null &&
          entry.identity.replacementGatewayPidFingerprint === null &&
          entry.identity.restartProcessGroupFingerprint === null
    ) &&
    (
      entry.caseId === 'allowed-session-id-rollover'
        ? entry.identity.preSessionFingerprint !== entry.identity.postSessionFingerprint
        : true
    ) &&
    (
      entry.caseId === 'forbidden-delete-recreate'
        ? validFingerprint(entry.identity.deletionReceiptFingerprint) &&
          validFingerprint(entry.identity.recreationReceiptFingerprint) &&
          entry.identity.preSessionFingerprint !== entry.identity.postSessionFingerprint
        : entry.identity.deletionReceiptFingerprint === null &&
          entry.identity.recreationReceiptFingerprint === null
    );
}

function validClosedReceiptShape(receipt) {
  return exactKeys(receipt, [
    'schema',
    'row',
    'authoritativeSource',
    'candidateOnly',
    'foldRequiresReview',
    'verdict',
    'failureCategories',
    'target',
    'binding',
    'driver',
    'runtimePlugin',
    'matrix',
    'cleanup',
    'redaction',
    'integrity',
  ]) &&
    exactKeys(receipt.target, [
      'candidateSha',
      'runtimeBuildSha',
      'docsHarnessSha',
      'runtimeConfigSha256',
    ]) &&
    exactKeys(receipt.binding, [
      'runFingerprint',
      'planSha256',
      'evidenceSha256',
      'observationSetSha256',
      'phaseChainSha256',
      'retentionObservationSha256',
      'cleanupSha256',
      'driverAttestationSha256',
      'runtimeConfigSha256',
      'directCleanupSha256',
    ]) &&
    exactKeys(receipt.driver, [
      'status',
      'attestationSha256',
      'attestationFingerprint',
      'endpointFingerprint',
      'commandPathFingerprint',
      'commandSha256',
      'gitBlob',
      'sourceHeadSha',
      'docsHeadSha',
      'gatewayCommandPathFingerprint',
      'gatewayCommandSha256',
      'gatewayGitBlob',
      'gatewayArgsFingerprint',
      'trustedLauncher',
      'launcherFingerprint',
      'isolationFingerprint',
      'processCommandBound',
      'endpointOwnedByProcess',
      'endpointSocketFingerprint',
      'gatewayProcessBound',
      'gatewayStartFingerprint',
      'gatewayConfigPathFingerprint',
      'gatewayEndpointFingerprint',
      'gatewaySocketFingerprint',
      'runtimeConfigSha256',
      'revocationCapability',
      'readyReceiptSha256',
    ]) &&
    exactKeys(receipt.runtimePlugin, [
      'required',
      'runtime',
      'pluginId',
      'registered',
      'allowListed',
      'sufficient',
      'source',
      'reason',
      'configObserved',
      'selectedModelFingerprint',
    ]) &&
    exactKeys(receipt.matrix, [
      'requiredCases',
      'requiredFormsPerCase',
      'expectedObservations',
      'observedObservations',
      'observedPhaseChains',
      'cases',
    ]) &&
    Array.isArray(receipt.matrix.cases) &&
    receipt.matrix.cases.every(closedPublicCaseShape) &&
    exactKeys(receipt.cleanup, [
      'status',
      'completedAt',
      'retained',
      'retentionAuthority',
      'resourceObservation',
      'homeRemoved',
      'stateRemoved',
      'configRemoved',
      'fixtureProcessStopped',
      'gatewayProcessStopped',
      'allCaseHandlesClosed',
      'observationSetSha256',
      'phaseChainSha256',
      'driverAttestationSha256',
      'runCleanupReceiptFingerprint',
      'runtimeConfigSha256',
      'snapshotMatchedCandidateAfterRun',
      'runRootRemoved',
      'driverExitCode',
      'isolationFingerprint',
      'launcherIntegrityValid',
      'directCleanupVerified',
      'processGroupEmpty',
      'unexpectedProcessGroupMembers',
      'gatewayLifecycleCount',
      'gatewayLifecycleFingerprint',
      'k6Version',
      'k6Sha256',
      'k6PathFingerprint',
    ]) &&
    exactKeys(receipt.cleanup.retained, RETAINED_NAMES) &&
    exactKeys(
      receipt.cleanup.retentionAuthority,
      Object.keys(RETENTION_AUTHORITY),
    ) &&
    exactKeys(receipt.cleanup.resourceObservation, [
      'status',
      'evidenceSha256',
      'responseSha256',
      'observedAt',
      'gatewayPidFingerprint',
      'gatewayStartFingerprint',
      'gatewaySocketFingerprint',
      'gatewayEndpointFingerprint',
    ]) &&
    exactKeys(receipt.redaction, [
      'status',
      'forbiddenValuesScanned',
      'forbiddenValueMatches',
      'rawIdentifiersPublished',
    ]) &&
    exactKeys(receipt.integrity, ['algorithm', 'signature']);
}

export function validateReturnCovenantAuthoritativeReceipt(receipt, signingKey) {
  if (
    !receipt ||
    !validClosedReceiptShape(receipt) ||
    receipt.schema !== RETURN_COVENANT_RECEIPT_SCHEMA ||
    receipt.row !== RETURN_COVENANT_ROW_ID ||
    receipt.authoritativeSource !== 'return-covenant-row-scoped-observer' ||
    receipt.candidateOnly !== true ||
    receipt.foldRequiresReview !== true ||
    !SHA_40.test(receipt.target?.candidateSha || '') ||
    receipt.target?.runtimeBuildSha !== receipt.target.candidateSha ||
    !SHA_40.test(receipt.target?.docsHarnessSha || '') ||
    !HEX_64.test(receipt.target?.runtimeConfigSha256 || '') ||
    !HEX_16.test(receipt.binding?.runFingerprint || '') ||
    !HEX_64.test(receipt.binding?.planSha256 || '') ||
    !HEX_64.test(receipt.binding?.evidenceSha256 || '') ||
    !HEX_64.test(receipt.binding?.observationSetSha256 || '') ||
    !HEX_64.test(receipt.binding?.phaseChainSha256 || '') ||
    !HEX_64.test(receipt.binding?.retentionObservationSha256 || '') ||
    !HEX_64.test(receipt.binding?.cleanupSha256 || '') ||
    !HEX_64.test(receipt.binding?.driverAttestationSha256 || '') ||
    receipt.binding?.runtimeConfigSha256 !== receipt.target.runtimeConfigSha256 ||
    !HEX_64.test(receipt.binding?.directCleanupSha256 || '') ||
    receipt.integrity?.algorithm !== RETURN_COVENANT_INTEGRITY_ALGORITHM
  ) {
    return { valid: false, reason: 'invalid-shape' };
  }
  if (
    !Array.isArray(receipt.failureCategories) ||
    receipt.failureCategories.some((value) =>
      typeof value !== 'string' || !/^[a-z0-9-]+$/u.test(value)) ||
    receipt.redaction?.status !== 'pass' ||
    !Number.isInteger(receipt.redaction?.forbiddenValuesScanned) ||
    receipt.redaction.forbiddenValuesScanned <= 0 ||
    receipt.redaction?.forbiddenValueMatches !== 0 ||
    receipt.redaction?.rawIdentifiersPublished !== false
  ) {
    return { valid: false, reason: 'public-safety-failure' };
  }
  if (/Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}/u.test(JSON.stringify(receipt))) {
    return { valid: false, reason: 'public-safety-failure' };
  }
  if (!validateSignedObserverReceiptIntegrity({
    receipt,
    signingKey,
    canonicalize: canonicalReceipt,
    algorithm: RETURN_COVENANT_INTEGRITY_ALGORITHM,
  })) {
    return { valid: false, reason: 'invalid-integrity' };
  }
  const cases = receipt.matrix?.cases;
  const caseKeys = Array.isArray(cases)
    ? cases.map((entry) => returnCovenantExecutionKey(entry.caseId, entry.form))
    : [];
  const revocationCases = Array.isArray(cases)
    ? cases.filter((entry) =>
      entry.caseId === 'forbidden-explicit-revocation')
    : [];
  const expectedRevocationApplicability =
    receipt.driver?.revocationCapability?.revocationApiExposed === true
      ? 'executed'
      : 'not-exposed';
  const publicCanonicalIdentities = Array.isArray(cases)
    ? [
      ...cases.flatMap((entry) => [
        entry.chain?.prepareReceiptFingerprint,
        entry.chain?.dispatchReceiptFingerprint,
        entry.chain?.transitionReceiptFingerprint,
        entry.chain?.releaseReceiptFingerprint,
        entry.chain?.cleanupReceiptFingerprint,
        entry.identity?.heldResultFingerprint,
        entry.identity?.queueRecordFingerprint,
        entry.origin?.receiptFingerprint,
        entry.markerFingerprint,
        entry.authority?.capturedGenerationFingerprint,
        ...(entry.kind === 'forbidden'
          ? [entry.authority?.currentGenerationFingerprint]
          : []),
        ...(entry.identity?.restartReceiptFingerprint
          ? [
            entry.identity.restartReceiptFingerprint,
            entry.identity.replacementGatewayStartFingerprint,
            entry.identity.replacementGatewayPidFingerprint,
          ]
          : []),
        ...(entry.identity?.deletionReceiptFingerprint
          ? [entry.identity.deletionReceiptFingerprint]
          : []),
        ...(entry.identity?.recreationReceiptFingerprint
          ? [entry.identity.recreationReceiptFingerprint]
          : []),
        entry.delivery?.successorTranscriptScanFingerprint,
        entry.delivery?.trustedSystemEventScanFingerprint,
      ]),
      ...(expectedRevocationApplicability === 'not-exposed'
        ? [receipt.driver?.revocationCapability?.receiptFingerprint]
        : []),
    ].filter((value) => value !== null && value !== undefined)
    : [];
  const passShape =
    receipt.matrix?.requiredCases === RETURN_COVENANT_CASES.length &&
    receipt.matrix?.requiredFormsPerCase === 2 &&
    receipt.matrix?.expectedObservations === RETURN_COVENANT_CASES.length * 2 &&
    receipt.matrix?.observedObservations === RETURN_COVENANT_CASES.length * 2 &&
    receipt.matrix?.observedPhaseChains === RETURN_COVENANT_CASES.length * 2 &&
    Array.isArray(cases) &&
    cases.length === RETURN_COVENANT_CASES.length * 2 &&
    new Set(caseKeys).size === RETURN_COVENANT_CASES.length * 2 &&
    RETURN_COVENANT_CASES.every((entry) =>
      [...FORMS].every((form) =>
        caseKeys.includes(returnCovenantExecutionKey(entry.id, form)))) &&
    cases.every(validPublicCase) &&
    revocationCases.length === 2 &&
    revocationCases.every((entry) =>
      entry.applicability === expectedRevocationApplicability) &&
    (
      expectedRevocationApplicability === 'executed' ||
      new Set(revocationCases.map((entry) =>
        entry.capability?.receiptFingerprint)).size === 1
    ) &&
    new Set(cases.map((entry) => entry.chain.caseHandleFingerprint)).size ===
      RETURN_COVENANT_CASES.length * 2 &&
    new Set(cases
      .filter((entry) => entry.applicability === 'executed')
      .map((entry) => entry.markerFingerprint)).size ===
      cases.filter((entry) => entry.applicability === 'executed').length &&
    publicCanonicalIdentities.every(validFingerprint) &&
    new Set(publicCanonicalIdentities).size === publicCanonicalIdentities.length &&
    receipt.driver?.status === 'pass' &&
    HEX_64.test(receipt.driver?.attestationSha256 || '') &&
    validFingerprint(receipt.driver?.attestationFingerprint) &&
    validFingerprint(receipt.driver?.endpointFingerprint) &&
    validFingerprint(receipt.driver?.commandPathFingerprint) &&
    HEX_64.test(receipt.driver?.commandSha256 || '') &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(receipt.driver?.gitBlob || '') &&
    receipt.driver?.sourceHeadSha === receipt.target.candidateSha &&
    receipt.driver?.docsHeadSha === receipt.target.docsHarnessSha &&
    validFingerprint(receipt.driver?.gatewayCommandPathFingerprint) &&
    HEX_64.test(receipt.driver?.gatewayCommandSha256 || '') &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(
      receipt.driver?.gatewayGitBlob || '',
    ) &&
    validFingerprint(receipt.driver?.gatewayArgsFingerprint) &&
    receipt.driver?.trustedLauncher === true &&
    validFingerprint(receipt.driver?.launcherFingerprint) &&
    validFingerprint(receipt.driver?.isolationFingerprint) &&
    receipt.driver?.processCommandBound === true &&
    receipt.driver?.endpointOwnedByProcess === true &&
    validFingerprint(receipt.driver?.endpointSocketFingerprint) &&
    receipt.driver?.gatewayProcessBound === true &&
    validFingerprint(receipt.driver?.gatewayStartFingerprint) &&
    HEX_64.test(receipt.driver?.gatewayConfigPathFingerprint || '') &&
    validFingerprint(receipt.driver?.gatewayEndpointFingerprint) &&
    validFingerprint(receipt.driver?.gatewaySocketFingerprint) &&
    receipt.driver?.runtimeConfigSha256 === receipt.target.runtimeConfigSha256 &&
    exactKeys(receipt.driver?.revocationCapability, [
      'inventoryComplete',
      'revocationApiExposed',
      'receiptFingerprint',
      'surfaceFingerprint',
    ]) &&
    receipt.driver.revocationCapability.inventoryComplete === true &&
    validFingerprint(receipt.driver.revocationCapability.receiptFingerprint) &&
    validFingerprint(receipt.driver.revocationCapability.surfaceFingerprint) &&
    HEX_64.test(receipt.driver?.readyReceiptSha256 || '') &&
    receipt.cleanup?.status === 'pass' &&
    validTimestamp(receipt.cleanup?.completedAt) &&
    RETAINED_NAMES.every((name) => receipt.cleanup.retained?.[name] === 0) &&
    canonicalJson(receipt.cleanup?.retentionAuthority) ===
      canonicalJson(RETENTION_AUTHORITY) &&
    receipt.cleanup?.resourceObservation?.status === 'verified' &&
    receipt.cleanup.resourceObservation.evidenceSha256 ===
      receipt.binding.retentionObservationSha256 &&
    HEX_64.test(
      receipt.cleanup.resourceObservation.responseSha256 || '',
    ) &&
    validTimestamp(receipt.cleanup.resourceObservation.observedAt) &&
    validFingerprint(
      receipt.cleanup.resourceObservation.gatewayPidFingerprint,
    ) &&
    validFingerprint(
      receipt.cleanup.resourceObservation.gatewayStartFingerprint,
    ) &&
    validFingerprint(
      receipt.cleanup.resourceObservation.gatewaySocketFingerprint,
    ) &&
    validFingerprint(
      receipt.cleanup.resourceObservation.gatewayEndpointFingerprint,
    ) &&
    receipt.cleanup?.homeRemoved === true &&
    receipt.cleanup?.stateRemoved === true &&
    receipt.cleanup?.configRemoved === true &&
    receipt.cleanup?.fixtureProcessStopped === true &&
    receipt.cleanup?.gatewayProcessStopped === true &&
    receipt.cleanup?.allCaseHandlesClosed === true &&
    receipt.cleanup?.observationSetSha256 === receipt.binding.observationSetSha256 &&
    receipt.cleanup?.phaseChainSha256 === receipt.binding.phaseChainSha256 &&
    receipt.cleanup?.driverAttestationSha256 === receipt.driver.attestationSha256 &&
    receipt.cleanup?.runtimeConfigSha256 === receipt.target.runtimeConfigSha256 &&
    receipt.cleanup?.snapshotMatchedCandidateAfterRun === true &&
    receipt.cleanup?.runRootRemoved === true &&
    receipt.cleanup?.driverExitCode === 0 &&
    receipt.cleanup?.isolationFingerprint ===
      receipt.driver.isolationFingerprint &&
    receipt.cleanup?.launcherIntegrityValid === true &&
    receipt.cleanup?.directCleanupVerified === true &&
    receipt.cleanup?.processGroupEmpty === true &&
    receipt.cleanup?.unexpectedProcessGroupMembers === 0 &&
    Number.isInteger(receipt.cleanup?.gatewayLifecycleCount) &&
    receipt.cleanup.gatewayLifecycleCount >= 1 &&
    validFingerprint(receipt.cleanup?.gatewayLifecycleFingerprint) &&
    /^k6 v2\.0\.0\b/u.test(receipt.cleanup?.k6Version || '') &&
    HEX_64.test(receipt.cleanup?.k6Sha256 || '') &&
    HEX_64.test(receipt.cleanup?.k6PathFingerprint || '') &&
    validFingerprint(receipt.cleanup?.runCleanupReceiptFingerprint) &&
    receipt.runtimePlugin?.sufficient === true &&
    receipt.runtimePlugin?.source === 'isolated-target-config' &&
    receipt.runtimePlugin?.configObserved === true &&
    validFingerprint(receipt.runtimePlugin?.selectedModelFingerprint) &&
    receipt.redaction?.status === 'pass' &&
    Number.isInteger(receipt.redaction?.forbiddenValuesScanned) &&
    receipt.redaction.forbiddenValuesScanned > 0 &&
    receipt.redaction?.forbiddenValueMatches === 0 &&
    receipt.redaction?.rawIdentifiersPublished === false;
  if (receipt.verdict === 'PASS-candidate') {
    return passShape && receipt.failureCategories.length === 0
      ? { valid: true, verdict: receipt.verdict }
      : { valid: false, reason: 'invalid-pass-matrix' };
  }
  return receipt.verdict === 'FAIL-candidate' &&
    receipt.failureCategories.length > 0
    ? { valid: true, verdict: receipt.verdict }
    : { valid: false, reason: 'invalid-failure' };
}
