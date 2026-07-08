# Accepted `request_compaction` fixture design

Project 81 already has unattended canaries for the `request_compaction` tool surface:

- `R-RC-1` proves a direct typed-tool call reaches `request_compaction` and returns a structured below-threshold rejection.
- `R-RC-2` proves a delegated child reaches `request_compaction` and returns either a structured below-threshold rejection or an accepted-compaction receipt.

Those rows are intentionally allowed to stop at `HONEST-LIMIT` when the session is below the 70% context floor. They do **not** prove that an over-threshold session actually compacts, rotates/updates transcript state, or preserves a post-compaction recovery delegate across the seam. This fixture is the separate accepted-path design.

## Goal

Create a serialized fixture that proves a real accepted `request_compaction` lifecycle without polluting production config and without token-thrashing a frontier model.

The fixture should prove:

1. A disposable session crosses the compaction acceptance floor.
2. The agent stages a `continue_delegate(mode="post-compaction")` lifeboat before requesting compaction.
3. `request_compaction()` returns an accepted/enqueued result, not `REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD`.
4. Compaction runs after the turn, through the normal platform lifecycle.
5. The post-compaction delegate fires after compaction and returns to the compacted successor session.
6. The successor session can read the lifeboat return and produce a sentinel that was not present before compaction.

## Non-goals

Do not use any of these as the fixture mechanism:

- no production `~/.openclaw/openclaw.json` edits;
- no production Gateway restart;
- no lowering the live fleet compaction threshold;
- no attempt to consume hundreds of thousands of tokens on a hosted/frontier model;
- no PASS claim from threshold rejection alone;
- no PASS claim from a post-compaction delegate staged in a session that never actually compacted.

## Required isolation

The fixture must run in one of these isolation modes.

### Preferred: isolated temp Gateway

Start a throwaway Gateway with all mutable state redirected to a temp root:

- `OPENCLAW_CONFIG_PATH=<tmp>/openclaw.json`
- `OPENCLAW_STATE_DIR=<tmp>/state`
- `OPENCLAW_WORKSPACE_DIR=<tmp>/workspace`
- gateway host/port/token chosen for the fixture only
- a disposable agent/session namespace

The temp config may define a model catalog entry with a small effective context budget using explicit config metadata, for example `models.providers.<provider>.models.*.contextTokens` or `contextWindow` as appropriate for the selected provider. The exact path must be schema-checked in the implementation PR before use.

### Acceptable: harness-level simulated context accounting

If the proof runner can drive the same compaction code path with injected context accounting, it may avoid starting a second Gateway. This is only acceptable if the receipt proves the runtime entered the same `request_compaction` acceptance and post-compaction lifecycle used by real sessions. A unit-test-only stub is not enough for a Project 81 accepted-path PASS.

### Manual fallback: local model server behind temp config

A local GPU/CPU model server may be used only inside the isolated temp config. It must be optional, not assumed available for all maintainers. The fixture must emit `HONEST-LIMIT-local-model-unavailable` when no suitable local provider is present.

## Config knobs the implementation must make explicit

The fixture PR must document the exact values it uses for:

- provider/model id used by the temp session;
- model metadata cap (`contextTokens` or `contextWindow`);
- `agents.defaults.compaction.reserveTokens` and `reserveTokensFloor`;
- `agents.defaults.compaction.keepRecentTokens`;
- `agents.defaults.compaction.truncateAfterCompaction`;
- whether `notifyUser` is disabled for fixture quietness;
- temp Gateway port/token and cleanup path;
- timeout budget for compaction completion and post-compaction delegate return.

Any config mutation in a non-temp Gateway must fail closed unless the run has an explicit reviewed fixture with backup/restore receipts. The preferred implementation should not need that path.

## PASS receipts

A foldable PASS requires all of these receipts in the candidate artifact directory:

- `seat-readiness.json` or isolated-gateway readiness receipt showing the fixture target is disposable.
- `temp-config.redacted.json` or equivalent, with secrets removed and context-budget knobs visible.
- Parent/session transcript excerpt showing the agent staged `continue_delegate(mode="post-compaction")` before calling `request_compaction()`.
- `request-compaction-accepted.json` showing the tool accepted/enqueued compaction. A below-threshold rejection is not PASS for this fixture.
- Compaction lifecycle receipt: transcript checkpoint/successor id, compaction count change, or gateway event showing compaction start and complete for the target session.
- Post-compaction delegate receipt showing the lifeboat fired after the compaction event, not before.
- Successor-session sentinel showing the post-compaction return was consumed after rehydration.
- Cleanup receipt proving temp Gateway/process/state cleanup, or explicit path retained for review.

Tempo trace JSON should be fetched when trace ids are emitted. If the isolated fixture cannot emit Tempo traces, the artifact must say so explicitly and rely on transcript/lifecycle receipts instead.

## HONEST-LIMIT / BLOCKED outcomes

The fixture should emit structured non-PASS outcomes rather than fail opaquely:

- `HONEST-LIMIT-local-model-unavailable` — optional local provider requested but not available.
- `BLOCKED-temp-gateway-start` — isolated Gateway could not start or become ready.
- `BLOCKED-context-budget-not-forced` — fixture could not prove the session crossed the acceptance floor.
- `FAIL-request-compaction-rejected` — tool returned a structured below-threshold rejection in a fixture intended to be over threshold.
- `FAIL-compaction-timeout` — request accepted but no compaction completion receipt arrived before timeout.
- `FAIL-lifeboat-missing` — compaction completed but the post-compaction delegate did not return/rehydrate.
- `FAIL-cleanup` — temp state or process cleanup failed after the proof.

## Proposed issue shape

Title: `Project 81: add isolated accepted request_compaction fixture`

Body checklist:

- [ ] start from current docs main and current OpenClaw runtime docs for compaction settings;
- [ ] choose preferred isolation mode: temp Gateway or harness-level runtime path;
- [ ] schema-check the exact config paths for context budget and compaction settings;
- [ ] implement a fixture runner that writes redacted config/readiness/lifecycle receipts;
- [ ] prove accepted `request_compaction`, not only threshold rejection;
- [ ] prove post-compaction delegate crosses the compaction boundary;
- [ ] emit structured HONEST-LIMIT/BLOCKED outcomes for unavailable local model or fixture startup failures;
- [ ] keep `R-RC-1`/`R-RC-2` threshold canaries separate from this accepted-path PASS;
- [ ] run public dry-run after wiring any manifest/scenario surface.

## Proposed PR shape

The implementation PR should be split from broad-suite reporting/docs cleanup.

Expected files:

- fixture runner script under `tools/k6-proofs/scripts/` or `tools/k6-proofs/fixtures/`;
- optional manifest/scenario only if the accepted path can be made unattended and safe;
- row/runbook docs that state this is accepted-path coverage, not threshold-canary coverage;
- tests for fail-closed config isolation and redacted receipt emission;
- sample artifact fixture with secrets removed.

Review gate:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
```

If the PR adds a script without a runnable manifest, it should still include a dry-run or unit-test gate that exercises argument parsing, redaction, and fail-closed behavior.
