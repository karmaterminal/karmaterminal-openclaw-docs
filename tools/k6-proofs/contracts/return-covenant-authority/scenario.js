/**
 * Proposed row: R-CD-RETURN-COVENANT-AUTHORITY.
 *
 * This scenario is intentionally not registered as runnable yet. It requires a
 * product-owned loopback fixture driver that does not exist on the checkpoint
 * product SHA. The driver must hold each accepted delegate result, perform the
 * selected recipient lifecycle transition, and only then release the result.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';
import { canonicalJson } from '../../lib/canonical-json.mjs';
import {
  assertExecutableReturnCovenantPlan,
  buildReturnCovenantDriverRequest,
  buildReturnCovenantRetentionRequest,
  buildReturnCovenantRunCleanupRequest,
  expandReturnCovenantExecutions,
  RETURN_COVENANT_DRIVER_SCHEMA,
  RETURN_COVENANT_EVIDENCE_PREFIX,
  RETURN_COVENANT_RETENTION_OBSERVATION_SCHEMA,
  RETURN_COVENANT_TEARDOWN_PREFIX,
  validateReturnCovenantDriverAttestation,
} from '../../lib/return-covenant-scenario-contract.mjs';

export const options = {
  scenarios: {
    r_cd_return_covenant_authority: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30m',
    },
  },
  thresholds: {
    r_cd_return_covenant_authority_failures: ['count==0'],
    r_cd_return_covenant_authority_duration_ms: ['p(95)<1800000'],
  },
};

const failures = new Counter('r_cd_return_covenant_authority_failures');
const duration = new Trend('r_cd_return_covenant_authority_duration_ms', true);
const planPath = __ENV.OPENCLAW_RETURN_COVENANT_INPUT;
const attestationPath = __ENV.OPENCLAW_RETURN_COVENANT_DRIVER_ATTESTATION;
if (!planPath || !attestationPath) {
  throw new Error(
    'OPENCLAW_RETURN_COVENANT_INPUT and ' +
    'OPENCLAW_RETURN_COVENANT_DRIVER_ATTESTATION are required',
  );
}
const plan = assertExecutableReturnCovenantPlan(JSON.parse(open(planPath)));
const driverAttestation = JSON.parse(open(attestationPath));
const driverBaseUrl = (__ENV.OPENCLAW_RETURN_COVENANT_DRIVER_URL || '').replace(/\/+$/u, '');
const gatewayToken = __ENV.OPENCLAW_GATEWAY_TOKEN || '';
if (!/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(driverBaseUrl)) {
  throw new Error('OPENCLAW_RETURN_COVENANT_DRIVER_URL must use HTTP IPv4 loopback');
}
const attestationErrors = validateReturnCovenantDriverAttestation({
  plan,
  attestation: driverAttestation,
  endpoint: driverBaseUrl,
});
if (attestationErrors.length > 0) {
  throw new Error(`driver attestation failed: ${attestationErrors.join('; ')}`);
}

function sha256Json(value) {
  return crypto.sha256(canonicalJson(value), 'hex');
}

function receiptForPhase(body, phase) {
  if (phase === 'prepare') {
    return { prepare: body.prepare, observation: body.observation || null };
  }
  if (phase === 'dispatch') return body.acceptance;
  if (phase === 'transition') return body.transition;
  if (phase === 'release') return body.release;
  if (phase === 'observe') {
    return { settled: body.settled === true, observation: body.observation || null };
  }
  if (phase === 'cleanup') return body.cleanup;
  if (phase === 'cleanup-run') return body.cleanupRun;
  return null;
}

function parseResponse(response, phase, requestNonce) {
  const ok = check(response, {
    [`${phase}: product driver returned success`]: (value) =>
      value.status >= 200 && value.status < 300,
  });
  if (!ok) {
    throw new Error(`${phase} failed with HTTP ${response.status}`);
  }
  let body;
  try {
    body = response.json();
  } catch {
    throw new Error(`${phase} returned invalid JSON`);
  }
  const receipt = receiptForPhase(body, phase);
  const receiptSha256 = sha256Json(receipt);
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
  const expectedSignature = crypto.hmac(
    'sha256',
    driverAttestation.phaseSigningKey,
    canonicalJson(signatureBase),
    'hex',
  );
  if (
    body?.schema !== RETURN_COVENANT_DRIVER_SCHEMA ||
    body?.phase !== phase ||
    body?.ok !== true ||
    body?.driverBinding?.attestationSha256 !==
      driverAttestation.attestationSha256 ||
    body?.driverBinding?.launchNonceFingerprint !==
      driverAttestation.launchNonceFingerprint ||
    body?.driverBinding?.processStartFingerprint !==
      driverAttestation.process.startFingerprint ||
    body?.driverBinding?.endpointSocketFingerprint !==
      driverAttestation.process.endpointSocketFingerprint ||
    body?.driverBinding?.runtimeConfigSha256 !==
      driverAttestation.runtimeConfigSha256 ||
    body?.driverBinding?.requestNonce !== requestNonce ||
    body?.driverBinding?.receiptSha256 !== receiptSha256 ||
    body?.driverBinding?.signature !== expectedSignature
  ) {
    throw new Error(`${phase} returned an invalid driver receipt`);
  }
  return body;
}

function postPhase(phase, request) {
  const randomNonce = crypto.sha256(crypto.randomBytes(32), 'hex');
  const requestNonce = crypto.sha256(`${phase}:${randomNonce}`, 'hex');
  const driverBinding = {
    attestationSha256: driverAttestation.attestationSha256,
    challenge: driverAttestation.phaseChallenge,
    launchNonceFingerprint: driverAttestation.launchNonceFingerprint,
    processStartFingerprint: driverAttestation.process.startFingerprint,
    endpointSocketFingerprint:
      driverAttestation.process.endpointSocketFingerprint,
    runtimeConfigSha256: driverAttestation.runtimeConfigSha256,
    requestNonce,
  };
  return parseResponse(http.post(
    `${driverBaseUrl}/v1/return-covenant/${phase}`,
    JSON.stringify({ ...request, driverBinding }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '5s',
    },
  ), phase, requestNonce);
}

function observeUntilSettled({
  execution,
  caseHandle,
  acceptance,
  transition,
  releasedAtMs,
}) {
  const notBefore = releasedAtMs + plan.settlementWindowMs;
  const deadline = notBefore + 5_000;
  while (exec.instance.currentTestRunDuration <= deadline) {
    const response = postPhase('observe', buildReturnCovenantDriverRequest({
      phase: 'observe',
      plan,
      execution,
      caseHandle,
      acceptance,
      transition,
    }));
    if (
      response.settled === true &&
      response.observation &&
      exec.instance.currentTestRunDuration >= notBefore
    ) {
      const observedAtMs = exec.instance.currentTestRunDuration;
      return {
        observation: response.observation,
        harnessTiming: {
          releasedAtMs,
          observedAtMs,
          elapsedMs: observedAtMs - releasedAtMs,
        },
        proof: response.driverBinding,
      };
    }
    sleep(0.25);
  }
  throw new Error('bounded settlement window expired without an observation');
}

function observeResourceRetention({ evidence, target }) {
  const requestedAt = new Date().toISOString();
  const requestedAtMonotonicMs = exec.instance.currentTestRunDuration;
  const requestNonce = crypto.sha256(
    `retention:${crypto.sha256(crypto.randomBytes(32), 'hex')}`,
    'hex',
  );
  const request = buildReturnCovenantRetentionRequest({
    plan,
    evidence,
    requestNonce,
  });
  let response = null;
  let failureReason = null;
  if (
    !gatewayToken ||
    !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(target?.endpoint || '') ||
    !Number.isInteger(target?.namespacePid) ||
    typeof target?.namespaceStartFingerprint !== 'string'
  ) {
    failureReason = !gatewayToken
      ? 'gateway-auth-unavailable'
      : 'gateway-target-unavailable';
  } else {
    try {
      response = http.post(
        `${target.endpoint}/v1/return-covenant/resource-inspection`,
        JSON.stringify(request),
        {
          headers: {
            Authorization: `Bearer ${gatewayToken}`,
            'Content-Type': 'application/json',
          },
          redirects: 0,
          timeout: '5s',
        },
      );
      if (response.status < 200 || response.status >= 300) {
        failureReason = response.status === 404
          ? 'resource-inspection-unsupported'
          : 'resource-inspection-http-failure';
      }
    } catch {
      failureReason = 'resource-inspection-request-failed';
    }
  }
  const observedAt = new Date().toISOString();
  const observedAtMonotonicMs = exec.instance.currentTestRunDuration;
  const body = typeof response?.body === 'string' ? response.body : '';
  sleep(0.25);
  return {
    schema: RETURN_COVENANT_RETENTION_OBSERVATION_SCHEMA,
    status: failureReason === null
      ? 'observed'
      : 'unverified-resource-retention',
    failureReason,
    request,
    target,
    timing: {
      requestedAt,
      observedAt,
      requestedAtMonotonicMs,
      observedAtMonotonicMs,
    },
    response: {
      status: Number.isInteger(response?.status) ? response.status : null,
      url: typeof response?.url === 'string' ? response.url : null,
      contentType:
        typeof response?.headers?.['Content-Type'] === 'string'
          ? response.headers['Content-Type']
          : null,
      body,
      bodySha256: crypto.sha256(body, 'hex'),
      byteLength: body.length,
    },
  };
}

export default function () {
  const startedAt = new Date().toISOString();
  const started = exec.instance.currentTestRunDuration;
  const observations = [];
  const phaseChains = [];
  const issuedCaseHandles = [];
  const closedCaseHandles = [];
  const executionErrors = [];
  let scenarioFailures = 0;
  let retentionTarget = {
    source: 'trusted-launcher-attested-gateway',
    endpoint: driverAttestation.gateway.endpoint,
    namespacePid: driverAttestation.gateway.namespacePid,
    namespaceStartFingerprint:
      driverAttestation.gateway.namespaceStartFingerprint,
  };

  for (const execution of expandReturnCovenantExecutions(plan)) {
    let caseHandle = null;
    let acceptance = null;
    let transition = null;
    let observation = null;
    const phaseChain = {
      caseId: execution.caseId,
      form: execution.form,
      proofs: {},
    };
    try {
      const prepared = postPhase('prepare', buildReturnCovenantDriverRequest({
        phase: 'prepare',
        plan,
        execution,
      }));
      caseHandle = prepared.caseHandle;
      if (typeof caseHandle !== 'string' || caseHandle.length === 0) {
        throw new Error('prepare did not return a case handle');
      }
      phaseChain.caseHandle = caseHandle;
      issuedCaseHandles.push({
        caseId: execution.caseId,
        form: execution.form,
        caseHandle,
      });
      phaseChain.prepare = prepared.prepare;
      phaseChain.proofs.prepare = prepared.driverBinding;
      if (
        execution.caseId === 'forbidden-explicit-revocation' &&
        driverAttestation.revocationCapability.revocationApiExposed === false
      ) {
        if (!prepared.observation) {
          throw new Error('not-exposed capability did not return an observation');
        }
        observation = prepared.observation;
        continue;
      }

      const dispatched = postPhase('dispatch', buildReturnCovenantDriverRequest({
        phase: 'dispatch',
        plan,
        execution,
        caseHandle,
      }));
      acceptance = dispatched.acceptance;
      phaseChain.dispatch = acceptance;
      phaseChain.proofs.dispatch = dispatched.driverBinding;
      if (
        acceptance?.accepted !== true ||
        acceptance?.completionHeld !== true ||
        typeof acceptance?.heldResultId !== 'string' ||
        typeof acceptance?.resultMarker !== 'string'
      ) {
        throw new Error('dispatch did not accept and hold delegate completion');
      }

      const transitioned = postPhase('transition', buildReturnCovenantDriverRequest({
        phase: 'transition',
        plan,
        execution,
        caseHandle,
        acceptance,
      }));
      transition = transitioned.transition;
      phaseChain.transition = transition;
      phaseChain.proofs.transition = transitioned.driverBinding;
      if (transition?.restart) {
        retentionTarget = {
          source: 'phase-chain-final-gateway',
          endpoint: transition.restart.replacementGatewayEndpoint,
          namespacePid: transition.restart.replacementGatewayPid,
          namespaceStartFingerprint:
            transition.restart.replacementGatewayStartFingerprint,
        };
      }

      const released = postPhase('release', buildReturnCovenantDriverRequest({
        phase: 'release',
        plan,
        execution,
        caseHandle,
        acceptance,
        transition,
      }));
      const releasedAtMs = exec.instance.currentTestRunDuration;
      phaseChain.release = released.release;
      phaseChain.proofs.release = released.driverBinding;
      const observed = observeUntilSettled({
        execution,
        caseHandle,
        acceptance,
        transition,
        releasedAtMs,
      });
      observation = observed.observation;
      phaseChain.harnessTiming = observed.harnessTiming;
      phaseChain.proofs.observe = observed.proof;
    } catch (error) {
      failures.add(1);
      scenarioFailures += 1;
      executionErrors.push({
        caseId: execution.caseId,
        form: execution.form,
        message: String(error?.message || error),
      });
    } finally {
      if (caseHandle) {
        try {
          const cleaned = postPhase('cleanup', buildReturnCovenantDriverRequest({
            phase: 'cleanup',
            plan,
            execution,
            caseHandle,
            acceptance,
            transition,
          }));
          phaseChain.cleanup = cleaned.cleanup;
          phaseChain.proofs.cleanup = cleaned.driverBinding;
          closedCaseHandles.push({
            caseId: execution.caseId,
            form: execution.form,
            caseHandle,
            cleanupRequestNonce: cleaned.driverBinding.requestNonce,
          });
        } catch (error) {
          failures.add(1);
          scenarioFailures += 1;
          executionErrors.push({
            caseId: execution.caseId,
            form: execution.form,
            message: `cleanup: ${String(error?.message || error)}`,
          });
        }
      }
      if (observation) observations.push(observation);
      if (phaseChain.prepare) phaseChains.push(phaseChain);
    }
  }

  const elapsed = exec.instance.currentTestRunDuration - started;
  duration.add(elapsed);
  const cleanupBindings = {
    observationSetSha256: sha256Json(observations),
    phaseChainSha256: sha256Json(phaseChains),
    driverAttestationSha256: driverAttestation.attestationSha256,
  };
  const cleanupRunResponse = postPhase(
    'cleanup-run',
    buildReturnCovenantRunCleanupRequest(plan, cleanupBindings),
  );
  const cleanupRun = cleanupRunResponse.cleanupRun;
  if (
    cleanupRun?.completed !== true ||
    typeof cleanupRun?.receiptId !== 'string' ||
    cleanupRun.receiptId.length < 8 ||
    cleanupRun.observationSetSha256 !== cleanupBindings.observationSetSha256 ||
    cleanupRun.phaseChainSha256 !== cleanupBindings.phaseChainSha256 ||
    cleanupRun.driverAttestationSha256 !==
      cleanupBindings.driverAttestationSha256 ||
    cleanupRun.runtimeConfigSha256 !== plan.target.runtimeConfigSha256
  ) {
    throw new Error('cleanup-run response is not bound to completed evidence');
  }
  const evidence = {
    schema: 'openclaw.k6.return-covenant-observation-set.v1',
    rowId: plan.rowId,
    runId: plan.runId,
    startedAt,
    endedAt: null,
    observations,
    phaseChains,
    caseHandleLedger: {
      schema: 'openclaw.k6.return-covenant-case-handle-ledger.v1',
      issued: issuedCaseHandles,
      closed: closedCaseHandles,
      open: issuedCaseHandles.filter((issued) =>
        !closedCaseHandles.some((closed) =>
          closed.caseId === issued.caseId &&
          closed.form === issued.form &&
          closed.caseHandle === issued.caseHandle)),
    },
    executionErrors,
    scenarioFailures,
    driverAttestationSha256: driverAttestation.attestationSha256,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    cleanupRun,
    cleanupRunProof: cleanupRunResponse.driverBinding,
  };
  evidence.retentionObservation = observeResourceRetention({
    evidence,
    target: retentionTarget,
  });
  evidence.endedAt = new Date().toISOString();
  console.log(`${RETURN_COVENANT_EVIDENCE_PREFIX}${JSON.stringify(evidence)}`);
  sleep(1);
  console.log(
    `[${plan.rowId}] VERDICT: PARTIAL-candidate pending signed observer receipt`,
  );
}

export function teardown() {
  const response = postPhase(
    'cleanup-run',
    buildReturnCovenantRunCleanupRequest(plan, { fallback: true }),
  );
  if (
    response.cleanupRun?.completed !== true ||
    typeof response.cleanupRun?.receiptId !== 'string'
  ) {
    throw new Error('cleanup-run teardown receipt is incomplete');
  }
  console.log(`${RETURN_COVENANT_TEARDOWN_PREFIX}${JSON.stringify({
    schema: 'openclaw.k6.return-covenant-teardown.v1',
    runId: plan.runId,
    rowId: plan.rowId,
    cleanupRunReceiptId: response.cleanupRun.receiptId,
    cleanupRun: response.cleanupRun,
    cleanupRunProof: response.driverBinding,
    completed: true,
  })}`);
}

export function handleSummary(data) {
  const failureCount =
    data.metrics.r_cd_return_covenant_authority_failures?.values?.count || 0;
  return {
    stdout: `${JSON.stringify({
      row: plan.rowId,
      candidateSha: plan.target.candidateSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      verdict: 'PARTIAL-candidate',
      candidateOnly: true,
      foldRequiresReview: true,
      signedObserverReceiptRequired: true,
      scenarioFailures: failureCount,
      durationMs:
        data.metrics.r_cd_return_covenant_authority_duration_ms?.values || null,
    })}\n`,
  };
}
