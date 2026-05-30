# §9 Manifest Questions — Cael-Seat Byte-Walk Positions
## Authored 2026-05-29 ~19:30 PDT from continuation-feature-substrate-position

> Frond authored 5 §9 figs-judgment questions in `/tmp/alt-path-manifest.md`.
> I'm the prince who built the continuation feature. These are my byte-walk positions
> from continuation-substrate, not echoing silas or frond. Bring own.

---

## Q1: Test scope — keep all 35+ test additions OR slim to minimum-viable?

**Cael position: KEEP ALL.**

**Byte-walk substrate:**
- 54 test files (`.test.ts`) in the continuation-feature surface (new files).
- The test corpus is the proof-substrate for PR #79925 cure-cycles N+0..N+8. Every test was added because a cure-cycle proved that path needed coverage.
- Examples of load-bearing tests that CANNOT be cut:
  - `delegate-dispatch.chain-depth-exhaustion.test.ts` — proves chain bound enforcement
  - `delegate-dispatch.cost-cap-exhaustion.test.ts` — proves cost cap enforcement
  - `delegate-mid-run-compaction-survival.test.ts` — proves post-compaction-delegate survives the seam
  - `post-compaction-delegate-dispatch.test.ts` — proves the lifeboat fires correctly
  - `cross-session-targeting.nonexistent-target.test.ts` — proves graceful failure on bad targets
  - `volatile-map-allowlist.test.ts` — proves chain-tracking memory doesn't leak
  - `agent-runner.continuation-delegate-fire-span.test.ts` — proves OTel span emission

**The slim-to-minimum framing is the trap.** Cure-cycles N+0..N+8 each added tests AFTER finding a regression. Cutting tests = re-opening surface that cohort already proved closed.

**Cure-shape**: ship all tests. If upstream test additions overlap, take-both (different test names, no actual collision possible).

---

## Q2: intersession.return config gate — keep OR drop?

**Cael position: NOT FOUND in current PR-head substrate. Question is stale.**

**Byte-walk substrate:**
- `rg "intersession" src/ extensions/` → **zero hits** in entire codebase.
- The `intersession.return` config gate does NOT exist in PR-head `fc337f05d64`.
- What DOES exist is `crossSessionTargeting` (in `src/auto-reply/continuation/types.ts`, config-gated as `"enabled"` | `"disabled"`).
- crossSessionTargeting is load-bearing (11-case test matrix, fleet uses it, manifest §6.3 lists it as load-bearing).

**Conclusion**: question is based on stale framing. The actual config gate is `crossSessionTargeting`, not `intersession.return`. The real question is whether to keep `crossSessionTargeting` — answer: **YES, load-bearing for cohort cross-prince delegate returns**.

---

## Q3: ACP wrapper preservation — keep `runWithDiagnosticTraceparent` OR allow removal?

**Cael position: KEEP. Load-bearing for trace context propagation.**

**Byte-walk substrate:**
- `runWithDiagnosticTraceparent` lives in `src/infra/diagnostic-trace-context.ts:1` and is used in 4 callsites:
  - `src/agents/agent-command.ts` (2 refs)
  - `src/agents/command/attempt-execution.ts` (3 refs)
  - `src/auto-reply/reply/agent-runner.ts` (2 refs) — **THIS IS THE CONTINUATION HOT-PATH**
  - `src/infra/diagnostic-trace-context.test.ts` (2 refs)
- In `agent-runner.ts` it wraps `runAgentTurnWithFallback` with `followupRun.run.traceparent` — this is the OTel trace-context-propagation for continuation-spawned runs.
- Without this wrapper, OTel spans for continuation chains lose parent-child linkage → tempo shows orphaned spans → cohort can't trace continuation chains end-to-end.
- Cure-cycle #658 added OTel auto-pickup specifically for this. Removal would re-open the gap.

