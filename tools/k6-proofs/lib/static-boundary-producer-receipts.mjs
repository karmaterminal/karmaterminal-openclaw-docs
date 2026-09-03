/** Fail-closed R-CW-5A/R-CW-6A producer-receipt selection and validation. */

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const SHA512_HEX_PATTERN = /^[0-9a-f]{128}$/u;
const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u;
const REQUIRED_RCW6_RESULT_CHECKS = [
  'matrixPassed',
  'dispatchPassed',
  'runtimeSurfacePassed',
  'structuredChainCapped',
  'noRejectedHopSpawn',
  'durableRecoveryPassed',
  'typedSurfacePassed',
  'exactCandidateDisposableWorktree',
  'candidatePackageManagerVersionMatchesExecuting',
  'installedGraphMatchesCandidate',
  'verifiedDependencyTreeContainsLocalExecutables',
  'worktreeIntegrityAfterInstall',
  'worktreeIntegrityAfterProofSurfaces',
  'publicArtifactsSafe',
];

const CONTRACTS = {
  'R-CW-5': {
    files: [
      'fixture-result.json',
      'fixture-readiness.json',
      'boundary-matrix.json',
      'typed-tool-surface.json',
      'dispatch-boundary-suite.json',
      'cleanup.json',
    ],
  },
  'R-CW-6': {
    files: [
      'fixture-result.json',
      'fixture-readiness.json',
      'boundary-matrix.json',
      'runtime-boundary.json',
      'durable-state-recovery.json',
      'typed-tool-surface.json',
      'dispatch-boundary-suite.json',
      'cleanup.json',
      'public-artifact-safety.json',
    ],
  },
};

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function rowContract(rowId) {
  const contract = CONTRACTS[rowId];
  if (!contract) throw new Error(`unsupported boundary producer row ${rowId}`);
  return contract;
}

function oneManifestRow(proofsManifest, rowId) {
  const rows = Array.isArray(proofsManifest?.rows)
    ? proofsManifest.rows.filter((row) => row?.row === rowId)
    : [];
  if (rows.length !== 1) {
    throw new Error(`current proofs manifest must contain exactly one ${rowId} row`);
  }
  return rows[0];
}

function canonicalManifestIdentity(proofsManifest, candidateSha) {
  return (
    ['sha', 'ship_sha', 'capture_sha', 'proof_source_sha'].every(
      (field) => proofsManifest?.[field] === candidateSha,
    ) &&
    (proofsManifest?.current_sha === undefined ||
      proofsManifest?.current_sha === candidateSha)
  );
}

export function selectReviewedBoundaryProducer({ proofsManifest, rowId, candidateSha }) {
  rowContract(rowId);
  if (!SHA_PATTERN.test(candidateSha)) {
    throw new Error('boundary producer candidate must be one full lowercase SHA');
  }
  if (!canonicalManifestIdentity(proofsManifest, candidateSha)) {
    throw new Error('current proofs manifest identity does not match the candidate');
  }
  const row = oneManifestRow(proofsManifest, rowId);
  if (
    row.state !== 'pass' ||
    row.candidate_verdict !== 'PASS-candidate' ||
    row.review_status !== 'reviewed' ||
    row.fired !== true
  ) {
    throw new Error(`${rowId} producer is not one reviewed current-corpus PASS`);
  }
  const runIds = row.test_cases_executed;
  if (
    !Array.isArray(runIds) ||
    runIds.length !== 1 ||
    typeof runIds[0] !== 'string' ||
    !RUN_ID_PATTERN.test(runIds[0])
  ) {
    throw new Error(`${rowId} producer must identify exactly one safe run id`);
  }
  return {
    rowId,
    runId: runIds[0],
    relativeRoot: `../../../PROOFS/${candidateSha}/${rowId}/local/${runIds[0]}`,
    files: [...rowContract(rowId).files],
  };
}

export function boundaryProducerReceiptFiles(rowId) {
  return [...rowContract(rowId).files];
}

export function boundaryProducerSelectionFailureCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('current proofs manifest is unavailable')) {
    return 'manifest-unavailable-or-malformed';
  }
  if (message.includes('unsupported boundary producer row')) return 'unsupported-producer-row';
  if (message.includes('candidate must be one full lowercase SHA')) return 'invalid-candidate-sha';
  if (message.includes('manifest identity does not match')) return 'manifest-identity-mismatch';
  if (message.includes('manifest must contain exactly one')) return 'producer-row-cardinality';
  if (message.includes('not one reviewed current-corpus PASS')) return 'producer-not-reviewed-pass';
  if (message.includes('must identify exactly one safe run id')) return 'producer-run-selection-invalid';
  return 'producer-validator-error';
}

