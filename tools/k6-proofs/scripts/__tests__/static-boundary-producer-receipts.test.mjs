import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryProducerSelectionFailureCode,
  selectReviewedBoundaryProducer,
  validateBoundaryProducerReceiptSet,
} from '../../lib/static-boundary-producer-receipts.mjs';

const sha = '5'.repeat(40);
const digest = 'a'.repeat(64);

function manifest(rowId, overrides = {}) {
  return {
    sha,
    ship_sha: sha,
    capture_sha: sha,
    current_sha: sha,
    proof_source_sha: sha,
    rows: [
      {
        row: rowId,
        state: 'pass',
        candidate_verdict: 'PASS-candidate',
        review_status: 'reviewed',
        fired: true,
        test_cases_executed: ['run-current'],
        ...overrides,
      },
    ],
  };
}

function rcw5Dependency() {
  const candidateFiles = {
    'package.json': digest,
    'pnpm-lock.yaml': digest,
  };
  const phase = {
    head: sha,
    trackedClean: true,
    candidateFileSha256: candidateFiles,
  };
  return {
    packageManager: `pnpm@12.1.0+sha512.${'b'.repeat(128)}`,
    pnpmVersion: '12.1.0',
    pnpmIntegritySha512: 'b'.repeat(128),
    packageManagerExecutableSha256: digest,
    packageManagerMetadataSha256: digest,
    nativePackage: '@pnpm/exe.linux-arm64',
    nativePackageIntegrity: 'sha512-fixture',
    installCommand: ['node', '<candidate-pinned-pnpm>', 'install'],
    packageManagerStateConfinedToDisposableWorktree: true,
    lockfileSha256: digest,
    virtualStoreLockSha256: digest,
    workspaceGraphSha256: digest,
    installedGraphMatchesCandidate: true,
    packageManagerBootstrapValidated: true,
    frozenLockfileVerified: true,
    sourceNodeModulesTrusted: false,
    executionWorktreeIntegrity: {
      beforeInstall: phase,
      afterInstall: phase,
      afterExecution: phase,
    },
    cleanup: {
      disposableWorktreeCreated: true,
      disposableWorktreeRemoved: true,
    },
  };
}

function rcw5Receipts() {
  const dependency = rcw5Dependency();
  return {
    'fixture-result.json': {
      schema: 'openclaw.project81.r-cw-5.fixture-result.v1',
      verdict: 'PASS-candidate',
      candidateSha: sha,
      receipts: {
        fixtureReadiness: 'fixture-readiness.json',
        boundaryMatrix: 'boundary-matrix.json',
        dispatchBoundarySuite: 'dispatch-boundary-suite.json',
        typedToolSurface: 'typed-tool-surface.json',
        cleanup: 'cleanup.json',
      },
      checks: {
        matrixPassed: true,
        dispatchPassed: true,
        toolSurfacePassed: true,
        noRejectedHopSpawn: true,
      },
    },
    'fixture-readiness.json': {
      schema: 'openclaw.project81.r-cw-5.fixture-readiness.v1',
      candidateSha: sha,
      sourceHeadMatchesCandidate: true,
      sourceTrackedCleanBefore: true,
      productionConfigTouched: false,
      productionStateTouched: false,
      lockfileSha256: digest,
    },
    'boundary-matrix.json': {
      schema: 'openclaw.project81.r-cw-5.boundary-matrix.v1',
      passed: true,
      dependency,
    },
    'typed-tool-surface.json': {
      schema: 'openclaw.project81.r-cw-5.typed-tool-surface.v1',
      passed: true,
      dependency,
    },
    'dispatch-boundary-suite.json': {
      schema: 'openclaw.project81.r-cw-5.dispatch-boundary-suite.v1',
      passed: true,
      dependency,
    },
    'cleanup.json': {
      schema: 'openclaw.project81.r-cw-5.cleanup.v1',
      productionConfigTouched: false,
      productionStateTouched: false,
      sourceMutated: false,
      sourceHeadMatchesCandidateAfter: true,
      sourceTrackedCleanAfter: true,
      disposableWorktreeRemoved: true,
      cleanupRequired: false,
    },
  };
}

