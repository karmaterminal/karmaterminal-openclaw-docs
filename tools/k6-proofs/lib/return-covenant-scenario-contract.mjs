export const RETURN_COVENANT_ROW_ID = 'R-CD-RETURN-COVENANT-AUTHORITY';
export const RETURN_COVENANT_PLAN_SCHEMA =
  'openclaw.k6.return-covenant-fixture-input.v1';
export const RETURN_COVENANT_DRIVER_SCHEMA =
  'openclaw.k6.return-covenant-fixture-driver.v1';
export const RETURN_COVENANT_EVIDENCE_PREFIX =
  'R_CD_RETURN_COVENANT_AUTHORITY_EVIDENCE ';
export const RETURN_COVENANT_FORMS = Object.freeze([
  'typed-tool',
  'bracket-token',
]);

export const RETURN_COVENANT_CASES = Object.freeze([
  {
    id: 'allowed-ordinary-new',
    kind: 'allowed',
    lifecycleEdge: 'ordinary-new',
  },
  {
    id: 'allowed-ordinary-reset',
    kind: 'allowed',
    lifecycleEdge: 'ordinary-reset',
  },
  {
    id: 'allowed-provider-fallback',
    kind: 'allowed',
    lifecycleEdge: 'provider-fallback',
  },
  {
    id: 'allowed-compaction',
    kind: 'allowed',
    lifecycleEdge: 'compaction',
  },
  {
    id: 'allowed-gateway-restart-replay',
    kind: 'allowed',
    lifecycleEdge: 'gateway-restart-replay',
  },
  {
    id: 'allowed-session-id-rollover',
    kind: 'allowed',
    lifecycleEdge: 'session-id-rollover',
  },
  {
    id: 'allowed-late-materialization',
    kind: 'allowed',
    lifecycleEdge: 'late-recipient-materialization',
  },
  {
    id: 'forbidden-delete-recreate',
    kind: 'forbidden',
    lifecycleEdge: 'explicit-delete-recreate',
  },
  {
    id: 'forbidden-owner-reassignment',
    kind: 'forbidden',
    lifecycleEdge: 'effective-owner-reassignment',
  },
  {
    id: 'forbidden-member-access-removal',
    kind: 'forbidden',
    lifecycleEdge: 'actual-member-access-removal',
  },
  {
    id: 'forbidden-restrictive-visibility',
    kind: 'forbidden',
    lifecycleEdge: 'restrictive-visibility-change',
  },
  {
    id: 'forbidden-explicit-revocation',
    kind: 'forbidden',
    lifecycleEdge: 'explicit-revocation',
  },
]);

export const RETURN_COVENANT_DATABASE_PROFILES = Object.freeze({
  'fresh-v19': {
    sourceSchemaVersion: null,
    targetSchemaVersion: 19,
    fixtureShape: 'fresh',
  },
  'covenant-v18-upgrade': {
    sourceSchemaVersion: 18,
    targetSchemaVersion: 19,
    fixtureShape: 'covenant-v18',
  },
  'participant-v18-upgrade': {
    sourceSchemaVersion: 18,
    targetSchemaVersion: 19,
    fixtureShape: 'participant-v18',
  },
  'idempotent-v19-reopen': {
    sourceSchemaVersion: 19,
    targetSchemaVersion: 19,
    fixtureShape: 'v19-reopen',
  },
});

const SHA_40 = /^[a-f0-9]{40}$/u;
const RETURN_MODES = new Set(['normal', 'silent', 'silent-wake', 'post-compaction']);
const CASE_BY_ID = new Map(RETURN_COVENANT_CASES.map((entry) => [entry.id, entry]));
const EFFECT_NAMES = ['promptAdoptions', 'wakes', 'channelDeliveries'];

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameSet(left, right) {
  return left.length === right.length &&
    left.every((value) => right.includes(value));
}

function effectErrors(effects, prefix, forbidden) {
  const errors = [];
  if (!isObject(effects)) return [`${prefix} must be an object`];
  for (const name of EFFECT_NAMES) {
    if (!Number.isInteger(effects[name]) || effects[name] < 0 || effects[name] > 1) {
      errors.push(`${prefix}.${name} must be 0 or 1`);
    }
    if (forbidden && effects[name] !== 0) {
      errors.push(`${prefix}.${name} must be zero for forbidden cases`);
    }
  }
  if (!forbidden && effects.promptAdoptions !== 1) {
    errors.push(`${prefix}.promptAdoptions must be one for allowed cases`);
  }
  return errors;
}

