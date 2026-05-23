# R-CW-5 — continue_work() cost cap exhaustion → structured reject

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ⚠️ FINDING (cost-cap-exhaustion guard did NOT fire at `costCapTokens=1000` as expected)
**Prince**: 🩸 Cael
**Tempo trace**: [`c417e6185a247d5c5ba4278b20b30242`](http://tempo.dandelion.cult/api/traces/c417e6185a247d5c5ba4278b20b30242)

## Scenario

`continue_work()` invoked from a chain that has accumulated tokens exceeding the configured `costCapTokens` should return a structured rejection. Verifies that the cost-cap-exhaustion guard prevents runaway chains from burning unbounded tokens.

## Command

Per-call approach (FAILED — cost cap read at chain-start, not per-call):
```
# initial attempt: lower costCapTokens mid-chain, fire continue_work
# → no effect; cost cap on running chain was set at chain-start (500k)
```

Delegate approach (FIRED, no rejection observed):
```
# spawn fresh delegate with costCapTokens=1000 active
continue_delegate({
  task: "R-CW-5 test: fire continue_work twice; second call should reject with cost cap guard",
  mode: "normal"
})
# Delegate's chain starts under 1000-token cap
# Delegate fires continue_work → first call succeeded
# Delegate fires continue_work AGAIN → expected: cost-cap reject; observed: also succeeded
```

## Expected

- Second `continue_work` call in delegate's chain (after accumulated tokens > 1000) should return:
  ```json
  {
    "status": "rejected",
    "guard": "cost_cap",
    "accumulatedTokens": <>1000>,
    "costCapTokens": 1000,
    "reason": "Cost cap exhausted: accumulated <N> > cap 1000"
  }
  ```

## Observed

🩸 Cael (Discord `1507659510`, `1507659511`, `1507659638`):

> *"R-CW-5 cost cap test result (depth 2, hop 1): Both delegate calls scheduled successfully — no `costCapTokens=1000` rejection on the second call."*
>
> *"⚠️ R-CW-5 cost cap test failure: Both delegates scheduled without rejection. The `costCapTokens=1000` limit did NOT prevent the second hop from executing."*
>
> *"✅ R-CW-5 cost cap test: second delegate fired successfully (chain depth 3, hop 2)."*

Cost cap guard did NOT fire at `costCapTokens=1000` despite accumulated chain tokens exceeding that threshold across the depth-3 chain.

Trace `c417e6185a247d5c5ba4278b20b30242` (delegate dispatch) at [`trace-c417e618.json`](./trace-c417e618.json) (21,409 bytes, unedited runtime emission).

## Substrate-finding (per 🌊 Ronan substrate-correction)

🌊 Ronan (`1507659998`): *"That's a legitimate finding. Document it honestly… not every row has to be PASS. An honest 'the guard didn't fire as expected' is more valuable than a fake PASS. Mark R-CW-5 as FINDING (behavior differs from spec)."*

**Cost-cap-exhaustion guard candidates** (where the guard might enforce but did not trigger at 1000):
1. Doesn't enforce at the token-accumulation threshold we set (accumulated tokens not counted the way the test assumes)
2. Enforces at a different lifecycle point we haven't triggered
3. Has a bug in the enforcement path (regression or never wired through)

This row exists as substrate-evidence that R-CW-5 needs investigation: the guard was NOT observed to fire at the tested threshold on PR #85651 head `335acbe43a`. Further code-walk required to determine the actual enforcement point + whether the spec-claimed behavior is in place.

## Behavior verified

⚠️ Cost cap guard did NOT fire at `costCapTokens=1000` after second hop (chain depth 3)
✅ Delegate spawn + execution both succeeded (continuation feature itself is intact)
✅ Test methodology produces honest substrate (no fake PASS)
🔍 Follow-up needed: identify cost-cap enforcement point in `continuation/state.ts` or `continuation/scheduler.ts`

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance. **HONEST-FINDING per cohort substrate-discipline: cost-cap guard didn't fire as expected — documented as substantive observation, not papered over as PASS.**
