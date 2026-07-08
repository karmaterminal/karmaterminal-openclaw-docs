# Accepted `request_compaction` fixture

This fixture is the Project 81 scaffold for proving the **accepted** compaction path, separate from the existing threshold-rejection canaries (`R-RC-1` and ordinary `R-RC-2`). Live execution is gated behind an explicit review flag; today the runner implements preflight plus a deterministic local mock provider, and the downstream phases (temp Gateway spawn, `request_compaction` RPC, lifecycle wait, successor sentinel) live behind dependency-injected stubs so the follow-up review PR can wire them without a second refactor.

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

## Live orchestration (mock-provider + preflight only in this increment)

`--run` requires **three** independent signals so we never start a subprocess
by accident:

1. `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true` — fixture opt-in.
2. `OPENCLAW_CANDIDATE_SHA=<40-char-sha>` (or `--candidate-sha`).
3. `--enable-live-orchestration` (or `OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true`) — **review gate**.

Without the review gate, `--run` classifies as `HONEST-LIMIT-live-orchestration-review-gate`, exits 3, `pass:false`, and never spawns a subprocess.

With the review gate, the runner executes the live orchestration state machine which today implements:

- Deterministic loopback mock provider startup with OpenAI-compatible `/v1/responses` and `/v1/chat/completions` routes. The provider returns fixed high-input token usage suitable for the later context-forcing phase and writes `mock-provider.json` / `mock-provider-stop.json` receipts.
- Preflight validation of the OpenClaw source dir (`--openclaw-dir` or `OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR`). Directories that live inside any production marker (`~/.openclaw`, `~/flesh_beast_tmp/openclaw`) are refused with `BLOCKED-openclaw-dir-inside-production`. Reviewed source-only guards are required before the default hint directory may be used.
- Free port allocation on 127.0.0.1 (releases the port immediately; the temp Gateway will re-bind when the live implementation lands).
- Redacted temp config write to `<tempRoot>/config/openclaw.json`. The fixture token is never written to disk — the config carries `<REDACTED-fixture-token>`, and the model provider baseUrl points at the deterministic mock provider port.
- `preflight-context.json` receipt with candidate SHA, openclaw entrypoint, port candidate, mock provider port, and configured context budget.

After mock-provider/preflight the state machine calls the temp-Gateway start step, which is currently unimplemented and causes the runner to classify as `HONEST-LIMIT-live-orchestration-preflight-only`, exit 3, `pass:false`, with `phase: "temp-gateway-start"`. This is intentional: no PASS is possible until the isolated Gateway, RPC, compaction lifecycle, and lifeboat receipts are wired.

Example:

```bash
OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true \
  node tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs \
  --run \
  --enable-live-orchestration \
  --candidate-sha "$OPENCLAW_CANDIDATE_SHA" \
  --openclaw-dir /path/to/openclaw-source-checkout \
  --tmpdir /tmp/openclaw-p81-331-fixture \
  --json
```

## Required live env knobs

The future live runner must make these explicit and redacted in artifacts:

- `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true`
- `OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true` (review gate)
- `OPENCLAW_ACCEPTED_COMPACTION_TMPDIR=<tmp>`
- `OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR=<source-dir>`
- `OPENCLAW_CONFIG_PATH=<tmp>/config/openclaw.json`
- `OPENCLAW_STATE_DIR=<tmp>/state`
- `OPENCLAW_WORKSPACE_DIR=<tmp>/workspace`
- `OPENCLAW_ACCEPTED_COMPACTION_PORT=<free-port>` (0 = allocate during preflight)
- `OPENCLAW_GATEWAY_WS=ws://127.0.0.1:<port>`
- `OPENCLAW_GATEWAY_TOKEN=<fixture-token>` (never written to disk)
- `OPENCLAW_CANDIDATE_SHA=<40-char-sha>`
- `OPENCLAW_ACCEPTED_COMPACTION_MODEL=<provider/model>`
- `OPENCLAW_ACCEPTED_COMPACTION_CONTEXT_TOKENS=<small-cap>`
- `OPENCLAW_ACCEPTED_COMPACTION_KEEP_RECENT_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_RESERVE_TOKENS=<n>`
- `OPENCLAW_ACCEPTED_COMPACTION_TIMEOUT_MS=<ms>`
- optional `OPENCLAW_ACCEPTED_COMPACTION_RETAIN_TMP=true`

## Non-PASS outcomes

The runner classifies non-PASS states instead of failing opaquely:

- `HONEST-LIMIT-live-orchestration-review-gate`
- `HONEST-LIMIT-live-orchestration-preflight-only`
- `HONEST-LIMIT-local-model-unavailable`
- `BLOCKED-openclaw-dir-missing`
- `BLOCKED-openclaw-dir-inside-production`
- `BLOCKED-openclaw-entrypoint-missing`
- `BLOCKED-free-port-allocation`
- `BLOCKED-temp-gateway-start`
- `BLOCKED-mock-provider-start`
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
- `--run` requires the `--enable-live-orchestration` review gate.
- `openclaw-dir` inside production markers is refused until reviewed source-only guards land.
