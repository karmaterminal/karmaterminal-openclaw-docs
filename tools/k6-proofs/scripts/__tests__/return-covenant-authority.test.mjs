import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  createReturnCovenantDriverAttestation,
  fingerprintProcessLoopbackListeners,
  inspectProcessLoopbackListeners,
  RETURN_COVENANT_DRIVER_READY_SCHEMA,
  verifyReturnCovenantDirectCleanup,
} from '../../lib/return-covenant-driver-attestation.mjs';
import {
  childTerminationReason,
  readBoundedCandidateJson,
} from '../../lib/return-covenant-candidate-io.mjs';
import {
  inspectReturnCovenantDurableStores,
} from '../../lib/return-covenant-retention-inspector.mjs';
import {
  deriveReturnCovenantCaseHandleClosure,
  deriveReturnCovenantTrustedRetention,
  parseReturnCovenantEvidenceLog,
  resolveReturnCovenantAuthoritativeReceipt as resolveRawReturnCovenantReceipt,
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_INTEGRITY_ALGORITHM,
  RETURN_COVENANT_RETENTION_AUTHORITY,
  RETURN_COVENANT_TEARDOWN_PREFIX,
  validateReturnCovenantAuthoritativeReceipt,
  validateReturnCovenantCleanup,
  validateReturnCovenantObservation,
  validateReturnCovenantObservationSet,
  validateReturnCovenantRetentionObservation,
} from '../../lib/return-covenant-authoritative-receipt.mjs';
import {
  assertExecutableReturnCovenantPlan,
  buildReturnCovenantDriverRequest,
  buildReturnCovenantRetentionRequest,
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
const RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA =
  '0109521b0c2b8a2c81c9f901789a81c5316074a7';

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
  'contracts/return-covenant-authority/retention-observation.schema.json',
  'contracts/return-covenant-authority/scenario.js',
  'k6-proof-binaries.json',
  'lib/canonical-json.mjs',
  'lib/isolated-runtime-plugin-contract.mjs',
  'lib/return-covenant-authoritative-receipt.mjs',
  'lib/return-covenant-candidate-io.mjs',
  'lib/return-covenant-driver-attestation.mjs',
  'lib/return-covenant-retention-inspector.mjs',
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
  const teardownStartedAt = new Date(
    Date.parse(evidence.endedAt) + 1_000,
  ).toISOString();
  evidence.teardown = {
    schema: 'openclaw.k6.return-covenant-teardown.v1',
    runId: evidence.runId,
    rowId: evidence.rowId,
    cleanupRunReceiptId: evidence.cleanupRun.receiptId,
    startedAt: teardownStartedAt,
    completedAt: new Date(Date.parse(teardownStartedAt) + 100).toISOString(),
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

const retentionResourceMethods = {
  delegates: 'continuation.delegates.list',
  queueItems: 'continuation.queue.list',
  temporarySessions: 'sessions.list',
};

function retentionObservationFor({
  plan,
  evidence,
  retained = {},
}) {
  const finalRestart = evidence.observations
    .filter((entry) => entry.lifecycle?.restart)
    .at(-1).lifecycle.restart;
  const requestedAt = '2026-08-28T12:09:30.000Z';
  const observedAt = '2026-08-28T12:09:30.010Z';
  const requestNonce = sha256(`retention:${plan.runId}`);
  const request = buildReturnCovenantRetentionRequest({
    plan,
    evidence,
    requestNonce,
  });
  const resources = Object.fromEntries(
    Object.entries(retentionResourceMethods).map(([category, method]) => {
      const count = retained[category] || 0;
      const items = Array.from({ length: count }, (_, index) => ({
        id: `${category}-retained-${index}`,
        runId: plan.runId,
        status: 'retained',
      }));
      return [category, {
        method,
        complete: true,
        total: items.length,
        nextCursor: null,
        items,
      }];
    }),
  );
  const gatewayResponse = {
    schema: 'openclaw.k6.return-covenant-retention-response.v1',
    rowId: plan.rowId,
    runId: plan.runId,
    candidateSha: plan.target.candidateSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    requestNonce,
    observedAt,
    gateway: {
      endpoint: finalRestart.replacementGatewayEndpoint,
      namespacePid: finalRestart.replacementGatewayPid,
      namespaceStartFingerprint:
        finalRestart.replacementGatewayStartFingerprint,
    },
    resources,
  };
  const body = JSON.stringify(gatewayResponse);
  return {
    schema: 'openclaw.k6.return-covenant-retention-observation.v1',
    status: 'observed',
    failureReason: null,
    request,
    target: {
      source: 'phase-chain-final-gateway',
      endpoint: finalRestart.replacementGatewayEndpoint,
      namespacePid: finalRestart.replacementGatewayPid,
      namespaceStartFingerprint:
        finalRestart.replacementGatewayStartFingerprint,
    },
    timing: {
      requestedAt,
      observedAt,
      requestedAtMonotonicMs: 570_000,
      observedAtMonotonicMs: 570_010,
    },
    response: {
      status: 200,
      url: `${finalRestart.replacementGatewayEndpoint}/v1/return-covenant/resource-inspection`,
      contentType: 'application/json',
      body,
      bodySha256: sha256(body),
      byteLength: Buffer.byteLength(body),
    },
  };
}

function durableStoreObservationFor({
  plan,
  evidence,
  driverAttestation,
  retained = {},
}) {
  const resources = {
    delegates: Array.from(
      { length: retained.delegates || 0 },
      (_, index) => ({
        id: `durable-delegate-${index}`,
        childSessionKey: `agent:proof:${plan.runId}:child-${index}`,
        requesterSessionKey: plan.cases[0].logicalSessionKey,
        controllerSessionKey: plan.cases[0].logicalSessionKey,
        executionStatus: 'running',
        cleanupCompletedAt: null,
        deliveryStatus: 'pending',
        requiredDelivery: true,
        payloadSha256: sha256(`subagent-payload-${index}`),
      }),
    ),
    queueItems: Array.from(
      { length: retained.queueItems || 0 },
      (_, index) => ({
        id: `flow:durable-queue-${index}`,
        source: 'flow_runs',
        ownerKey: plan.cases[0].logicalSessionKey,
        controllerId: 'core/continuation-delegate',
        syncMode: 'managed',
        status: 'queued',
        endedAt: null,
        stateSha256: sha256(`queue-state-${index}`),
      }),
    ),
    temporarySessions: Array.from(
      { length: retained.temporarySessions || 0 },
      (_, index) => ({
        id: `proof:agent:proof:${plan.runId}:temporary-${index}`,
        agentId: 'proof',
        sessionKey: `agent:proof:${plan.runId}:temporary-${index}`,
        sessionId: `temporary-session-${index}`,
        spawnedBy: plan.cases[0].logicalSessionKey,
        parentSessionKey: plan.cases[0].logicalSessionKey,
        spawnDepth: 1,
        entrySha256: sha256(`session-entry-${index}`),
        storePathFingerprint: sha256(
          '/isolated/state/agents/proof/agent/openclaw-agent.sqlite',
        ),
      }),
    ),
  };
  const identity = {
    rowId: plan.rowId,
    runId: plan.runId,
    candidateSha: plan.target.candidateSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
    cleanupRunReceiptId: evidence.cleanupRun.receiptId,
  };
  const fsIdentity = (ino, size) => ({
    dev: '1',
    ino: String(ino),
    size,
    mode: 0o600,
    mtimeNs: '1',
  });
  const snapshotFile = (ino, bytes) => ({
    ...fsIdentity(ino, bytes.length),
    sha256: sha256(bytes),
  });
  const globalSource = {
    database: snapshotFile(11, 'global-db'),
    wal: snapshotFile(12, 'global-wal'),
    shm: snapshotFile(13, 'global-shm'),
  };
  const agentSource = {
    database: snapshotFile(21, 'agent-db'),
    wal: null,
    shm: null,
  };
  const sourceBinding = {
    method: 'quiesced-opened-file-set-v1',
    productStoreContractSha: RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA,
    directoryIdentities: {
      stateRoot: { ...fsIdentity(1, 0), mode: 0o700 },
      state: { ...fsIdentity(2, 0), mode: 0o700 },
      agents: { ...fsIdentity(3, 0), mode: 0o700 },
    },
    databases: [{
      kind: 'global',
      agentId: null,
      pathFingerprint: sha256('/isolated/state/state/openclaw.sqlite'),
      source: globalSource,
      snapshotSha256: jsonSha256(globalSource),
      schemaSha256: sha256('canonical-global-retention-schema'),
    }, {
      kind: 'agent',
      agentId: 'proof',
      pathFingerprint: sha256(
        '/isolated/state/agents/proof/agent/openclaw-agent.sqlite',
      ),
      source: agentSource,
      snapshotSha256: jsonSha256(agentSource),
      schemaSha256: sha256('canonical-agent-retention-schema'),
    }],
  };
  const runtimePid = driverAttestation.isolation.driverPid;
  const runtimeStartFingerprint =
    driverAttestation.isolation.driverStartFingerprint;
  const finalRestart = evidence.observations
    .filter((entry) => entry.lifecycle?.restart)
    .at(-1).lifecycle.restart;
  const gatewayPid = finalRestart.replacementGatewayPid;
  const gatewayStartFingerprint =
    finalRestart.replacementGatewayStartFingerprint;
  const gatewayEndpoint = finalRestart.replacementGatewayEndpoint;
  const gatewaySocketFingerprint = sha256(gatewayEndpoint);
  const processGroupFingerprint = sha256(
    String(driverAttestation.isolation.processGroupId),
  );
  const runtimeSample = (runtimeAlive) => ({
    driverStartFingerprint: runtimeAlive ? runtimeStartFingerprint : null,
    gatewayStartFingerprint: runtimeAlive ? gatewayStartFingerprint : null,
    gatewaySocketFingerprint: runtimeAlive
      ? gatewaySocketFingerprint
      : null,
    gatewayEndpointOwned: runtimeAlive,
    processGroupMembers: runtimeAlive
      ? [{
        pidFingerprint: sha256(String(runtimePid)),
        startFingerprint: runtimeStartFingerprint,
        state: 'T',
      }, {
        pidFingerprint: sha256(String(gatewayPid)),
        startFingerprint: gatewayStartFingerprint,
        state: 'T',
      }]
      : [],
  });
  const snapshot = ({
    runtimeAlive,
    requestedAt,
    snapshotStartedAt,
    snapshotCompletedAt,
    observedAt,
    stoppedAt = null,
    resumedAt = null,
    shutdownSettledAt = null,
  }) => {
    const runtimeProcess = {
      driverPidFingerprint: sha256(String(runtimePid)),
      gatewayPidFingerprint: sha256(String(gatewayPid)),
      processGroupFingerprint,
      expectedDriverStartFingerprint: runtimeStartFingerprint,
      expectedGatewayStartFingerprint: gatewayStartFingerprint,
      expectedGatewaySocketFingerprint: gatewaySocketFingerprint,
      expectedGatewayEndpoint: gatewayEndpoint,
      expectedAlive: runtimeAlive,
      before: runtimeSample(runtimeAlive),
      after: runtimeSample(runtimeAlive),
      quiescence: {
        required: runtimeAlive,
        stoppedAt,
        resumedAt,
        membersStopped: runtimeAlive ? 2 : null,
      },
      shutdownSettledAt,
      matched: true,
    };
    return {
      schema: 'openclaw.k6.return-covenant-store-observation.v1',
      status: 'observed',
      failureReason: null,
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive,
      runtimeProcess,
      requestedAt,
      snapshotStartedAt,
      snapshotCompletedAt,
      observedAt,
      identity,
      resources,
      sourceBinding,
      rawSnapshotSha256: jsonSha256({
        identity,
        resources,
        runtimeProcess,
        source: sourceBinding,
      }),
    };
  };
  return {
    schema: 'openclaw.k6.return-covenant-durable-store-chain.v1',
    stable: true,
    live: snapshot({
      runtimeAlive: true,
      requestedAt: '2026-08-28T12:09:31.010Z',
      snapshotStartedAt: '2026-08-28T12:09:31.012Z',
      snapshotCompletedAt: '2026-08-28T12:09:31.018Z',
      observedAt: '2026-08-28T12:09:31.020Z',
      stoppedAt: '2026-08-28T12:09:31.011Z',
      resumedAt: '2026-08-28T12:09:31.021Z',
    }),
    final: snapshot({
      runtimeAlive: false,
      requestedAt: '2026-08-28T12:09:32.300Z',
      snapshotStartedAt: '2026-08-28T12:09:32.310Z',
      snapshotCompletedAt: '2026-08-28T12:09:32.320Z',
      observedAt: '2026-08-28T12:09:32.330Z',
      shutdownSettledAt: '2026-08-28T12:09:32.200Z',
    }),
  };
}

function mutateRetentionResponse(evidence, mutation) {
  const response = JSON.parse(evidence.retentionObservation.response.body);
  mutation(response);
  const body = JSON.stringify(response);
  evidence.retentionObservation.response = {
    ...evidence.retentionObservation.response,
    body,
    bodySha256: sha256(body),
    byteLength: Buffer.byteLength(body),
  };
}

function makeRetentionUnavailable(evidence, reason = 'resource-inspection-unsupported') {
  const body = 'unsupported';
  evidence.retentionObservation = {
    ...evidence.retentionObservation,
    status: 'unverified-resource-retention',
    failureReason: reason,
    response: {
      status: 404,
      url: evidence.retentionObservation.response.url,
      contentType: 'text/plain',
      body,
      bodySha256: sha256(body),
      byteLength: Buffer.byteLength(body),
    },
  };
}

function resignCleanup(cleanup) {
  const {
    launcherIntegrity: _oldIntegrity,
    ...unsigned
  } = cleanup;
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

function rebindEvidenceForRetention(plan, evidence, driverAttestation) {
  refreshPhaseProofs(evidence, driverAttestation);
  evidence.caseHandleLedger = {
    schema: 'openclaw.k6.return-covenant-case-handle-ledger.v1',
    issued: evidence.phaseChains.map((chain) => ({
      caseId: chain.caseId,
      form: chain.form,
      caseHandle: chain.caseHandle,
    })),
    closed: evidence.phaseChains.map((chain) => ({
      caseId: chain.caseId,
      form: chain.form,
      caseHandle: chain.caseHandle,
      cleanupRequestNonce: chain.proofs?.cleanup?.requestNonce,
    })),
    open: [],
  };
  evidence.cleanupRun = {
    ...evidence.cleanupRun,
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
    driverAttestationSha256: driverAttestation.attestationSha256,
  };
  evidence.driverAttestationSha256 = driverAttestation.attestationSha256;
  refreshPhaseProofs(evidence, driverAttestation);
  evidence.cleanupRun = {
    ...evidence.cleanupRun,
    observationSetSha256: jsonSha256(evidence.observations),
    phaseChainSha256: jsonSha256(evidence.phaseChains),
  };
  refreshPhaseProofs(evidence, driverAttestation);
  evidence.retentionObservation = retentionObservationFor({
    plan,
    evidence,
  });
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
      endedAt: '2026-08-28T12:09:31.000Z',
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
  rebindEvidenceForRetention(plan, evidence, driverAttestation);
  if (options.retained) {
    evidence.retentionObservation = retentionObservationFor({
      plan,
      evidence,
      retained: options.retained,
    });
  }
  return result;
}

function bindCleanup(
  cleanup,
  evidence,
  driverAttestation,
  plan,
  durableStoreObservation,
) {
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
  ].map((entry, index) => {
    const walls = [
      [
        '2026-08-28T12:00:00.000Z',
        '2026-08-28T12:03:00.000Z',
        '2026-08-28T12:03:01.000Z',
      ],
      [
        '2026-08-28T12:03:02.000Z',
        '2026-08-28T12:08:00.000Z',
        '2026-08-28T12:08:01.000Z',
      ],
      [
        '2026-08-28T12:08:02.000Z',
        '2026-08-28T12:09:30.500Z',
        '2026-08-28T12:09:31.000Z',
      ],
    ][index];
    return {
      ...entry,
      firstSeenMonotonicMs: index * 10,
      lastSeenMonotonicMs: index * 10 + 5,
      exitedAtMonotonicMs: index * 10 + 9,
      firstSeenAt: walls[0],
      lastSeenAt: walls[1],
      exitedAt: walls[2],
      retainedAtCleanup: false,
    };
  });
  const closure = deriveReturnCovenantCaseHandleClosure({
    plan,
    evidence,
    driverAttestation,
  });
  const storeObservation = durableStoreObservation ||
    durableStoreObservationFor({
      plan,
      evidence,
      driverAttestation,
    });
  const retention = deriveReturnCovenantTrustedRetention({
    plan,
    evidence,
    driverAttestation,
    gatewayLifecycle,
    durableStoreObservation: storeObservation,
  });
  const unsigned = {
    ...cleanupWithoutIntegrity,
    runtimeBuildSha: driverAttestation.runtimeBuildSha,
    retained: {
      ...cleanupWithoutIntegrity.retained,
      ...retention.retained,
      gateways: cleanupWithoutIntegrity.retained.gateways,
      fixtureProcesses: cleanupWithoutIntegrity.retained.fixtureProcesses,
    },
    retentionAuthority: RETURN_COVENANT_RETENTION_AUTHORITY,
    resourceObservation: retention.resourceObservation,
    durableStoreObservation: storeObservation,
    allCaseHandlesClosed: closure.allCaseHandlesClosed,
    caseHandles: closure.caseHandles,
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
  rebindEvidenceForRetention(plan, evidence, driverAttestation);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
      plan,
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
      plan,
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
      plan,
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
    plan,
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
    plan,
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

test('candidate zero cleanup cannot mask docs-owned retained resources', async (t) => {
  for (const category of Object.keys(retentionResourceMethods)) {
    await t.test(category, async () => {
      const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
        await Promise.all([
          completeMatrix({ retained: { [category]: 1 } }),
          fixture('cleanup-pass.json'),
          fixture('runtime-config.valid.json'),
        ]);
      const receipt = resolveReturnCovenantAuthoritativeReceipt({
        plan,
        evidence,
        cleanup: bindCleanup(
          cleanupFixture,
          evidence,
          driverAttestation,
          plan,
          durableStoreObservationFor({
            plan,
            evidence,
            driverAttestation,
            retained: { [category]: 1 },
          }),
        ),
        runtimeConfig,
        driverAttestation,
        signingKey,
      });
      assert.equal(cleanupFixture.retained[category], 0);
      assert.equal(receipt.verdict, 'FAIL-candidate');
      assert.ok(receipt.failureCategories.includes('resource-retention'));
    });
  }
});

test('case-handle closure is derived from exact phase-chain coverage', async (t) => {
  const candidateClaims = await fixture('cleanup-pass.json');
  assert.equal(candidateClaims.allCaseHandlesClosed, true);
  for (const mode of ['missing', 'duplicated', 'explicitly-open']) {
    await t.test(mode, async () => {
      const [{ plan, evidence, driverAttestation }, runtimeConfig] =
        await Promise.all([
          completeMatrix(),
          fixture('runtime-config.valid.json'),
        ]);
      if (mode === 'missing') {
        evidence.phaseChains.pop();
      } else if (mode === 'duplicated') {
        evidence.phaseChains.push(structuredClone(evidence.phaseChains[0]));
      } else {
        evidence.caseHandleLedger.open.push(
          structuredClone(evidence.caseHandleLedger.issued[0]),
        );
      }
      const closure = deriveReturnCovenantCaseHandleClosure({
        plan,
        evidence,
        driverAttestation,
      });
      assert.equal(closure.allCaseHandlesClosed, false);
      const cleanup = bindCleanup(
        candidateClaims,
        evidence,
        driverAttestation,
        plan,
      );
      assert.equal(cleanup.allCaseHandlesClosed, false);
      const receipt = resolveReturnCovenantAuthoritativeReceipt({
        plan,
        evidence,
        cleanup,
        runtimeConfig,
        driverAttestation,
        signingKey,
      });
      assert.equal(receipt.verdict, 'FAIL-candidate');
      assert.ok(receipt.failureCategories.includes('phase-chain-mismatch'));
    });
  }
});

test('missing candidate resource-inspection seam cannot veto docs-owned stores', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  makeRetentionUnavailable(evidence);
  const cleanup = bindCleanup(
    cleanupFixture,
    evidence,
    driverAttestation,
    plan,
  );
  assert.equal(
    cleanup.resourceObservation.status,
    'unverified-resource-retention',
  );
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    evidence,
    cleanup,
    runtimeConfig,
    driverAttestation,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(receipt.failureCategories, []);
});

test('candidate retention diagnostics are not resource authority', async (t) => {
  const controls = {
    run: (evidence) => mutateRetentionResponse(
      evidence,
      (response) => { response.runId = 'rcv-ffffffffffffffffffffffffffffffff'; },
    ),
    sha: (evidence) => mutateRetentionResponse(
      evidence,
      (response) => { response.candidateSha = 'f'.repeat(40); },
    ),
    gateway: (evidence) => {
      evidence.retentionObservation.target.namespacePid += 1;
      mutateRetentionResponse(
        evidence,
        (response) => { response.gateway.namespacePid += 1; },
      );
    },
    'gateway-start': (evidence) => {
      evidence.retentionObservation.target.namespaceStartFingerprint =
        'f'.repeat(64);
      mutateRetentionResponse(
        evidence,
        (response) => {
          response.gateway.namespaceStartFingerprint = 'f'.repeat(64);
        },
      );
    },
    timestamp: (evidence) => mutateRetentionResponse(
      evidence,
      (response) => { response.observedAt = '2000-01-01T00:00:00.000Z'; },
    ),
    'response-url': (evidence) => {
      evidence.retentionObservation.response.url =
        'http://127.0.0.1:18790/v1/return-covenant/resource-inspection';
    },
  };
  for (const [name, mutate] of Object.entries(controls)) {
    await t.test(name, async () => {
      const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
        await Promise.all([
          completeMatrix(),
          fixture('cleanup-pass.json'),
          fixture('runtime-config.valid.json'),
        ]);
      mutate(evidence);
      const receipt = resolveReturnCovenantAuthoritativeReceipt({
        plan,
        evidence,
        cleanup: bindCleanup(
          cleanupFixture,
          evidence,
          driverAttestation,
          plan,
        ),
        runtimeConfig,
        driverAttestation,
        signingKey,
      });
      assert.equal(receipt.verdict, 'PASS-candidate');
      assert.deepEqual(receipt.failureCategories, []);
    });
  }

  await t.test('socket', async () => {
    const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
      await Promise.all([
        completeMatrix(),
        fixture('cleanup-pass.json'),
        fixture('runtime-config.valid.json'),
      ]);
    const cleanup = bindCleanup(
      cleanupFixture,
      evidence,
      driverAttestation,
      plan,
    );
    cleanup.resourceObservation.gatewaySocketFingerprint = 'f'.repeat(64);
    const receipt = resolveReturnCovenantAuthoritativeReceipt({
      plan,
      evidence,
      cleanup: resignCleanup(cleanup),
      runtimeConfig,
      driverAttestation,
      signingKey,
    });
    assert.equal(receipt.verdict, 'FAIL-candidate');
    assert.ok(receipt.failureCategories.includes('cleanup-failure'));
  });
});

test('malformed candidate retention diagnostics cannot veto canonical stores', async (t) => {
  const controls = {
    malformed(evidence) {
      const body = '{"malformed":';
      evidence.retentionObservation.response = {
        ...evidence.retentionObservation.response,
        body,
        bodySha256: sha256(body),
        byteLength: Buffer.byteLength(body),
      };
    },
    partial: (evidence) => mutateRetentionResponse(
      evidence,
      (response) => { response.resources.queueItems.complete = false; },
    ),
    'count-mismatch': (evidence) => mutateRetentionResponse(
      evidence,
      (response) => { response.resources.delegates.total = 1; },
    ),
    overflow: (evidence) => mutateRetentionResponse(
      evidence,
      (response) => {
        response.resources.delegates.items = Array.from(
          { length: 101 },
          (_, index) => ({
            id: `overflow-delegate-${index}`,
            runId: response.runId,
            status: 'retained',
          }),
        );
        response.resources.delegates.total = 101;
      },
    ),
  };
  for (const [name, mutate] of Object.entries(controls)) {
    await t.test(name, async () => {
      const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
        await Promise.all([
          completeMatrix(),
          fixture('cleanup-pass.json'),
          fixture('runtime-config.valid.json'),
        ]);
      mutate(evidence);
      const receipt = resolveReturnCovenantAuthoritativeReceipt({
        plan,
        evidence,
        cleanup: bindCleanup(
          cleanupFixture,
          evidence,
          driverAttestation,
          plan,
        ),
        runtimeConfig,
        driverAttestation,
        signingKey,
      });
      assert.equal(receipt.verdict, 'PASS-candidate');
      assert.deepEqual(receipt.failureCategories, []);
    });
  }
});

test('clean trusted resource observation plus independent process teardown passes', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
    await Promise.all([
      completeMatrix(),
      fixture('cleanup-pass.json'),
      fixture('runtime-config.valid.json'),
    ]);
  const cleanup = bindCleanup(
    cleanupFixture,
    evidence,
    driverAttestation,
    plan,
  );
  const validation = validateReturnCovenantRetentionObservation({
    plan,
    evidence,
    driverAttestation,
    gatewayLifecycle: cleanup.gatewayLifecycle,
  });
  assert.deepEqual(validation.retained, {
    delegates: 0,
    queueItems: 0,
    temporarySessions: 0,
  });
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(cleanup.retained.gateways, 0);
  assert.equal(cleanup.retained.fixtureProcesses, 0);
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
});

function canonicalSubagentPayload({
  runId,
  childSessionKey,
  requesterSessionKey,
  executionStatus = 'terminal',
  deliveryStatus = 'delivered',
  cleanupCompletedAt = 20,
}) {
  return {
    runId,
    childSessionKey,
    controllerSessionKey: requesterSessionKey,
    requesterSessionKey,
    requesterDisplayKey: requesterSessionKey,
    task: 'retention fixture task',
    cleanup: 'delete',
    createdAt: 1,
    expectsCompletionMessage: true,
    execution: {
      status: executionStatus,
      startedAt: 2,
      ...(executionStatus === 'terminal'
        ? { endedAt: 10, outcome: { status: 'ok' } }
        : {}),
    },
    completion: { required: true },
    delivery: {
      status: deliveryStatus,
      ...(deliveryStatus === 'pending' || deliveryStatus === 'in_progress'
        ? {
          payload: {
            requesterSessionKey,
            requesterDisplayKey: requesterSessionKey,
            childSessionKey,
            childRunId: runId,
            task: 'retention fixture task',
            expectsCompletionMessage: true,
          },
        }
        : {}),
    },
    ...(cleanupCompletedAt === undefined ? {} : { cleanupCompletedAt }),
  };
}

async function createProductShapedRetentionFixture() {
  const stateRoot = await mkdtemp(
    path.join(tmpdir(), 'return-covenant-product-store-'),
  );
  const snapshotRoot = await mkdtemp(
    path.join(tmpdir(), 'return-covenant-product-snapshot-'),
  );
  const databaseDir = path.join(stateRoot, 'state');
  const agentDatabaseDir = path.join(
    stateRoot,
    'agents',
    'proof',
    'agent',
  );
  await Promise.all([
    mkdir(databaseDir, { recursive: true, mode: 0o700 }),
    mkdir(agentDatabaseDir, { recursive: true, mode: 0o700 }),
  ]);
  const databasePath = path.join(databaseDir, 'openclaw.sqlite');
  const agentDatabasePath = path.join(
    agentDatabaseDir,
    'openclaw-agent.sqlite',
  );
  const database = new DatabaseSync(databasePath);
  const agentDatabase = new DatabaseSync(agentDatabasePath);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
  agentDatabase.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
  database.exec(`
    CREATE TABLE schema_meta (
      meta_key TEXT NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      agent_id TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO schema_meta VALUES
      ('primary', 'global', 13, NULL, 'fixture', 1, 1);
    CREATE TABLE agent_databases (
      agent_id TEXT NOT NULL,
      path TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      size_bytes INTEGER,
      PRIMARY KEY (agent_id, path)
    ) STRICT;
    CREATE TABLE delivery_queue_entries (
      queue_name TEXT NOT NULL,
      id TEXT NOT NULL,
      status TEXT NOT NULL,
      entry_kind TEXT,
      session_key TEXT,
      channel TEXT,
      target TEXT,
      account_id TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      last_error TEXT,
      recovery_state TEXT,
      platform_send_started_at INTEGER,
      entry_json TEXT NOT NULL,
      enqueued_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      failed_at INTEGER,
      PRIMARY KEY (queue_name, id)
    ) STRICT;
    CREATE TABLE subagent_runs (
      run_id TEXT NOT NULL PRIMARY KEY,
      child_session_key TEXT NOT NULL,
      controller_session_key TEXT,
      requester_session_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}'
    ) STRICT;
    CREATE TABLE flow_runs (
      flow_id TEXT NOT NULL PRIMARY KEY,
      shape TEXT,
      sync_mode TEXT NOT NULL DEFAULT 'managed',
      owner_key TEXT NOT NULL,
      chain_id TEXT,
      requester_origin_json TEXT,
      controller_id TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      notify_policy TEXT NOT NULL,
      goal TEXT NOT NULL,
      current_step TEXT,
      blocked_task_id TEXT,
      blocked_summary TEXT,
      state_json TEXT,
      wait_json TEXT,
      cancel_requested_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ended_at INTEGER
    ) STRICT;
    PRAGMA user_version=13;
  `);
  agentDatabase.exec(`
    CREATE TABLE schema_meta (
      meta_key TEXT NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      agent_id TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO schema_meta VALUES
      ('primary', 'agent', 19, 'proof', 'fixture', 1, 1);
    CREATE TABLE session_nodes (
      session_key TEXT NOT NULL PRIMARY KEY,
      current_session_id TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      entry_valid INTEGER NOT NULL DEFAULT 0 CHECK (entry_valid IN (-1, 0, 1)),
      updated_at INTEGER NOT NULL,
      status TEXT CHECK (status IS NULL OR status IN ('running', 'done', 'failed', 'killed', 'timeout')),
      created_at INTEGER,
      created_via TEXT CHECK (created_via IS NULL OR created_via IN ('operator', 'spawn', 'channel', 'cron', 'talk', 'run', 'plugin', 'internal')),
      created_actor_type TEXT CHECK (created_actor_type IS NULL OR created_actor_type IN ('human', 'agent', 'system')),
      created_actor_id TEXT,
      owner_actor_type TEXT,
      owner_actor_id TEXT,
      owner_assigned_by_type TEXT,
      owner_assigned_by_id TEXT,
      owner_assigned_at INTEGER,
      project_id TEXT,
      parent_session_key TEXT,
      spawned_by TEXT,
      fork_source_session_key TEXT,
      fork_source_session_id TEXT,
      fork_source_entry_id TEXT,
      label TEXT,
      display_name TEXT,
      category TEXT,
      icon TEXT,
      pinned_at INTEGER,
      archived_at INTEGER,
      last_read_at INTEGER,
      last_interaction_at INTEGER,
      last_activity_at INTEGER
    ) STRICT;
    CREATE TABLE session_windows (
      session_id TEXT NOT NULL PRIMARY KEY,
      session_key TEXT NOT NULL,
      previous_session_id TEXT,
      reason TEXT,
      session_scope TEXT NOT NULL DEFAULT 'conversation',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      transcript_updated_at INTEGER DEFAULT NULL,
      transcript_observed_at INTEGER DEFAULT NULL,
      session_entry_provenance INTEGER NOT NULL DEFAULT 0,
      acp_owned INTEGER NOT NULL DEFAULT 0,
      plugin_owner_id TEXT,
      hook_external_content_source TEXT,
      started_at INTEGER,
      ended_at INTEGER,
      status TEXT,
      chat_type TEXT,
      channel TEXT,
      account_id TEXT,
      primary_conversation_id TEXT,
      model_provider TEXT,
      model TEXT,
      agent_harness_id TEXT,
      parent_session_key TEXT,
      spawned_by TEXT,
      display_name TEXT
    ) STRICT;
    PRAGMA user_version=19;
  `);
  database.prepare(`
    INSERT INTO agent_databases
      (agent_id, path, schema_version, last_seen_at, size_bytes)
    VALUES ('proof', 'agents/proof/agent/openclaw-agent.sqlite', 19, 1, NULL)
  `).run();
  const rootEntry = {
    sessionId: 'root-session',
    updatedAt: 1,
    status: 'running',
    createdVia: 'internal',
    spawnDepth: 0,
  };
  agentDatabase.prepare(`
    INSERT INTO session_nodes (
      session_key, current_session_id, entry_json, entry_valid,
      updated_at, status, created_at, created_via
    ) VALUES (?, ?, ?, 1, 1, 'running', 1, 'internal')
  `).run(
    'agent:proof:main',
    rootEntry.sessionId,
    JSON.stringify(rootEntry),
  );
  agentDatabase.prepare(`
    INSERT INTO session_windows (
      session_id, session_key, session_scope, created_at, updated_at,
      session_entry_provenance, acp_owned, status
    ) VALUES (?, 'agent:proof:main', 'conversation', 1, 1, 1, 0, 'running')
  `).run(rootEntry.sessionId);
  database.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  agentDatabase.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  let closed = false;
  let snapshotIndex = 0;
  return {
    stateRoot,
    databasePath,
    agentDatabasePath,
    database,
    agentDatabase,
    insertSubagent({
      runId = 'run-retained',
      childSessionKey = 'agent:proof:subagent:retained',
      payload = canonicalSubagentPayload({
        runId,
        childSessionKey,
        requesterSessionKey: 'agent:proof:main',
        executionStatus: 'running',
        deliveryStatus: 'pending',
        cleanupCompletedAt: undefined,
      }),
    } = {}) {
      database.prepare(`
        INSERT INTO subagent_runs (
          run_id, child_session_key, controller_session_key,
          requester_session_key, created_at, payload_json
        ) VALUES (?, ?, 'agent:proof:main', 'agent:proof:main', 1, ?)
      `).run(runId, childSessionKey, JSON.stringify(payload));
    },
    insertFlow({
      flowId = 'flow-retained',
      status = 'running',
      endedAt = null,
      state = {
        kind: 'continuation_delegate',
        task: 'retained continuation',
        childSessionKey: 'agent:proof:subagent:retained',
        originRunId: 'run-retained',
      },
    } = {}) {
      database.prepare(`
        INSERT INTO flow_runs (
          flow_id, shape, sync_mode, owner_key, chain_id,
          requester_origin_json, controller_id, revision, status,
          notify_policy, goal, current_step, blocked_task_id,
          blocked_summary, state_json, wait_json, cancel_requested_at,
          created_at, updated_at, ended_at
        ) VALUES (
          ?, NULL, 'managed', 'agent:proof:main', NULL, NULL,
          'core/continuation-delegate', 0, ?, 'silent',
          'Continuation delegate', 'retention fixture', NULL, NULL,
          ?, NULL, NULL, 1, 1, ?
        )
      `).run(flowId, status, JSON.stringify(state), endedAt);
    },
    insertDelivery({
      id = 'delivery-retained',
      status = 'pending',
      recoveryState = null,
      deliveryStartedAt = 2,
    } = {}) {
      const unfinished =
        status === 'pending' ||
        (status === 'failed' && recoveryState === 'settlement_pending');
      const entry = unfinished ? {
        id,
        enqueuedAt: 1,
        retryCount: 0,
        kind: 'agentTurn',
        sessionKey: 'agent:proof:main',
        message: 'retained result',
        messageId: 'retained-message',
        ...(deliveryStartedAt == null ? {} : { deliveryStartedAt }),
        ...(recoveryState === null ? {} : { recoveryState }),
        owner: {
          kind: 'subagent_completion',
          runId: 'run-retained',
          taskId: 'task-retained',
          generation: 1,
          deadlineAt: 10,
        },
      } : {
        id,
        enqueuedAt: 1,
        retryCount: 0,
        ...(status === 'completed'
          ? { acknowledgedAt: 1 }
          : { failedAt: 1 }),
      };
      database.prepare(`
        INSERT INTO delivery_queue_entries (
          queue_name, id, status, entry_kind, session_key, channel,
          target, account_id, retry_count, last_attempt_at, last_error,
          recovery_state, platform_send_started_at, entry_json,
          enqueued_at, updated_at, failed_at
        ) VALUES (
          'session', ?, ?, ?, ?, NULL,
          NULL, NULL, 0, NULL, NULL, ?, NULL, ?, 1, 1,
          CASE WHEN ? = 'failed' THEN 1 ELSE NULL END
        )
      `).run(
        id,
        status,
        unfinished ? 'agentTurn' : null,
        unfinished ? 'agent:proof:main' : null,
        recoveryState,
        JSON.stringify(entry),
        status,
      );
    },
    insertTemporarySession({
      sessionKey = 'agent:proof:subagent:retained',
      spawnedBy = 'agent:proof:main',
    } = {}) {
      const entry = {
        sessionId: `temporary-${sha256(sessionKey).slice(0, 16)}`,
        updatedAt: 2,
        createdAt: 2,
        status: 'running',
        createdVia: 'spawn',
        spawnedBy,
        parentSessionKey: spawnedBy,
        spawnDepth: 1,
      };
      agentDatabase.prepare(`
        INSERT INTO session_nodes (
          session_key, current_session_id, entry_json, entry_valid,
          updated_at, status, created_at, created_via,
          parent_session_key, spawned_by
        ) VALUES (?, ?, ?, 1, 2, 'running', 2, 'spawn',
          ?, ?)
      `).run(
        sessionKey,
        entry.sessionId,
        JSON.stringify(entry),
        spawnedBy,
        spawnedBy,
      );
      agentDatabase.prepare(`
        INSERT INTO session_windows (
          session_id, session_key, session_scope, created_at, updated_at,
          session_entry_provenance, acp_owned, status,
          parent_session_key, spawned_by
        ) VALUES (?, ?, 'conversation', 2, 2, 1, 0, 'running', ?, ?)
      `).run(entry.sessionId, sessionKey, spawnedBy, spawnedBy);
    },
    async observe({ testHooks } = {}) {
      const { plan, evidence } = await completeMatrix();
      snapshotIndex += 1;
      return await inspectReturnCovenantDurableStores({
        plan,
        evidence,
        statePath: stateRoot,
        snapshotPath: path.join(
          snapshotRoot,
          `trusted-snapshot-${snapshotIndex}`,
        ),
        runtimeProcess: {
          // Legacy fields keep this control runnable against rejected
          // implementation 281552c0; the successor ignores them.
          pid: 2_147_483_000,
          startFingerprint: 'd'.repeat(64),
          processGroupId: 2_147_483_000,
          driver: {
            pid: 2_147_483_000,
            startFingerprint: 'd'.repeat(64),
          },
          gateway: {
            pid: 2_147_483_001,
            startFingerprint: 'e'.repeat(64),
            socketFingerprint: 'f'.repeat(64),
            endpoint: 'http://127.0.0.1:18791',
          },
          shutdownSettledAt: new Date(Date.now() - 1_000).toISOString(),
        },
        expectedRuntimeAlive: false,
        testHooks,
      });
    },
    close() {
      if (closed) return;
      closed = true;
      database.close();
      agentDatabase.close();
    },
    async dispose() {
      this.close();
      await Promise.all([
        rm(stateRoot, { recursive: true, force: true }),
        rm(snapshotRoot, { recursive: true, force: true }),
      ]);
    },
  };
}

test('durable inspector matches current product-shaped retention stores', async (t) => {
  await t.test('clean exact stores pass and root sessions are irrelevant', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.deepEqual(observed.resources, {
        delegates: [],
        queueItems: [],
        temporarySessions: [],
      });
      assert.equal(
        observed.sourceBinding.productStoreContractSha,
        RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA,
      );
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('retained payload_json subagent fails closed', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertSubagent();
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.delegates.length, 1);
      assert.equal(observed.resources.delegates[0].deliveryStatus, 'pending');
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('required in-progress final delivery retains a terminal run', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertSubagent({
        payload: canonicalSubagentPayload({
          runId: 'run-retained',
          childSessionKey: 'agent:proof:subagent:retained',
          requesterSessionKey: 'agent:proof:main',
          executionStatus: 'terminal',
          deliveryStatus: 'in_progress',
          cleanupCompletedAt: 20,
        }),
      });
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.delegates.length, 1);
      assert.equal(observed.resources.delegates[0].requiredDelivery, true);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('retained delivery row preserves attempt ownership', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertDelivery();
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.queueItems.length, 1);
      assert.equal(observed.resources.queueItems[0].attemptOwned, true);
      assert.equal(
        observed.resources.queueItems[0].source,
        'delivery_queue_entries',
      );
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('writer-supplied media staging entry kind is canonical', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      const entry = {
        id: 'media-stage-retained',
        enqueuedAt: 1,
        retryCount: 0,
        artifacts: [],
      };
      fixtureState.database.prepare(`
        INSERT INTO delivery_queue_entries (
          queue_name, id, status, entry_kind, session_key, channel,
          target, account_id, retry_count, last_attempt_at, last_error,
          recovery_state, platform_send_started_at, entry_json,
          enqueued_at, updated_at, failed_at
        ) VALUES (
          'outbound-media-staging', ?, 'pending',
          'outbound-media-stage', NULL, NULL, NULL, NULL,
          0, NULL, NULL, NULL, NULL, ?, 1, 1, NULL
        )
      `).run(entry.id, JSON.stringify(entry));
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.queueItems.length, 1);
      assert.equal(
        observed.resources.queueItems[0].entryKind,
        'outbound-media-stage',
      );
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('retained canonical child session is relevant', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertSubagent({
        payload: canonicalSubagentPayload({
          runId: 'run-retained',
          childSessionKey: 'agent:proof:subagent:retained',
          requesterSessionKey: 'agent:proof:main',
        }),
      });
      fixtureState.insertTemporarySession();
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.delegates.length, 0);
      assert.equal(observed.resources.temporarySessions.length, 1);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('canonical retained-window tombstone is not a live session', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertTemporarySession();
      fixtureState.agentDatabase.prepare(`
        UPDATE session_nodes
        SET entry_json = '{}', entry_valid = -1, status = NULL,
            created_at = NULL, created_via = NULL,
            parent_session_key = NULL, spawned_by = NULL
        WHERE session_key = 'agent:proof:subagent:retained'
      `).run();
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.temporarySessions.length, 0);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('flow and delivery terminal siblings are excluded exactly', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertFlow({
        flowId: 'flow-terminal-lost',
        status: 'lost',
        endedAt: 4,
      });
      fixtureState.insertFlow({
        flowId: 'flow-terminal-blocked',
        status: 'blocked',
        endedAt: 5,
      });
      fixtureState.insertFlow({
        flowId: 'flow-live-blocked',
        status: 'blocked',
      });
      fixtureState.insertDelivery({
        id: 'delivery-completed',
        status: 'completed',
        deliveryStartedAt: null,
      });
      fixtureState.insertDelivery({
        id: 'delivery-failed',
        status: 'failed',
        deliveryStartedAt: null,
      });
      fixtureState.insertDelivery({
        id: 'delivery-settlement-pending',
        status: 'failed',
        recoveryState: 'settlement_pending',
        deliveryStartedAt: null,
      });
      const terminalFailure = {
        id: 'delivery-terminal-diagnostic',
        enqueuedAt: 1,
        retryCount: 0,
        failedAt: 1,
        completionRetention: 'permanent',
        recoveryState: 'completed_permanent',
      };
      fixtureState.database.prepare(`
        INSERT INTO delivery_queue_entries (
          queue_name, id, status, entry_kind, session_key, channel,
          target, account_id, retry_count, last_attempt_at, last_error,
          recovery_state, platform_send_started_at, entry_json,
          enqueued_at, updated_at, failed_at
        ) VALUES (
          'session', ?, 'failed', NULL, NULL, NULL, NULL, NULL,
          0, NULL, 'invalid source payload', 'completed_permanent',
          NULL, ?, 1, 1, 1
        )
      `).run(terminalFailure.id, JSON.stringify(terminalFailure));
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.deepEqual(
        observed.resources.queueItems.map((entry) => entry.id),
        [
          'delivery:session:delivery-settlement-pending',
        ],
      );
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('run-bound flow child keys retain canonical spawned sessions', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertFlow();
      fixtureState.insertTemporarySession();
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.temporarySessions.length, 1);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('alternate continuation targets bind retained child sessions', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      const targetSessionKey = 'agent:proof:subagent:alternate-target';
      const recipientSessionKey =
        'agent:proof:subagent:selected-authority-recipient';
      const payload = canonicalSubagentPayload({
        runId: 'run-terminal-target',
        childSessionKey: 'agent:proof:subagent:completed',
        requesterSessionKey: 'agent:proof:main',
      });
      payload.continuationTargetSessionKeys = [targetSessionKey];
      payload.continuationRecipientAuthorityBinding = {
        version: 1,
        selection: 'selected',
        recipients: [{
          sessionKey: recipientSessionKey,
          authority: {
            state: 'bound',
            epoch: '123e4567-e89b-42d3-a456-426614174000',
          },
        }],
      };
      fixtureState.insertSubagent({
        runId: payload.runId,
        childSessionKey: payload.childSessionKey,
        payload,
      });
      fixtureState.insertTemporarySession({
        sessionKey: targetSessionKey,
        spawnedBy: 'agent:proof:other-parent',
      });
      fixtureState.insertTemporarySession({
        sessionKey: recipientSessionKey,
        spawnedBy: 'agent:proof:other-parent',
      });
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.deepEqual(
        observed.resources.temporarySessions.map((entry) => entry.sessionKey),
        [targetSessionKey, recipientSessionKey],
      );
    } finally {
      await fixtureState.dispose();
    }
  });

  for (const mode of ['execution-status', 'delivery-status', 'malformed-json']) {
    await t.test(`unknown or malformed subagent payload: ${mode}`, async () => {
      const fixtureState = await createProductShapedRetentionFixture();
      try {
        const payload = canonicalSubagentPayload({
          runId: 'run-malformed',
          childSessionKey: 'agent:proof:subagent:malformed',
          requesterSessionKey: 'agent:proof:main',
        });
        if (mode === 'execution-status') payload.execution.status = 'paused';
        if (mode === 'delivery-status') payload.delivery.status = 'unknown';
        fixtureState.insertSubagent({
          runId: 'run-malformed',
          childSessionKey: 'agent:proof:subagent:malformed',
          payload,
        });
        if (mode === 'malformed-json') {
          fixtureState.database.prepare(
            "UPDATE subagent_runs SET payload_json = '{'",
          ).run();
        }
        const observed = await fixtureState.observe();
        assert.equal(observed.status, 'unverified-resource-retention');
        assert.match(observed.failureReason, /payload_json/);
      } finally {
        await fixtureState.dispose();
      }
    });
  }

  await t.test('malformed required final-delivery payload fails closed', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      const payload = canonicalSubagentPayload({
        runId: 'run-malformed-delivery',
        childSessionKey: 'agent:proof:subagent:malformed-delivery',
        requesterSessionKey: 'agent:proof:main',
        executionStatus: 'terminal',
        deliveryStatus: 'pending',
      });
      payload.delivery.payload = 'not-an-object';
      fixtureState.insertSubagent({
        runId: payload.runId,
        childSessionKey: payload.childSessionKey,
        payload,
      });
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'unverified-resource-retention');
      assert.match(observed.failureReason, /delivery\.payload/);
    } finally {
      await fixtureState.dispose();
    }
  });

  for (const mode of [
    'missing',
    'renamed-column',
    'view',
    'session-view',
  ]) {
    await t.test(`canonical table shape fails closed: ${mode}`, async () => {
      const fixtureState = await createProductShapedRetentionFixture();
      try {
        if (mode === 'missing') {
          fixtureState.database.exec('DROP TABLE delivery_queue_entries;');
        } else if (mode === 'renamed-column') {
          fixtureState.database.exec(
            'ALTER TABLE subagent_runs RENAME COLUMN payload_json TO payload_blob;',
          );
        } else if (mode === 'view') {
          fixtureState.database.exec(`
            ALTER TABLE flow_runs RENAME TO flow_runs_real;
            CREATE VIEW flow_runs AS SELECT * FROM flow_runs_real;
          `);
        } else {
          fixtureState.agentDatabase.exec(`
            ALTER TABLE session_nodes RENAME TO session_nodes_real;
            CREATE VIEW session_nodes AS SELECT * FROM session_nodes_real;
          `);
        }
        const observed = await fixtureState.observe();
        assert.equal(observed.status, 'unverified-resource-retention');
        assert.match(
          observed.failureReason,
          /canonical|exact product columns/,
        );
      } finally {
        await fixtureState.dispose();
      }
    });
  }

  for (const mode of [
    'flow-status',
    'delivery-status',
    'delivery-json',
    'session-json',
    'agent-layout',
  ]) {
    await t.test(`unknown canonical store state fails closed: ${mode}`, async () => {
      const fixtureState = await createProductShapedRetentionFixture();
      try {
        if (mode === 'flow-status') {
          fixtureState.insertFlow({ status: 'paused' });
        } else if (mode === 'delivery-status') {
          fixtureState.insertDelivery({ status: 'retrying' });
        } else if (mode === 'delivery-json') {
          fixtureState.insertDelivery();
          fixtureState.database.prepare(
            "UPDATE delivery_queue_entries SET entry_json = '{'",
          ).run();
        } else if (mode === 'session-json') {
          fixtureState.insertFlow();
          fixtureState.insertTemporarySession();
          fixtureState.agentDatabase.prepare(
            "UPDATE session_nodes SET entry_json = '{' WHERE created_via = 'spawn'",
          ).run();
        } else {
          fixtureState.database.prepare(
            "UPDATE agent_databases SET path = 'agents/proof/sessions/sessions.json'",
          ).run();
        }
        const observed = await fixtureState.observe();
        assert.equal(observed.status, 'unverified-resource-retention');
      } finally {
        await fixtureState.dispose();
      }
    });
  }

  await t.test('symlinked canonical database is rejected', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.close();
      const movedPath = `${fixtureState.databasePath}.real`;
      await rename(fixtureState.databasePath, movedPath);
      await symlink(movedPath, fixtureState.databasePath);
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'unverified-resource-retention');
      assert.match(observed.failureReason, /canonical bounded file/);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('pathname swap after no-follow open is rejected', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.close();
      const replacementPath = `${fixtureState.databasePath}.replacement`;
      const replacement = new DatabaseSync(replacementPath);
      replacement.exec('CREATE TABLE replacement (id TEXT) STRICT;');
      replacement.close();
      const originalPath = `${fixtureState.databasePath}.opened`;
      let swapped = false;
      const observed = await fixtureState.observe({
        testHooks: {
          async afterSourceOpen({ databasePath }) {
            if (databasePath !== fixtureState.databasePath || swapped) return;
            swapped = true;
            await rename(fixtureState.databasePath, originalPath);
            await rename(replacementPath, fixtureState.databasePath);
          },
        },
      });
      assert.equal(observed.status, 'unverified-resource-retention');
      assert.match(observed.failureReason, /changed during snapshot/);
    } finally {
      await fixtureState.dispose();
    }
  });

  await t.test('WAL-only retained delivery row is observed', async () => {
    const fixtureState = await createProductShapedRetentionFixture();
    try {
      fixtureState.insertDelivery({ id: 'wal-only-delivery' });
      const mainOnlyPath = path.join(fixtureState.stateRoot, 'main-only.sqlite');
      await writeFile(mainOnlyPath, await readFile(fixtureState.databasePath));
      const mainOnly = new DatabaseSync(mainOnlyPath, { readOnly: true });
      try {
        assert.equal(
          mainOnly.prepare(
            'SELECT count(*) AS count FROM delivery_queue_entries',
          ).get().count,
          0,
        );
      } finally {
        mainOnly.close();
      }
      const observed = await fixtureState.observe();
      assert.equal(observed.status, 'observed', observed.failureReason);
      assert.equal(observed.resources.queueItems.length, 1);
      assert.equal(
        observed.sourceBinding.databases[0].source.wal.size > 0,
        true,
      );
    } finally {
      await fixtureState.dispose();
    }
  });
});

