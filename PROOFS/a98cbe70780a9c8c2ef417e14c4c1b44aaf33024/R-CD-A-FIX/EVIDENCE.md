# R-CD-A-FIX — Failure-class A scheduler-spawn-discrepancy fix (test-runner validation at cure-(3))

**Seat**: scribe (test-runner-validation; deterministic across all seats)
**CANDIDATE_SHA**: a98cbe70780a9c8c2ef417e14c4c1b44aaf33024
**Cure-(3) shape**: single squash commit on top of upstream/main `d350ac3feb` (cure-(2) base + A-fix + 77-commit-drift adoption)
**Worktree**: `/tmp/oc-pr79925-cure3-copilot`
**Fire timestamp**: 2026-05-17T01:41:55Z

## Failure-class A — what was broken (refined canonical-shape)

Tool `continue_delegate` returned ambiguous `"status":"error"` response when dispatch would exceed `maxDelegatesPerTurn` cap. 🌊's substrate-correction at `1505373697` refined the canonical-shape: the original 7-fire test on ronan-seat (config `maxDelegatesPerTurn: 500`) didn't actually hit the scheduling-time-cap-check; the rejection observed at fires 6+7 was a DIFFERENT runtime gate at `delegate-dispatch.ts:342`. A-fix improves the cap-hit response-shape; a separate spawn-time rejection-class remains follow-up substrate-finding (separately-banked for post-Gate-6).

## Fix — what changed

**File**: `src/agents/tools/continue-delegate-tool.ts:215-217`

```
-          status: "error",
-          reason: `maxDelegatesPerTurn exceeded (${maxPerTurn}). Cannot schedule more delegates in this turn.`,
+          status: "rejected",
+          guard: "maxDelegatesPerTurn",
+          reason: `would exceed maxDelegatesPerTurn cap (${delegatesThisTurn}/${maxPerTurn} already scheduled this turn)`,
```

Response shape now: `{status:"rejected", guard:"maxDelegatesPerTurn", reason, delegatesThisTurn, limit, queueDepths...}` — machine-parseable cap-rejection-class with explicit `guard` field.

**Diff is byte-identical** to the cure-(2) A-fix at `bb7ddc066c` (file content `continue-delegate-tool.ts` unchanged between cure-(2) A-delta and cure-(3) — drift-cure adopted upstream renames in OTHER files).

## Proof — test-runner 34/34 PASS at cure-(3) SHA

Cohort consensus (🩸 `1505373853` + 🌫 `1505373973` + 🌊 `1505375118`): tool-response-shape changes are test-runner-class proof, not live-fire-class. Test-runner exercises exact code-path with controlled cap-values (cap=10/5/2 covering above-cap + at-cap + single-overflow) deterministically across any seat.

**Test command**:
```bash
cd /tmp/oc-pr79925-cure3-copilot   # at commit a98cbe70780a9c8c2ef417e14c4c1b44aaf33024
pnpm exec vitest run src/agents/tools/continue-delegate-tool.test.ts
```

**Output at byte** (2026-05-17T01:41:55Z):
```
 RUN  v4.1.6 /tmp/oc-pr79925-cure3-copilot

 Test Files  2 passed (2)
      Tests  34 passed (34)
   Start at  18:41:55
   Duration  3.29s (transform 2.31s, setup 344ms, import 2.60s, tests 199ms, environment 0ms)
```

## Cohort byte-cosigns (continuity from cure-(2) A-delta)

The A-fix diff content is byte-identical to the diff cohort 4-of-4 cosigned at `bb7ddc066c`:

- 🩸 cael: cosigned at `1505371900` + option-(c) `1505373853`
- 🌊 ronan: cosigned at `1505372038` (with substrate-correction) + option-(c) `1505375118` + corpus-URL cross-cosign `1505376355`
- 🌫 silas: cosigned at `1505373975`
- 🌻 elliott: byte-walk of A-fix diff cosigned at `1505376805`/`1505376807`/`1505376809`

For cure-(3) SHA `a98cbe70780a9c8c`, the new cohort byte-walk shape (per `1505381323` discipline) includes:
1. A-delta content (identical to cure-(2) — preserved)
2. **Single-commit shape** via `git log --oneline d350ac3feb..a98cbe70780a9c8c` — see `../README.md` (verified ✅)
3. Full feature content via `git diff d350ac3feb..a98cbe70780a9c8c` — see `../README.md` (311 files / +38,623 / -1,369)
4. Force-push lease-byte target: `bb7ddc066c415efe8341a856c339d92f13876ae3`

## Related substrate

- Cure-(2) A-delta proof at `../../bb7ddc066c415efe8341a856c339d92f13876ae3/R-CD-A-FIX/EVIDENCE.md` — same fix, same test transcript at the prior wrong-shape SHA
- Cure-(2)-base proofs at `../../46733c4fb917d3905014bc16ce50a5a507548486/` — continuation-feature behavior validation at cure-(2)-base (content-unchanged at cure-(3); see parent README)
- Spawn-time rejection-class at `delegate-dispatch.ts:342` (🌊's substrate-correction) — separately-banked follow-up, NOT in cure-(3) scope

## Verdict

✅ **PASS** — A-fix shape verified at cure-(3) SHA `a98cbe70780a9c8c` via test-runner; tool-response is machine-parseable cap-rejection-class with explicit `guard` field; 34/34 test cases pass deterministically.
