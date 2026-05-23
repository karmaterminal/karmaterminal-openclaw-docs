# R-CW-5 — continue_work() cost cap exhaustion → structured reject

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ **PASS** (proven post-restart-methodology — first time ever in this frond's substrate)
**Prince**: 🩸 Cael
**Tempo trace (initial attempt)**: [`c417e6185a247d5c5ba4278b20b30242`](http://tempo.dandelion.cult/api/traces/c417e6185a247d5c5ba4278b20b30242)

## Scenario

`continue_work()` invoked from a chain whose accumulated tokens exceed the configured `costCapTokens` should return a structured rejection. Verifies the cost-cap-exhaustion guard prevents runaway chains.

## Methodology evolution (substantive)

**Initial test approach (failed)**: lower `costCapTokens` mid-chain via config patch → fire `continue_work` → expect reject. Did NOT work — the running chain was started with `costCapTokens=500000` and config changes mid-flight didn't propagate (config snapshot captured at chain-start; mid-chain lowering had no effect on the live chain).

**Working methodology (per figs's direction)**: restart gateway with low `costCapTokens` from boot → fresh chain reads the low cap at chain-start → as accumulated tokens grow past cap, next `continue_work` call rejects.

## Command (proven path)

1. Patch fleet config: `continuation.costCapTokens: 1000`, `continuation.maxChainLength: 200` (give chain-depth room so cost-cap fires first)
2. Restart cael-seat gateway → fresh chain reads `costCapTokens=1000` at startup
3. Fire `continue_work({ delaySeconds: 5 })` repeatedly across chain hops
4. As accumulated output tokens cross 1000 threshold, next call gets the reject

## Expected

- Gateway emits `[continuation] Bracket continuation rejected: cost cap exceeded (<N> > 1000).` to the dispatching session
- Continuation chain does NOT advance further
- The next call is structurally rejected (not silently dropped)

## Observed

🩸 Cael (Discord `1507663279`):

> *"🔥🔥🔥 **R-CW-5 PROVEN ✅ — COST CAP GUARD FIRES!**"*
>
> ```
> [continuation] Bracket continuation rejected: cost cap exceeded (22879 > 1000).
> ```
>
> *"the gateway rejects when accumulated chain tokens exceed configured cap"*

**Prior corpus check**: this guard has NEVER been proven in any prior proof corpus across the frond's history. All prior runs marked it as HONEST-LIMIT or deferred. Tonight is the FIRST TIME the cost-cap guard has been observed firing.

The earlier delegate-with-low-cap approach (trace [`trace-c417e618.json`](./trace-c417e618.json), 21,409 bytes) was substrate-investigation that revealed the methodology — config hot-reload was not propagating to running sessions; the live chain had captured `costCapTokens=500000` at chain-start and was immune to mid-flight config changes. The post-restart fresh-chain approach is the working substrate.

## Behavior verified

✅ Cost-cap guard exists in code (`scheduler.ts` + `agent-runner.ts` enforcement points)
✅ Guard fires when accumulated chain tokens exceed configured `costCapTokens`
✅ Rejection emits structured log line `[continuation] Bracket continuation rejected: cost cap exceeded (<N> > <cap>).`
✅ Chain does not advance after rejection
✅ FIRST TIME proven in this frond's substrate (prior all-deferred → PASS)

## Substrate-substrate (methodology canon)

**To test cost-cap correctly, the gateway must boot with the low cap.** Mid-flight config changes do NOT propagate to running chains (config snapshot captured at chain-start). This is a substantive substrate-finding about the runtime — see `WORKORDER-cost-cap-chain-depth-wiring.md` + the dispatched `wo-cost-cap-wiring` copilot lane for code-walk investigation of hot-reload behavior + wiring map.

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance. **HISTORICAL MILESTONE**: cost-cap guard proven for the first time in the frond's substrate.
