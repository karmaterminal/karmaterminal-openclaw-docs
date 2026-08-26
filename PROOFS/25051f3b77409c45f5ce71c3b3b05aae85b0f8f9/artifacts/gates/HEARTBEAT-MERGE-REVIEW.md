# PR #129388 heartbeat merge review

## Named-ref contract

| Category | Named ref | Full SHA | Local | Tracking | Server | Equality / use |
|---|---|---|---|---|---|---|
| Product/base | `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `HEAD` and local lane ref equal | N/A (SHA-addressed review) | Commit API equals | Exact review authority |
| Product/base (feature parent) | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a^1` | `6b6f4db79ba5143f2a56e759abe111478bf6c8a5` | Merge parent equals | N/A | `karmaterminal/openclaw` commit API equals | Exact feature-side stage |
| Product/base (upstream parent) | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a^2` | `4da57168d3c1970419e93e59a91e65466518231b` | Merge parent equals | N/A | `openclaw/openclaw` commit API equals | Exact upstream-side stage |
| Safe lane | N/A (read-only exception; review anchored to the SHA-addressed product ref) | N/A | Informational local branch `codeagent/129388-2ffc-heartbeat-merge-review` equals product SHA | Absent | Absent | No lane-ref gate invented; workorder forbids push |
| CI/workflow | N/A (focused-only review; descendant Mode-B dispatches are outside this lane) | N/A | N/A | N/A | N/A | No broad-CI evidence credited |
| Presentation | `openclaw/openclaw#129388`, `karmaterminal:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Object and local presentation ref equal | `origin/codeagent/85651-upstream-1ba243c8-gates` equals | Live PR head equals | Presentation only; not review authority |
| Docs/proof | N/A (final corpus transposition awaits an accepted descendant and composite live proof) | N/A | N/A | N/A | N/A | Not part of this review |

## Verdict

**APPROVE**

No blocking findings in the sole textual conflict resolution in
`src/infra/heartbeat-wake.ts` at
`2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a`.

Production LOC: +8/-26 (net -18) in the combined heartbeat-owner diff |
Tests: +0/-0.

## Stage comparison

- `git show --remerge-diff` reconstructs exactly two conflict hunks: the
  guard-deferral requeue and the request timestamp. The merged result takes
  upstream's centralized retry call at `src/infra/heartbeat-wake.ts:484-486`
  and monotonic request stamp at `src/infra/heartbeat-wake.ts:687-699`.
- Relative to feature parent
  `6b6f4db79ba5143f2a56e759abe111478bf6c8a5`, the owner diff consists only of
  upstream's seven intended timing/retry edits: five internal clock reads move
  to `performance.now()`, the guard requeue moves to
  `resolveHeartbeatRetrySchedule`/`retryPendingWake`, and the raw request stamp
  moves to `performance.now()`.
- Relative to upstream parent
  `4da57168d3c1970419e93e59a91e65466518231b`, the merged owner retains the
  continuation composition: trusted-routing marker and split target keys,
  `parentRunId`, `guardRetry`, and their queue/retry/dispatch propagation.
- Current upstream `main`
  `888c8422013e13023164c62d734f31ebb54ff572` has no
  `src/infra/heartbeat-wake.ts` delta from the reviewed upstream parent. It was
  context only, not authority for the historical merge.

## Required-check evidence

1. Upstream timing and centralized retry are present:
   `src/infra/heartbeat-wake.ts:347-396`,
   `src/infra/heartbeat-wake.ts:484-486`, and
   `src/infra/heartbeat-wake.ts:687-699`.
2. Continuation routing survives every retry boundary:
   `src/infra/heartbeat-wake.ts:270-330` records `parentRunId`,
   `trustedContinuationRouting`, and `guardRetry`;
   `src/infra/heartbeat-wake.ts:367-395` requeues all three; and
   `src/infra/heartbeat-wake.ts:424-443` forwards lineage and remints the
   non-enumerable trust marker. `src/infra/heartbeat-wake-coalescing.ts:88-106`
   keeps trusted and default unscoped targets distinct.
3. Task/event/immediate work remains guarded without replaying completed wakes:
   `src/infra/heartbeat-wake.ts:474-487` retains the real-work classes,
   `src/infra/heartbeat-wake.ts:374-396` retries only the current wake, and
   `src/infra/heartbeat-wake.ts:419-471` hands off only the current/unfinished
   suffix.
4. Clock domains meet only at an explicit conversion:
   `src/infra/heartbeat-cooldown.ts:29-46` defines `retryAtMs` as a wall-clock
   instant; `src/infra/heartbeat-wake.ts:347-364` subtracts `Date.now()` to
   obtain a delay; `src/infra/heartbeat-wake.ts:376` converts that delay to a
   monotonic deadline. Every internal queue/timer comparison uses
   `performance.now()` at `src/infra/heartbeat-wake.ts:132`,
   `src/infra/heartbeat-wake.ts:290`, `src/infra/heartbeat-wake.ts:504`,
   `src/infra/heartbeat-wake.ts:556`, and
   `src/infra/heartbeat-wake.ts:688`.
5. Lifecycle handoff, cancellation, and target unlock remain generation-owned:
   `src/infra/heartbeat-wake.ts:399-472`,
   `src/infra/heartbeat-wake.ts:489-498`, and
   `src/infra/heartbeat-wake.ts:639-671`; cancellation propagation is owned by
   `src/infra/heartbeat-wake-lifecycle.ts:29-67`.
6. No silent owner-surface revert: the first-parent zero-context diff contains
   only the seven upstream changes above; the remerge diff identifies only the
   two resolved hunks; no conflict markers remain. The complete feature-side
   routing/lineage/guard composition remains present in the merged owner.

## Focused proof

Passed on exact product SHA, serially:

```text
node scripts/run-vitest.mjs run --config test/vitest/vitest.infra.config.ts --maxWorkers=1 \
  src/infra/heartbeat-wake.test.ts \
  src/infra/heartbeat-wake-concurrency.test.ts \
  src/infra/heartbeat-wake.lifecycle.test.ts \
  src/infra/heartbeat-wake.preemption.test.ts
```

Result: 4 files, 66 tests passed.

```text
node scripts/run-vitest.mjs run --config test/vitest/vitest.unit-fast.config.ts --maxWorkers=1 \
  src/infra/heartbeat-wake.transcript-context.test.ts
```

Result: 1 file, 1 test passed.

The transcript-context test is owned by `unit-fast`; an initial attempt through
the infra config returned "No test files found" because that config deliberately
excludes unit-fast-owned tests. No test assertion failed.

CI path: **focused-only**. Per workorder, no broad CI, Mode-B dispatch, install,
source edit, commit, push, or GitHub mutation was performed.

## Review metadata

By: Gwydion Nanashi Ferrinas Solidor (@karmafeast, acct 2011-06-30) |
OpenClaw: 13 PRs, 5 issues, 1 commit/12mo |
GitHub: 19,936 commits, 9,977 PRs, 488 issues, 53 reviews/12mo.

Assignment: unassigned.

Best-fix verdict: **best**. Keeping the feature-side inline requeue would retain
epoch deadlines inside the newly monotonic queue and duplicate retry policy.
Taking the centralized upstream call while preserving continuation fields in
the shared helper gives one owner and one clock conversion.

Remaining uncertainty: none within the bounded heartbeat conflict. This review
does not assess the rest of the 947-file presentation PR or provide the
descendant/composite live proof reserved for later lanes.
