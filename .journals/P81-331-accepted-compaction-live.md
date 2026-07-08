# P81 #331 — Accepted `request_compaction` fixture: live-orchestration increment

Date: 2026-07-08
Branch: `codeagent/p81-331-accepted-compaction-live`
Base: PR #351 scaffold on `ronan/accepted-request-compaction-fixture`
Repository: `karmaterminal/karmaterminal-openclaw-docs`
Issue: `karmaterminal/karmaterminal-openclaw-docs#331`

## Scope

Move the scaffold-only `--run` (which unconditionally exited
`BLOCKED-live-orchestration-not-implemented`) toward a real live orchestration
without violating any of the workorder's non-negotiable safety constraints.
Full end-to-end orchestration (temp Gateway spawn, mock provider bootstrap,
context-budget forcing, `request_compaction` RPC, lifecycle wait, successor
sentinel, trace fetch) is genuinely too large for one Copilot turn without
human review, so this increment ships a **preflight-only** real path plus a
mockable state machine that the next reviewer can wire without a second
refactor.

## What changed

### New file
- `tools/k6-proofs/scripts/lib/accepted-compaction-orchestrator.mjs` —
  mockable orchestration library:
  - Path safety helpers (`assertNotProductionPath`, `normalizeSafePath`,
    `existingRealpathWithSuffix`, `productionPathCandidates`).
  - `resolveOpenClawDir(candidate, opts)` — validates that a user-supplied
    OpenClaw source checkout exists, has an `openclaw.mjs` entrypoint, and
    does **not** live inside any production marker (`~/.openclaw`,
    `~/flesh_beast_tmp/openclaw`). The workorder's hint dir at
    `/home/figs/flesh_beast_tmp/openclaw` is refused with
    `BLOCKED-openclaw-dir-inside-production` until reviewed source-only
    guards land — this is intentional; see "Remaining blockers" below.
  - `allocateFreePort({ host })` — asks the kernel for a loopback ephemeral
    port and releases it immediately. Preflight only; the live Gateway spawn
    will re-bind.
  - `buildRedactedConfig({...})` — writes the fixture's isolated temp config
    shape with `<REDACTED-fixture-token>` in place of any real token, so no
    secret is ever written to disk.
  - `makeUnimplementedLiveSteps()` — dependency-injected stubs for
    `startMockProvider`, `startTempGateway`, `callGatewayRpc`,
    `forceContextBudget`, `stageLifeboat`, `requestCompaction`,
    `waitForCompactionComplete`, `verifyLifeboatReturn`,
    `verifySuccessorSentinel`, `fetchTrace`. Each throws a well-known
    `LIVE_NOT_IMPLEMENTED` error that the state machine maps to the
    honest-limit outcome.
  - `runOrchestration({ args, paths, liveSteps, ... })` — phase state
    machine. Runs real preflight (openclaw dir + free port + redacted temp
    config write) then iterates through phase-mapped live steps. Any
    thrown `LIVE_NOT_IMPLEMENTED` short-circuits to
    `HONEST-LIMIT-live-orchestration-preflight-only`; any other error maps
    onto the classified outcome for that phase (e.g.
    `BLOCKED-temp-gateway-start`, `FAIL-request-compaction-rejected`).
    Emits `preflight-context.json`, `temp-config.redacted.json`,
    per-phase error receipts, `cleanup.json`, and `outcome.json`. Never
    claims `pass:true`.
  - Canonical `NON_PASS_OUTCOMES` map for downstream code and tests.

- `tools/k6-proofs/scripts/__tests__/accepted-compaction-orchestrator.test.mjs`
  — 14 new unit tests covering:
  - Path safety refusal for all production markers.
  - `resolveOpenClawDir` missing dir / missing entrypoint / production-path
    refusal / happy path.
  - `allocateFreePort` returns a valid TCP port.
  - `buildRedactedConfig` never emits `sk-...` / `api-key` in cleartext.
  - `makeUnimplementedLiveSteps` throws with `LIVE_NOT_IMPLEMENTED` and step
    name.
  - `runOrchestration`: BLOCKED-temp-gateway-start classification, HONEST-
    LIMIT stop when mock provider unimplemented, free-port failure
    classification, FAIL-request-compaction-rejected classification.

### Modified files

