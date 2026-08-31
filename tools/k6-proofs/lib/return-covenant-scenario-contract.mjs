import {
  validateReturnCovenantRuntimeArtifactBinding,
  validateReturnCovenantRuntimeMountObservation,
} from './return-covenant-runtime-artifact-contract.mjs';

export const RETURN_COVENANT_ROW_ID = 'R-CD-RETURN-COVENANT-AUTHORITY';
export const RETURN_COVENANT_PLAN_SCHEMA =
  'openclaw.k6.return-covenant-fixture-input.v1';
export const RETURN_COVENANT_DRIVER_SCHEMA =
  'openclaw.k6.return-covenant-fixture-driver.v1';
export const RETURN_COVENANT_DRIVER_ATTESTATION_SCHEMA =
  'openclaw.k6.return-covenant-driver-attestation.v1';
export const RETURN_COVENANT_EVIDENCE_PREFIX =
  'R_CD_RETURN_COVENANT_AUTHORITY_EVIDENCE ';
export const RETURN_COVENANT_TEARDOWN_PREFIX =
  'R_CD_RETURN_COVENANT_AUTHORITY_TEARDOWN ';
export const RETURN_COVENANT_RETENTION_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-retention-observation.v1';
export const RETURN_COVENANT_RETENTION_REQUEST_SCHEMA =
  'openclaw.k6.return-covenant-retention-request.v1';
export const RETURN_COVENANT_RETENTION_RESPONSE_SCHEMA =
  'openclaw.k6.return-covenant-retention-response.v1';
export const RETURN_COVENANT_FORMS = Object.freeze([
  'typed-tool',
  'bracket-token',
]);
export const RETURN_COVENANT_RETENTION_RESOURCES = Object.freeze([
  Object.freeze({
    category: 'delegates',
    method: 'continuation.delegates.list',
  }),
  Object.freeze({
    category: 'queueItems',
    method: 'continuation.queue.list',
  }),
  Object.freeze({
    category: 'temporarySessions',
    method: 'sessions.list',
  }),
]);
export const RETURN_COVENANT_RETENTION_QUERY_LIMIT = 101;

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
const SHA_256 = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const RUN_ID = /^rcv-[a-f0-9]{32}$/u;
const RETURN_MODES = new Set(['normal', 'silent', 'silent-wake', 'post-compaction']);
const CASE_BY_ID = new Map(RETURN_COVENANT_CASES.map((entry) => [entry.id, entry]));
const EFFECT_NAMES = ['promptAdoptions', 'wakes', 'channelDeliveries'];
export const RETURN_COVENANT_MODE_EFFECTS = Object.freeze({
  normal: Object.freeze({
    promptAdoptions: 1,
    wakes: 1,
    channelDeliveries: 1,
  }),
  silent: Object.freeze({
    promptAdoptions: 1,
    wakes: 0,
    channelDeliveries: 0,
  }),
  'silent-wake': Object.freeze({
    promptAdoptions: 1,
    wakes: 1,
    channelDeliveries: 0,
  }),
  'post-compaction': Object.freeze({
    promptAdoptions: 1,
    wakes: 1,
    channelDeliveries: 0,
  }),
});
export const RETURN_COVENANT_ZERO_EFFECTS = Object.freeze({
  promptAdoptions: 0,
  wakes: 0,
  channelDeliveries: 0,
});

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeProductPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/')) {
    return false;
  }
  const normalized = value.split('/').reduce((parts, part) => {
    if (!part || part === '.') return parts;
    if (part === '..') return null;
    if (parts === null) return null;
    return [...parts, part];
  }, []);
  return normalized !== null && normalized.join('/') === value;
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