export function validateReturnCovenantPlan(plan) {
  const errors = [];
  if (!isObject(plan)) return ['plan must be an object'];
  if (plan.schema !== RETURN_COVENANT_PLAN_SCHEMA) {
    errors.push(`schema must be ${RETURN_COVENANT_PLAN_SCHEMA}`);
  }
  if (plan.rowId !== RETURN_COVENANT_ROW_ID) {
    errors.push(`rowId must be ${RETURN_COVENANT_ROW_ID}`);
  }
  if (typeof plan.runId !== 'string' || plan.runId.length < 8) {
    errors.push('runId must be a non-empty synthetic identifier');
  }
  for (const name of ['candidateSha', 'runtimeBuildSha', 'docsHarnessSha']) {
    if (!SHA_40.test(plan.target?.[name] || '')) {
      errors.push(`target.${name} must be a full lowercase SHA`);
    }
  }
  if (
    SHA_40.test(plan.target?.candidateSha || '') &&
    plan.target.runtimeBuildSha !== plan.target.candidateSha
  ) {
    errors.push('target.runtimeBuildSha must equal target.candidateSha');
  }
  if (
    plan.driver?.schema !== RETURN_COVENANT_DRIVER_SCHEMA ||
    plan.driver?.ownership !== 'product'
  ) {
    errors.push('driver must declare the product-owned v1 fixture protocol');
  }
  if (!['available', 'missing-product-seam'].includes(plan.driver?.fixtureCommand?.status)) {
    errors.push('driver.fixtureCommand.status must declare availability');
  }
  if (
    plan.driver?.fixtureCommand?.status === 'available' &&
    (
      typeof plan.driver.fixtureCommand.relativePath !== 'string' ||
      plan.driver.fixtureCommand.relativePath.length === 0
    )
  ) {
    errors.push('an available fixture command must have a product-relative path');
  }
  if (
    !Number.isInteger(plan.settlementWindowMs) ||
    plan.settlementWindowMs < 1_000 ||
    plan.settlementWindowMs > 120_000
  ) {
    errors.push('settlementWindowMs must be bounded between 1000 and 120000');
  }
  for (const name of ['home', 'state', 'config']) {
    if (plan.isolation?.[name] !== 'temporary-isolated') {
      errors.push(`isolation.${name} must be temporary-isolated`);
    }
  }
  if (plan.isolation?.syntheticData !== true) {
    errors.push('isolation.syntheticData must be true');
  }
  if (typeof plan.syntheticChannelKey !== 'string' || plan.syntheticChannelKey.length < 8) {
    errors.push('syntheticChannelKey must name deterministic synthetic channel data');
  }

  if (!Array.isArray(plan.cases)) {
    errors.push('cases must be an array');
    return errors;
  }
  const counts = new Map();
  const profiles = new Set();
  for (const [index, entry] of plan.cases.entries()) {
    const prefix = `cases[${index}]`;
    const expected = CASE_BY_ID.get(entry?.id);
    counts.set(entry?.id, (counts.get(entry?.id) || 0) + 1);
    if (!expected) {
      errors.push(`${prefix}.id is not a required authority case`);
      continue;
    }
    if (entry.kind !== expected.kind) {
      errors.push(`${prefix}.kind must be ${expected.kind}`);
    }
    if (entry.lifecycleEdge !== expected.lifecycleEdge) {
      errors.push(`${prefix}.lifecycleEdge must be ${expected.lifecycleEdge}`);
    }
    if (!RETURN_MODES.has(entry.returnMode)) {
      errors.push(`${prefix}.returnMode is invalid`);
    }
    if (typeof entry.logicalSessionKey !== 'string' || entry.logicalSessionKey.length < 8) {
      errors.push(`${prefix}.logicalSessionKey must be deterministic synthetic data`);
    }
    if (!sameSet(entry.forms || [], RETURN_COVENANT_FORMS)) {
      errors.push(`${prefix}.forms must contain typed-tool and bracket-token exactly once`);
    }
    const profile = RETURN_COVENANT_DATABASE_PROFILES[entry.databaseProfile];
    if (!profile) {
      errors.push(`${prefix}.databaseProfile is invalid`);
    } else {
      profiles.add(entry.databaseProfile);
    }
    for (const form of RETURN_COVENANT_FORMS) {
      errors.push(...effectErrors(
        entry.expectedEffects?.[form],
        `${prefix}.expectedEffects.${form}`,
        entry.kind === 'forbidden',
      ));
    }
    const restartExpected = entry.id === 'allowed-gateway-restart-replay';
    if (entry.restartBetweenAcceptanceAndRelease !== restartExpected) {
      errors.push(
        `${prefix}.restartBetweenAcceptanceAndRelease must be ${restartExpected}`,
      );
    }
    if (
      entry.id === 'forbidden-explicit-revocation' &&
      entry.applicability !== 'required-if-exposed'
    ) {
      errors.push(`${prefix}.applicability must be required-if-exposed`);
    }
  }
  for (const definition of RETURN_COVENANT_CASES) {
    if ((counts.get(definition.id) || 0) !== 1) {
      errors.push(`case ${definition.id} must appear exactly once`);
    }
  }
  for (const profile of Object.keys(RETURN_COVENANT_DATABASE_PROFILES)) {
    if (!profiles.has(profile)) {
      errors.push(`database profile ${profile} must be covered`);
    }
  }
  return errors;
}

