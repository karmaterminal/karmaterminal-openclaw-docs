import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createReturnCovenantDriverAttestation,
  RETURN_COVENANT_DRIVER_READY_SCHEMA,
  verifyReturnCovenantDirectCleanup,
} from '../../lib/return-covenant-driver-attestation.mjs';
import {
  readBoundedCandidateJson,
} from '../../lib/return-covenant-candidate-io.mjs';
import {
  parseReturnCovenantEvidenceLog,
  resolveReturnCovenantAuthoritativeReceipt as resolveRawReturnCovenantReceipt,
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_INTEGRITY_ALGORITHM,
  RETURN_COVENANT_TEARDOWN_PREFIX,
  validateReturnCovenantAuthoritativeReceipt,
  validateReturnCovenantCleanup,
  validateReturnCovenantObservation,
  validateReturnCovenantObservationSet,
} from '../../lib/return-covenant-authoritative-receipt.mjs';
import {
  assertExecutableReturnCovenantPlan,
  buildReturnCovenantDriverRequest,
  expandReturnCovenantExecutions,
  RETURN_COVENANT_DATABASE_PROFILES,
  RETURN_COVENANT_DRIVER_SCHEMA,
  returnCovenantExecutionKey,
  validateReturnCovenantPlan,
} from '../../lib/return-covenant-scenario-contract.mjs';
import {
  evaluateIsolatedRuntimePlugin,
} from '../../lib/isolated-runtime-plugin-contract.mjs';
import {
  canonicalJson,
  sealSignedObserverReceipt,
} from '../../lib/signed-observer-receipt.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixtures = path.join(root, 'tests/fixtures/return-covenant-authority');
const signingKey = 'synthetic-observer-signing-key-at-least-32-characters';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function jsonSha256(value) {
  return sha256(canonicalJson(value));
}

async function fixture(name) {
  return JSON.parse(await readFile(path.join(fixtures, name), 'utf8'));
}

const TRUSTED_HARNESS_FILES = [
  'contracts/return-covenant-authority/scenario.js',
  'k6-proof-binaries.json',
  'lib/canonical-json.mjs',
  'lib/isolated-runtime-plugin-contract.mjs',
  'lib/return-covenant-authoritative-receipt.mjs',
  'lib/return-covenant-candidate-io.mjs',
  'lib/return-covenant-driver-attestation.mjs',
  'lib/return-covenant-scenario-contract.mjs',
  'lib/signed-observer-receipt.mjs',
  'scripts/launch-return-covenant-driver.mjs',
  'scripts/run-return-covenant-sandbox.mjs',
];

async function copyTrustedHarness(targetRoot) {
  for (const relative of TRUSTED_HARNESS_FILES) {
    const target = path.join(targetRoot, 'tools/k6-proofs', relative);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, await readFile(path.join(root, relative)), {
      mode: relative.endsWith('/launch-return-covenant-driver.mjs')
        ? 0o700
        : 0o600,
    });
  }
}

function executionFor(plan, caseId, form) {
  return expandReturnCovenantExecutions(plan)
    .find((entry) => entry.caseId === caseId && entry.form === form);
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  const final = parts.pop();
  let cursor = target;
  for (const part of parts) cursor = cursor[part];
  cursor[final] = value;
}

const forbiddenAdmission = {
  'forbidden-delete-recreate': 'stale',
  'forbidden-owner-reassignment': 'unauthorized',
  'forbidden-member-access-removal': 'unauthorized',
  'forbidden-restrictive-visibility': 'unauthorized',
  'forbidden-explicit-revocation': 'revoked',
};

function generatedObservation({ execution, allowedBase, forbiddenBase, index }) {
  const observation = structuredClone(execution.kind === 'allowed' ? allowedBase : forbiddenBase);
  const key = returnCovenantExecutionKey(execution.caseId, execution.form);
  const profile = RETURN_COVENANT_DATABASE_PROFILES[execution.databaseProfile];
  const captured = `captured-generation-${key}`;
  const resultMarker = `RCV-${sha256(key).slice(0, 32)}`;
  const caseHandle = `case-handle-${key}`;
  observation.caseId = execution.caseId;
  observation.runId = execution.plan.runId;
  observation.form = execution.form;
  observation.kind = execution.kind;
  observation.candidateSha = execution.plan.target.candidateSha;
  observation.runtimeBuildSha = execution.plan.target.runtimeBuildSha;
  observation.docsHarnessSha = execution.plan.target.docsHarnessSha;
  observation.runtimeConfigSha256 =
    execution.plan.target.runtimeConfigSha256;
  const startedAtMs = Date.UTC(2026, 7, 28, 12, 0, index * 10);
  observation.startedAt = new Date(startedAtMs).toISOString();
  observation.endedAt = new Date(startedAtMs + 6_000).toISOString();
  observation.returnMode = execution.returnMode;
  observation.logicalSessionKey = execution.testCase.logicalSessionKey;
  observation.caseHandle = caseHandle;
  observation.database = {
    profile: execution.databaseProfile,
    sourceSchemaVersion: profile.sourceSchemaVersion,
    targetSchemaVersion: profile.targetSchemaVersion,
    fixtureShape: profile.fixtureShape,
    productOwnedFixture: true,
    canonicalFixtureReceiptId: `fixture-receipt-${key}`,
    freshInstall: profile.sourceSchemaVersion === null,
    migrationApplied: profile.sourceSchemaVersion === 18,
    reopenIdempotent: execution.databaseProfile === 'idempotent-v19-reopen',
  };
  observation.dispatch = {
    caseHandle,
    prepareReceiptId: observation.database.canonicalFixtureReceiptId,
    accepted: true,
    completionHeld: true,
    receiptId: `dispatch-receipt-${key}`,
    heldResultId: `held-result-${key}`,
    capturedAuthorityGeneration: captured,
    resultMarker,
    originEvidence: {
      source: 'product-owned',
      observedForm: execution.form,
      receiptId: `origin-receipt-${key}`,
      typedToolExecutions: execution.form === 'typed-tool' ? 1 : 0,
      bracketParses: execution.form === 'bracket-token' ? 1 : 0,
      rawFinalText: execution.form === 'bracket-token',
    },
  };
  observation.lifecycle = {
    edge: execution.lifecycleEdge,
    occurredAfterAcceptance: true,
    completedBeforeRelease: true,
    preSessionId: execution.caseId === 'allowed-late-materialization'
      ? null
      : `pre-session-${key}`,
    postSessionId: `post-session-${key}`,
    successorIdentity: `successor-${key}`,
    receiptId: `lifecycle-receipt-${key}`,
    acceptedDispatchReceiptId: observation.dispatch.receiptId,
    generationAdvanced: execution.kind === 'forbidden',
    effectiveAuthorityUnchanged: execution.kind === 'allowed',
    ...(execution.caseId === 'forbidden-delete-recreate'
      ? {
        operations: {
          deletionObserved: true,
          deletionReceiptId: `delete-operation-receipt-${key}`,
          recreationObserved: true,
          recreationReceiptId: `recreate-operation-receipt-${key}`,
        },
      }
      : {}),
    ...(execution.caseId === 'allowed-gateway-restart-replay'
      ? {
        restart: {
          stoppedAfterAcceptance: true,
          restartedBeforeRelease: true,
          replayRecovered: true,
          receiptId: `restart-receipt-${key}`,
        },
      }
      : {}),
  };
  observation.authorityDiagnostic = {
    source: 'product-owned',
    surface: 'diagnostics/continuation/recipient-authority',
    capturedAuthorityGeneration: captured,
    currentAuthorityGeneration: execution.kind === 'allowed'
      ? captured
      : `current-generation-${key}`,
  };
  const admission = execution.kind === 'allowed'
    ? 'adopted'
    : forbiddenAdmission[execution.caseId];
  observation.delivery = {
    acceptedDispatchReceiptId: observation.dispatch.receiptId,
    heldResultAuthorityGeneration: captured,
    caseHandle,
    transitionReceiptId: observation.lifecycle.receiptId,
    releaseReceiptId: `release-receipt-${key}`,
    resultReleased: true,
    admission,
    queue: {
      recordId: `queue-record-${key}`,
      status: execution.kind === 'allowed'
        ? 'adopted'
        : `${admission}-acknowledged`,
      acknowledged: true,
      removed: true,
      retryScheduled: false,
    },
  };
  observation.effects.expected = { ...execution.expectedEffects };
  observation.effects.observed = { ...execution.expectedEffects };
  observation.settlement = {
    bounded: true,
    complete: true,
    windowMs: 5000,
    releasedAt: new Date(startedAtMs + 500).toISOString(),
    scansCompletedAt: new Date(startedAtMs + 5_500).toISOString(),
    elapsedMs: 5000,
    monotonicElapsedMs: 5000,
  };
  observation.scans = {
    resultMarker,
    successorTranscript: {
      source: 'product-owned',
      marker: resultMarker,
      matches: 0,
      receiptId: `transcript-scan-receipt-${key}`,
    },
    trustedSystemEvents: {
      source: 'product-owned',
      marker: resultMarker,
      matches: 0,
      receiptId: `system-event-scan-receipt-${key}`,
    },
  };
  observation.resultMarker = resultMarker;
  return observation;
}

