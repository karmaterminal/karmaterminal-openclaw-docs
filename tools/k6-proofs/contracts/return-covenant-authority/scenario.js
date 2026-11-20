/**
 * Row: R-CD-RECIPIENT-AUTHORITY-MATRIX.
 *
 * The recipient-authority matrix: 12 lifecycle cases, each fired as a typed continue_delegate
 * call and then as a bracket [[CONTINUE_DELEGATE: ...]] token, 24 observations under one signed
 * receipt. It is its own row. R-CD-RETURN-COVENANT-AUTHORITY is docs#615's supervised restart
 * control (scenarios/r-cd-return-covenant-authority.js), and this matrix never feeds that row's
 * verdict (🌊's ruling, 2026-10-31). The row manifest caps it at PARTIAL-candidate: it is a
 * process-local launcher and fixture, not an external gateway invocation. Bound issue:
 * karmaterminal/karmaterminal-openclaw-docs#536.
 *
 * This scenario is not k6-runnable through run-proof.sh. launch-return-covenant-driver.mjs runs
 * it inside its sandbox against a product-owned loopback fixture driver that holds each accepted
 * delegate result, performs the case's lifecycle edge, and only then releases the result.
 *
 * Product path at j12 karmaterminal/openclaw 352f56029dc95c60149ab4aaa127226a861d0b3d
 * (codeagent/absorb-8083-j12, the product to be presented; byte-read with git show and git grep).
 * All paths below are src/ at j12 unless marked otherwise.
 *
 * No case executes at j12. The product seam this scenario drives is gone:
 * 2a8566340ddf8572dd974fc6a510fed0907dfe8a ("move the return-covenant fixture harness to
 * fork-only", openclaw#1418) removed scripts/return-covenant-fixture-driver.mjs, the
 * return-covenant fixture module and the gateway extra-handler seam it ran in
 * (gateway/server-extra-handlers.ts). git grep at j12 finds no return-covenant bytes. The last
 * product carrying the seam is P89 3821eaef72677c78f450ae9956cb582a22ba4cba. The launcher
 * requires the plan's fixture command to be a tracked blob at the candidate, so a j12 plan is
 * refused before any process starts; no case can pass there without reaching its path. Even
 * where the seam survives, it cannot run this row unchanged: the P89 driver, and every fork-full
 * ref that keeps it (2a8566340d^, gloss/p89-composite-l8full, scribe/20261002/p89-composite-l8),
 * pins the plan's row id to R-CD-RETURN-COVENANT-AUTHORITY
 * (return-covenant-fixture/protocol.ts:11 and 108 at 3821eaef), so it refuses a plan for
 * R-CD-RECIPIENT-AUTHORITY-MATRIX. A restored seam must accept this row's id. The anchors say
 * where each case's return would be bound, checked, refused or adopted at j12 and what each
 * outcome leaves, for the review of a restored seam.
 *
 * Shared path, every case and both forms:
 *   Bound    typed form: agents/tools/continue-delegate-tool.ts:434 (post-compaction mode
 *            stages at :401 through stagePostCompactionCustodyDelegate,
 *            auto-reply/continuation/delegate-store-post-compaction.ts:41-69); bracket form:
 *            auto-reply/reply/agent-runner-continuation-signal.ts:251 -> enqueuePendingDelegate
 *            (auto-reply/continuation/delegate-store.ts:203-219). Every form reaches
 *            createDelegateRecord, which binds before the custody record exists
 *            (auto-reply/continuation/delegate-flow-store.ts:426-437) ->
 *            createContinuationRecipientAuthorityBinding / captureContinuationRecipientAuthorities
 *            (auto-reply/continuation/recipient-authority-binding.ts:56-74, 35-54; the requester's
 *            own key when no target is named) -> captureSessionRecipientAuthority
 *            (config/sessions/session-sharing-store.async.ts:588-597) -> worker "authority.capture"
 *            (config/sessions/session-sharing-store.worker.ts:170-171) -> insert-if-absent epoch
 *            (config/sessions/session-recipient-authority.worker.ts:35-50). The spawn carries the
 *            binding (agents/subagents/spawn/subagent-spawn-request.ts:328,
 *            recipient-authority-binding.ts:76-109) and the completed run hands it to the return
 *            (agents/subagents/registry/subagent-registry-announce-flow.ts:22,
 *            agents/subagents/announce/subagent-announce.ts:571 ->
 *            agents/subagent-announce.continuation-return.ts:63-213; a bound return always takes the
 *            targeted path, :98-103, and enqueues at :164-188).
 *   Checked  one predicate: the captured epoch equals the stored one
 *            (config/sessions/session-recipient-authority-types.ts:87-92), read in the session
 *            sharing worker and decided synchronously under the agent database writer admission
 *            (config/sessions/session-recipient-authority-current.ts:71-124, 132-157; openclaw#1432
 *            moved this read off the caller thread). It runs at enqueue
 *            (auto-reply/continuation/targeting.ts:242-254 before the durable row, :282-311 after
 *            it, :329-346 after the event is queued), at the wake handoff
 *            (auto-reply/continuation/continuation-wake.ts:163-228), at the prompt drain
 *            (auto-reply/reply/session-system-events.ts:192-211) and at final prompt adoption
 *            (auto-reply/reply/session-system-event-adoption.ts:234-256, 263-300), and at durable
 *            replay (gateway/server-restart-sentinel-delivery.ts:226-243, 269-290).
 *            The matrix's held flow decides at the replay check. At P89 the driver enqueued each
 *            held return while its authority was still current, then deferred the durable row
 *            and removed the queued event (return-covenant-fixture/case-dispatch.ts:184-194 at
 *            3821eaef). At release it drained that row itself, through
 *            deliverQueuedSessionDeliveryCore (case-lifecycle.ts:321-346). So every refusal it
 *            observed came from the replay check, and the wake and adoption checks fenced the
 *            allowed cases after it. The enqueue checks ran only before the edge, when the epoch
 *            was still current.
 *   Refused  the product has one refusal, not three: targeting.ts:284 calls it "stale",
 *            server-restart-sentinel-delivery.ts:274 "stale-authority". The matrix's stale,
 *            unauthorized and revoked labels name the edge that advanced the epoch; the P89 driver
 *            set them from the case id (return-covenant-fixture/case-lifecycle.ts:415-421 at
 *            3821eaef). A refused return writes no row (targeting.ts:252-254), or its row is
 *            acknowledged and retired and its queued event removed (targeting.ts:312-319, 340-345;
 *            continuation-wake.ts:167-171 and 229-239 -> settleStaleSystemEventAuthority,
 *            session-system-event-adoption.ts:113-134; settle-stale at :182-198; replay skips the
 *            row and the drain settles it, server-restart-sentinel-delivery.ts:234-243, 284-289).
 *   Adopted  an adoption-scoped managed system event (targeting.ts:270-310) handed to one
 *            continuation wake turn (continuation-wake.ts:187-222; this wake replaced upstream's
 *            retired requestHeartbeatNow, :5-15) or adopted by the next prompt drain
 *            (session-system-event-adoption.ts:178-227); its row is acknowledged only after the
 *            turn adopts it (continuation-wake.ts:209-221, 255-273;
 *            session-system-event-adoption.ts:102-111).
 *   Final effects  allowed: prompt adoption 1; wake 1 when the mode wakes (targeting.ts:366-374,
 *            continuation-return.ts:175 and 252-254); channel delivery only from a turn that
 *            delivers (silent-wake hands off with deliver:false, continuation-wake.ts:194), as
 *            RETURN_COVENANT_MODE_EFFECTS configures. Refused: zero prompt adoption, zero wake,
 *            zero channel delivery, the durable row acknowledged with no retry.
 *
 * The runtime advances the epoch only at deletion
 * (config/sessions/session-accessor.sqlite-entry-store.ts:56-69), owner change
 * (config/sessions/session-accessor.sqlite-owner.ts:168-182), visibility narrowing for every writer
 * (config/sessions/session-accessor.sqlite-entry-mutation.ts:119-136) and member removal
 * (config/sessions/session-sharing-store.native.ts:177-182), each through
 * advanceSessionRecipientAuthorityInTransaction
 * (config/sessions/session-accessor.sqlite-recipient-authority.ts:16-37), plus first capture.
 * Outside the runtime, `openclaw doctor`'s canonical-key repair can re-mint or delete an epoch
 * (commands/doctor-session-recipient-authority-repair.ts:15-117); it is not a revocation API.
 * j12 has no recipient-authority revocation API (gateway/methods/core-descriptors.ts lists
 * sessions.reset :255, sessions.delete :259, session.visibility.set :467,
 * session.members.remove :470, sessions.assignOwner :524 and no revoke). Its stores are per-agent
 * schema 40 and global schema 36 (state/openclaw-schema-versions.ts:13, 47;
 * state/openclaw-agent-recipient-authority-schema.ts:11, openclaw#1484); the plan's v18/v19
 * profiles and the retention inspector's global-v15/per-agent-v19 pins are product 0ed59cb6's,
 * so a j12 store would fail closed as unverified-resource-retention.
 *
 * Per case at j12 (allowed: captured = current, adopted; forbidden: captured != current,
 * refused):
 *   - allowed-ordinary-new: /new is a reset. Reply-session init's explicit reset
 *     (auto-reply/reply/session.ts:203-210 -> session-rollover-mutation.ts:11-53) and the Gateway's
 *     sessions.reset (gateway/session-reset-service.ts:392 ->
 *     gateway/session-reset-continuation-retention.ts:7-36) both run reset retention
 *     (auto-reply/continuation/session-reset-retention.ts:49-131): returns are held while the
 *     reset is pending (targeting.ts:288-289, 320-327; server-restart-sentinel-delivery.ts:201-225),
 *     then released to the successor head if the epoch is current or moved to failed if stale
 *     (auto-reply/continuation/session-reset-retention-resolve.ts:31-73, 161-185). The commit
 *     writes the next entry without advancing the epoch (config/sessions/session-reset.kernel.ts:14-43).
 *     At P89 the fixture called resetSessionEntryLifecycle directly, which bypasses reset
 *     retention (new since F4, 2026-10-21); a restored seam must drive /new through one of
 *     the two flows above or the case does not reach its j12 path.
 *   - allowed-ordinary-reset: the same path and the same P89 gap as allowed-ordinary-new, reason reset.
 *   - allowed-provider-fallback: the run's fallback (agents/model-fallback-runner.ts:138; sticky
 *     choice agents/model-fallback-sticky.ts:27-108) touches no epoch writer. The P89 fixture
 *     modelled it as a session-entry model patch, which reaches entry-mutation.ts:119-136 without
 *     narrowing and so cannot advance; that proves the patch writer keeps the epoch, not that a
 *     real fallback run delivers.
 *   - allowed-compaction: compaction has no epoch writer; a post-compaction delegate is staged
 *     with its binding (auto-reply/continuation/delegate-store-post-compaction.ts:41-69) and
 *     released carrying it (auto-reply/reply/post-compaction-delegate-delivery.ts:547-548), then
 *     takes the shared path. No compaction ran at P89: the fixture patched compactionCount and
 *     claimed the staged delegate directly (case-lifecycle.ts:141-146,
 *     case-dispatch.ts:288-310), so it showed the staged binding carries over, not that a real
 *     compaction releases it.
 *   - allowed-gateway-restart-replay: the durable row survives the process and replays through
 *     deliverQueuedSessionDeliveryCore (gateway/server-restart-sentinel.ts:74-98, 138-153 ->
 *     gateway/server-restart-sentinel-delivery.ts:138-297), checked at :226-243 and re-enqueued
 *     under the authority decision at :269-290. At P89 the "restart" was the driver's SIGTERM and
 *     respawn of its own fixture gateway (return-covenant-fixture/gateway.ts:71-88,
 *     fixture-gateway.ts:18-81) and the replay was the driver's own drain
 *     (case-lifecycle.ts:321-346). The replacement's boot recovery
 *     (gateway/server-restart-sentinel.ts:138-153) was deliberately kept from redriving the
 *     held row (case-lifecycle.ts:327-328). No gateway.restart.request, run-loop restart branch
 *     or restart handoff is involved, so this edge is not evidence for the supervised-restart
 *     claim that R-CD-RETURN-COVENANT-AUTHORITY's control owns.
 *   - allowed-session-id-rollover: an implicit reply-session rollover (session.ts:203-210 with
 *     explicitReset false; session-rollover-mutation.ts:27-29) gets inert retention hooks
 *     (auto-reply/reply/session-init-reset-retention.ts:11-39) and writes a new session ID under
 *     the same key with no epoch advance. The P89 fixture wrote the new session ID through the
 *     entry accessor directly, so it reached the epoch rule but not the rollover flow.
 *   - allowed-late-materialization: first capture of an absent recipient creates the epoch row
 *     (session-recipient-authority.worker.ts:39-49); materializing the session later writes no
 *     epoch, provided the materializing write does not narrow visibility below shared
 *     (entry-mutation.ts:124-136 reads an absent previous visibility as shared).
 *   - forbidden-delete-recreate (label stale; the reassigned, replaced recipient): sessions.delete
 *     -> deleteSessionEntryRows advances the epoch in the deleting transaction
 *     (session-accessor.sqlite-entry-store.ts:56-69), and the authority row outlives the session,
 *     so the recreated key keeps the advanced epoch and the captured one stays stale.
 *   - forbidden-owner-reassignment (label unauthorized; the reassigned owner): sessions.assignOwner
 *     -> assignSessionOwner advances when the owner actually changes
 *     (session-accessor.sqlite-owner.ts:131-189, advance at :180-182).
 *   - forbidden-member-access-removal (label unauthorized; the product calls it revoking access):
 *     session.members.remove -> removeSessionMember advances before observers are notified
 *     (session-sharing-store.native.ts:136-195, advance at :180-182).
 *   - forbidden-restrictive-visibility (label unauthorized; the product calls it revoking
 *     recipients): any writer that narrows visibility advances in the same transaction
 *     (entry-mutation.ts:119-136, rank session-recipient-authority-types.ts:66-71 and 94-99). At
 *     P89 only the Gateway method advanced, so the fixture advanced the epoch itself in
 *     afterPersistInTransaction (case-lifecycle.ts:214-223); at j12 the patch writer advances on
 *     its own, and a restored seam must not add its own advance or the case cannot show the
 *     product did.
 *   - forbidden-explicit-revocation (label revoked): no product path at j12 (no revocation API;
 *     the runtime's only advance sites are the four above and first capture). At j12 the case
 *     can only be not-exposed with the product's capability receipt; that is a fact for the
 *     review of a restored seam, not something the resolver can enforce. At P89 the driver
 *     declared revocationApiExposed from test-runtime/return-covenant/recipient-authority-revocation
 *     and advanced the epoch itself (case-lifecycle.ts:224-234). The resolver now refuses an
 *     executed revocation from any test-runtime surface (revocation-capability-mismatch).
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
    r_cd_recipient_authority_matrix: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30m',
    },
  },
  thresholds: {
    r_cd_recipient_authority_matrix_failures: ['count==0'],
    r_cd_recipient_authority_matrix_duration_ms: ['p(95)<1800000'],
  },
};

const failures = new Counter('r_cd_recipient_authority_matrix_failures');
const duration = new Trend('r_cd_recipient_authority_matrix_duration_ms', true);
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
    cleanupRun.runtimeConfigSha256 !== plan.target.runtimeConfigSha256 ||
    cleanupRun.runtimeArtifactManifestSha256 !==
      plan.target.runtimeArtifactManifestSha256
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
    runtimeArtifactManifestSha256:
      plan.target.runtimeArtifactManifestSha256,
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
  const startedAt = new Date().toISOString();
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
    startedAt,
    completedAt: new Date().toISOString(),
    cleanupRun: response.cleanupRun,
    cleanupRunProof: response.driverBinding,
    completed: true,
  })}`);
}

export function handleSummary(data) {
  const failureCount =
    data.metrics.r_cd_recipient_authority_matrix_failures?.values?.count || 0;
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
        data.metrics.r_cd_recipient_authority_matrix_duration_ms?.values || null,
    })}\n`,
  };
}