function rcw6Provenance() {
  return {
    candidateWorktreeHead: sha,
    candidateLockfileSha256: digest,
    installedLockfileSha256: digest,
    candidateWorkspaceGraphSha256: digest,
    packageManagerBootstrapSha256: digest,
    installedGraphMatchesCandidate: true,
    packageManagerBootstrapValidated: true,
    candidatePackageManager: 'pnpm@12.1.0',
    candidatePackageManagerVersion: '12.1.0',
    executingPackageManagerVersion: '12.1.0',
    installedPackageManager: 'pnpm@12.1.0',
    installedPackageManagerVersion: '12.1.0',
    virtualStoreDir: '.pnpm',
    virtualStoreContainedWithinCandidateNodeModules: true,
    installCommand: ['pnpm', 'install', '--frozen-lockfile'],
    localExecutableContract: {
      tsx: { path: 'node_modules/.bin/tsx', realpathWithinVerifiedDependencyTree: true },
      vitest: { path: 'node_modules/.bin/vitest', realpathWithinVerifiedDependencyTree: true },
    },
    worktreeIntegrity: {
      beforeInstall: { headMatchesCandidate: true, trackedClean: true },
      afterInstall: { headMatchesCandidate: true, trackedClean: true },
      afterProofSurfaces: { headMatchesCandidate: true, trackedClean: true },
    },
    hostToolchainHermetic: false,
  };
}

function rcw6Receipts() {
  const provenance = rcw6Provenance();
  const withProvenance = (receipt) => ({ ...receipt, ...provenance });
  return {
    'fixture-result.json': {
      schema: 'openclaw.project81.r-cw-6.fixture-result.v1',
      verdict: 'PASS-candidate',
      candidateSha: sha,
      dependencyProvenance: provenance,
      receipts: {
        fixtureReadiness: 'fixture-readiness.json',
        boundaryMatrix: 'boundary-matrix.json',
        runtimeBoundary: 'runtime-boundary.json',
        durableStateRecovery: 'durable-state-recovery.json',
        typedToolSurface: 'typed-tool-surface.json',
        dispatchBoundarySuite: 'dispatch-boundary-suite.json',
        cleanup: 'cleanup.json',
        publicArtifactSafety: 'public-artifact-safety.json',
      },
      checks: {
        matrixPassed: true,
        dispatchPassed: true,
        runtimeSurfacePassed: true,
        structuredChainCapped: true,
        noRejectedHopSpawn: true,
        durableRecoveryPassed: true,
        typedSurfacePassed: true,
        exactCandidateDisposableWorktree: true,
        candidatePackageManagerVersionMatchesExecuting: true,
        installedGraphMatchesCandidate: true,
        verifiedDependencyTreeContainsLocalExecutables: true,
        worktreeIntegrityAfterInstall: true,
        worktreeIntegrityAfterProofSurfaces: true,
        publicArtifactsSafe: true,
      },
    },
    'fixture-readiness.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.fixture-readiness.v1',
      candidateSha: sha,
      sourceHeadMatchesCandidate: true,
      sourceTrackedCleanBefore: true,
      productionConfigTouched: false,
      productionStateTouched: false,
      gatewayStarted: false,
    }),
    'boundary-matrix.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.boundary-matrix.v1',
      passed: true,
    }),
    'runtime-boundary.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.runtime-boundary.v1',
      passed: true,
    }),
    'durable-state-recovery.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.durable-state-recovery.v1',
      passed: true,
    }),
    'typed-tool-surface.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.typed-tool-surface.v1',
      passed: true,
    }),
    'dispatch-boundary-suite.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.dispatch-boundary-suite.v1',
      passed: true,
    }),
    'cleanup.json': withProvenance({
      schema: 'openclaw.project81.r-cw-6.cleanup.v1',
      productionConfigTouched: false,
      productionStateTouched: false,
      gatewayStarted: false,
      sourceMutated: false,
      sourceHeadMatchesCandidateAfter: true,
      sourceTrackedCleanAfter: true,
      disposableWorktreeRemoved: true,
      cleanupRequired: false,
    }),
    'public-artifact-safety.json': {
      schema: 'openclaw.project81.r-cw-6.public-artifact-safety.v1',
      passed: true,
    },
  };
}

test('selects exactly one reviewed current-corpus producer run', () => {
  assert.deepEqual(
    selectReviewedBoundaryProducer({
      proofsManifest: manifest('R-CW-5'),
      rowId: 'R-CW-5',
      candidateSha: sha,
    }),
    {
      rowId: 'R-CW-5',
      runId: 'run-current',
      relativeRoot: `../../../PROOFS/${sha}/R-CW-5/local/run-current`,
      files: [
        'fixture-result.json',
        'fixture-readiness.json',
        'boundary-matrix.json',
        'typed-tool-surface.json',
        'dispatch-boundary-suite.json',
        'cleanup.json',
      ],
    },
  );
});