test('durable-store authority requires an attested live leg and stable shutdown leg', async (t) => {
  for (const mode of [
    'runtime-dead',
    'unstable',
    'pid-start-changed',
    'live-overlaps-teardown',
    'source-failure',
  ]) {
    await t.test(mode, async () => {
      const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] =
        await Promise.all([
          completeMatrix(),
          fixture('cleanup-pass.json'),
          fixture('runtime-config.valid.json'),
        ]);
      const storeObservation = durableStoreObservationFor({
        plan,
        evidence,
        driverAttestation,
      });
      if (mode === 'runtime-dead') {
        storeObservation.live.runtimeAlive = false;
        storeObservation.live.runtimeProcess = {
          ...storeObservation.live.runtimeProcess,
          matched: false,
        };
      } else if (mode === 'unstable') {
        storeObservation.stable = false;
      } else if (mode === 'pid-start-changed') {
        storeObservation.live.runtimeProcess.after.driverStartFingerprint =
          'f'.repeat(64);
        storeObservation.live.rawSnapshotSha256 = jsonSha256({
          identity: storeObservation.live.identity,
          resources: storeObservation.live.resources,
          runtimeProcess: storeObservation.live.runtimeProcess,
          source: storeObservation.live.sourceBinding,
        });
      } else if (mode === 'source-failure') {
        storeObservation.stable = false;
        storeObservation.final = {
          ...storeObservation.final,
          status: 'unverified-resource-retention',
          failureReason: 'canonical store identity changed during snapshot',
          snapshotStartedAt: null,
          snapshotCompletedAt: null,
          resources: {
            delegates: null,
            queueItems: null,
            temporarySessions: null,
          },
          sourceBinding: null,
          rawSnapshotSha256: null,
        };
      }
      const cleanup = bindCleanup(
        cleanupFixture,
        evidence,
        driverAttestation,
        plan,
        storeObservation,
      );
      if (mode === 'live-overlaps-teardown') {
        evidence.teardown.startedAt = '2026-08-28T12:09:31.015Z';
        evidence.teardown.completedAt = '2026-08-28T12:09:31.025Z';
      }
      const receipt = resolveReturnCovenantAuthoritativeReceipt({
        plan,
        evidence,
        cleanup,
        runtimeConfig,
        driverAttestation,
        signingKey,
      });
      assert.equal(receipt.verdict, 'FAIL-candidate');
      assert.ok(
        receipt.failureCategories.includes('unverified-resource-retention'),
      );
    });
  }
});

