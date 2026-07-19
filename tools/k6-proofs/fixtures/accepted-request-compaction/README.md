# Accepted `request_compaction` fixture

This fixture is the Project 81 scaffold for proving the **accepted** compaction path, separate from the existing threshold-rejection canaries (`R-RC-1` and ordinary `R-RC-2`). It remains intentionally fail-closed for PASS, but `--run` now performs the next reviewed live step safely: it creates an isolated temp root/config/state/workspace/logs tree, allocates or validates a unique loopback port, writes a redacted temp config artifact, attempts to start a temp Gateway, probes readiness, and always emits cleanup receipts.

## Contract

A foldable PASS for this fixture requires all of the following, in order:

1. Disposable fixture target with isolated config/state/workspace.
2. Fresh known context accounting at `>= 0.70` of the fixture context cap.
3. Parent turn stages `continue_delegate(mode="post-compaction")` before `request_compaction()`.
4. `request_compaction` returns `status:"compaction_requested"` with a `compactionRequestId`.
5. Compaction lifecycle starts and completes for the target session.
6. The post-compaction delegate fires after the compaction seam.
7. The compacted/successor session consumes a sentinel that was impossible before compaction.
8. Temp Gateway/process/state cleanup is proven, or retained intentionally for review.

A threshold rejection is never a PASS for this fixture.

## Dry-run / plan

```bash
node tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs \
  --plan \
  --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
  --artifact-dir /tmp/accepted-compaction-plan \
  --json
```

The dry-run starts no Gateway and touches no production config. It writes:

- `accepted-compaction-plan.json`
- `fixture-readiness.json`
- `temp-config.redacted.json`
- `cleanup.json`
- `outcome.json`

The plan artifact includes the required environment, receipt names, non-PASS classifications, and guardrails for the reviewed live implementation.

## Live execution status

`--run` requires `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true` plus a candidate SHA. In this PR it:

1. Refuses production or production-symlink temp/artifact paths before artifact emission.
2. Allocates or validates a loopback port.
3. Writes the actual temp config to `<tmp>/config/openclaw.json` and a redacted copy to `temp-config.redacted.json`.
4. Attempts to spawn an isolated temp Gateway with `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, and `OPENCLAW_WORKSPACE_DIR` pointed only at the temp root.
5. Probes `/health` and `/status`, records `gatewayPid` in `fixture-readiness.json` when a process actually starts, then always stops the temp Gateway and writes `cleanup.json`.

If startup or readiness fails, the fixture exits non-zero with `BLOCKED-temp-gateway-start`. If readiness succeeds, it still exits non-zero with `BLOCKED-context-budget-not-forced` because the accepted compaction session-orchestration seam is not implemented yet.

No PASS is claimed by this PR.

## Required live env knobs

The future live runner must make these explicit and redacted in artifacts:

- `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true`
- `OPENCLAW_ACCEPTED_COMPACTION_TMPDIR=<tmp>`
- `OPENCLAW_CONFIG_PATH=<tmp>/config/openclaw.json`
- `OPENCLAW_STATE_DIR=<tmp>/state`
- `OPENCLAW_WORKSPACE_DIR=<tmp>/workspace`
- `OPENCLAW_ACCEPTED_COMPACTION_PORT=<free-port>`
- `OPENCLAW_GATEWAY_WS=ws://127.0.0.1:<port>`
- `OPENCLAW_GATEWAY_TOKEN=<fixture-token>`
- `OPENCLAW_CANDIDATE_SHA=<40-char-sha>`
- `OPENCLAW_ACCEPTED_COMPACTION_MODEL=<provider/model>`
- optional `OPENCLAW_ACCEPTED_COMPACTION_PROVIDER_BASE_URL=<local-openai-compatible-base-url>`
- `OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS=<small-cap>`
- `OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS=<ms>`
- optional `OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP=true`
- optional `OPENCLAW_ACCEPTED_COMPACTION_GATEWAY_CMD_JSON='["openclaw","gateway"]'` to override the temp Gateway command (used by tests with `mock-temp-gateway.mjs`)

## Non-PASS outcomes

The runner must classify non-PASS states instead of failing opaquely:

- `PARTIAL-local-model-unavailable`
- `BLOCKED-temp-gateway-start`
- `BLOCKED-context-budget-not-forced`
- `FAIL-request-compaction-rejected`
- `FAIL-request-compaction-already-pending`
- `FAIL-compaction-timeout`
- `FAIL-lifeboat-missing`
- `FAIL-sentinel-missing`
- `FAIL-cleanup`

## Current emitted receipts in `--run`

- `accepted-compaction-plan.json`
- `fixture-readiness.json`
- `temp-config.redacted.json`
- `cleanup.json`
- `outcome.json`

`fixture-readiness.json` records the isolated temp root, allocated port, startup probe status, model id, context cap, and `gatewayPid` when a temp Gateway actually starts. `cleanup.json` proves whether the temp Gateway stopped, whether cleanup had to force-kill it, whether the temp root was deleted or intentionally retained, and that `productionConfigTouched` stayed `false`.

## Safety rails

- No production `~/.openclaw/openclaw.json` edits.
- No production Gateway restart.
- No live fleet threshold lowering.
- No hosted frontier token burn to force pressure.
- No PASS from threshold rejection.
- No PASS unless the lifeboat crosses the actual compaction seam.