**The "deprecated" framing from the 2026-05-26 cure-cycle was wrong**. The function is non-trivially load-bearing for production observability. workorder-preserve-overlay-canon is correct here: PRESERVE.

---

## Q4: Defensive-guard merge bias — when upstream adds guard AND we add guard, which is canonical?

**Cael position: MERGE BOTH GUARD SETS. Never drop a guard.**

**Byte-walk substrate:**
- `src/auto-reply/command-auth.ts` has 12 `senderIsOwner|isOwner` references in our PR-head.
- Upstream diff against branching-point: **0 lines** in `src/auto-reply/command-auth.ts` (upstream hasn't touched this file).
- So Q4 doesn't apply to `command-auth.ts` specifically — that's a non-conflict.
- The general principle: when both parties add defensive guards in the same file, the failure mode of "merge picks one" is asymmetric:
  - Drop OUR guard → re-open vulnerability cohort already closed (regression)
  - Drop UPSTREAM guard → re-open vulnerability upstream community closed (regression + we look bad to upstream)
- **Both regressions are unacceptable.** Always take-both-guards. Two guards never hurt; one missing guard hurts.

**Cure-shape**: when defensive-guard conflict surfaces, write a merged hunk that includes BOTH guards. If they're truly redundant (same logic), the second guard is no-op cost. If they catch different cases, both catches are needed.

---

## Q5: Schema-iteration tie-breaking — when upstream evolves schema X AND we modify schema X, which structure wins?

**Cael position: UNION of fields. Tie-break shape via type-discriminator if needed.**

**Byte-walk substrate:**
- `compact.types.ts` is the canonical example we already classified:
  - Mine adds `"volitional"` to trigger enum + `traceparent: string`
  - Upstream adds `agentId: string` + `execOverrides` + import-path-shift
  - Resolution: **take-both, union the enum** (`"budget" | "overflow" | "manual" | "volitional"`), add both fields.
- Same shape applies for any schema-conflict where both parties added fields/enum-values:
  - Field additions: union (additive)
  - Enum value additions: union (additive)
  - Field-type changes (incompatible): figs-judgment-class, but rare in practice
- For our continuation-feature surface, schema-conflicts are all additive-additive. None are mutually-exclusive.

**Cure-shape**: take-both default; escalate to figs only when both sides changed the same field-type (rare, and I haven't found any in continuation surface).

---

## Summary

| Q# | Topic | Cael position | Confidence |
|----|-------|--------------|------------|
| Q1 | Test scope | KEEP ALL 54 test files | HIGH — every test came from a cure-cycle |
| Q2 | intersession.return | **STALE QUESTION** — config gate doesn't exist; real gate is `crossSessionTargeting`, keep | HIGH — byte-grep confirms |
| Q3 | ACP wrapper `runWithDiagnosticTraceparent` | KEEP — load-bearing for trace propagation in continuation hot-path | HIGH — byte-walk shows 4 callsites, hot-path usage |
| Q4 | Defensive-guard merge bias | TAKE-BOTH always; both guards no-op or both load-bearing | HIGH — asymmetric regression cost |
| Q5 | Schema-iteration tie-breaking | UNION fields/enums; figs-judgment only for incompatible type changes | HIGH — continuation surface is all additive-additive |

**Net result for figs**: of the 5 §9 questions, **0 actually require figs-judgment for the continuation-feature slice**. Q1/Q3/Q4/Q5 have clear cure-shapes; Q2 is stale framing.

The ONE figs-question still standing from my continuation walk (separate from §9):
- **gpt-5.5 hardcoded fallback in `src/agents/embedded-agent-runner/model.ts`** — keep (fleet ops) or drop (upstream model registry caught up)?

That's it. One figs-decision for the entire continuation-feature merge.

---

*Cael 🩸 — byte-walked from continuation-substrate-position, not echoing.*
*Substrate-of-record: PR-head `fc337f05d64`, branching-point `b474f429ee`, upstream HEAD `75de853c37`.*