function validCleanTriplet(integrity, candidateSha) {
  if (!integrity || typeof integrity !== 'object') return false;
  return ['beforeInstall', 'afterInstall', 'afterExecution'].every((phase) => {
    const observation = integrity[phase];
    return observation?.head === candidateSha && observation?.trackedClean === true;
  });
}

function validRcw5Dependency(dependency, candidateSha, lockfileSha256) {
  return Boolean(
    dependency &&
      typeof dependency === 'object' &&
      typeof dependency.packageManager === 'string' &&
      typeof dependency.pnpmVersion === 'string' &&
      SHA512_HEX_PATTERN.test(dependency.pnpmIntegritySha512) &&
      DIGEST_PATTERN.test(dependency.packageManagerExecutableSha256) &&
      DIGEST_PATTERN.test(dependency.packageManagerMetadataSha256) &&
      typeof dependency.nativePackage === 'string' &&
      typeof dependency.nativePackageIntegrity === 'string' &&
      dependency.lockfileSha256 === lockfileSha256 &&
      DIGEST_PATTERN.test(dependency.virtualStoreLockSha256) &&
      DIGEST_PATTERN.test(dependency.workspaceGraphSha256) &&
      dependency.installedGraphMatchesCandidate === true &&
      dependency.packageManagerBootstrapValidated === true &&
      dependency.frozenLockfileVerified === true &&
      dependency.packageManagerStateConfinedToDisposableWorktree === true &&
      dependency.sourceNodeModulesTrusted === false &&
      validCleanTriplet(dependency.executionWorktreeIntegrity, candidateSha) &&
      dependency.cleanup?.disposableWorktreeCreated === true &&
      dependency.cleanup?.disposableWorktreeRemoved === true,
  );
}

function validRcw6Provenance(provenance, candidateSha) {
  const integrity = provenance?.worktreeIntegrity;
  return Boolean(
    provenance &&
      provenance.candidateWorktreeHead === candidateSha &&
      DIGEST_PATTERN.test(provenance.candidateLockfileSha256) &&
      DIGEST_PATTERN.test(provenance.installedLockfileSha256) &&
      DIGEST_PATTERN.test(provenance.candidateWorkspaceGraphSha256) &&
      DIGEST_PATTERN.test(provenance.packageManagerBootstrapSha256) &&
      provenance.installedGraphMatchesCandidate === true &&
      provenance.packageManagerBootstrapValidated === true &&
      typeof provenance.candidatePackageManager === 'string' &&
      provenance.candidatePackageManagerVersion === provenance.executingPackageManagerVersion &&
      provenance.installedPackageManagerVersion === provenance.candidatePackageManagerVersion &&
      provenance.virtualStoreContainedWithinCandidateNodeModules === true &&
      provenance.localExecutableContract?.tsx?.realpathWithinVerifiedDependencyTree === true &&
      provenance.localExecutableContract?.vitest?.realpathWithinVerifiedDependencyTree === true &&
      integrity?.beforeInstall?.headMatchesCandidate === true &&
      integrity?.beforeInstall?.trackedClean === true &&
      integrity?.afterInstall?.headMatchesCandidate === true &&
      integrity?.afterInstall?.trackedClean === true &&
      integrity?.afterProofSurfaces?.headMatchesCandidate === true &&
      integrity?.afterProofSurfaces?.trackedClean === true,
  );
}

