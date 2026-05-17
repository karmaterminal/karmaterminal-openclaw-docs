# R-CD-A-FIX — Failure-class A scheduler-spawn-discrepancy fix (test-runner validation)

**Seat**: scribe (test-runner-validation; deterministic across all seats)
**CANDIDATE_SHA**: bb7ddc066c415efe8341a856c339d92f13876ae3
**Cure-(2) extension**: A-fix-only delta on top of cure-(2) base `46733c4fb917d3905014bc16ce50a5a507548486`
**Worktree**: `/tmp/oc-pr79925-drive-2026-05-16`
**Fire timestamp**: 2026-05-17T00:53:36Z

## Failure-class A — what was broken

Tool `continue_delegate` returned ambiguous `"status":"error"` response when dispatch would exceed `maxDelegatesPerTurn` cap. Original framing (🌊 `1505361495`): tool-response wasn't machine-parseable as a cap-rejection-class — looked like generic error.

🌊's substrate-correction at `1505373697` refined the canonical-shape: the original 7-fire test on ronan-seat (config `maxDelegatesPerTurn: 500`) didn't actually hit the scheduling-time-cap-check; the rejection observed at fires 6+7 was a DIFFERENT runtime gate at `delegate-dispatch.ts:342`. A-fix still good — improves the cap-hit response-shape — but a separate spawn-time rejection-class remains as follow-up substrate-finding.

## Fix — what changed

**File**: `src/agents/tools/continue-delegate-tool.ts:215-217`

```
-          status: "error",
-          reason: `maxDelegatesPerTurn exceeded (${maxPerTurn}). Cannot schedule more delegates in this turn.`,
+          status: "rejected",
+          guard: "maxDelegatesPerTurn",
+          reason: `would exceed maxDelegatesPerTurn cap (${delegatesThisTurn}/${maxPerTurn} already scheduled this turn)`,
```

Response shape now: `{status:"rejected", guard:"maxDelegatesPerTurn", reason, delegatesThisTurn, limit, queueDepths...}` — machine-parseable cap-rejection-class with explicit guard-name field.

## Proof — test-runner 34/34 PASS

Cohort consensus (🩸 `1505373853` + 🌫 `1505373973` + 🌊 `1505375118`): tool-response-shape changes are test-runner-class proof, not live-fire-class. Test-runner exercises exact code-path with controlled cap-values (cap=10/5/2 covering above-cap + at-cap + single-overflow) deterministically across any seat.

**Test command**:
```bash
cd /tmp/oc-pr79925-drive-2026-05-16
pnpm exec vitest run src/agents/tools/continue-delegate-tool.test.ts
```

**Output at byte** (2026-05-17T00:53:36Z):
```
 RUN  v4.1.6 /tmp/oc-pr79925-drive-2026-05-16

 Test Files  2 passed (2)
      Tests  34 passed (34)
   Start at  17:53:36
   Duration  1.70s (transform 919ms, setup 209ms, import 1.25s, tests 105ms, environment 0ms)
```

## Cohort byte-cosigns

- 🩸 cael: cosigned at `1505371900` + lean-call for option (c) at `1505373853` (test-runner sufficient)
- 🌊 ronan: cosigned at `1505372038` (with substrate-correction on canonical-shape) + option (c) cosign at `1505375118`
- 🌫 silas: cosigned at `1505373975` (R-CD-A-FIX evidence-shape proposed) + silas-seat aspected-cosign standing-by when 🌿 surfaces
- 🌻 elliott: cosign on A-fix-only-scope at `1505371126` (A-fix is clear-cut; D-fix wrong-shape)

## Related substrate

- Cure-(2) base proofs (R-CW/R-CD/Chain/TEST/R-RC/R-OBS) at `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/` — continuation-feature surface unchanged by A-fix delta
- 🌊's substrate-correction note: original Failure-class A canonical-shape conflated scheduling-time-cap-check vs spawn-time-other-rejection because ronan-seat config had non-default `maxDelegatesPerTurn: 500`. Separately-banked: the spawn-time rejection-class at `delegate-dispatch.ts:342` is still un-fixed and remains follow-up substrate-finding post-Gate-6.

## Verdict

✅ PASS — A-fix shape verified at byte via test-runner; tool-response now machine-parseable cap-rejection-class with explicit `guard` field.
