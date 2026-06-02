# Gate 3 Verdict — CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`

**Owner**: 🌊 Ronan (undertow-seat, spark-ecdf)
**Worktree**: `/tmp/oc-gates-1de2974/` (`git worktree add` at CANDIDATE_SHA, never live runtime)
**Gateway**: `OpenClaw 2026.5.31 (1de2974)` post-deploy `26816100078`
**Per-runbook**: `RUNBOOKS/PROOF-CORPUS-METHOD.md` §"Live-host runtime proofs require fleet-deploy" + `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` §"Gate 3 — FULL local gates"

## Gate-by-gate summary

| Gate | Command | Exit | Verdict | Time |
|------|---------|------|---------|------|
| 3a | `pnpm install --frozen-lockfile` | 0 | ✅ PASS | 1.5s (cache hit) |
| 3b | `pnpm tsgo` | 0 | ✅ PASS | 5s (incremental cache hit) |
| 3d | `pnpm check` | **1** | 🔴 **FAIL** | 75.5s (lint phase failure only) |
| 3f | `pnpm build` | 0 | ✅ PASS | 144.9s (tsdown 102.1s slowest) |

**Skipped at submission-time**: 3c `pnpm tsgo-test` + 3e `pnpm vitest` — these are the longest-runtime gates (vitest ~10-20min on arm64) and the urgent PR-update ask wanted tsgo + check + build first. Can fire on cohort-request.

## Gate 3d failure classification

**4 oxlint errors at CANDIDATE_SHA**:

1. `src/auto-reply/reply/agent-runner-execution.ts:3104:9` — `eslint(no-useless-assignment)`: `didResetAfterCompactionFailure = didResetAfterCompactionFailureNow;` — assigned value not used in subsequent statements
2. `src/agents/subagent-spawn.test.ts:66:49` — parser error `Expected '}' but found 'EOF'` — incomplete file (truncated describe block)
3. (third core error) `typescript(no-misused-promises)`: Promise returned in function argument where a void return was expected
4. `extensions/diagnostics-otel/src/continuation-tracer-adapter.test.ts:88:12` — `typescript(unbound-method)`: `trace.getTracer` referenced unbound

## Upstream-class comparison

**Per Gate 3 discipline**: "do not classify as 'upstream-class' without an exit-code receipt from running the gate on naive upstream/main HEAD" (runbook §Gate 3).

Fired `pnpm check` on `openclaw/openclaw:main` HEAD (`e7aac172d5a18142d53d051f6adface6b03e52ee` at 2026-06-02 04:43 PDT) in fresh worktree `/tmp/oc-upstream-main/`. Receipt at `upstream-main-broken-class-receipt.log`.

**Result**: 0 oxlint warnings + 0 errors. Exit code 0. CLEAN.

**Verdict**: the 4 Gate 3d errors are **PR-INTRODUCED**, NOT upstream-class. They do not exist on `upstream/main` HEAD; they exist at PR #85651's CANDIDATE_SHA `1de29746f0`.

## Cure-direction (cure-bytes needed at PR head before Gate 4 cosign)

Per runbook §Gate 3: "any non-upstream-class failure → HALT; do NOT proceed past Gate 3; report; cohort decides whether to refire rebase or fix-in-place."

This is the **HALT** state. Cure-bytes for each of the 4 errors needed before Gate 4 cohort-cosign-stack. Locations are byte-pinned above. Errors are stylistic-class (no-useless-assignment, no-misused-promises, unbound-method) + 1 incomplete-file (subagent-spawn.test.ts parser error) — none affect runtime semantics directly, but Gate 3 discipline doesn't permit pass-with-asterisk.

## Tool-registration cure-bytes verified at byte (separate from lint failures)

Per figs's `1511248773` ask "PR branch updated with all tool registration available", byte-walk at CANDIDATE_SHA confirms the #868 tool-registration cure-bytes are present:
- `src/agents/embedded-agent-runner/run.ts:1560-1561` forwards `continueWorkOpts: params.continueWorkOpts, requestCompactionOpts: params.requestCompactionOpts`
- `src/agents/embedded-agent-runner/run/attempt.ts:1267-1268` same forwarding
- Comment block at `run.ts:1549-1559` explicitly cites #868 + the cure-mechanism

**Tool-registration cure stands at byte**; the lint failures are independent from the tool-registration cure-bytes.

## Status

🔴 **Gate 3 HALT** at lint-failure-class (PR-introduced, not upstream-class). Cure-bytes for 4 oxlint errors required before Gate 4 cosign-stack.