export function expectedReturnCovenantEffects(testCase) {
  return testCase.kind === 'forbidden'
    ? RETURN_COVENANT_ZERO_EFFECTS
    : RETURN_COVENANT_MODE_EFFECTS[testCase.returnMode];
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
  if (!RUN_ID.test(plan.runId || '')) {
    errors.push('runId must be rcv- followed by a 128-bit lowercase hex nonce');
  }
  for (const name of [
    'candidateSha',
    'productTreeSha',
    'runtimeBuildSha',
    'docsHarnessSha',
  ]) {
    if (!SHA_40.test(plan.target?.[name] || '')) {
      errors.push(`target.${name} must be a full lowercase SHA`);
    }
  }
  for (const name of [
    'runtimeConfigSha256',
    'runtimeArtifactManifestSha256',
  ]) {
    if (!SHA_256.test(plan.target?.[name] || '')) {
      errors.push(`target.${name} must be a SHA-256`);
    }
  }
  if (
    SHA_40.test(plan.target?.candidateSha || '') &&
    plan.target.runtimeBuildSha !== plan.target.candidateSha
  ) {
    errors.push('target.runtimeBuildSha must equal target.candidateSha');
  }
  if (
    plan.driver?.fixtureCommand?.status === 'available' &&
    (
      !safeProductPath(plan.driver?.gatewayCommand?.relativePath) ||
      !SHA_256.test(plan.driver.gatewayCommand.sha256 || '') ||
      !Array.isArray(plan.driver.gatewayCommand.args) ||
      plan.driver.gatewayCommand.args.length !== 1 ||
      plan.driver.gatewayCommand.args[0] !== 'gateway'
    )
  ) {
    errors.push(
      'an available fixture driver must name the candidate gateway command and SHA-256',
    );
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
      !safeProductPath(plan.driver.fixtureCommand.relativePath) ||
      !SHA_256.test(plan.driver.fixtureCommand.sha256 || '')
    )
  ) {
    errors.push(
      'an available fixture command must have a product-relative path and SHA-256',
    );
  }
  if (
    !Number.isInteger(plan.settlementWindowMs) ||
    plan.settlementWindowMs < 1_000 ||
    plan.settlementWindowMs > 30_000
  ) {
    errors.push('settlementWindowMs must be bounded between 1000 and 30000');
  }
  for (const name of ['home', 'state', 'config']) {
    if (plan.isolation?.[name] !== 'temporary-isolated') {
      errors.push(`isolation.${name} must be temporary-isolated`);
    }
  }
  if (plan.isolation?.syntheticData !== true) {
    errors.push('isolation.syntheticData must be true');
  }
  if (plan.syntheticChannelKey !== `synthetic:proof:${plan.runId}:channel`) {
    errors.push('syntheticChannelKey must be derived from the proof run ID');
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
    if (entry.logicalSessionKey !== `agent:proof:${plan.runId}:${entry.id}`) {
      errors.push(`${prefix}.logicalSessionKey must be derived from run and case IDs`);
    }
    if (
      entry.forms?.length !== 2 ||
      entry.forms[0] !== 'typed-tool' ||
      entry.forms[1] !== 'bracket-token'
    ) {
      errors.push(`${prefix}.forms must be ordered typed-tool then bracket-token`);
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
      const immutableEffects = expectedReturnCovenantEffects(entry);
      if (!EFFECT_NAMES.every((name) =>
        entry.expectedEffects?.[form]?.[name] === immutableEffects?.[name])) {
        errors.push(
          `${prefix}.expectedEffects.${form} must match immutable ${entry.returnMode} semantics`,
        );
      }
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

export function validateReturnCovenantDriverAttestation({
  plan,
  attestation,
  endpoint,
}) {
  const errors = [];
  if (attestation?.schema !== RETURN_COVENANT_DRIVER_ATTESTATION_SCHEMA) {
    errors.push('driver attestation schema is invalid');
  }
  for (const name of ['runId', 'rowId']) {
    if (attestation?.[name] !== plan?.[name]) {
      errors.push(`driver attestation ${name} differs from the plan`);
    }
  }
  if (
    attestation?.candidateSha !== plan?.target?.candidateSha ||
    attestation?.productTreeSha !== plan?.target?.productTreeSha ||
    attestation?.runtimeBuildSha !== plan?.target?.runtimeBuildSha ||
    attestation?.docsHarnessSha !== plan?.target?.docsHarnessSha ||
    attestation?.runtimeConfigSha256 !== plan?.target?.runtimeConfigSha256
  ) {
    errors.push('driver attestation target identity differs from the plan');
  }
  if (
    !validateReturnCovenantRuntimeArtifactBinding(
      attestation?.runtimeArtifact,
    ) ||
    attestation.runtimeArtifact.rowId !== plan?.rowId ||
    attestation.runtimeArtifact.runId !== plan?.runId ||
    attestation.runtimeArtifact.productSha !== plan?.target?.candidateSha ||
    attestation.runtimeArtifact.productTreeSha !==
      plan?.target?.productTreeSha ||
    attestation.runtimeArtifact.docsHarnessSha !==
      plan?.target?.docsHarnessSha ||
    attestation.runtimeArtifact.manifestSha256 !==
      plan?.target?.runtimeArtifactManifestSha256
  ) {
    errors.push('runtime artifact is not bound to the exact plan');
  }
  if (
    !validateReturnCovenantRuntimeMountObservation(
      attestation?.runtimeMountObservation,
      attestation?.runtimeArtifact,
    )
  ) {
    errors.push('runtime artifact read-only mount observation is invalid');
  }
  if (
    attestation?.command?.relativePath !==
      plan?.driver?.fixtureCommand?.relativePath ||
    attestation?.command?.sha256 !== plan?.driver?.fixtureCommand?.sha256 ||
    !GIT_OBJECT_ID.test(attestation?.command?.gitBlob || '') ||
    attestation?.command?.trackedAtCandidate !== true ||
    attestation?.command?.workingTreeMatchesCandidate !== true
  ) {
    errors.push('driver command is not bound to the exact product tree');
  }
  if (
    attestation?.gatewayCommand?.relativePath !==
      plan?.driver?.gatewayCommand?.relativePath ||
    attestation?.gatewayCommand?.sha256 !== plan?.driver?.gatewayCommand?.sha256 ||
    JSON.stringify(attestation?.gatewayCommand?.args) !==
      JSON.stringify(plan?.driver?.gatewayCommand?.args) ||
    !GIT_OBJECT_ID.test(attestation?.gatewayCommand?.gitBlob || '') ||
    attestation?.gatewayCommand?.trackedAtCandidate !== true ||
    attestation?.gatewayCommand?.workingTreeMatchesCandidate !== true
  ) {
    errors.push('gateway command is not bound to the exact product tree');
  }
  if (
    attestation?.source?.headSha !== plan?.target?.candidateSha ||
    attestation?.source?.treeSha !== plan?.target?.productTreeSha ||
    attestation?.source?.docsHeadSha !== plan?.target?.docsHarnessSha ||
    attestation?.source?.trackedWorktreeClean !== true ||
    attestation?.source?.docsHarnessClean !== true
  ) {
    errors.push('driver source or docs harness identity is not frozen');
  }
  if (
    attestation?.process?.commandContainsVerifiedDriver !== true ||
    attestation?.process?.endpointOwnedByVerifiedProcess !== true ||
    !SHA_256.test(attestation?.process?.commandLineFingerprint || '') ||
    !SHA_256.test(attestation?.process?.startFingerprint || '') ||
    !SHA_256.test(attestation?.process?.endpointSocketFingerprint || '')
    ||
    !Array.isArray(attestation?.process?.listenerFingerprints) ||
    attestation.process.listenerFingerprints.length < 1 ||
    attestation.process.listenerFingerprints.some((value) =>
      !SHA_256.test(value))
  ) {
    errors.push('driver process is not bound to the verified command');
  }
  if (
    attestation?.gateway?.processBound !== true ||
    attestation?.gateway?.runtimeBuildSha !== plan?.target?.runtimeBuildSha ||
    attestation?.gateway?.runtimeConfigSha256 !== plan?.target?.runtimeConfigSha256 ||
    !SHA_256.test(attestation?.gateway?.commandLineFingerprint || '') ||
    !SHA_256.test(
      attestation?.gateway?.currentCommandLineFingerprint || '',
    ) ||
    attestation?.gateway?.commandObservationSource !==
      'trusted-launcher-pre-title-procfs-v1' ||
    !SHA_256.test(attestation?.gateway?.startFingerprint || '') ||
    !SHA_256.test(attestation?.gateway?.configPathFingerprint || '') ||
    !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(
      attestation?.gateway?.endpoint || '',
    ) ||
    !SHA_256.test(attestation?.gateway?.socketFingerprint || '')
    ||
    !Number.isInteger(attestation?.gateway?.namespacePid) ||
    !SHA_256.test(attestation?.gateway?.namespaceStartFingerprint || '')
    ||
    !Array.isArray(attestation?.gateway?.listenerFingerprints) ||
    attestation.gateway.listenerFingerprints.length < 1 ||
    attestation.gateway.listenerFingerprints.some((value) =>
      !SHA_256.test(value))
  ) {
    errors.push('isolated gateway process or runtime config is not bound');
  }
  if (
    attestation?.revocationCapability?.schema !==
      'openclaw.k6.return-covenant-capability-inventory.v1' ||
    attestation?.revocationCapability?.source !== 'product-owned' ||
    attestation?.revocationCapability?.productSha !== plan?.target?.candidateSha ||
    attestation?.revocationCapability?.runtimeBuildSha !==
      plan?.target?.runtimeBuildSha ||
    attestation?.revocationCapability?.runtimeConfigSha256 !==
      plan?.target?.runtimeConfigSha256 ||
    attestation?.revocationCapability?.inventoryComplete !== true ||
    typeof attestation?.revocationCapability?.revocationApiExposed !== 'boolean' ||
    typeof attestation?.revocationCapability?.surface !== 'string' ||
    attestation.revocationCapability.surface.length < 8 ||
    typeof attestation?.revocationCapability?.receiptId !== 'string' ||
    attestation.revocationCapability.receiptId.length < 8
  ) {
    errors.push('run-wide revocation capability inventory is not bound');
  }
  if (
    !SHA_256.test(attestation?.attestationSha256 || '') ||
    !SHA_256.test(attestation?.readyReceiptSha256 || '') ||
    !SHA_256.test(attestation?.launchNonceFingerprint || '') ||
    typeof attestation?.phaseChallenge !== 'string' ||
    attestation.phaseChallenge.length < 24 ||
    typeof attestation?.phaseSigningKey !== 'string' ||
    attestation.phaseSigningKey.length < 32 ||
    !SHA_256.test(attestation?.phaseKeyFingerprint || '')
  ) {
    errors.push('driver ready receipt is not bound');
  }
  if (
    attestation?.launcher?.createdByTrustedLauncher !== true ||
    !SHA_256.test(attestation?.launcher?.launcherProcessFingerprint || '') ||
    !SHA_256.test(attestation?.launcher?.snapshotFingerprint || '') ||
    !SHA_256.test(attestation?.launcher?.observerKeyFingerprint || '') ||
    attestation?.isolation?.createdByTrustedLauncher !== true ||
    !Number.isInteger(attestation?.isolation?.driverPid) ||
    !Number.isInteger(attestation?.isolation?.gatewayPid) ||
    !Number.isInteger(attestation?.isolation?.processGroupId) ||
    !Number.isInteger(attestation?.isolation?.sandboxPid) ||
    !SHA_256.test(attestation?.isolation?.sandboxStartFingerprint || '') ||
    !Number.isInteger(attestation?.isolation?.namespaceDriverPid) ||
    !Number.isInteger(attestation?.isolation?.namespaceGatewayPid) ||
    !SHA_256.test(
      attestation?.isolation?.namespaceDriverStartFingerprint || '',
    ) ||
    !SHA_256.test(
      attestation?.isolation?.namespaceGatewayStartFingerprint || '',
    ) ||
    attestation.isolation.driverPid === attestation.isolation.gatewayPid ||
    !SHA_256.test(attestation?.isolation?.runRootFingerprint || '') ||
    !SHA_256.test(attestation?.isolation?.homeFingerprint || '') ||
    !SHA_256.test(attestation?.isolation?.stateFingerprint || '') ||
    !SHA_256.test(attestation?.isolation?.configFingerprint || '') ||
    !SHA_256.test(attestation?.isolation?.snapshotFingerprint || '') ||
    !SHA_256.test(
      attestation?.isolation?.runtimeArtifactFingerprint || '',
    ) ||
    typeof attestation?.isolation?.runtimeArtifactPath !== 'string' ||
    attestation.isolation.runtimeArtifactPath.length < 1 ||
    !SHA_256.test(attestation?.isolation?.driverStartFingerprint || '') ||
    !SHA_256.test(attestation?.isolation?.gatewayStartFingerprint || '')
  ) {
    errors.push('trusted launcher isolation receipt is incomplete');
  }
  if (attestation?.endpoint !== endpoint) {
    errors.push('driver endpoint differs from its verified attestation');
  }
  return errors;
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
    kind: execution.kind,
    lifecycleEdge: execution.lifecycleEdge,
    candidateSha: plan.target.candidateSha,
    productTreeSha: plan.target.productTreeSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    runtimeArtifactManifestSha256:
      plan.target.runtimeArtifactManifestSha256,
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
    acceptance.receiptId.length < 8 ||
    typeof acceptance?.heldResultId !== 'string' ||
    acceptance.heldResultId.length < 8 ||
    typeof acceptance?.capturedAuthorityGeneration !== 'string' ||
    acceptance.capturedAuthorityGeneration.length < 16 ||
    typeof acceptance?.resultMarker !== 'string' ||
    acceptance.resultMarker.length < 24
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
      resultMarker: acceptance.resultMarker,
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

export function buildReturnCovenantRunCleanupRequest(plan, bindings = {}) {
  return {
    schema: RETURN_COVENANT_DRIVER_SCHEMA,
    runId: plan.runId,
    rowId: plan.rowId,
    phase: 'cleanup-run',
    candidateSha: plan.target.candidateSha,
    productTreeSha: plan.target.productTreeSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    runtimeArtifactManifestSha256:
      plan.target.runtimeArtifactManifestSha256,
    ...(bindings.fallback === true
      ? { fallback: true }
      : {
        observationSetSha256: bindings.observationSetSha256,
        phaseChainSha256: bindings.phaseChainSha256,
        driverAttestationSha256: bindings.driverAttestationSha256,
      }),
  };
}

export function buildReturnCovenantRetentionRequest({
  plan,
  evidence,
  requestNonce,
}) {
  return {
    schema: RETURN_COVENANT_RETENTION_REQUEST_SCHEMA,
    rowId: plan.rowId,
    runId: plan.runId,
    candidateSha: plan.target.candidateSha,
    productTreeSha: plan.target.productTreeSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    runtimeArtifactManifestSha256:
      plan.target.runtimeArtifactManifestSha256,
    driverAttestationSha256: evidence.driverAttestationSha256,
    observationSetSha256: evidence.cleanupRun.observationSetSha256,
    phaseChainSha256: evidence.cleanupRun.phaseChainSha256,
    cleanupRunReceiptId: evidence.cleanupRun.receiptId,
    requestNonce,
    caseForms: evidence.phaseChains.map((chain) => ({
      caseId: chain.caseId,
      form: chain.form,
      caseHandle: chain.caseHandle,
    })),
    resources: RETURN_COVENANT_RETENTION_RESOURCES.map((entry) => ({
      ...entry,
      limit: RETURN_COVENANT_RETENTION_QUERY_LIMIT,
    })),
  };
}