- `tools/k6-proofs/scripts/run-accepted-compaction-fixture.mjs`:
  - Now imports from the orchestrator lib and removes duplicated path
    helpers / config builder.
  - New `--enable-live-orchestration` flag and
    `OPENCLAW_ACCEPTED_COMPACTION_ENABLE_LIVE=true` env var — a **review
    gate**. Without it, `--run` classifies as
    `HONEST-LIMIT-live-orchestration-review-gate`, exits 3, `pass:false`,
    and does not run the orchestrator.
  - New `--openclaw-dir` flag and `OPENCLAW_ACCEPTED_COMPACTION_OPENCLAW_DIR`
    env var carrying the OpenClaw source checkout to spawn from.
  - When both gates are open, invokes `runOrchestration(...)` with
    unimplemented live steps; today this always completes preflight and
    stops at `HONEST-LIMIT-live-orchestration-preflight-only`.
  - Split artifact writers into plan-only, review-gate, and live paths.
    Plan-only path is byte-compatible with the pre-refactor scaffold for
    downstream consumers.
  - Test-only hook: `globalThis.__openclawAcceptedCompactionTestHooks
    .orchestratorFactory` allows dependency injection for future integration
    tests without shell-spawning the runner.

- `tools/k6-proofs/scripts/__tests__/accepted-compaction-fixture.test.mjs`:
  - Replaced obsolete "run mode with opt-in still fails closed until
    orchestration is implemented" test (which expected
    `BLOCKED-live-orchestration-not-implemented`) with a `HONEST-LIMIT-
    live-orchestration-review-gate` assertion.
  - Added three integration tests exercising `--enable-live-orchestration`
    with: missing openclaw-dir, production-path openclaw-dir, and a happy
    preflight path against a tmp openclaw source stub. Each verifies
    artifacts, phase, outcome, and secret redaction.

- `tools/k6-proofs/fixtures/accepted-request-compaction/README.md`:
  - Documents the review gate, the new classified outcomes, and how to
    invoke live preflight against a source-only openclaw checkout.

## Tests run

```
node --test \
  tools/k6-proofs/scripts/__tests__/accepted-compaction-fixture.test.mjs \
  tools/k6-proofs/scripts/__tests__/accepted-compaction-orchestrator.test.mjs
```

Result: **27 pass / 0 fail / 0 skipped** on Node v25.9.0.

Manual CLI smoke tests exercised:
1. `--plan --candidate-sha ...` — emits redacted plan artifacts, exit 0.
2. `--run` without `--enable-live-orchestration` — classifies as review
   gate, exit 3, no orchestrator invocation, no preflight artifact.
3. `--run --enable-live-orchestration --openclaw-dir <tmp-stub>` — writes
   `preflight-context.json` with a positive port candidate, redacted
   `temp-config.redacted.json`, `live-orchestration-not-yet-implemented.json`,
   `cleanup.json`, `outcome.json`; exit 3, `pass:false`.
4. `--run --enable-live-orchestration --openclaw-dir <production-path>` —
   refused with `BLOCKED-openclaw-dir-inside-production`, exit 3.

No production Gateway process was started, no production config touched,
no hosted tokens burned.

## Remaining blockers (require review before landing)

Ordered by which downstream phase they unblock:

1. **`BLOCKED-openclaw-dir-inside-production`** — `resolveOpenClawDir`
   currently refuses any candidate that lives inside a production marker,
   including the workorder's hint at `~/flesh_beast_tmp/openclaw`. To use
   that hint dir the reviewer must (a) confirm the directory is truly a
   source-only checkout, and (b) either add a reviewed source-only guard
   (e.g. verifying the caller does not pass any of the production sibling
   state dirs) or move the checkout out of the production marker path.
   Recommended follow-up: allow an explicit `--allow-source-inside-
   production` review flag paired with an assertion that the openclaw dir
   does NOT contain a runnable state dir at siblings like `state/`,
   `agents/`, or a live `openclaw.json`.

2. **`startMockProvider` unimplemented** — needs to spawn
   `/home/figs/flesh_beast_tmp/openclaw/scripts/e2e/mock-openai-server.mjs`
   (or a vendored copy) on a free loopback port with a deterministic
   fixture response. Must capture `pid` and `port` receipts and refuse to
   start any request that reaches out to hosted providers.