function phaseChainFor(observation) {
  const releasedAtMs = Date.parse(observation.settlement.releasedAt);
  const observedAtMs = releasedAtMs + observation.settlement.windowMs;
  return {
    caseId: observation.caseId,
    form: observation.form,
    caseHandle: observation.caseHandle,
    harnessTiming: {
      releasedAtMs,
      observedAtMs,
      elapsedMs: observedAtMs - releasedAtMs,
    },
    prepare: {
      caseHandle: observation.caseHandle,
      receiptId: observation.database.canonicalFixtureReceiptId,
    },
    dispatch: {
      caseHandle: observation.caseHandle,
      prepareReceiptId: observation.database.canonicalFixtureReceiptId,
      accepted: true,
      completionHeld: true,
      receiptId: observation.dispatch.receiptId,
      heldResultId: observation.dispatch.heldResultId,
      resultMarker: observation.resultMarker,
      capturedAuthorityGeneration:
        observation.dispatch.capturedAuthorityGeneration,
      originEvidence: structuredClone(observation.dispatch.originEvidence),
    },
    transition: {
      caseHandle: observation.caseHandle,
      lifecycleOccurred: true,
      receiptId: observation.lifecycle.receiptId,
      acceptedDispatchReceiptId: observation.dispatch.receiptId,
      capturedAuthorityGeneration:
        observation.dispatch.capturedAuthorityGeneration,
      ...(observation.lifecycle.restart
        ? { restartReceiptId: observation.lifecycle.restart.receiptId }
        : {}),
      ...(observation.lifecycle.operations
        ? { operations: structuredClone(observation.lifecycle.operations) }
        : {}),
    },
    release: {
      caseHandle: observation.caseHandle,
      released: true,
      receiptId: observation.delivery.releaseReceiptId,
      transitionReceiptId: observation.lifecycle.receiptId,
      acceptedDispatchReceiptId: observation.dispatch.receiptId,
      heldResultId: observation.dispatch.heldResultId,
      resultMarker: observation.resultMarker,
      capturedAuthorityGeneration:
        observation.dispatch.capturedAuthorityGeneration,
    },
    cleanup: {
      caseHandle: observation.caseHandle,
      closed: true,
      receiptId: `case-cleanup-receipt-${observation.caseId}-${observation.form}`,
    },
  };
}

function driverAttestationFor(plan) {
  const unsigned = {
    schema: 'openclaw.k6.return-covenant-driver-attestation.v1',
    runId: plan.runId,
    rowId: plan.rowId,
    candidateSha: plan.target.candidateSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    endpoint: 'http://127.0.0.1:18790',
    command: {
      relativePath: plan.driver.fixtureCommand.relativePath,
      sha256: plan.driver.fixtureCommand.sha256,
      gitBlob: 'b'.repeat(40),
      trackedAtCandidate: true,
      workingTreeMatchesCandidate: true,
    },
    gatewayCommand: {
      relativePath: plan.driver.gatewayCommand.relativePath,
      sha256: plan.driver.gatewayCommand.sha256,
      gitBlob: 'b'.repeat(40),
      args: plan.driver.gatewayCommand.args,
      trackedAtCandidate: true,
      workingTreeMatchesCandidate: true,
    },
    source: {
      headSha: plan.target.candidateSha,
      docsHeadSha: plan.target.docsHarnessSha,
      trackedWorktreeClean: true,
      docsHarnessClean: true,
    },
    process: {
      commandContainsVerifiedDriver: true,
      endpointOwnedByVerifiedProcess: true,
      commandLineFingerprint: 'c'.repeat(64),
      startFingerprint: 'd'.repeat(64),
      endpointSocketFingerprint: 'a'.repeat(64),
      listenerFingerprints: ['a'.repeat(64)],
    },
    gateway: {
      processBound: true,
      commandLineFingerprint: '1'.repeat(64),
      startFingerprint: '2'.repeat(64),
      runtimeBuildSha: plan.target.runtimeBuildSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      configPathFingerprint: '3'.repeat(64),
      endpoint: 'http://127.0.0.1:18791',
      socketFingerprint: '0'.repeat(64),
      listenerFingerprints: ['0'.repeat(64)],
      namespacePid: 2147483001,
      namespaceStartFingerprint: '2'.repeat(64),
    },
    revocationCapability: {
      schema: 'openclaw.k6.return-covenant-capability-inventory.v1',
      source: 'product-owned',
      productSha: plan.target.candidateSha,
      runtimeBuildSha: plan.target.runtimeBuildSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      inventoryComplete: true,
      revocationApiExposed: true,
      surface: 'diagnostics/continuation/capability-inventory',
      receiptId: 'run-wide-revocation-capability-receipt',
    },
    readyReceiptSha256: 'e'.repeat(64),
    launchNonceFingerprint: sha256('synthetic-phase-challenge-at-least-24-chars'),
    phaseChallenge: 'synthetic-phase-challenge-at-least-24-chars',
    phaseSigningKey: 'synthetic-phase-signing-key-at-least-32-characters',
    phaseKeyFingerprint: sha256(
      'synthetic-phase-signing-key-at-least-32-characters',
    ),
    launcher: {
      createdByTrustedLauncher: true,
      launcherProcessFingerprint: '4'.repeat(64),
      snapshotFingerprint: '5'.repeat(64),
      observerKeyFingerprint: sha256(signingKey),
    },
    isolation: {
      runRoot: '/private/synthetic-run',
      homePath: '/private/synthetic-run/home',
      statePath: '/private/synthetic-run/state',
      configPath: '/private/synthetic-run/config/openclaw.json',
      snapshotPath: '/private/synthetic-run/snapshot',
      runRootFingerprint: '6'.repeat(64),
      homeFingerprint: '7'.repeat(64),
      stateFingerprint: '8'.repeat(64),
      configFingerprint: '9'.repeat(64),
      snapshotFingerprint: '5'.repeat(64),
      createdByTrustedLauncher: true,
      driverPid: 2147483000,
      gatewayPid: 2147483001,
      processGroupId: 2147483000,
      sandboxPid: 2147482999,
      sandboxStartFingerprint: 'a'.repeat(64),
      namespaceDriverPid: 2147483000,
      namespaceGatewayPid: 2147483001,
      namespaceDriverStartFingerprint: 'd'.repeat(64),
      namespaceGatewayStartFingerprint: '2'.repeat(64),
      driverStartFingerprint: 'd'.repeat(64),
      gatewayStartFingerprint: '2'.repeat(64),
    },
  };
  return {
    ...unsigned,
    attestationSha256: jsonSha256(unsigned),
  };
}

function signedPhaseProof(driverAttestation, phase, receipt, seed) {
  const requestNonce = sha256(`${phase}:${seed}`);
  const receiptSha256 = jsonSha256(receipt);
  const signatureBase = {
    phase,
    requestNonce,
    receiptSha256,
    attestationSha256: driverAttestation.attestationSha256,
    launchNonceFingerprint: driverAttestation.launchNonceFingerprint,
    processStartFingerprint: driverAttestation.process.startFingerprint,
    endpointSocketFingerprint:
      driverAttestation.process.endpointSocketFingerprint,
    runtimeConfigSha256: driverAttestation.runtimeConfigSha256,
  };
  return {
    ...signatureBase,
    signature: createHmac('sha256', driverAttestation.phaseSigningKey)
      .update(canonicalJson(signatureBase))
      .digest('hex'),
  };
}

function refreshPhaseProofs(evidence, driverAttestation) {
  for (const [index, chain] of evidence.phaseChains.entries()) {
    const observation = evidence.observations.find((entry) =>
      entry.caseId === chain.caseId && entry.form === chain.form);
    const notExposed = observation?.applicability === 'not-exposed';
    const receipts = {
      prepare: {
        prepare: chain.prepare,
        observation: notExposed ? observation : null,
      },
      ...(!notExposed
        ? {
          dispatch: chain.dispatch,
          transition: chain.transition,
          release: chain.release,
          observe: { settled: true, observation },
        }
        : {}),
      cleanup: chain.cleanup,
    };
    chain.proofs = Object.fromEntries(
      Object.entries(receipts).map(([phase, receipt]) => [
        phase,
        signedPhaseProof(driverAttestation, phase, receipt, `${index}:${phase}`),
      ]),
    );
  }
  evidence.cleanupRunProof = signedPhaseProof(
    driverAttestation,
    'cleanup-run',
    evidence.cleanupRun,
    'run-cleanup',
  );
  evidence.teardown = {
    schema: 'openclaw.k6.return-covenant-teardown.v1',
    runId: evidence.runId,
    rowId: evidence.rowId,
    cleanupRunReceiptId: evidence.cleanupRun.receiptId,
    completed: true,
    cleanupRun: evidence.cleanupRun,
    cleanupRunProof: signedPhaseProof(
      driverAttestation,
      'cleanup-run',
      evidence.cleanupRun,
      'teardown-cleanup',
    ),
  };
}

