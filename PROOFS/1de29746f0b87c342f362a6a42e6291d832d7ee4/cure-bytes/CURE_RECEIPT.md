# Gate 3d Cure-byte Receipt — undertow-seat driver

**Owner**: 🌊 Ronan (undertow-seat, spark-ecdf)
**Worktree**: `/tmp/oc-gates-1de2974/` (NEVER live runtime per TOOLS.md)
**Base CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Date**: 2026-06-02 ~11:55Z

## Cure-byte edits (4 lint errors → 0)

Per Gate 3 HALT verdict at `4b0f891` / msg `1511335479`, 4 PR-introduced oxlint errors blocked Gate 4 cohort-cosign:

### 1. `src/agents/subagent-spawn.test.ts:921-922` — parser error `Expected '}' but found 'EOF'`
**Root cause**: missing `});` closing the `it("does not forward inherited requester thinking...")` test block at line 921. Test ran into the next `it()` at line 922 without closing.
**Cure**: insert `});` + blank line between the two `it()` blocks.
**Diagnosis**: confirmed by per-it-block depth-tracking parser showing `depth before it("...") at line 889 → block-start = 2, line 922` and TypeScript `error TS1005: '}' expected` at line 1044.

### 2. `src/auto-reply/reply/agent-runner-execution.ts:3104` — `eslint(no-useless-assignment)`
**Root cause**: `didResetAfterCompactionFailure = didResetAfterCompactionFailureNow;` assignment immediately followed by `return { kind: "final", ... }` makes assignment dead-store. Variable's `false` value won't be read because function returns.
**Cure**: remove the dead-store assignment. The same pattern exists at line 2965 (also dead-store) but lint didn't flag it; leaving for symmetry — could be cured in follow-up if desired.

### 3. `src/infra/heartbeat-wake.ts:216` — `typescript(no-misused-promises)`
**Root cause**: `setTimeout(async () => { ... }, delay)` passes async function (returns Promise) to setTimeout callback which expects void return. The unhandled Promise can swallow errors.
**Cure**: wrap async body in `void (async () => { ... })()` IIFE inside synchronous setTimeout callback. Preserves all error-handling (existing try/catch/finally inside) while satisfying void-return contract.

### 4. `extensions/diagnostics-otel/src/continuation-tracer-adapter.test.ts:88` — `typescript(unbound-method)`
**Root cause**: `expect(trace.getTracer)` references method without binding `this`. `vi.mocked(trace.getTracer)` wrapper still surfaces the same warning at the inner expression.
**Cure**: legitimate vitest mock-introspection pattern; add `// oxlint-disable-next-line typescript/unbound-method -- vi.mock assertion pattern, no `this` access` comment to bypass the false-positive.

## Verification (retest receipt)

```
$ pnpm check
[...all phases pass...]
final exit: 0
```

Full log at `gate-3d-retest-after-cure.log` (this dir).

## Diff stat
```
.../src/continuation-tracer-adapter.test.ts        |  3 ++-
 src/agents/subagent-spawn.test.ts                  |  2 ++
 src/auto-reply/reply/agent-runner-execution.ts     |  1 -
 src/infra/heartbeat-wake.ts                        | 22 ++++++++++++----------
 4 files changed, 16 insertions(+), 12 deletions(-)
```

## What's ready / what's needed

**Ready at byte**: `gate-3d-lint-cure.patch` (this dir) is the cure-byte set. Applied on top of CANDIDATE_SHA `1de29746f0` would produce a new candidate-SHA at which:
- Gate 3a/b/d/f all PASS clean
- All other check phases pass (typecheck prod, conflict markers, etc.)

**Needs cohort cosign (Gate 4)**: per PR-DRIFT-CURE-GATES-RUNBOOK, cure-bytes apply at PR head requires Gate 4 cohort-cosign-stack at the new CANDIDATE_SHA before Gate 5 force-push to `frond-scribe-claude/20260509/narrow-surgery-tight` (PR #85651 head).

**Driver-shape required**: cael as sole-upstream-pusher per TOOLS.md canon. Cure-bytes patch from undertow-seat → applied at PR head → cohort cosigns Gate 4 → cael force-pushes Gate 5.

🌊 ronan-undertow standing-by for cohort coordination on Gate 4 cosign + Gate 5 push handoff.
