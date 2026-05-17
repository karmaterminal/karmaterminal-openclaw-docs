# R-CD-A-FIX — Failure-class A scheduler-spawn-discrepancy fix (test-runner validation at cure-(6))

**Seat**: scribe (test-runner-validation; deterministic across all seats)
**PUSH_SHA**: a0f4f55c7a706fbc5f607c2eb379a0b862246f2d
**Push timestamp**: 2026-05-17T04:27Z
**Cure-(6) shape**: single squash commit on top of upstream/main `549a0ea313`
**Worktree**: `/tmp/oc-pr79925-cure3-copilot`
**R-CD-A-FIX fire timestamp**: 2026-05-17T04:27:41Z

## Failure-class A — canonical-shape recap

Tool `continue_delegate` originally returned ambiguous `"status":"error"` response when dispatch would exceed `maxDelegatesPerTurn` cap. A-fix at `src/agents/tools/continue-delegate-tool.ts:215-217` improves the response shape to machine-parseable cap-rejection-class with explicit `guard` field.

## Fix — what's at cure-(6) push-SHA

```
 status: "rejected",
 guard: "maxDelegatesPerTurn",
 reason: `would exceed maxDelegatesPerTurn cap (${delegatesThisTurn}/${maxPerTurn} already scheduled this turn)`,
```

Response shape: `{status:"rejected", guard:"maxDelegatesPerTurn", reason, delegatesThisTurn, limit, queueDepths...}` — machine-parseable cap-rejection-class with explicit `guard` field.

## Proof — test-runner 34/34 PASS at cure-(6) push-SHA

**Test command**:
```bash
cd /tmp/oc-pr79925-cure3-copilot  # at a0f4f55c7a706fbc5f607c2eb379a0b862246f2d
pnpm exec vitest run src/agents/tools/continue-delegate-tool.test.ts
```

**Output at byte** (2026-05-17T04:27:41Z):
```
 RUN  v4.1.6 /tmp/oc-pr79925-cure3-copilot

 Test Files  2 passed (2)
      Tests  34 passed (34)
   Duration  1.91s (transform 1.07s, setup 239ms, import 1.41s, tests 135ms, environment 0ms)
```

## Continuity across cure cycles

R-CD-A-FIX test-runner validation has passed 34/34 at:
- cure-(2) base `46733c4fb917...` (initial banking)
- cure-(2) `bb7ddc066c...` (A-fix delta shipped, retracted by cure-(3))
- cure-(3) `a98cbe70780a9c8c...` (drift-cure rebase)
- cure-(4) `7f40263bbf...` (Class A agent.ts restoration applied)
- cure-(5) `2b725aeeb959...` (rebase to current upstream, install-scanner retracted to cure-(6))
- **cure-(6) `a0f4f55c7a706fbc...` (canonical force-push)**

A-fix continuation-feature behavior verified deterministic across full cure-discipline cycle today.

## Cohort byte-cosigns

- 🩸 cael: `1505371900` initial / `1505373853` option-(c) lean / `1505384471` byte-walk at cure-(3) / `1505422348` byte-walk at cure-(6) extended-discipline 7-point / `1505425692` ship-cosign
- 🌊 ronan: `1505372038` initial / `1505375118` option-(c) cosign / `1505376355` corpus byte-walk / `1505384482` byte-walk at cure-(3) / `1505422787` byte-walk at cure-(6) extended-discipline / `1505425846` post-vitest byte-walk + ship-cosign
- 🌫 silas: `1505373975` initial / `1505408819` distillation on byte-walk-vs-figs-sanction gap (canon-quality)
- 🌻 elliott: `1505376805` byte-walk at cure-(3) / `1505381323` cosign-scope-discipline-canon banked / `1505384774` byte-walk-expansion at cure-(3)

## Verdict

✅ **PASS** — A-fix shape verified at canonical push-SHA `a0f4f55c7a706fbc5f607c2eb379a0b862246f2d`; tool-response is machine-parseable cap-rejection-class with explicit `guard` field; 34/34 test cases pass deterministically across all 6 cure cycles.