async function completeMatrix(options = {}) {
  const [fixturePlan, allowedBase, forbiddenBase] = await Promise.all([
    options.plan ? Promise.resolve(null) : fixture('plan.valid.json'),
    fixture('allowed-pass.json'),
    fixture('forbidden-pass.json'),
  ]);
  const plan = options.plan || fixturePlan;
  const observations = expandReturnCovenantExecutions(plan)
    .map((execution, index) => generatedObservation({
      execution: { ...execution, plan },
      allowedBase,
      forbiddenBase,
      index,
    }));
  const phaseChains = observations.map(phaseChainFor);
  const driverAttestation =
    options.driverAttestation || driverAttestationFor(plan);
  let replacementIndex = 0;
  let currentGateway = {
    pid: driverAttestation.gateway.namespacePid,
    startFingerprint: driverAttestation.gateway.namespaceStartFingerprint,
    endpoint: driverAttestation.gateway.endpoint,
  };
  for (const [index, observation] of observations.entries()) {
    if (observation.caseId !== 'allowed-gateway-restart-replay') continue;
    const replacement = options.restartProcesses?.[replacementIndex++];
    const replacementGatewayPid = replacement?.pid ?? 2147483100 + index;
    const replacementGateway = {
      pid: replacementGatewayPid,
      startFingerprint:
        replacement?.startFingerprint ??
        sha256(`replacement-gateway:${replacementGatewayPid}`),
      endpoint:
        replacement?.endpoint ?? `http://127.0.0.1:${19000 + index}`,
    };
    observation.lifecycle.restart = {
      ...observation.lifecycle.restart,
      originalGatewayPid: currentGateway.pid,
      originalGatewayStartFingerprint: currentGateway.startFingerprint,
      replacementGatewayPid: replacementGateway.pid,
      replacementGatewayStartFingerprint:
        replacementGateway.startFingerprint,
      gatewayCommandSha256: driverAttestation.gatewayCommand.sha256,
      runtimeConfigSha256: driverAttestation.runtimeConfigSha256,
      processGroupId: driverAttestation.isolation.processGroupId,
      replacementGatewayEndpoint: replacementGateway.endpoint,
    };
    const chain = phaseChains[index];
    chain.transition.restartReceiptId = observation.lifecycle.restart.receiptId;
    chain.transition.restart = structuredClone(observation.lifecycle.restart);
    currentGateway = replacementGateway;
  }
  const result = {
    plan,
    driverAttestation,
    evidence: {
      schema: 'openclaw.k6.return-covenant-observation-set.v1',
      rowId: plan.rowId,
      runId: plan.runId,
      startedAt: '2026-08-28T12:00:00.000Z',
      endedAt: '2026-08-28T12:09:00.000Z',
      observations,
      phaseChains,
      executionErrors: [],
      scenarioFailures: 0,
      driverAttestationSha256: driverAttestation.attestationSha256,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      k6ExitCode: 0,
    },
  };
  const evidence = result.evidence;
  evidence.cleanupRun = {
    completed: true,
    receiptId: 'run-cleanup-receipt-pass',
    observationSetSha256: '',
    phaseChainSha256: '',
    driverAttestationSha256: driverAttestation.attestationSha256,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
  };
  refreshPhaseProofs(evidence, driverAttestation);
  evidence.cleanupRun = {
    ...evidence.cleanupRun,
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
  };
  refreshPhaseProofs(evidence, driverAttestation);
  return result;
}

function bindCleanup(cleanup, evidence, driverAttestation) {
  refreshPhaseProofs(evidence, driverAttestation);
  evidence.cleanupRun = {
    ...evidence.cleanupRun,
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
    driverAttestationSha256: driverAttestation.attestationSha256,
  };
  refreshPhaseProofs(evidence, driverAttestation);
  const {
    launcherIntegrity: _fixtureIntegrity,
    ...cleanupWithoutIntegrity
  } = cleanup;
  const gatewayLifecycle = [
    {
      pid: driverAttestation.isolation.gatewayPid,
      startFingerprint: driverAttestation.gateway.startFingerprint,
      namespacePid: driverAttestation.gateway.namespacePid,
      namespaceStartFingerprint:
        driverAttestation.gateway.namespaceStartFingerprint,
      verified: true,
      endpoints: [driverAttestation.gateway.endpoint],
      socketFingerprint: driverAttestation.gateway.socketFingerprint,
      listenerFingerprints: driverAttestation.gateway.listenerFingerprints,
      verificationSource: 'direct-environ',
    },
    ...evidence.observations
      .filter((entry) => entry.lifecycle?.restart)
      .map((entry) => ({
        pid: entry.lifecycle.restart.replacementGatewayPid,
        startFingerprint:
          entry.lifecycle.restart.replacementGatewayStartFingerprint,
        namespacePid: entry.lifecycle.restart.replacementGatewayPid,
        namespaceStartFingerprint:
          entry.lifecycle.restart.replacementGatewayStartFingerprint,
        verified: true,
        endpoints: [entry.lifecycle.restart.replacementGatewayEndpoint],
        socketFingerprint: sha256(
          entry.lifecycle.restart.replacementGatewayEndpoint,
        ),
        listenerFingerprints: [
          sha256(`listener:${entry.lifecycle.restart.replacementGatewayEndpoint}`),
        ],
        verificationSource: 'namespace-inherited',
      })),
  ].map((entry, index) => ({
    ...entry,
    firstSeenMonotonicMs: index * 10,
    lastSeenMonotonicMs: index * 10 + 5,
    exitedAtMonotonicMs: index * 10 + 9,
  }));
  const unsigned = {
    ...cleanupWithoutIntegrity,
    caseHandles: evidence.phaseChains.map((chain) => chain.caseHandle),
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
    driverAttestationSha256: driverAttestation.attestationSha256,
    snapshotMatchedCandidateAfterRun: true,
    runRootRemoved: true,
    driverExitCode: 0,
    isolationFingerprint: driverAttestation.isolation.runRootFingerprint,
    processGroupEmpty: true,
    unexpectedProcessGroupMembers: 0,
    gatewayLifecycle,
    k6: {
      version: 'k6 v2.0.0',
      sha256: 'a'.repeat(64),
      pathFingerprint: 'b'.repeat(64),
    },
  };
  return {
    ...unsigned,
    launcherIntegrity: {
      algorithm: 'hmac-sha256-launch-key-v1',
      signature: createHmac('sha256', signingKey)
        .update(canonicalJson(unsigned))
        .digest('hex'),
    },
  };
}

function directCleanupFor(driverAttestation) {
  return {
    schema: 'openclaw.k6.return-covenant-direct-cleanup.v1',
    verified: true,
    runRootRemoved: true,
    homeRemoved: true,
    stateRemoved: true,
    configRemoved: true,
    snapshotRemoved: true,
    driverStopped: true,
    gatewayStopped: true,
    sandboxStopped: true,
    processGroupEmpty: true,
    isolationFingerprint: driverAttestation.isolation.runRootFingerprint,
  };
}

function resolveReturnCovenantAuthoritativeReceipt(params) {
  return resolveRawReturnCovenantReceipt({
    ...params,
    directCleanup:
      params.directCleanup || directCleanupFor(params.driverAttestation),
  });
}

function failureCodes(validation) {
  return new Set(validation.errors.map((error) => error.code));
}

function assertClosedSchemaDeclaresRequired(schema, label = '#') {
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    if (schema.additionalProperties === false) {
      for (const name of schema.required || []) {
        assert.ok(
          Object.hasOwn(schema.properties || {}, name),
          `${label} requires undeclared property ${name}`,
        );
      }
    }
    for (const [name, child] of Object.entries(schema)) {
      assertClosedSchemaDeclaresRequired(child, `${label}/${name}`);
    }
  } else if (Array.isArray(schema)) {
    schema.forEach((child, index) =>
      assertClosedSchemaDeclaresRequired(child, `${label}/${index}`));
  }
}

function assertSimpleSchema(schema, value, root, label = '#') {
  if (schema.$ref) {
    const target = schema.$ref
      .replace(/^#\//u, '')
      .split('/')
      .reduce((cursor, key) => cursor[key], root);
    return assertSimpleSchema(target, value, root, label);
  }
  if (Object.hasOwn(schema, 'const')) assert.deepEqual(value, schema.const, label);
  if (schema.type === 'object') {
    assert.equal(value && typeof value === 'object' && !Array.isArray(value), true, label);
    for (const name of schema.required || []) {
      assert.equal(Object.hasOwn(value, name), true, `${label}.${name}`);
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        assert.equal(Object.hasOwn(schema.properties || {}, name), true, `${label}.${name}`);
      }
    }
    for (const [name, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, name)) {
        assertSimpleSchema(child, value[name], root, `${label}.${name}`);
      }
    }
  }
  if (schema.type === 'array') {
    assert.equal(Array.isArray(value), true, label);
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, label);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, label);
    if (schema.uniqueItems) assert.equal(new Set(value).size, value.length, label);
    value.forEach((entry, index) =>
      assertSimpleSchema(schema.items, entry, root, `${label}[${index}]`));
  }
  if (schema.type === 'string') {
    assert.equal(typeof value, 'string', label);
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, label);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern, 'u'), label);
  }
  if (schema.type === 'integer') {
    assert.equal(Number.isInteger(value), true, label);
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, label);
  }
  if (schema.type === 'boolean') assert.equal(typeof value, 'boolean', label);
}

function canonicalReceipt(receipt) {
  const { integrity: _integrity, ...unsigned } = receipt;
  return canonicalJson(unsigned);
}

function resign(receipt) {
  const { integrity: _integrity, ...unsigned } = receipt;
  return sealSignedObserverReceipt({
    receipt: unsigned,
    signingKey,
    canonicalize: canonicalReceipt,
    algorithm: RETURN_COVENANT_INTEGRITY_ALGORITHM,
  });
}

test('fixture input covers every authority edge, schema shape, and both delegate forms', async () => {
  const plan = await fixture('plan.valid.json');
  assert.deepEqual(validateReturnCovenantPlan(plan), []);
  assert.equal(expandReturnCovenantExecutions(plan).length, 24);
  assert.deepEqual(
    [...new Set(plan.cases.map((entry) => entry.databaseProfile))].sort(),
    Object.keys(RETURN_COVENANT_DATABASE_PROFILES).sort(),
  );
  assert.equal(
    plan.cases.filter((entry) => entry.restartBetweenAcceptanceAndRelease).length,
    1,
  );
  assert.equal(assertExecutableReturnCovenantPlan(plan), plan);

  const missingSeam = structuredClone(plan);
  missingSeam.driver.fixtureCommand = { status: 'missing-product-seam' };
  assert.throws(
    () => assertExecutableReturnCovenantPlan(missingSeam),
    /product-owned fixture command is not available/,
  );

  const duplicate = structuredClone(plan);
  duplicate.cases[1].id = duplicate.cases[0].id;
  assert.match(validateReturnCovenantPlan(duplicate).join('\n'), /exactly once/);

  const reversedForms = structuredClone(plan);
  reversedForms.cases[0].forms.reverse();
  assert.match(
    validateReturnCovenantPlan(reversedForms).join('\n'),
    /ordered typed-tool then bracket-token/,
  );
  const duplicateForms = structuredClone(plan);
  duplicateForms.cases[0].forms = ['typed-tool', 'typed-tool'];
  assert.match(
    validateReturnCovenantPlan(duplicateForms).join('\n'),
    /ordered typed-tool then bracket-token/,
  );

  const redefinedSilentWake = structuredClone(plan);
  redefinedSilentWake.cases[0].expectedEffects['typed-tool'].channelDeliveries = 1;
  redefinedSilentWake.cases[0].expectedEffects['bracket-token'].channelDeliveries = 1;
  assert.match(
    validateReturnCovenantPlan(redefinedSilentWake).join('\n'),
    /immutable silent-wake semantics/,
  );
});

