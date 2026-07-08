# Accepted `request_compaction` fixture

This fixture is the Project 81 scaffold for proving the **accepted** compaction path, separate from the existing threshold-rejection canaries (`R-RC-1` and ordinary `R-RC-2`). It is intentionally fail-closed: the current script emits a redacted plan/dry-run artifact only, and live execution refuses to start until reviewed isolated-Gateway orchestration lands.

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

`--run` is deliberately blocked in this PR. It requires `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true`, a candidate SHA, and reviewed code that actually starts an isolated temp Gateway and collects the PASS receipts above. Until then, `--run` exits fail-closed before any Gateway is started.

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
- `OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS=<small-cap>`
- `OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS=<ms>`
- optional `OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP=true`

## Non-PASS outcomes

The runner must classify non-PASS states instead of failing opaquely:

- `HONEST-LIMIT-local-model-unavailable`
- `BLOCKED-temp-gateway-start`
- `BLOCKED-context-budget-not-forced`
- `FAIL-request-compaction-rejected`
- `FAIL-request-compaction-already-pending`
- `FAIL-compaction-timeout`
- `FAIL-lifeboat-missing`
- `FAIL-sentinel-missing`
- `FAIL-cleanup`

## Safety rails

- No production `~/.openclaw/openclaw.json` edits.
- No production Gateway restart.
- No live fleet threshold lowering.
- No hosted frontier token burn to force pressure.
- No PASS from threshold rejection.
- No PASS unless the lifeboat crosses the actual compaction seam.