export function assertExecutableReturnCovenantPlan(plan) {
  const errors = validateReturnCovenantPlan(plan);
  if (plan?.driver?.fixtureCommand?.status !== 'available') {
    errors.push('product-owned fixture command is not available');
  }
  if (errors.length > 0) {
    throw new Error(`return covenant plan is not executable: ${errors.join('; ')}`);
  }
  return plan;
}

export function expandReturnCovenantExecutions(plan) {
  return plan.cases.flatMap((entry) =>
    entry.forms.map((form) => ({
      caseId: entry.id,
      form,
      kind: entry.kind,
      lifecycleEdge: entry.lifecycleEdge,
      returnMode: entry.returnMode,
      databaseProfile: entry.databaseProfile,
      expectedEffects: entry.expectedEffects[form],
      testCase: entry,
    })));
}

export function returnCovenantExecutionKey(caseId, form) {
  return `${caseId}:${form}`;
}

export function buildReturnCovenantDriverRequest({
  phase,
  plan,
  execution,
  caseHandle,
  acceptance,
  transition,
}) {
  const common = {
    schema: RETURN_COVENANT_DRIVER_SCHEMA,
    runId: plan.runId,
    rowId: plan.rowId,
    phase,
    caseId: execution.caseId,
    form: execution.form,
    candidateSha: plan.target.candidateSha,
    docsHarnessSha: plan.target.docsHarnessSha,
  };
  if (phase === 'prepare') {
    return {
      ...common,
      databaseProfile: execution.databaseProfile,
      logicalSessionKey: execution.testCase.logicalSessionKey,
      syntheticChannelKey: plan.syntheticChannelKey,
      returnMode: execution.returnMode,
      expectedEffects: execution.expectedEffects,
      settlementWindowMs: plan.settlementWindowMs,
    };
  }
  if (typeof caseHandle !== 'string' || caseHandle.length === 0) {
    throw new Error(`${phase} requires a prepared case handle`);
  }
  if (phase === 'dispatch') {
    return {
      ...common,
      caseHandle,
      holdCompletion: true,
    };
  }
  if (phase === 'cleanup') {
    return {
      ...common,
      caseHandle,
      settlementWindowMs: plan.settlementWindowMs,
    };
  }
  if (
    !acceptance?.accepted ||
    !acceptance?.completionHeld ||
    typeof acceptance?.receiptId !== 'string' ||
    typeof acceptance?.capturedAuthorityGeneration !== 'string'
  ) {
    throw new Error(`${phase} requires an accepted held dispatch receipt`);
  }
  if (phase === 'transition') {
    return {
      ...common,
      caseHandle,
      acceptedDispatchReceiptId: acceptance.receiptId,
      capturedAuthorityGeneration: acceptance.capturedAuthorityGeneration,
      lifecycleEdge: execution.lifecycleEdge,
      restartBetweenAcceptanceAndRelease:
        execution.testCase.restartBetweenAcceptanceAndRelease,
    };
  }
  if (
    phase === 'observe' &&
    (
      transition?.lifecycleOccurred !== true ||
      transition?.acceptedDispatchReceiptId !== acceptance.receiptId
    )
  ) {
    throw new Error('observe requires the bound recipient lifecycle transition');
  }
  if (
    phase === 'release' &&
    (
      transition?.lifecycleOccurred !== true ||
      transition?.acceptedDispatchReceiptId !== acceptance.receiptId ||
      transition?.capturedAuthorityGeneration !==
        acceptance.capturedAuthorityGeneration
    )
  ) {
    throw new Error('release requires the bound recipient lifecycle transition');
  }
  if (phase === 'release') {
    return {
      ...common,
      caseHandle,
      acceptedDispatchReceiptId: acceptance.receiptId,
      heldResultId: acceptance.heldResultId,
      capturedAuthorityGeneration: acceptance.capturedAuthorityGeneration,
      transitionReceiptId: transition.receiptId,
    };
  }
  if (phase === 'observe') {
    return {
      ...common,
      caseHandle,
      settlementWindowMs: plan.settlementWindowMs,
    };
  }
  throw new Error(`unsupported return covenant driver phase: ${phase}`);
}
