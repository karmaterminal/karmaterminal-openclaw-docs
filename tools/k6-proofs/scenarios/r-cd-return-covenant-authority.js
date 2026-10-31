/**
 * Scenario scaffold: R-CD-RETURN-COVENANT-AUTHORITY.
 *
 * k6 cannot start, observe or replace a gateway process, so this entry stays non-runnable
 * and fails closed. The row's executable control is
 * `tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs`: it drives a real
 * restart on a disposable proof-gw gateway as the product's declared external supervisor
 * and grades the receipts. Ruling: 🌊, Discord msg 1565895695586558120 (the row stays
 * required/MISSING until this control runs on the final successor, including 🌻's
 * replacement-never-usable negative). Bound issue: karmaterminal/openclaw-bootstrap#1727.
 *
 * Product path at F′ karmaterminal/openclaw f15237ec921879d918482cdf372b0718d4c1aab9
 * (byte-read with git show; GitNexus index openclaw-gn-j7-bc90c0ea is STALE for these paths,
 * so its answers were leads only).
 *
 * 1. Which authority. A delegate's return covenant is bound to the recipient session's
 *    authority generation, one UUID epoch per logical session key:
 *    - store: session_recipient_authority(session_key, epoch, created_at, updated_at) in the
 *      per-agent database agents/<agent>/agent/openclaw-agent.sqlite
 *      (src/state/openclaw-agent-schema.sql:140-147: "Logical return authority survives
 *      session materialization and deletion");
 *    - currency rule: a captured authority is current only while the stored epoch equals it
 *      (src/config/sessions/session-recipient-authority-types.ts:87-92), checked under writer
 *      admission (src/config/sessions/session-recipient-authority-current.ts:99-106);
 *    - capture is insert-if-absent (src/config/sessions/session-recipient-authority.worker.ts:35-50),
 *      on delegate spawn (src/auto-reply/continuation/recipient-authority-binding.ts:35-54,
 *      src/agents/subagents/spawn/subagent-spawn-request.ts:328);
 *    - generation edges write a fresh epoch (src/config/sessions/session-accessor.sqlite-recipient-authority.ts:17-37):
 *      deletion (src/config/sessions/session-accessor.sqlite-entry-store.ts:66-69), owner
 *      change (src/config/sessions/session-accessor.sqlite-owner.ts:180-182), visibility
 *      narrowing (src/config/sessions/session-accessor.sqlite-entry-mutation.ts:119-135),
 *      member removal (src/config/sessions/session-sharing-store.native.ts:180-182);
 *    - return delivery revalidates it (src/agents/subagent-announce.continuation-return.ts:164-165,
 *      src/auto-reply/continuation/continuation-wake.ts:146-167); durable recipient-bound
 *      rows recover in a new process only while it is current
 *      (src/gateway/server-restart-sentinel.new-process.proof.test.ts:85-124).
 *    A gateway restart is not a generation edge, so the epoch must be the same before, during
 *    and after the restart. The control establishes one generation without a model turn:
 *    sessions.create, then session.visibility.set to "suggest"
 *    (src/gateway/server-methods/sessions-sharing.ts:527-580; allowed by default,
 *    src/gateway/session-sharing-policy.ts:85-93), which advances (creates) the row. It reads
 *    the row read-only from outside the gateway and publishes only its SHA-256.
 *
 * 2. Which transition. gateway.restart.request (operator.admin,
 *    src/gateway/methods/core-descriptors.ts:344). The untargeted form
 *    {reason:"gateway.restart", skipDeferral:true} is the safe-restart coordinator path
 *    (src/gateway/server-methods/restart.ts:124-194 -> src/infra/restart-coordinator.ts:66-94);
 *    its response body {ok,status,preflight,restart} is retained verbatim (private) and
 *    redacted (public). The CLI's unmanaged path sends the targeted form instead
 *    (src/cli/daemon-cli/lifecycle-unmanaged.ts:139-165). A device-less local CLI client keeps
 *    its shared-token scopes (src/gateway/server/ws-connection/handshake-auth-helpers.ts:189-203,
 *    connect-auth.ts:286-296).
 *    With OPENCLAW_SUPERVISOR_MODE=external (src/infra/gateway-supervision.ts:10-12,
 *    src/infra/supervisor-markers.ts:84-93, src/infra/process-respawn.ts:56-71) the run loop
 *    closes the server, publishes the gateway_restart_handoff row, releases the lock and exits
 *    0 (src/cli/gateway-cli/run-loop.ts:497-560; ordering pinned by
 *    src/cli/gateway-cli/run-loop-external-handoff.test-support.ts:68-110). No restart mode
 *    at F′ keeps the old process serving until its successor is ready: every full-process
 *    path closes first, and unmanaged gateways restart in-process
 *    (src/cli/gateway-cli/run-loop.ts:562-580). The supervisor consumes the handoff with
 *    `gateway restart-handoff consume --expected-pid <pid> --json`
 *    (src/cli/gateway-cli/register-restart-handoff.ts:41-74; row TTL 60 s,
 *    src/infra/restart-handoff.ts:36-41) and starts the replacement.
 *    A proof-gw systemd unit cannot host this: composite-launcher.sh sets OPENCLAW_SYSTEMD_UNIT
 *    with Restart=no, so a supervised restart exits 0 and never returns. The control stops
 *    nothing it did not start: the operator stops the proof-gw unit first.
 *
 * 3. Which readiness signal. GET /readyz is 200 {ready:true,...} or 503 with failing[]
 *    (src/gateway/server-http-probes.ts:84-94, src/gateway/gateway-http-route-contracts.ts:1-8);
 *    GET /startupz reports started | starting | draining with the buildId
 *    (src/gateway/server/readiness.ts:29-33 and 46-72, src/gateway/server-http-probes.ts:12-24);
 *    hello-ok carries server.buildId and a per-process server.bootId
 *    (src/gateway/server/ws-connection/connect-hello.ts:173-182; buildId from dist/build-info.json,
 *    src/version.ts:83-95 and 181-186). A generation is usable only while it owns the
 *    listening socket, /readyz passes and hello-ok answers; the control observes all three at
 *    every sample. An unchanged epoch alone is not usability.
 *
 * At F′ the old server closes before any successor is ready, so continuous service across a
 * restart is not an invariant (🌊, Discord msg 1565903655885082677). The control asserts what
 * holds: the durable epoch is present and unchanged at every sample, including the outage where
 * no process serves, and the failure text survives. It reports the outage as outageInterval
 * (last serving old sample -> first serving sample after it). The rejected base lost the
 * failure body.
 */
export const options = {
  scenarios: {
    r_cd_return_covenant_authority_scaffold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

const REFUSAL =
  'R-CD-RETURN-COVENANT-AUTHORITY is fixture-gated; run tools/k6-proofs/scripts/run-return-covenant-restart-control.mjs against a stopped proof-gw gateway at the exact candidate.';

// k6 logs an exception thrown by an iteration and still exits 0; one thrown from setup()
// aborts the run (exit 107), so the refusal lives there too.
export function setup() {
  throw new Error(REFUSAL);
}

export default function () {
  throw new Error(REFUSAL);
}
