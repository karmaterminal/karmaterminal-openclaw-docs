import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  parseReturnCovenantEvidenceLog,
  resolveReturnCovenantAuthoritativeReceipt,
  RETURN_COVENANT_EVIDENCE_PREFIX,
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
  returnCovenantExecutionKey,
  validateReturnCovenantPlan,
} from '../../lib/return-covenant-scenario-contract.mjs';
import {
  evaluateIsolatedRuntimePlugin,
} from '../../lib/isolated-runtime-plugin-contract.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixtures = path.join(root, 'tests/fixtures/return-covenant-authority');
const resolver = path.join(root, 'scripts/resolve-return-covenant-authority-receipt.mjs');
const signingKey = 'return-covenant-authority-test-signing-key';

async function fixture(name) {
  return JSON.parse(await readFile(path.join(fixtures, name), 'utf8'));
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
  observation.caseId = execution.caseId;
  observation.form = execution.form;
  observation.kind = execution.kind;
  observation.startedAt = new Date(Date.UTC(2026, 7, 28, 12, 0, index * 2)).toISOString();
  observation.endedAt = new Date(Date.UTC(2026, 7, 28, 12, 0, index * 2 + 1)).toISOString();
  observation.returnMode = execution.returnMode;
  observation.logicalSessionKey = execution.testCase.logicalSessionKey;
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
    accepted: true,
    completionHeld: true,
    receiptId: `dispatch-receipt-${key}`,
    heldResultId: `held-result-${key}`,
    capturedAuthorityGeneration: captured,
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
    generationAdvanced: execution.kind === 'forbidden',
    effectiveAuthorityUnchanged: execution.kind === 'allowed',
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
  observation.resultMarker = `RETURN-COVENANT-RESULT-${key}`;
  return observation;
}

async function completeMatrix() {
  const [plan, allowedBase, forbiddenBase] = await Promise.all([
    fixture('plan.valid.json'),
    fixture('allowed-pass.json'),
    fixture('forbidden-pass.json'),
  ]);
  return {
    plan,
    observations: expandReturnCovenantExecutions(plan).map((execution, index) =>
      generatedObservation({ execution, allowedBase, forbiddenBase, index })),
  };
}

function failureCodes(validation) {
  return new Set(validation.errors.map((error) => error.code));
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
    }),
    { valid: true, errors: [] },
  );
  assert.deepEqual(
    validateReturnCovenantObservation({
      observation: forbidden,
      plan,
      execution: executionFor(plan, forbidden.caseId, forbidden.form),
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
  });
  assert.equal(validation.valid, false);
  for (const expected of control.expectedFailures) {
    assert.ok(failureCodes(validation).has(expected));
  }
});

test('missing and duplicated observations cannot be hidden by other passing cases', async () => {
  const { plan, observations } = await completeMatrix();
  const control = await fixture('control-missing-duplicated-observation.json');
  const filtered = observations.filter((observation) =>
    returnCovenantExecutionKey(observation.caseId, observation.form) !== control.remove);
  const duplicate = filtered.find((observation) =>
    returnCovenantExecutionKey(observation.caseId, observation.form) === control.duplicate);
  filtered.push(structuredClone(duplicate));
  const validation = validateReturnCovenantObservationSet({
    plan,
    observations: filtered,
  });
  assert.equal(validation.valid, false);
  for (const expected of control.expectedFailures) {
    assert.ok(failureCodes(validation).has(expected));
  }
});

test('cleanup rejects retained queue/process state and incomplete path removal', async () => {
  const plan = await fixture('plan.valid.json');
  const passing = validateReturnCovenantCleanup({
    cleanup: await fixture('cleanup-pass.json'),
    plan,
  });
  assert.deepEqual(passing, { valid: true, errors: [] });
  const failing = validateReturnCovenantCleanup({
    cleanup: await fixture('cleanup-failure.json'),
    plan,
  });
  assert.equal(failing.valid, false);
  assert.ok(failureCodes(failing).has('cleanup-failure'));
});

test('signed observer receipt binds the complete matrix and publishes no raw identities', async () => {
  const [{ plan, observations }, cleanup, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-pass.json'),
    fixture('runtime-config.valid.json'),
  ]);
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    observations,
    cleanup,
    runtimeConfig,
    signingKey,
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.deepEqual(
    validateReturnCovenantAuthoritativeReceipt(receipt, signingKey),
    { valid: true, verdict: 'PASS-candidate' },
  );
  assert.equal(receipt.matrix.cases.length, 24);
  const publicBytes = JSON.stringify(receipt);
  for (const observation of observations) {
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
});

test('missing observations and cleanup failure produce signed FAIL receipts', async () => {
  const [{ plan, observations }, cleanupFailure, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-failure.json'),
    fixture('runtime-config.valid.json'),
  ]);
  observations.pop();
  const receipt = resolveReturnCovenantAuthoritativeReceipt({
    plan,
    observations,
    cleanup: cleanupFailure,
    runtimeConfig,
    signingKey,
  });
  assert.equal(receipt.verdict, 'FAIL-candidate');
  assert.ok(receipt.failureCategories.includes('observation-missing'));
  assert.ok(receipt.failureCategories.includes('cleanup-failure'));
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
});

test('evidence parser and resolver CLI require exactly one observation set', async () => {
  const [{ plan, observations }, cleanup, runtimeConfig] = await Promise.all([
    completeMatrix(),
    fixture('cleanup-pass.json'),
    fixture('runtime-config.valid.json'),
  ]);
  const evidence = {
    schema: 'openclaw.k6.return-covenant-observation-set.v1',
    observations,
  };
  const line = `${RETURN_COVENANT_EVIDENCE_PREFIX}${JSON.stringify(evidence)}`;
  assert.equal(parseReturnCovenantEvidenceLog(line).observations.length, 24);
  assert.throws(() => parseReturnCovenantEvidenceLog(''), /observed 0/);
  assert.throws(() => parseReturnCovenantEvidenceLog(`${line}\n${line}`), /observed 2/);

  const directory = await mkdtemp(path.join(tmpdir(), 'return-covenant-resolver-'));
  try {
    const planPath = path.join(directory, 'plan.json');
    const logPath = path.join(directory, 'k6.log');
    const runtimePath = path.join(directory, 'runtime.json');
    const cleanupPath = path.join(directory, 'cleanup.json');
    const outputPath = path.join(directory, 'receipt.json');
    await Promise.all([
      writeFile(planPath, JSON.stringify(plan)),
      writeFile(logPath, `${line}\n`),
      writeFile(runtimePath, JSON.stringify(runtimeConfig)),
      writeFile(cleanupPath, JSON.stringify(cleanup)),
    ]);
    const result = spawnSync(process.execPath, [
      resolver,
      '--plan', planPath,
      '--k6-log', logPath,
      '--runtime-config', runtimePath,
      '--cleanup', cleanupPath,
      '--out', outputPath,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(receipt.verdict, 'PASS-candidate');
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