test('driver assembly fences transition and release behind accepted held work', async () => {
  const plan = await fixture('plan.valid.json');
  const execution = executionFor(plan, 'allowed-ordinary-new', 'typed-tool');
  const prepared = buildReturnCovenantDriverRequest({ phase: 'prepare', plan, execution });
  assert.equal(prepared.logicalSessionKey, execution.testCase.logicalSessionKey);
  const dispatched = buildReturnCovenantDriverRequest({
    phase: 'dispatch',
    plan,
    execution,
    caseHandle: 'case-handle',
  });
  assert.equal(dispatched.holdCompletion, true);
  assert.throws(
    () => buildReturnCovenantDriverRequest({
      phase: 'transition',
      plan,
      execution,
      caseHandle: 'case-handle',
    }),
    /accepted held dispatch/,
  );
  const acceptance = {
    accepted: true,
    completionHeld: true,
    receiptId: 'accepted-receipt',
    heldResultId: 'held-result',
    capturedAuthorityGeneration: 'captured-generation',
    resultMarker: 'RETURN-COVENANT-DRIVER-ASSEMBLY-MARKER',
  };
  const transitionRequest = buildReturnCovenantDriverRequest({
    phase: 'transition',
    plan,
    execution,
    caseHandle: 'case-handle',
    acceptance,
  });
  assert.equal(transitionRequest.acceptedDispatchReceiptId, acceptance.receiptId);
  assert.throws(
    () => buildReturnCovenantDriverRequest({
      phase: 'release',
      plan,
      execution,
      caseHandle: 'case-handle',
      acceptance,
      transition: {
        lifecycleOccurred: true,
        acceptedDispatchReceiptId: 'wrong-receipt',
        capturedAuthorityGeneration: acceptance.capturedAuthorityGeneration,
      },
    }),
    /bound recipient lifecycle transition/,
  );
  assert.doesNotThrow(() => buildReturnCovenantDriverRequest({
    phase: 'cleanup',
    plan,
    execution,
    caseHandle: 'case-handle',
  }));
});

test('passing allowed and correctly rejected forbidden fixtures validate', async () => {
  const plan = await fixture('plan.valid.json');
  const allowed = await fixture('allowed-pass.json');
  const forbidden = await fixture('forbidden-pass.json');
  assert.deepEqual(
    validateReturnCovenantObservation({
      observation: allowed,
      plan,
      execution: executionFor(plan, allowed.caseId, allowed.form),
      phaseChain: phaseChainFor(allowed),
    }),
    { valid: true, errors: [] },
  );
  assert.deepEqual(
    validateReturnCovenantObservation({
      observation: forbidden,
      plan,
      execution: executionFor(plan, forbidden.caseId, forbidden.form),
      phaseChain: phaseChainFor(forbidden),
    }),
    { valid: true, errors: [] },
  );
});

test('stale prompt, wake, and channel effects each fail independently', async (t) => {
  const plan = await fixture('plan.valid.json');
  for (const name of [
    'control-stale-prompt-adoption.json',
    'control-stale-wake.json',
    'control-stale-channel-delivery.json',
  ]) {
    await t.test(name, async () => {
      const control = await fixture(name);
      const observation = await fixture(control.baseFixture);
      for (const mutation of control.mutations) {
        setPath(observation, mutation.path, mutation.value);
      }
      const validation = validateReturnCovenantObservation({
        observation,
        plan,
        execution: executionFor(plan, observation.caseId, observation.form),
        phaseChain: phaseChainFor(observation),
      });
      assert.equal(validation.valid, false);
      assert.ok(failureCodes(validation).has(control.expectedFailure));
    });
  }
});

test('product SHA and authority-generation mismatches fail closed', async () => {
  const plan = await fixture('plan.valid.json');
  const control = await fixture('control-identity-generation-mismatch.json');
  const observation = await fixture(control.baseFixture);
  for (const mutation of control.mutations) {
    setPath(observation, mutation.path, mutation.value);
  }
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain: phaseChainFor(observation),
  });

  assert.equal(validation.valid, false);
  for (const expected of control.expectedFailures) {
    assert.ok(failureCodes(validation).has(expected));
  }
});

test('empty phase identities and a missing result marker fail closed', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('allowed-pass.json');
  const phaseChain = phaseChainFor(observation);
  observation.dispatch.receiptId = '';
  observation.dispatch.resultMarker = '';
  observation.resultMarker = '';
  phaseChain.dispatch.receiptId = '';
  phaseChain.dispatch.resultMarker = '';
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });
  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('dispatch-not-held'));
});

test('bracket form cannot be relabeled typed execution evidence', async () => {
  const { plan, evidence } = await completeMatrix();
  const observation = evidence.observations.find((entry) =>
    entry.caseId === 'allowed-ordinary-new' && entry.form === 'bracket-token');
  const phaseChain = evidence.phaseChains.find((entry) =>
    entry.caseId === observation.caseId && entry.form === observation.form);
  observation.dispatch.originEvidence.observedForm = 'typed-tool';
  observation.dispatch.originEvidence.typedToolExecutions = 1;
  observation.dispatch.originEvidence.bracketParses = 0;
  observation.dispatch.originEvidence.rawFinalText = false;
  phaseChain.dispatch.originEvidence =
    structuredClone(observation.dispatch.originEvidence);
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });

  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('origin-form-mismatch'));
});

test('sealed phase origin cannot contradict the final observation', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('allowed-pass.json');
  const phaseChain = phaseChainFor(observation);
  phaseChain.dispatch.originEvidence.source = 'untrusted';
  phaseChain.dispatch.originEvidence.rawFinalText = true;
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });
  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('origin-form-mismatch'));
});

test('reported settlement cannot substitute for elapsed observer time', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('allowed-pass.json');
  const phaseChain = phaseChainFor(observation);
  observation.settlement.scansCompletedAt = '2026-08-28T12:00:01.000Z';
  observation.settlement.elapsedMs = 500;
  observation.settlement.monotonicElapsedMs = 500;
  phaseChain.harnessTiming.observedAtMs =
    phaseChain.harnessTiming.releasedAtMs + 500;
  phaseChain.harnessTiming.elapsedMs = 500;
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });

  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('settlement-too-short'));
});

test('fractional k6 monotonic milliseconds remain valid evidence', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const releasedAtMs = 0.371587;
  const observedAtMs = 5000.496312;
  evidence.phaseChains[0].harnessTiming = {
    releasedAtMs,
    observedAtMs,
    elapsedMs: observedAtMs - releasedAtMs,
  };
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate', receipt.failureCategories.join(', '));
});

test('parseable timestamp comments cannot enter public receipts', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('allowed-pass.json');
  observation.startedAt =
    'Thu, 28 Aug 2026 12:00:00 GMT (PRIVATE_TIMESTAMP_SENTINEL)';
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain: phaseChainFor(observation),
  });
  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('observation-shape'));
});

test('missing and duplicated observations cannot be hidden by other passing cases', async () => {
  const { plan, evidence, driverAttestation } = await completeMatrix();
  const control = await fixture('control-missing-duplicated-observation.json');
  const filtered = evidence.observations.filter((observation) =>
    returnCovenantExecutionKey(observation.caseId, observation.form) !== control.remove);
  const duplicate = filtered.find((observation) =>
    returnCovenantExecutionKey(observation.caseId, observation.form) === control.duplicate);
  filtered.push(structuredClone(duplicate));
  const corruptedEvidence = {
    ...evidence,
    observations: filtered,
  };
  const validation = validateReturnCovenantObservationSet({
    plan,
    evidence: corruptedEvidence,
    driverAttestation,
  });
  assert.equal(validation.valid, false);
  for (const expected of control.expectedFailures) {
    assert.ok(failureCodes(validation).has(expected));
  }
});

test('cleanup rejects retained queue/process state and incomplete path removal', async () => {
  const { plan, evidence, driverAttestation } = await completeMatrix();
  const passing = validateReturnCovenantCleanup({
    cleanup: bindCleanup(
      await fixture('cleanup-pass.json'),
      evidence,
      driverAttestation,
    ),
    plan,
    evidence,
    driverAttestation,
    directCleanup: directCleanupFor(driverAttestation),
    observerSigningKey: signingKey,
  });
  assert.deepEqual(passing, { valid: true, errors: [] });
  const failing = validateReturnCovenantCleanup({
    cleanup: bindCleanup(
      await fixture('cleanup-failure.json'),
      evidence,
      driverAttestation,
    ),
    plan,
    evidence,
    driverAttestation,
    directCleanup: directCleanupFor(driverAttestation),
    observerSigningKey: signingKey,
  });
  assert.equal(failing.valid, false);
  assert.ok(failureCodes(failing).has('cleanup-failure'));

  const extraRetainedFixture = await fixture('cleanup-pass.json');
  extraRetainedFixture.retained.escapedProcesses = 1;
  const extraRetained = validateReturnCovenantCleanup({
    cleanup: bindCleanup(
      extraRetainedFixture,
      evidence,
      driverAttestation,
    ),
    plan,
    evidence,
    driverAttestation,
    directCleanup: directCleanupFor(driverAttestation),
    observerSigningKey: signingKey,
  });
  assert.equal(extraRetained.valid, false);
  assert.ok(failureCodes(extraRetained).has('cleanup-failure'));

  const reusedSocket = bindCleanup(
    await fixture('cleanup-pass.json'),
    evidence,
    driverAttestation,
  );
  reusedSocket.gatewayLifecycle[1].listenerFingerprints =
    [...reusedSocket.gatewayLifecycle[0].listenerFingerprints];
  reusedSocket.gatewayLifecycle[1].endpoints =
    [...reusedSocket.gatewayLifecycle[0].endpoints];
  const {
    launcherIntegrity: _oldIntegrity,
    ...reusedSocketUnsigned
  } = reusedSocket;
  reusedSocket.launcherIntegrity = {
    algorithm: 'hmac-sha256-launch-key-v1',
    signature: createHmac('sha256', signingKey)
      .update(canonicalJson(reusedSocketUnsigned))
      .digest('hex'),
  };
  const reusedSocketValidation = validateReturnCovenantCleanup({
    cleanup: reusedSocket,
    plan,
    evidence,
    driverAttestation,
    directCleanup: directCleanupFor(driverAttestation),
    observerSigningKey: signingKey,
  });
  assert.equal(reusedSocketValidation.valid, false);
  assert.ok(failureCodes(reusedSocketValidation).has('cleanup-failure'));

  const stale = bindCleanup(
    await fixture('cleanup-pass.json'),
    evidence,
    driverAttestation,
  );
  stale.observationSetSha256 = 'f'.repeat(64);
  assert.equal(validateReturnCovenantCleanup({
    cleanup: stale,
    plan,
    evidence,
    driverAttestation,
    directCleanup: directCleanupFor(driverAttestation),
    observerSigningKey: signingKey,
  }).valid, false);
});