test('signed observer receipt binds the complete matrix and publishes no raw identities', async () => {
  const [{ plan, evidence, driverAttestation }, cleanupFixture, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-pass.json'),
    fixture('runtime-config.valid.json'),
  ]);
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation, plan);
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
  const cleanupFailure = bindCleanup(
    cleanupFixture,
    evidence,
    driverAttestation,
    plan,
  );
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation, plan);
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
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation, plan);
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
    const gatewayListeners = await inspectProcessLoopbackListeners(gatewayPid);
    assert.equal(
      attestation.gateway.socketFingerprint,
      fingerprintProcessLoopbackListeners(gatewayListeners),
    );
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

async function runTrustedLauncherFixture(transformDriver = (source) => source) {
  const sourceDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-source-'));
  const inputDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-input-'));
  const controlDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-control-'));
  const artifactDir = await mkdtemp(path.join(tmpdir(), 'return-covenant-artifact-'));
  try {
    const driverRelative = 'fixture-driver.mjs';
    const driverPath = path.join(sourceDir, driverRelative);
    const driverSource = transformDriver(
      await readFile(
        path.join(fixtures, 'mock-product-driver.mjs'),
        'utf8',
      ),
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
      throw new Error(JSON.stringify({
        earlyExit,
        stderr: launcherStderr,
        stdout: launcherStdout,
        driverLog: await readFile(path.join(controlDir, 'driver.log'), 'utf8')
          .catch(() => ''),
      }));
    }
    const launcherExitCode = await launcherExit;
    const readOptionalJson = (file) => readFile(file, 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    const [receipt, cleanup, candidateDiagnostic, k6Log] = await Promise.all([
      readOptionalJson(path.join(artifactDir, 'observer-receipt.json')),
      readOptionalJson(path.join(controlDir, 'cleanup.json')),
      readOptionalJson(path.join(controlDir, 'candidate-cleanup-diagnostic.json')),
      readFile(path.join(controlDir, 'k6.log'), 'utf8').catch(() => ''),
    ]);
    let evidence = null;
    try {
      evidence = parseReturnCovenantEvidenceLog(k6Log);
    } catch {
      evidence = null;
    }
    return {
      attestation,
      candidateDiagnostic,
      cleanup,
      controlDir,
      evidence,
      launcherExitCode,
      launcherStderr,
      launcherStdout,
      receipt,
      debug: {
        driverLog: await readFile(path.join(controlDir, 'driver.log'), 'utf8')
          .catch(() => ''),
        k6Exit: await readFile(path.join(controlDir, 'k6-exit-code.txt'), 'utf8')
          .catch(() => ''),
        k6LogTail: k6Log.split('\n').slice(-20),
      },
      async dispose() {
        await Promise.all([
          rm(sourceDir, { recursive: true, force: true }),
          rm(inputDir, { recursive: true, force: true }),
          rm(controlDir, { recursive: true, force: true }),
          rm(artifactDir, { recursive: true, force: true }),
        ]);
      },
    };
  } catch (error) {
    await Promise.all([
      rm(sourceDir, { recursive: true, force: true }),
      rm(inputDir, { recursive: true, force: true }),
      rm(controlDir, { recursive: true, force: true }),
      rm(artifactDir, { recursive: true, force: true }),
    ]);
    throw error;
  }
}

test('trusted launcher owns snapshot, isolation, process start, and final cleanup', async () => {
  const result = await runTrustedLauncherFixture();
  try {
    assert.equal(
      result.launcherExitCode,
      0,
      JSON.stringify({
        stderr: result.launcherStderr,
        stdout: result.launcherStdout,
        failureCategories: result.receipt?.failureCategories,
        launcherCleanup: result.cleanup,
        ...result.debug,
        firstObservation: result.evidence?.observations?.[0],
        firstPhaseChain: result.evidence?.phaseChains?.[0],
        scenarioFailures: result.evidence?.scenarioFailures,
        executionErrors: result.evidence?.executionErrors,
        cleanup: result.receipt?.cleanup,
        binding: result.receipt?.binding,
        failingCases: result.receipt?.matrix?.cases
          .filter((entry) => entry.validation === 'fail')
          .map((entry) => ({
            key: `${entry.caseId}:${entry.form}`,
            failures: entry.failureCategories,
          })),
      }),
    );
    const controlFiles = await readdir(result.controlDir);
    assert.ok(
      controlFiles.includes('driver-attestation.json') &&
        controlFiles.includes('cleanup.json'),
      JSON.stringify({
          stdout: result.launcherStdout,
          stderr: result.launcherStderr,
        controlFiles,
      }),
    );
    assert.equal(result.attestation.launcher.createdByTrustedLauncher, true);
    assert.notEqual(
      result.attestation.isolation.driverPid,
      result.attestation.isolation.gatewayPid,
    );
    assert.equal(result.cleanup.snapshotMatchedCandidateAfterRun, true);
    assert.equal(result.cleanup.runRootRemoved, true);
    assert.equal(result.cleanup.driverExitCode, 0);
    assert.deepEqual(result.cleanup.retained, {
      delegates: 0,
      queueItems: 0,
      temporarySessions: 0,
      gateways: 0,
      fixtureProcesses: 0,
    });
    assert.equal(result.cleanup.resourceObservation.status, 'verified');
    const liveStore = result.cleanup.durableStoreObservation.live;
    const finalStore = result.cleanup.durableStoreObservation.final;
    assert.equal(liveStore.runtimeProcess.quiescence.required, true);
    assert.equal(liveStore.runtimeProcess.matched, true);
    assert.equal(
      canonicalJson(liveStore.runtimeProcess.before),
      canonicalJson(liveStore.runtimeProcess.after),
    );
    assert.ok(
      liveStore.sourceBinding.databases.some((entry) =>
        entry.source.wal?.size > 0),
      'live observation did not bind any WAL bytes',
    );
    assert.ok(
      Date.parse(liveStore.observedAt) <=
        Date.parse(result.evidence.teardown.startedAt),
    );
    assert.ok(
      Date.parse(result.evidence.teardown.completedAt) <=
        Date.parse(finalStore.runtimeProcess.shutdownSettledAt),
    );
    assert.ok(
      Date.parse(finalStore.runtimeProcess.shutdownSettledAt) <=
        Date.parse(finalStore.requestedAt),
    );
    assert.equal(result.candidateDiagnostic.passEligible, false);
    assert.equal(
      result.receipt.verdict,
      'PASS-candidate',
      result.receipt.failureCategories.join(', '),
    );
    assert.equal(
      result.receipt.integrity.algorithm,
      RETURN_COVENANT_INTEGRITY_ALGORITHM,
    );
    assert.deepEqual(
      validateReturnCovenantAuthoritativeReceipt(
        result.receipt,
        result.attestation.phaseSigningKey,
      ),
      { valid: false, reason: 'invalid-integrity' },
    );
    assert.notEqual(
      result.cleanup.launcherIntegrity.signature,
      createHmac('sha256', result.attestation.phaseSigningKey)
        .update(canonicalJson(
          (({ launcherIntegrity: _ignored, ...value }) => value)(result.cleanup),
        ))
        .digest('hex'),
    );
    assert.equal(
      (await verifyReturnCovenantDirectCleanup(result.attestation)).verified,
      true,
    );
  } finally {
    await result.dispose();
  }
});

test('trusted launcher does not require the absent product inspection endpoint', async () => {
  const result = await runTrustedLauncherFixture((source) =>
    source.replace('inspectionFault: null', "inspectionFault: 'unsupported'"));
  try {
    assert.equal(
      result.launcherExitCode,
      0,
      JSON.stringify({
        stderr: result.launcherStderr,
        cleanup: result.cleanup,
        receipt: result.receipt,
        ...result.debug,
      }),
    );
    assert.equal(
      result.cleanup.resourceObservation.status,
      'unverified-resource-retention',
    );
    assert.equal(
      result.cleanup.durableStoreObservation.live.status,
      'observed',
    );
    assert.deepEqual(result.cleanup.retained, {
      delegates: 0,
      queueItems: 0,
      temporarySessions: 0,
      gateways: 0,
      fixtureProcesses: 0,
    });
    assert.equal(result.receipt.verdict, 'PASS-candidate');
  } finally {
    await result.dispose();
  }
});

for (const category of Object.keys(retentionResourceMethods)) {
  test(`trusted launcher rejects candidate zero lie for ${category}`, async () => {
      const result = await runTrustedLauncherFixture((source) =>
        source
          .replace(
            'retainedResource: null',
            `retainedResource: '${category}'`,
          )
          .replace(
            'candidateClaimsClean: false',
            'candidateClaimsClean: true',
          ));
      try {
        assert.equal(result.launcherExitCode, 1);
        assert.ok(result.candidateDiagnostic, JSON.stringify({
          cleanup: result.cleanup,
          debug: result.debug,
          receipt: result.receipt,
          stderr: result.launcherStderr,
          stdout: result.launcherStdout,
        }));
        assert.equal(result.candidateDiagnostic.passEligible, false);
        assert.equal(result.candidateDiagnostic.claims.retained[category], 0);
        assert.equal(
          result.cleanup.retained[category],
          1,
          JSON.stringify({
            category,
            durableStoreObservation:
              result.cleanup.durableStoreObservation,
            gatewayObservation: JSON.parse(
              result.evidence.retentionObservation.response.body,
            ).resources[category],
          }),
        );
        assert.equal(result.cleanup.resourceObservation.status, 'verified');
        assert.equal(result.cleanup.retained.gateways, 0);
        assert.equal(result.cleanup.retained.fixtureProcesses, 0);
        assert.equal(result.receipt.verdict, 'FAIL-candidate');
        assert.ok(result.receipt.failureCategories.includes('resource-retention'));
        const raw = JSON.parse(
          result.evidence.retentionObservation.response.body,
        );
        assert.equal(raw.resources[category].items.length, 1);
      } finally {
        await result.dispose();
      }
  });
}

test('trusted launcher rejects retention inspection redirected off gateway socket', async () => {
  const result = await runTrustedLauncherFixture((source) =>
    source
      .replace('retainedResource: null', "retainedResource: 'delegates'")
      .replace('inspectionFault: null', "inspectionFault: 'redirect'")
      .replace('candidateClaimsClean: false', 'candidateClaimsClean: true'));
  try {
    assert.equal(result.launcherExitCode, 1);
    assert.equal(result.candidateDiagnostic.claims.retained.delegates, 0);
    assert.equal(
      result.cleanup.resourceObservation.status,
      'unverified-resource-retention',
    );
    assert.equal(result.cleanup.retained.delegates, 1);
    assert.equal(result.receipt.verdict, 'FAIL-candidate');
    assert.ok(result.receipt.failureCategories.includes('resource-retention'));
    assert.equal(result.evidence.retentionObservation.response.status, 307);
    assert.equal(
      result.evidence.retentionObservation.response.url,
      `${result.evidence.retentionObservation.target.endpoint}/v1/return-covenant/resource-inspection`,
    );
  } finally {
    await result.dispose();
  }
});

test('trusted launcher rejects forged-clean arrays from the attested gateway', async () => {
  const result = await runTrustedLauncherFixture((source) =>
    source
      .replace('retainedResource: null', "retainedResource: 'delegates'")
      .replace('inspectionFault: null', "inspectionFault: 'forged-clean'")
      .replace('candidateClaimsClean: false', 'candidateClaimsClean: true'));
  try {
    assert.equal(result.launcherExitCode, 1);
    assert.equal(result.candidateDiagnostic.claims.retained.delegates, 0);
    const gatewayResponse = JSON.parse(
      result.evidence.retentionObservation.response.body,
    );
    assert.equal(gatewayResponse.resources.delegates.items.length, 0);
    assert.equal(result.cleanup.retained.delegates, 1);
    assert.equal(
      result.cleanup.durableStoreObservation.live.resources.delegates.length,
      1,
    );
    assert.equal(
      result.cleanup.durableStoreObservation.final.resources.delegates.length,
      1,
    );
    assert.equal(result.receipt.verdict, 'FAIL-candidate');
    assert.ok(result.receipt.failureCategories.includes('resource-retention'));
  } finally {
    await result.dispose();
  }
});

test('trusted launcher rejects clean arrays relayed through the attested gateway', async () => {
  const result = await runTrustedLauncherFixture((source) =>
    source
      .replace('retainedResource: null', "retainedResource: 'delegates'")
      .replace('inspectionFault: null', "inspectionFault: 'relay'")
      .replace('candidateClaimsClean: false', 'candidateClaimsClean: true'));
  try {
    assert.equal(result.launcherExitCode, 1);
    const gatewayResponse = JSON.parse(
      result.evidence.retentionObservation.response.body,
    );
    assert.equal(gatewayResponse.resources.delegates.items.length, 0);
    assert.equal(
      result.evidence.retentionObservation.response.url,
      `${result.evidence.retentionObservation.target.endpoint}/v1/return-covenant/resource-inspection`,
    );
    assert.equal(result.cleanup.retained.delegates, 1);
    assert.equal(result.receipt.verdict, 'FAIL-candidate');
    assert.ok(result.receipt.failureCategories.includes('resource-retention'));
  } finally {
    await result.dispose();
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

test('sandbox waits report signal-terminated children fail closed', async () => {
  assert.equal(
    childTerminationReason({ exitCode: null, signalCode: 'SIGTERM' }),
    'signal SIGTERM',
  );
  const directory = await mkdtemp(path.join(tmpdir(), 'return-covenant-signal-'));
  try {
    const driver = path.join(directory, 'signal-driver.mjs');
    await writeFile(
      driver,
      "process.kill(process.pid, 'SIGTERM');\n",
      { mode: 0o700 },
    );
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts/run-return-covenant-sandbox.mjs'),
      '--driver', driver,
      '--driver-args', '[]',
      '--attestation', path.join(directory, 'missing-attestation.json'),
      '--k6', '/bin/true',
      '--k6-config', path.join(directory, 'k6.json'),
      '--k6-home', directory,
      '--scenario', path.join(directory, 'scenario.js'),
      '--plan', path.join(directory, 'plan.json'),
    ], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(
      result.stderr,
      /product driver exited before attestation \(signal SIGTERM\)/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
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
    'retention-observation.schema.json',
  ];
  const schemas = await Promise.all(schemaNames.map((name) =>
    fixture(`../../../contracts/return-covenant-authority/${name}`)));
  schemas.forEach((schema, index) =>
    assertClosedSchemaDeclaresRequired(schema, schemaNames[index]));
  const cleanupSchema = schemas[0];
  const {
    plan,
    evidence,
    driverAttestation,
  } = await completeMatrix();
  assertSimpleSchema(
    cleanupSchema,
    bindCleanup(
      await fixture('cleanup-pass.json'),
      evidence,
      driverAttestation,
      plan,
    ),
    cleanupSchema,
  );
  assertSimpleSchema(
    schemas.at(-1),
    evidence.retentionObservation,
    schemas.at(-1),
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
  rebindEvidenceForRetention(plan, evidence, driverAttestation);
  const cleanup = bindCleanup(cleanupFixture, evidence, driverAttestation, plan);
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
    gatewayLifecycle: cleanup.gatewayLifecycle,
  });
  const retentionValidation = validateReturnCovenantRetentionObservation({
    plan,
    evidence,
    driverAttestation,
    gatewayLifecycle: cleanup.gatewayLifecycle,
  });
  assert.equal(
    receipt.verdict,
    'PASS-candidate',
    JSON.stringify({
      observationErrors: nAValidation.errors,
      receiptFailures: receipt.failureCategories,
      resourceObservation: cleanup.resourceObservation,
      retentionErrors: retentionValidation.errors,
    }),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
    cleanup: bindCleanup(cleanupFixture, evidence, driverAttestation, plan),
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