test('rejects wrong candidate, non-PASS producer, and ambiguous run selection', () => {
  assert.throws(
    () =>
      selectReviewedBoundaryProducer({
        proofsManifest: manifest('R-CW-5'),
        rowId: 'R-CW-5',
        candidateSha: '6'.repeat(40),
      }),
    /identity does not match/,
  );
  assert.throws(
    () =>
      selectReviewedBoundaryProducer({
        proofsManifest: manifest('R-CW-5', {
          state: 'fail',
          candidate_verdict: 'FAIL-fixture',
        }),
        rowId: 'R-CW-5',
        candidateSha: sha,
      }),
    /not one reviewed current-corpus PASS/,
  );
  assert.throws(
    () =>
      selectReviewedBoundaryProducer({
        proofsManifest: manifest('R-CW-5', {
          test_cases_executed: ['run-one', 'run-two'],
        }),
        rowId: 'R-CW-5',
        candidateSha: sha,
      }),
    /exactly one safe run id/,
  );
});

test('classifies producer-selection failures without leaking arbitrary errors', () => {
  assert.equal(
    boundaryProducerSelectionFailureCode(new Error('current proofs manifest is unavailable')),
    'manifest-unavailable-or-malformed',
  );
  assert.equal(
    boundaryProducerSelectionFailureCode(
      new Error('R-CW-6 producer is not one reviewed current-corpus PASS'),
    ),
    'producer-not-reviewed-pass',
  );
  assert.equal(
    boundaryProducerSelectionFailureCode(new Error('/private/path should not be exposed')),
    'producer-validator-error',
  );
});

test('R-CW-5A accepts the complete reviewed producer receipt set', () => {
  const result = validateBoundaryProducerReceiptSet({
    rowId: 'R-CW-5',
    candidateSha: sha,
    receipts: rcw5Receipts(),
  });
  assert.equal(result.passed, true);
  assert.ok(Object.values(result.checks).every(Boolean));
});

test('R-CW-5A rejects missing and disagreeing producer receipts', () => {
  const missing = rcw5Receipts();
  delete missing['cleanup.json'];
  assert.deepEqual(
    validateBoundaryProducerReceiptSet({
      rowId: 'R-CW-5',
      candidateSha: sha,
      receipts: missing,
    }),
    { passed: false, checks: { receiptSetComplete: false } },
  );

  const disagreeing = rcw5Receipts();
  disagreeing['typed-tool-surface.json'].dependency = {
    ...disagreeing['typed-tool-surface.json'].dependency,
    workspaceGraphSha256: 'c'.repeat(64),
  };
  const disagreement = validateBoundaryProducerReceiptSet({
    rowId: 'R-CW-5',
    candidateSha: sha,
    receipts: disagreeing,
  });
  assert.equal(disagreement.passed, false);
  assert.equal(disagreement.checks.dependencyAgreement, false);
});

test('R-CW-6A requires a PASS producer plus runtime and durable receipts', () => {
  assert.doesNotThrow(() =>
    selectReviewedBoundaryProducer({
      proofsManifest: manifest('R-CW-6'),
      rowId: 'R-CW-6',
      candidateSha: sha,
    }),
  );
  const valid = validateBoundaryProducerReceiptSet({
    rowId: 'R-CW-6',
    candidateSha: sha,
    receipts: rcw6Receipts(),
  });
  assert.equal(valid.passed, true);
  assert.ok(Object.values(valid.checks).every(Boolean));

  const missingRuntime = rcw6Receipts();
  delete missingRuntime['runtime-boundary.json'];
  assert.equal(
    validateBoundaryProducerReceiptSet({
      rowId: 'R-CW-6',
      candidateSha: sha,
      receipts: missingRuntime,
    }).passed,
    false,
  );
});

test('R-CW-6A rejects missing, empty, or truncated result checks', () => {
  for (const checks of [undefined, {}, { matrixPassed: true }]) {
    const receipts = rcw6Receipts();
    if (checks === undefined) delete receipts['fixture-result.json'].checks;
    else receipts['fixture-result.json'].checks = checks;
    const result = validateBoundaryProducerReceiptSet({
      rowId: 'R-CW-6',
      candidateSha: sha,
      receipts,
    });
    assert.equal(result.passed, false);
    assert.equal(result.checks.reviewedPass, false);
  }
});

test('R-CW-6A cannot select the current terminal FAIL producer', () => {
  assert.throws(
    () =>
      selectReviewedBoundaryProducer({
        proofsManifest: manifest('R-CW-6', {
          state: 'fail',
          candidate_verdict: 'FAIL-fixture',
          review_status: 'terminal-nonpass',
        }),
        rowId: 'R-CW-6',
        candidateSha: sha,
      }),
    /not one reviewed current-corpus PASS/,
  );
});