test('signed observer receipt binds the complete matrix and publishes no raw identities', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-pass.json'),
    fixture('runtime-config.valid.json'),
  ]);
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(
    receipt.verdict,
    'PASS-candidate',
    receipt.failureCategories.join(', '),
  );
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(receipt, signingKey),
    { valid: true, verdict: 'PASS-candidate' },
  );
  assert.equal(receipt.matrix.cases.length, 24);
  const publicBytes = JSON.stringify(receipt);
  for (const observation of evidence.observations) {
    assert.doesNotMatch(publicBytes, new RegExp(observation.logicalSessionKey));
    assert.doesNotMatch(
      publicBytes,
      new RegExp(observation.dispatch.capturedAuthorityGeneration),
    );
    assert.doesNotMatch(publicBytes, new RegExp(observation.resultMarker));
  }
  const tampered = structuredClone(receipt);
  tampered.matrix.cases[0].delivery.observedEffects.promptAdoptions = 0;
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(tampered, signingKey),
    { valid: false, reason: 'invalid-integrity' },
  );

  const duplicateMatrix = structuredClone(receipt);
  duplicateMatrix.matrix.cases[1] = structuredClone(duplicateMatrix.matrix.cases[0]);
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(
      resign(duplicateMatrix),
      signingKey,
    ),
    { valid: false, reason: 'invalid-pass-matrix' },
  );

  const copiedDispatch = structuredClone(receipt);
  copiedDispatch.matrix.cases[1].chain.dispatchReceiptFingerprint =
    copiedDispatch.matrix.cases[0].chain.dispatchReceiptFingerprint;
  copiedDispatch.matrix.cases[1].identity.acceptedDispatchFingerprint =
    copiedDispatch.matrix.cases[0].chain.dispatchReceiptFingerprint;
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(
      resign(copiedDispatch),
      signingKey,
    ),
    { valid: false, reason: 'invalid-pass-matrix' },
  );

  const contentFree = structuredClone(receipt);
  contentFree.matrix.cases = Array.from({ length: 24 }, () => ({
    validation: 'pass',
    failureCategories: [],
    authority: { diagnosticSource: 'product-owned' },
    delivery: {
      effectsDistinguishable: true,
      settlementComplete: true,
    },
  }));
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(resign(contentFree), signingKey),
    { valid: false, reason: 'invalid-shape' },
  );

  const rawExtra = structuredClone(receipt);
  rawExtra.privateSessionKey = 'agent:private:must-not-publish';
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(resign(rawExtra), signingKey),
    { valid: false, reason: 'invalid-shape' },
  );
});

test('missing observations and cleanup failure produce signed FAIL receipts', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-failure.json'),
    fixture('runtime-config.valid.json'),
  ]);
  evidence.observations.pop();
  evidence.observations[0].effects.expected.privatePrompt =
    'PRIVATE_SENTINEL_NOT_IN_REDACTION_SET';
  const cleanupFailure = bindCleanup(cleanupFixture, evidence, driverAttestation);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: cleanupFailure,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('observation-missing'));
  assert.ok(receipt.failureCategories.includes('cleanup-failure'));
  assert.doesNotMatch(
    JSON.stringify(receipt),
    /PRIVATE_SENTINEL_NOT_IN_REDACTION_SET/,
  );
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(receipt, signingKey),
    { valid: true, verdict: 'FAIL-candidate' },
  );
});

test('isolated runtime authority cannot be supplied by ambient plugin state', async () => {
  const runtimeConfig = await fixture('runtime-config.valid.json');
  assert.equal(evaluateIsolatedRuntimePlugin({ config: runtimeConfig }).sufficient, true);
  const missing = structuredClone(runtimeConfig);
  delete missing.plugins;
  const evaluation = evaluateIsolatedRuntimePlugin({
    config: missing,
    ambientRegistry: { agentHarnesses: [{ harness: { id: 'codex' } }] },
  });
  assert.equal(evaluation.sufficient, false);
  assert.equal(evaluation.source, 'isolated-target-config');

  const [{ plan, evidence, driverAttestation }, cleanupFixture] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-pass.json'),
  ]);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig: {},
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('isolated-runtime-unavailable'));

  const splicedConfig = structuredClone(runtimeConfig);
  splicedConfig.unrelatedRun = true;
  const spliced = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig: splicedConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(spliced.verdict, 'FAIL-candidate');
  assert.ok(spliced.failureCategories.includes('isolated-runtime-unavailable'));
});

test('scenario errors and reused phase identities remain terminal failures', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  evidence.executionErrors.push({
    caseId: 'allowed-ordinary-new',
    form: 'typed-tool',
    message: 'cleanup failed',
  });

  evidence.scenarioFailures = 1;
  evidence.phaseChains[1].caseHandle = evidence.phaseChains[0].caseHandle;
  evidence.phaseChains[1].prepare.caseHandle = evidence.phaseChains[0].caseHandle;
  evidence.phaseChains[1].cleanup.caseHandle = evidence.phaseChains[0].caseHandle;
  evidence.observations[1].caseHandle = evidence.phaseChains[0].caseHandle;
  evidence.observations[1].delivery.caseHandle = evidence.phaseChains[0].caseHandle;
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('scenario-failure'));
  assert.ok(receipt.failureCategories.includes('phase-chain-mismatch'));
});

test('one receipt reused across phases and a nonzero k6 exit cannot PASS', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const chain = evidence.phaseChains[0];
  const observation = evidence.observations[0];
  const shared = 'one-receipt-for-every-phase';
  chain.prepare.receiptId = shared;
  chain.dispatch.prepareReceiptId = shared;
  chain.dispatch.receiptId = shared;
  chain.transition.receiptId = shared;
  chain.transition.acceptedDispatchReceiptId = shared;
  chain.release.receiptId = shared;
  chain.release.transitionReceiptId = shared;
  chain.release.acceptedDispatchReceiptId = shared;
  chain.cleanup.receiptId = shared;
  observation.database.canonicalFixtureReceiptId = shared;
  observation.dispatch.receiptId = shared;
  observation.lifecycle.receiptId = shared;
  observation.lifecycle.acceptedDispatchReceiptId = shared;
  observation.delivery.acceptedDispatchReceiptId = shared;
  observation.delivery.transitionReceiptId = shared;
  observation.delivery.releaseReceiptId = shared;
  evidence.k6ExitCode = 1;
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });

  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('phase-chain-mismatch'));
  assert.ok(receipt.failureCategories.includes('scenario-failure'));
});

test('cross-case current generation and restart receipt reuse cannot PASS', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const allowedCaptured =
    evidence.observations[0].dispatch.capturedAuthorityGeneration;
  const forbidden = evidence.observations.find((entry) =>
    entry.caseId === 'forbidden-owner-reassignment');
  forbidden.authorityDiagnostic.currentAuthorityGeneration = allowedCaptured;
  const restartObservations = evidence.observations.filter((entry) =>
    entry.caseId === 'allowed-gateway-restart-replay');
  const restartChains = evidence.phaseChains.filter((entry) =>
    entry.caseId === 'allowed-gateway-restart-replay');
  restartObservations[1].lifecycle.restart.receiptId =
    restartObservations[0].lifecycle.restart.receiptId;
  restartChains[1].transition.restartReceiptId =
    restartChains[0].transition.restartReceiptId;
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('phase-chain-mismatch'));
});

test('delete/recreate requires distinct physical sessions and operation receipts', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('forbidden-pass.json');
  const phaseChain = phaseChainFor(observation);
  observation.lifecycle.postSessionId = observation.lifecycle.preSessionId;
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });

  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('observation-shape'));
});

test('sealed delete operations cannot contradict the final observation', async () => {
  const plan = await fixture('plan.valid.json');
  const observation = await fixture('forbidden-pass.json');
  const phaseChain = phaseChainFor(observation);
  phaseChain.transition.operations.deletionObserved = false;
  phaseChain.transition.operations.recreationObserved = false;
  const validation = validateReturnCovenantObservation({
    observation,
    plan,
    execution: executionFor(plan, observation.caseId, observation.form),
    phaseChain,
  });
  assert.equal(validation.valid, false);
  assert.ok(failureCodes(validation).has('observation-shape'));
});

test('phase response binding without launcher HMAC proof cannot PASS', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation);
  evidence.phaseChains[0].proofs.dispatch.signature = '0'.repeat(64);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });

  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('phase-proof-mismatch'));
});

