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
import { Counter, Trend } from 'k6/metrics';
import {
  assertExecutableReturnCovenantPlan,
  buildReturnCovenantDriverRequest,
  expandReturnCovenantExecutions,
  RETURN_COVENANT_DRIVER_SCHEMA,
  RETURN_COVENANT_EVIDENCE_PREFIX,
} from '../lib/return-covenant-scenario-contract.mjs';

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
if (!planPath) {
  throw new Error('OPENCLAW_RETURN_COVENANT_INPUT is required');
}
const plan = assertExecutableReturnCovenantPlan(JSON.parse(open(planPath)));
const driverBaseUrl = (__ENV.OPENCLAW_RETURN_COVENANT_DRIVER_URL || '').replace(/\/+$/u, '');
if (!/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]+)?$/u.test(driverBaseUrl)) {
  throw new Error('OPENCLAW_RETURN_COVENANT_DRIVER_URL must be an HTTP loopback URL');
}

function parseResponse(response, phase) {
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
  if (
    body?.schema !== RETURN_COVENANT_DRIVER_SCHEMA ||
    body?.phase !== phase ||
    body?.ok !== true
  ) {
    throw new Error(`${phase} returned an invalid driver receipt`);
  }
  return body;
}

function postPhase(phase, request) {
  return parseResponse(http.post(
    `${driverBaseUrl}/v1/return-covenant/${phase}`,
    JSON.stringify(request),
    { headers: { 'Content-Type': 'application/json' } },
  ), phase);
}

function observeUntilSettled({ execution, caseHandle, acceptance, transition }) {
  const deadline = Date.now() + plan.settlementWindowMs + 5_000;
  while (Date.now() <= deadline) {
    const response = postPhase('observe', buildReturnCovenantDriverRequest({
      phase: 'observe',
      plan,
      execution,
      caseHandle,
      acceptance,
      transition,
    }));
    if (response.settled === true && response.observation) {
      return response.observation;
    }
    sleep(0.25);
  }
  throw new Error('bounded settlement window expired without an observation');
}

export default function () {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const observations = [];
  const executionErrors = [];

  for (const execution of expandReturnCovenantExecutions(plan)) {
    let caseHandle = null;
    let acceptance = null;
    let transition = null;
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
      if (
        execution.caseId === 'forbidden-explicit-revocation' &&
        prepared.capability?.revocationApiExposed === false
      ) {
        if (!prepared.observation) {
          throw new Error('not-exposed capability did not return an observation');
        }
        observations.push(prepared.observation);
        continue;
      }

      const dispatched = postPhase('dispatch', buildReturnCovenantDriverRequest({
        phase: 'dispatch',
        plan,
        execution,
        caseHandle,
      }));
      acceptance = dispatched.acceptance;
      if (
        acceptance?.accepted !== true ||
        acceptance?.completionHeld !== true ||
        typeof acceptance?.heldResultId !== 'string'
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

      postPhase('release', buildReturnCovenantDriverRequest({
        phase: 'release',
        plan,
        execution,
        caseHandle,
        acceptance,
        transition,
      }));
      observations.push(observeUntilSettled({
        execution,
        caseHandle,
        acceptance,
        transition,
      }));
    } catch (error) {
      failures.add(1);
      executionErrors.push({
        caseId: execution.caseId,
        form: execution.form,
        message: String(error?.message || error),
      });
    } finally {
      if (caseHandle) {
        try {
          postPhase('cleanup', buildReturnCovenantDriverRequest({
            phase: 'cleanup',
            plan,
            execution,
            caseHandle,
            acceptance,
            transition,
          }));
        } catch (error) {
          failures.add(1);
          executionErrors.push({
            caseId: execution.caseId,
            form: execution.form,
            message: `cleanup: ${String(error?.message || error)}`,
          });
        }
      }
    }
  }

  const elapsed = Date.now() - started;
  duration.add(elapsed);
  console.log(`${RETURN_COVENANT_EVIDENCE_PREFIX}${JSON.stringify({
    schema: 'openclaw.k6.return-covenant-observation-set.v1',
    rowId: plan.rowId,
    runId: plan.runId,
    startedAt,
    endedAt: new Date().toISOString(),
    observations,
    executionErrors,
  })}`);
  console.log(
    `[${plan.rowId}] VERDICT: PARTIAL-candidate pending signed observer receipt`,
  );
}

export function handleSummary(data) {
  const failureCount =
    data.metrics.r_cd_return_covenant_authority_failures?.values?.count || 0;
  return {
    'r-cd-return-covenant-authority-summary.json': JSON.stringify({
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
    }, null, 2),
  };
}