function validateRcw5(candidateSha, receipts) {
  const result = receipts['fixture-result.json'];
  const readiness = receipts['fixture-readiness.json'];
  const boundary = receipts['boundary-matrix.json'];
  const typed = receipts['typed-tool-surface.json'];
  const dispatch = receipts['dispatch-boundary-suite.json'];
  const cleanup = receipts['cleanup.json'];
  const dependencies = [boundary?.dependency, typed?.dependency, dispatch?.dependency];
  const dependencyAgreement =
    dependencies.every(Boolean) && dependencies.every((value) => sameValue(value, dependencies[0]));
  const dependencyValid =
    dependencyAgreement &&
    validRcw5Dependency(dependencies[0], candidateSha, readiness?.lockfileSha256);
  const checks = {
    exactSchemas:
      result?.schema === 'openclaw.project81.r-cw-5.fixture-result.v1' &&
      readiness?.schema === 'openclaw.project81.r-cw-5.fixture-readiness.v1' &&
      boundary?.schema === 'openclaw.project81.r-cw-5.boundary-matrix.v1' &&
      typed?.schema === 'openclaw.project81.r-cw-5.typed-tool-surface.v1' &&
      dispatch?.schema === 'openclaw.project81.r-cw-5.dispatch-boundary-suite.v1' &&
      cleanup?.schema === 'openclaw.project81.r-cw-5.cleanup.v1',
    exactCandidate:
      result?.candidateSha === candidateSha && readiness?.candidateSha === candidateSha,
    reviewedPass:
      result?.verdict === 'PASS-candidate' &&
      result?.checks?.matrixPassed === true &&
      result?.checks?.dispatchPassed === true &&
      result?.checks?.toolSurfacePassed === true &&
      result?.checks?.noRejectedHopSpawn === true,
    receiptMapComplete:
      sameValue(result?.receipts, {
        fixtureReadiness: 'fixture-readiness.json',
        boundaryMatrix: 'boundary-matrix.json',
        dispatchBoundarySuite: 'dispatch-boundary-suite.json',
        typedToolSurface: 'typed-tool-surface.json',
        cleanup: 'cleanup.json',
      }),
    readinessClean:
      readiness?.sourceHeadMatchesCandidate === true &&
      readiness?.sourceTrackedCleanBefore === true &&
      readiness?.productionConfigTouched === false &&
      readiness?.productionStateTouched === false &&
      DIGEST_PATTERN.test(readiness?.lockfileSha256),
    producerSurfacesPassed:
      boundary?.passed === true && typed?.passed === true && dispatch?.passed === true,
    dependencyAgreement,
    dependencyValid,
    cleanupComplete:
      cleanup?.productionConfigTouched === false &&
      cleanup?.productionStateTouched === false &&
      cleanup?.sourceMutated === false &&
      cleanup?.sourceHeadMatchesCandidateAfter === true &&
      cleanup?.sourceTrackedCleanAfter === true &&
      cleanup?.disposableWorktreeRemoved === true &&
      cleanup?.cleanupRequired === false,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function validateRcw6(candidateSha, receipts) {
  const result = receipts['fixture-result.json'];
  const readiness = receipts['fixture-readiness.json'];
  const boundary = receipts['boundary-matrix.json'];
  const runtime = receipts['runtime-boundary.json'];
  const durable = receipts['durable-state-recovery.json'];
  const typed = receipts['typed-tool-surface.json'];
  const dispatch = receipts['dispatch-boundary-suite.json'];
  const cleanup = receipts['cleanup.json'];
  const safety = receipts['public-artifact-safety.json'];
  const provenances = [
    result?.dependencyProvenance,
    readiness,
    boundary,
    runtime,
    durable,
    typed,
    dispatch,
    cleanup,
  ].map((receipt) => {
    if (!receipt || typeof receipt !== 'object') return null;
    return {
      candidateWorktreeHead: receipt.candidateWorktreeHead ?? receipt.candidateSha,
      candidateLockfileSha256: receipt.candidateLockfileSha256,
      installedLockfileSha256: receipt.installedLockfileSha256,
      candidateWorkspaceGraphSha256: receipt.candidateWorkspaceGraphSha256,
      packageManagerBootstrapSha256: receipt.packageManagerBootstrapSha256,
      installedGraphMatchesCandidate: receipt.installedGraphMatchesCandidate,
      packageManagerBootstrapValidated: receipt.packageManagerBootstrapValidated,
      candidatePackageManager: receipt.candidatePackageManager,
      candidatePackageManagerVersion: receipt.candidatePackageManagerVersion,
      executingPackageManagerVersion: receipt.executingPackageManagerVersion,
      installedPackageManager: receipt.installedPackageManager,
      installedPackageManagerVersion: receipt.installedPackageManagerVersion,
      virtualStoreDir: receipt.virtualStoreDir,
      virtualStoreContainedWithinCandidateNodeModules:
        receipt.virtualStoreContainedWithinCandidateNodeModules,
      installCommand: receipt.installCommand,
      localExecutableContract: receipt.localExecutableContract,
      worktreeIntegrity: receipt.worktreeIntegrity,
      hostToolchainHermetic: receipt.hostToolchainHermetic,
    };
  });
  const provenanceAgreement =
    provenances.every(Boolean) && provenances.every((value) => sameValue(value, provenances[0]));
  const provenanceValid = provenanceAgreement && validRcw6Provenance(provenances[0], candidateSha);
  const checks = {
    exactSchemas:
      result?.schema === 'openclaw.project81.r-cw-6.fixture-result.v1' &&
      readiness?.schema === 'openclaw.project81.r-cw-6.fixture-readiness.v1' &&
      boundary?.schema === 'openclaw.project81.r-cw-6.boundary-matrix.v1' &&
      runtime?.schema === 'openclaw.project81.r-cw-6.runtime-boundary.v1' &&
      durable?.schema === 'openclaw.project81.r-cw-6.durable-state-recovery.v1' &&
      typed?.schema === 'openclaw.project81.r-cw-6.typed-tool-surface.v1' &&
      dispatch?.schema === 'openclaw.project81.r-cw-6.dispatch-boundary-suite.v1' &&
      cleanup?.schema === 'openclaw.project81.r-cw-6.cleanup.v1' &&
      safety?.schema === 'openclaw.project81.r-cw-6.public-artifact-safety.v1',
    exactCandidate:
      result?.candidateSha === candidateSha && readiness?.candidateSha === candidateSha,
    reviewedPass: Boolean(
      result?.verdict === 'PASS-candidate' &&
      result?.checks &&
      typeof result.checks === 'object' &&
      REQUIRED_RCW6_RESULT_CHECKS.every((key) => result.checks[key] === true) &&
      Object.values(result.checks).every((value) => value === true),
    ),
    receiptMapComplete:
      sameValue(result?.receipts, {
        fixtureReadiness: 'fixture-readiness.json',
        boundaryMatrix: 'boundary-matrix.json',
        runtimeBoundary: 'runtime-boundary.json',
        durableStateRecovery: 'durable-state-recovery.json',
        typedToolSurface: 'typed-tool-surface.json',
        dispatchBoundarySuite: 'dispatch-boundary-suite.json',
        cleanup: 'cleanup.json',
        publicArtifactSafety: 'public-artifact-safety.json',
      }),
    readinessClean:
      readiness?.sourceHeadMatchesCandidate === true &&
      readiness?.sourceTrackedCleanBefore === true &&
      readiness?.productionConfigTouched === false &&
      readiness?.productionStateTouched === false &&
      readiness?.gatewayStarted === false,
    producerSurfacesPassed:
      boundary?.passed === true &&
      runtime?.passed === true &&
      durable?.passed === true &&
      typed?.passed === true &&
      dispatch?.passed === true,
    provenanceAgreement,
    provenanceValid,
    cleanupComplete:
      cleanup?.productionConfigTouched === false &&
      cleanup?.productionStateTouched === false &&
      cleanup?.gatewayStarted === false &&
      cleanup?.sourceMutated === false &&
      cleanup?.sourceHeadMatchesCandidateAfter === true &&
      cleanup?.sourceTrackedCleanAfter === true &&
      cleanup?.disposableWorktreeRemoved === true &&
      cleanup?.cleanupRequired === false,
    publicArtifactsSafe: safety?.passed === true,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

export function validateBoundaryProducerReceiptSet({ rowId, candidateSha, receipts }) {
  rowContract(rowId);
  if (!SHA_PATTERN.test(candidateSha)) {
    throw new Error('boundary producer candidate must be one full lowercase SHA');
  }
  const required = boundaryProducerReceiptFiles(rowId);
  const complete =
    receipts &&
    typeof receipts === 'object' &&
    required.every((file) => receipts[file] && typeof receipts[file] === 'object');
  if (!complete) {
    return {
      passed: false,
      checks: {
        receiptSetComplete: false,
      },
    };
  }
  const validation =
    rowId === 'R-CW-5'
      ? validateRcw5(candidateSha, receipts)
      : validateRcw6(candidateSha, receipts);
  return {
    passed: validation.passed,
    checks: {
      receiptSetComplete: true,
      ...validation.checks,
    },
  };
}