test('missing per-case cleanup emits a signed FAIL instead of throwing', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation);
  delete evidence.phaseChains[0].cleanup;
  delete evidence.phaseChains[0].proofs.cleanup;
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('phase-proof-mismatch'));
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(receipt, signingKey),
    { valid: true, verdict: 'FAIL-candidate' },
  );
});

test('direct cleanup rejects a retained launcher run root', async () => {
  const plan = await fixture('plan.valid.json');
  const driverAttestation = driverAttestationFor(plan);
  const runRoot = await mkdtemp(path.join(tmpdir(), 'return-covenant-retained-'));
  driverAttestation.isolation = {
    ...driverAttestation.isolation,
    runRoot,
    homePath: path.join(runRoot, 'home'),
    statePath: path.join(runRoot, 'state'),
    configPath: path.join(runRoot, 'config.json'),
    snapshotPath: path.join(runRoot, 'snapshot'),
  };
  try {
    const retained = await verifyReturnCovenantDirectCleanup(driverAttestation);
    assert.equal(retained.verified, false);
    assert.equal(retained.runRootRemoved, false);
  } finally {
    await rm(runRoot, { recursive: true, force: true });
  }
  const removed = await verifyReturnCovenantDirectCleanup(driverAttestation);
  assert.equal(removed.verified, true);
});

test('driver attestation binds a running process to an exact candidate Git blob', async () => {
  const runRoot = await mkdtemp(path.join(tmpdir(), 'return-covenant-launch-'));
  const directory = path.join(runRoot, 'snapshot');
  const homePath = path.join(runRoot, 'home');
  const statePath = path.join(runRoot, 'state');
  const configDirectory = path.join(runRoot, 'config');
  await Promise.all([
    mkdir(directory, { mode: 0o700 }),
    mkdir(homePath, { mode: 0o700 }),
    mkdir(statePath, { mode: 0o700 }),
    mkdir(configDirectory, { mode: 0o700 }),
  ]);
  let child;
  try {
    const driverRelative = 'synthetic-driver.mjs';
    const driverPath = path.join(directory, driverRelative);
    const driverSource = [
      "import http from 'node:http';",
      "import { spawn } from 'node:child_process';",
      "import { once } from 'node:events';",
      "import { writeFileSync } from 'node:fs';",
      "if (process.argv[2] === 'gateway') {",
      "  const gatewayServer = http.createServer((_req, res) => res.end('gateway'));",
      "  gatewayServer.listen(0, '127.0.0.1', () => writeFileSync(process.env.RETURN_COVENANT_GATEWAY_READY_FILE, JSON.stringify({ endpoint: `http://127.0.0.1:${gatewayServer.address().port}` })));",
      '} else {',
      'const port = Number(process.env.RETURN_COVENANT_TEST_PORT);',
      "const gateway = spawn(process.execPath, [process.argv[1], 'gateway'], {",
      "  cwd: process.cwd(), env: process.env, stdio: 'ignore'",
      '});',
      'writeFileSync(process.env.RETURN_COVENANT_GATEWAY_PID_FILE, String(gateway.pid));',
      "const server = http.createServer((_req, res) => res.end('ok'));",
      "server.listen(port, '127.0.0.1');",
      "process.on('SIGTERM', () => server.close(() => { gateway.kill('SIGTERM'); process.exit(0); }));",
      '}',
      '',
    ].join('\n');
    await writeFile(driverPath, driverSource, { mode: 0o700 });
    const runtimeConfig = await fixture('runtime-config.valid.json');
    const runtimeConfigPath = path.join(configDirectory, 'openclaw.json');
    await writeFile(runtimeConfigPath, JSON.stringify(runtimeConfig), { mode: 0o600 });
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.name', 'Harness Test'],
      ['config', 'user.email', 'harness@example.invalid'],
      ['add', driverRelative],
      ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture'],
    ]) {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
    }).stdout.trim();
    const plan = await fixture('plan.valid.json');
    plan.target.candidateSha = head;
    plan.target.runtimeBuildSha = head;
    plan.target.docsHarnessSha = head;
    plan.settlementWindowMs = 1000;
    plan.driver.fixtureCommand.relativePath = driverRelative;
    plan.driver.fixtureCommand.sha256 = sha256(driverSource);
    plan.driver.gatewayCommand.relativePath = driverRelative;
    plan.driver.gatewayCommand.sha256 = sha256(driverSource);
    const portProbe = await import('node:net').then(({ createServer }) =>
      new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const { port } = server.address();
          server.close((error) => error ? reject(error) : resolve(port));
        });
      }));
    const gatewayPidFile = path.join(runRoot, 'gateway.pid');
    const gatewayReadyFile = path.join(runRoot, 'gateway-ready.json');
    const phaseSigningKey =
      'trusted-launcher-phase-signing-key-at-least-32-characters';
    const launchNonce = 'trusted-launcher-nonce-at-least-24-characters';
    const gatewayToken = 'trusted-launcher-synthetic-gateway-token';
    const {
      NODE_OPTIONS: _nodeOptions,
      ...baseEnvironment
    } = process.env;
    child = spawn(process.execPath, [driverPath], {
      cwd: directory,
      stdio: 'ignore',
      detached: true,
      env: {
        ...baseEnvironment,
        RETURN_COVENANT_TEST_PORT: String(portProbe),
        RETURN_COVENANT_GATEWAY_PID_FILE: gatewayPidFile,
        RETURN_COVENANT_GATEWAY_READY_FILE: gatewayReadyFile,
        OPENCLAW_RETURN_COVENANT_PHASE_KEY: phaseSigningKey,
        OPENCLAW_GATEWAY_TOKEN: gatewayToken,
        OPENCLAW_STATE_DIR: statePath,
        OPENCLAW_CONFIG_PATH: runtimeConfigPath,
        HOME: homePath,
      },
    });

    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    let listening = false;
    for (let attempt = 0; attempt < 50 && !listening; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${portProbe}`);
        listening = response.ok;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.equal(listening, true, 'synthetic driver did not start listening');
    let gatewayPid = 0;
    for (let attempt = 0; attempt < 50 && gatewayPid === 0; attempt += 1) {
      try {
        gatewayPid = Number((await readFile(gatewayPidFile, 'utf8')).trim());
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.ok(gatewayPid > 1, 'synthetic gateway child did not start');
    let gatewayReady;
    for (let attempt = 0; attempt < 50 && !gatewayReady; attempt += 1) {
      try {
        gatewayReady = JSON.parse(await readFile(gatewayReadyFile, 'utf8'));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.ok(gatewayReady?.endpoint, 'synthetic gateway did not start listening');
    const ready = {
      schema: RETURN_COVENANT_DRIVER_READY_SCHEMA,
      protocol: RETURN_COVENANT_DRIVER_SCHEMA,
      runId: plan.runId,
      rowId: plan.rowId,
      candidateSha: head,
      runtimeBuildSha: head,
      docsHarnessSha: head,
      commandRelativePath: driverRelative,
      commandSha256: sha256(driverSource),
      gatewayCommandRelativePath: driverRelative,
      gatewayCommandSha256: sha256(driverSource),
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      launchNonce,
      phaseKeyFingerprint: sha256(phaseSigningKey),
      pid: child.pid,
      gatewayPid,
      gatewayEndpoint: gatewayReady.endpoint,
      namespacePid: child.pid,
      namespaceGatewayPid: gatewayPid,
      endpoint: `http://127.0.0.1:${portProbe}`,
      revocationCapability: {
        schema: 'openclaw.k6.return-covenant-capability-inventory.v1',
        source: 'product-owned',
        productSha: head,
        runtimeBuildSha: head,
        runtimeConfigSha256: plan.target.runtimeConfigSha256,
        inventoryComplete: true,
        revocationApiExposed: true,
        surface: 'diagnostics/continuation/capability-inventory',
        receiptId: 'run-wide-revocation-capability-receipt',
      },
    };
    const launch = {
      createdByTrustedLauncher: true,
      launcherPid: process.pid,
      launcherStartFingerprint: '4'.repeat(64),
      observerKeyFingerprint: sha256(signingKey),
      driverPid: child.pid,
      processGroupId: child.pid,
      sandboxPid: child.pid,
      sandboxStartFingerprint: 'a'.repeat(64),
      launchNonce,
      phaseSigningKey,
      driverArgs: [],
      gatewayTokenFingerprint: sha256(gatewayToken),
      runRoot,
      homePath,
      statePath,
      configPath: runtimeConfigPath,
      snapshotPath: directory,
      livePaths: [],
    };
    const attestation = await createReturnCovenantDriverAttestation({
      plan,
      sourceDir: directory,
      docsDir: directory,
      ready,
      launch,
    });
    assert.equal(attestation.command.sha256, plan.driver.fixtureCommand.sha256);
    assert.equal(attestation.source.headSha, head);
    assert.equal(attestation.process.commandContainsVerifiedDriver, true);
    const [attestationSchema, readySchema] = await Promise.all([
      fixture('../../../contracts/return-covenant-authority/driver-attestation.schema.json'),
      fixture('../../../contracts/return-covenant-authority/driver-ready.schema.json'),
    ]);
    assertSimpleSchema(attestationSchema, attestation, attestationSchema);
    assertSimpleSchema(readySchema, ready, readySchema);
    const outsider = createHttpServer((_request, response) => response.end('stub'));
    await new Promise((resolve, reject) => {
      outsider.once('error', reject);
      outsider.listen(0, '127.0.0.1', resolve);
    });
    try {
      const outsiderPort = outsider.address().port;
      await assert.rejects(
        createReturnCovenantDriverAttestation({
          plan,
          sourceDir: directory,
          docsDir: directory,
          ready: { ...ready, endpoint: `http://127.0.0.1:${outsiderPort}` },
          launch,
        }),
        /does not own the ready endpoint/,
      );
    } finally {
      await new Promise((resolve, reject) =>
        outsider.close((error) => error ? reject(error) : resolve()));
    }
    await assert.rejects(
      createReturnCovenantDriverAttestation({
        plan,
        sourceDir: directory,
        docsDir: directory,
        ready: { ...ready, commandSha256: '0'.repeat(64) },
        launch,
      }),
      /ready receipt is incomplete or mismatched/,
    );
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await rm(runRoot, { recursive: true, force: true });
  }
});