3. **`startTempGateway` unimplemented** — needs to spawn OpenClaw's Gateway
   in `--bind loopback --force` mode with the fixture's isolated
   `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, `OPENCLAW_AGENT_DIR`,
   `OPENCLAW_GATEWAY_TOKEN`, plus the `OPENCLAW_SKIP_*` envs used by
   `scripts/anthropic-prompt-probe.ts`. Must set up the SIGINT/SIGKILL
   fallback stop path from that same probe.

4. **`callGatewayRpc` unimplemented** — this increment does not add a
   dependency on OpenClaw's `src/gateway/call.js`; the review PR must
   either shell out to `openclaw gateway call` or vendor a minimal
   WebSocket JSON-RPC client. Whichever is chosen must never log tokens.

5. **`forceContextBudget` unimplemented** — needs to drive `agent.wait`
   turns that provably raise `usedContext / contextTokens` above 0.70
   using deterministic mock provider responses (no hosted tokens).

6. **`stageLifeboat`, `requestCompaction`, `waitForCompactionComplete`,
   `verifyLifeboatReturn`, `verifySuccessorSentinel`, `fetchTrace`** —
   pass-emitting phases. Each must emit its named receipt
   (`request-compaction-accepted.json`, `compaction-lifecycle.json`,
   `post-compaction-lifeboat.json`, `successor-sentinel.json`,
   `trace-<id>.json` or `trace-unavailable.json`). No PASS may be
   claimed unless the successor consumes a sentinel that was impossible
   before compaction.

7. Optional integration test using
   `globalThis.__openclawAcceptedCompactionTestHooks.orchestratorFactory`
   to drive a fully-mocked happy path and assert every artifact is
   emitted with the expected schema key.

## Safety posture

- No production `~/.openclaw/openclaw.json` edits (grep on the diff shows
  zero writes to any path under `~/.openclaw` or `~/flesh_beast_tmp`).
- No Gateway spawn attempted anywhere in this diff (`startTempGateway`
  throws before any subprocess is created).
- No hosted tokens referenced; the fixture config points at
  `http://127.0.0.1:<mock-provider-port>` and the fixture token is only
  ever `<REDACTED-fixture-token>` on disk.
- No live fleet threshold changes.
- Every test that sets `OPENCLAW_GATEWAY_TOKEN=secret-token-must-not-print`
  or `OPENAI_API_KEY=openai-secret-must-not-print` also asserts those
  strings never appear in emitted artifacts / stdout / stderr — 27/27
  pass.
- `--run` always exits 3 with `pass:false` in this increment; there is no
  code path in the runner that can output `pass:true`.

## Is it safe to PR / merge?

**Yes, safe to open as a stacked PR on `#351`.** This increment is scoped
to reviewable safety infrastructure — orchestration state machine, path
guards, review gate, preflight — and cannot cause any of the workorder's
forbidden effects because none of the destructive live steps are
implemented. All 27 tests pass, secrets are provably redacted, and the
runner is fail-closed by default at every additional decision point.

Reviewer focus areas:
1. `resolveOpenClawDir` production-path refusal — is the marker list
   complete for our environment?
2. Review-gate flag naming and the fact that `--run` alone (with
   `OPENCLAW_ACCEPTED_COMPACTION_FIXTURE=true`) no longer maps to
   `BLOCKED-live-orchestration-not-implemented`. Downstream consumers
   grepping for that string must be updated to the new outcome names.
3. Whether the `HONEST-LIMIT-live-orchestration-preflight-only` name is
   preferred; it deliberately avoids `PARTIAL`/`PASS` to satisfy the
   workorder's "no PASS from partial" rule.

## Follow-up scope for the next review PR

- Implement `startMockProvider` / `stopMockProvider` against
  `scripts/e2e/mock-openai-server.mjs`.
- Implement `startTempGateway` / `stopTempGateway` using the
  `scripts/anthropic-prompt-probe.ts` pattern, guarded by explicit source-
  only assertions.
- Implement `callGatewayRpc` (shell `openclaw gateway call`).
- Implement context-budget forcing loop and receipt.
- Implement `request_compaction` RPC + `compactionRequestId` capture.
- Implement lifecycle wait polling with timeout classification.
- Implement post-compaction lifeboat return verification.
- Implement successor sentinel verification.
- Implement trace fetch (or explicit `trace-unavailable.json`).
- Land integration test using the orchestrator factory hook.