test('trusted launcher owns snapshot, isolation, process start, and final cleanup', async () => {
  const sourceDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-source-'));
  const inputDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-input-'));
  const controlDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-control-'));
  const artifactDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-artifact-'));
  try {
    const driverRelative = 'fixture-driver.mjs';
    const driverPath = path.join(sourceDir, driverRelative);
    const driverSource = await readFile(
      path.join(fixtures, 'mock-product-driver.mjs'),
      'utf8',
    );
    await writeFile(driverPath, driverSource, { mode: 0o700 });
    await copyTrustedHarness(sourceDir);
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.name', 'Harness Test'],
      ['config', 'user.email', 'harness@example.invalid'],
      ['add', '.'],
      ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture'],
    ]) {
      const result = spawnSync('git', args, { cwd: sourceDir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: sourceDir,
      encoding: 'utf8',
    }).stdout.trim();
    const [plan, runtimeConfig] = await Promise.all([
      fixture('plan.valid.json'),
      fixture('runtime-config.valid.json'),
    ]);
    plan.target.candidateSha = head;
    plan.target.runtimeBuildSha = head;
    plan.target.docsHarnessSha = head;
    plan.settlementWindowMs = 1000;
    plan.driver.fixtureCommand = {
      status: 'available',
      relativePath: driverRelative,
      sha256: sha256(driverSource),
    };
    plan.driver.gatewayCommand = {
      relativePath: driverRelative,
      sha256: sha256(driverSource),
      args: ['gateway'],
    };
    const planPath = path.join(inputDir, 'plan.json');
    const runtimePath = path.join(inputDir, 'runtime.json');
    await Promise.all([
      writeFile(planPath, JSON.stringify(plan), { mode: 0o600 }),
      writeFile(runtimePath, JSON.stringify(runtimeConfig), { mode: 0o600 }),
    ]);
    const launched = spawn(process.execPath, [
      path.join(
        sourceDir,
        'tools/k6-proofs/scripts/launch-return-covenant-driver.mjs',
      ),
      '--plan', planPath,
      '--source-dir', sourceDir,
      '--runtime-config', runtimePath,
      '--control-dir', controlDir,
      '--artifact-dir', artifactDir,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let launcherStdout = '';
    let launcherStderr = '';
    launched.stdout.setEncoding('utf8');
    launched.stderr.setEncoding('utf8');
    launched.stdout.on('data', (chunk) => { launcherStdout += chunk; });
    launched.stderr.on('data', (chunk) => { launcherStderr += chunk; });
    const launcherExit = new Promise((resolve, reject) => {
      launched.once('error', reject);
      launched.once('exit', (code) => resolve(code));
    });
    const attestationPath = path.join(controlDir, 'driver-attestation.json');
    let attestation;
    for (let attempt = 0; attempt < 300 && !attestation; attempt += 1) {
      try {
        attestation = JSON.parse(await readFile(attestationPath, 'utf8'));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    if (!attestation) {
      const earlyExit = await launcherExit;
      assert.fail(JSON.stringify({
        earlyExit,
        stderr: launcherStderr,
        stdout: launcherStdout,
        driverLog: await readFile(path.join(controlDir, 'driver.log'), 'utf8')
          .catch(() => ''),
      }));
    }
    const launcherExitCode = await launcherExit;
    let launcherReceipt;
    let launcherCleanup;
    let launcherEvidence;
    try {
      launcherReceipt = JSON.parse(
        await readFile(path.join(artifactDir, 'observer-receipt.json'), 'utf8'),
      );
    } catch {
      launcherReceipt = null;
    }
    try {
      launcherCleanup = JSON.parse(
        await readFile(path.join(controlDir, 'cleanup.json'), 'utf8'),
      );
    } catch {
      launcherCleanup = null;
    }
    try {
      launcherEvidence = parseReturnCovenantEvidenceLog(
        await readFile(path.join(controlDir, 'k6.log'), 'utf8'),
      );
    } catch {
      launcherEvidence = null;
    }
    assert.equal(
      launcherExitCode,
      0,
      JSON.stringify({
        stderr: launcherStderr,
        stdout: launcherStdout,
        failureCategories: launcherReceipt?.failureCategories,
        launcherCleanup,
        driverLog: await readFile(path.join(controlDir, 'driver.log'), 'utf8')
          .catch(() => ''),
        k6Exit: await readFile(path.join(controlDir, 'k6-exit-code.txt'), 'utf8')
          .catch(() => ''),
        k6LogTail: (await readFile(path.join(controlDir, 'k6.log'), 'utf8')
          .catch(() => '')).split('\n').slice(-20),
        firstObservation: launcherEvidence?.observations?.[0],
        firstPhaseChain: launcherEvidence?.phaseChains?.[0],
        scenarioFailures: launcherEvidence?.scenarioFailures,
        executionErrors: launcherEvidence?.executionErrors,
        cleanup: launcherReceipt?.cleanup,
        binding: launcherReceipt?.binding,
        failingCases: launcherReceipt?.matrix?.cases
          .filter((entry) => entry.validation === 'fail')
          .map((entry) => ({
            key: `${entry.caseId}:${entry.form}`,
            failures: entry.failureCategories,
          })),
      }),
    );
    const controlFiles = await readdir(controlDir);
    assert.ok(
      controlFiles.includes('driver-attestation.json') &&
        controlFiles.includes('cleanup.json'),
      JSON.stringify({
          stdout: launcherStdout,
          stderr: launcherStderr,
        controlFiles,
      }),
    );
    const [cleanup, receipt] = await Promise.all([
      readFile(path.join(controlDir, 'cleanup.json'), 'utf8')
        .then(JSON.parse),
      readFile(path.join(artifactDir, 'observer-receipt.json'), 'utf8')
        .then(JSON.parse),
    ]);
    assert.equal(attestation.launcher.createdByTrustedLauncher, true);
    assert.notEqual(attestation.isolation.driverPid, attestation.isolation.gatewayPid);
    assert.equal(cleanup.snapshotMatchedCandidateAfterRun, true);
    assert.equal(cleanup.runRootRemoved, true);
    assert.equal(cleanup.driverExitCode, 0);
    assert.equal(
      receipt.verdict,
      'PASS-candidate',
      receipt.failureCategories.join(', '),
    );
    assert.equal(receipt.integrity.algorithm, RETURN_COVENANT_INTEGRITY_ALGORITHM);
    assert.deepEqual(
      validateReturnCovenantAuthoritativeReceipt(
        receipt,
        attestation.phaseSigningKey,
      ),
      { valid: false, reason: 'invalid-integrity' },
    );
    assert.notEqual(
      cleanup.launcherIntegrity.signature,
      createHmac('sha256', attestation.phaseSigningKey)
        .update(canonicalJson((({ launcherIntegrity: _ignored, ...value }) => value)(cleanup)))
        .digest('hex'),
    );
    assert.equal(
      (await verifyReturnCovenantDirectCleanup(attestation)).verified,
      true,
    );
  } finally {
    await Promise.all([
      rm(sourceDir, { recursive: true, force: true }),
      rm(inputDir, { recursive: true, force: true }),
      rm(controlDir, { recursive: true, force: true }),
      rm(artifactDir, { recursive: true, force: true }),
    ]);
  }
});

test('trusted launcher rejects candidate command symlinks before execution', async () => {
  const sourceDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-symlink-source-'));
  const inputDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-symlink-input-'));
  const controlDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-symlink-control-'));
  const artifactDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-symlink-artifact-'));
  try {
    const driverRelative = 'fixture-driver.mjs';
    await symlink('/bin/true', path.join(sourceDir, driverRelative));
    await copyTrustedHarness(sourceDir);
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.name', 'Harness Test'],
      ['config', 'user.email', 'harness@example.invalid'],
      ['add', '.'],
      ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture'],
    ]) {
      const result = spawnSync('git', args, { cwd: sourceDir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: sourceDir,
      encoding: 'utf8',
    }).stdout.trim();
    const [plan, runtimeConfig, targetBytes] = await Promise.all([
      fixture('plan.valid.json'),
      fixture('runtime-config.valid.json'),
      readFile('/bin/true'),
    ]);
    plan.target.candidateSha = head;
    plan.target.runtimeBuildSha = head;
    plan.target.docsHarnessSha = head;
    plan.driver.fixtureCommand = {
      status: 'available',
      relativePath: driverRelative,
      sha256: sha256(targetBytes),
    };
    plan.driver.gatewayCommand = {
      relativePath: driverRelative,
      sha256: sha256(targetBytes),
      args: ['gateway'],
    };
    const planPath = path.join(inputDir, 'plan.json');
    const runtimePath = path.join(inputDir, 'runtime.json');
    await Promise.all([
      writeFile(planPath, JSON.stringify(plan), { mode: 0o600 }),
      writeFile(runtimePath, JSON.stringify(runtimeConfig), { mode: 0o600 }),
    ]);
    const launched = spawnSync(process.execPath, [
      path.join(
        sourceDir,
        'tools/k6-proofs/scripts/launch-return-covenant-driver.mjs',
      ),
      '--plan', planPath,
      '--source-dir', sourceDir,
      '--runtime-config', runtimePath,
      '--control-dir', controlDir,
      '--artifact-dir', artifactDir,
    ], { encoding: 'utf8', timeout: 10_000 });
    assert.notEqual(launched.status, 0);
    assert.match(launched.stderr, /regular non-symlink|regular Git blob/);
    assert.equal((await readdir(artifactDir)).length, 0);
  } finally {
    await Promise.all([
      rm(sourceDir, { recursive: true, force: true }),
      rm(inputDir, { recursive: true, force: true }),
      rm(controlDir, { recursive: true, force: true }),
      rm(artifactDir, { recursive: true, force: true }),
    ]);
  }
});

test('candidate JSON reader rejects symlinks, FIFOs, and oversized files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'return-covenant-json-'));
  try {
    const valid = path.join(directory, 'valid.json');
    const linked = path.join(directory, 'linked.json');
    const oversized = path.join(directory, 'oversized.json');
    const fifo = path.join(directory, 'candidate.fifo');
    await writeFile(valid, '{"ok":true}\n');
    await symlink(valid, linked);
    await writeFile(oversized, JSON.stringify({ value: 'x'.repeat(1024) }));
    const fifoResult = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
    assert.equal(fifoResult.status, 0, fifoResult.stderr);
    assert.deepEqual(await readBoundedCandidateJson(valid, 64), { ok: true });
    await assert.rejects(
      readBoundedCandidateJson(linked, 64),
      (error) => error?.code === 'ELOOP',
    );
    await assert.rejects(
      readBoundedCandidateJson(oversized, 64),
      /not a bounded regular file|exceeded its size bound/,
    );
    await assert.rejects(
      readBoundedCandidateJson(fifo, 64),
      /not a bounded regular file/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('published closed schemas declare required properties and accept passing fixtures', async () => {
  const schemaNames = [
    'cleanup.schema.json',
    'driver-attestation.schema.json',
    'driver-ready.schema.json',
    'fixture-input.schema.json',
    'observer.schema.json',
  ];
  const schemas = await Promise.all(schemaNames.map((name) =>
    fixture(`../../../contracts/return-covenant-authority/${name}`)));
  schemas.forEach((schema, index) =>
    assertClosedSchemaDeclaresRequired(schema, schemaNames[index]));
  const cleanupSchema = schemas[0];
  assertSimpleSchema(
    cleanupSchema,
    await fixture('cleanup-pass.json'),
    cleanupSchema,
  );
});

test('Draft 2020-12 observer schema rejects adversarial nested evidence', async () => {
  const [schema, allowed, forbidden] = await Promise.all([
    fixture('../../../contracts/return-covenant-authority/observer.schema.json'),
    fixture('allowed-pass.json'),
    fixture('forbidden-pass.json'),
  ]);
  const falseAcceptance = structuredClone(allowed);
  falseAcceptance.dispatch.accepted = false;
  const stringCounter = structuredClone(forbidden);
  stringCounter.effects.observed.promptAdoptions = '0';
  const extraField = structuredClone(allowed);
  extraField.delivery.privatePrompt = 'must-not-be-schema-valid';
  const script = [
    'import json, sys',
    'from jsonschema import Draft202012Validator, FormatChecker',
    'payload = json.load(sys.stdin)',
    'validator = Draft202012Validator(payload["schema"], format_checker=FormatChecker())',
    'valid = [not list(validator.iter_errors(value)) for value in payload["instances"]]',
    'json.dump(valid, sys.stdout)',
  ].join('\n');
  const result = spawnSync('python3', ['-c', script], {
    encoding: 'utf8',
    input: JSON.stringify({
      schema,
      instances: [allowed, forbidden, falseAcceptance, stringCounter, extraField],
    }),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), [true, true, false, false, false]);
  assert.equal(validateReturnCovenantObservation({
    observation: extraField,
    plan: await fixture('plan.valid.json'),
    execution: executionFor(
      await fixture('plan.valid.json'),
      extraField.caseId,
      extraField.form,
    ),
    phaseChain: phaseChainFor(extraField),
  }).valid, false);
});

test('explicit revocation N/A requires a complete exact-build capability inventory', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  driverAttestation.revocationCapability.revocationApiExposed = false;
  const { attestationSha256: _oldAttestationSha256, ...unsignedAttestation } =
    driverAttestation;
  driverAttestation.attestationSha256 = jsonSha256(unsignedAttestation);
  evidence.driverAttestationSha256 = driverAttestation.attestationSha256;
  const bracketIndex = evidence.observations.findIndex((entry) =>
    entry.caseId === 'forbidden-explicit-revocation' &&
    entry.form === 'bracket-token');
  const executedBracketObservation =
    structuredClone(evidence.observations[bracketIndex]);
  const executedBracketChain = structuredClone(evidence.phaseChains[bracketIndex]);
  for (const form of ['typed-tool', 'bracket-token']) {
    const execution = executionFor(
      plan,
      'forbidden-explicit-revocation',
      form,
    );
    const index = evidence.observations.findIndex((entry) =>
      entry.caseId === execution.caseId && entry.form === form);
    const caseHandle = `case-handle-revocation-capability-${form}`;
    const capabilityReceipt =
      driverAttestation.revocationCapability.receiptId;
    const prepareReceipt = `prepare-receipt-revocation-capability-${form}`;
    evidence.observations[index] = {
      schema: 'openclaw.k6.return-covenant-observation.v1',
      rowId: plan.rowId,
      runId: plan.runId,
      caseId: execution.caseId,
      form,
      kind: execution.kind,
      applicability: 'not-exposed',
      candidateSha: plan.target.candidateSha,
      runtimeBuildSha: plan.target.runtimeBuildSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      startedAt: '2026-08-28T12:08:00.000Z',
      endedAt: '2026-08-28T12:08:06.000Z',
      returnMode: execution.returnMode,
      logicalSessionKey: execution.testCase.logicalSessionKey,
      caseHandle,
      database: {
        profile: execution.databaseProfile,
        sourceSchemaVersion: 19,
        targetSchemaVersion: 19,
        fixtureShape: 'v19-reopen',
        productOwnedFixture: true,
        canonicalFixtureReceiptId: prepareReceipt,
        freshInstall: false,
        migrationApplied: false,
        reopenIdempotent: true,
      },
      isolation: { home: true, state: true, config: true, syntheticData: true },
      capability: {
        schema: 'openclaw.k6.return-covenant-capability-inventory.v1',
        source: 'product-owned',
        productSha: plan.target.candidateSha,
        runtimeBuildSha: plan.target.runtimeBuildSha,
        runtimeConfigSha256: plan.target.runtimeConfigSha256,
        docsHarnessSha: plan.target.docsHarnessSha,
        runId: plan.runId,
        caseId: execution.caseId,
        form,
        inventoryComplete: true,
        revocationApiExposed: false,
        surface: driverAttestation.revocationCapability.surface,
        receiptId: capabilityReceipt,
      },
      effects: {
        distinguishable: true,
        sources: {
          promptAdoptions: 'product-observer/prompt-adoption',
          wakes: 'product-observer/heartbeat-wake',
          channelDeliveries: 'product-observer/channel-delivery',
        },
        expected: { ...execution.expectedEffects },
        observed: { ...execution.expectedEffects },
      },
      settlement: { bounded: true, complete: true, windowMs: 5000 },
      scans: {
        resultMarker: null,
        successorTranscript: {
          source: 'product-owned',
          marker: null,
          matches: 0,
          receiptId: `capability-transcript-scan-${form}`,
        },
        trustedSystemEvents: {
          source: 'product-owned',
          marker: null,
          matches: 0,
          receiptId: `capability-system-event-scan-${form}`,
        },
      },
    };
    evidence.phaseChains[index] = {
      caseId: execution.caseId,
      form,
      caseHandle,
      prepare: {
        caseHandle,
        receiptId: prepareReceipt,
        capabilityReceiptId: capabilityReceipt,
      },
      cleanup: {
        caseHandle,
        closed: true,
        receiptId: `case-cleanup-receipt-capability-${form}`,
      },
    };
  }
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  const nAValidation = validateReturnCovenantObservationSet({
    plan,
    evidence,
    driverAttestation,
  });
  assert.equal(
    receipt.verdict,
    'PASS-candidate',
    JSON.stringify(nAValidation.errors),
  );
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(receipt, signingKey),
    { valid: true, verdict: 'PASS-candidate' },
    JSON.stringify(
      receipt.matrix.cases.filter((entry) => entry.applicability === 'not-exposed'),
      null,
      2,
    ),
  );

  const notExposedBracketObservation =
    structuredClone(evidence.observations[bracketIndex]);
  const notExposedBracketChain = structuredClone(evidence.phaseChains[bracketIndex]);
  evidence.observations[bracketIndex] = executedBracketObservation;
  evidence.phaseChains[bracketIndex] = executedBracketChain;
  const mixed = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(mixed.verdict, 'FAIL-candidate');
  assert.ok(mixed.failureCategories.includes('revocation-capability-mismatch'));

  evidence.observations[bracketIndex] = notExposedBracketObservation;
  evidence.phaseChains[bracketIndex] = notExposedBracketChain;
  evidence.observations.find((entry) =>
    entry.caseId === 'forbidden-explicit-revocation').capability.surface = '';
  const malformed = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation),
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(malformed.verdict, 'FAIL-candidate');
});

test('evidence parser requires exactly one observation set and teardown', async () => {
  const { evidence } = await completeMatrix();
  const line = `${RETURN_COVENANT_EVIDENCE_PREFIX}${JSON.stringify(evidence)}`;
  const teardownLine = `${RETURN_COVENANT_TEARDOWN_PREFIX}${JSON.stringify(evidence.teardown)}`;
  const completeLog = `${line}\n${teardownLine}`;
  assert.equal(parseReturnCovenantEvidenceLog(completeLog).observations.length, 24);
  assert.throws(() => parseReturnCovenantEvidenceLog(''), /observed 0/);
  assert.throws(
    () => parseReturnCovenantEvidenceLog(`${line}\n${line}\n${teardownLine}`),
    /observed 2/,
  );
  assert.throws(() => parseReturnCovenantEvidenceLog(line), /teardown record, observed 0/);
});
