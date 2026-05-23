# R-CW-6 — continue_work() max chain depth → structured reject

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ **PASS** (proven post-restart-methodology — first time ever in this frond's substrate)
**Prince**: 🩸 Cael
**Tempo trace (pre-restart boundary)**: [`92103558485d174043c9f9332ae44e42`](http://tempo.dandelion.cult/api/traces/92103558485d174043c9f9332ae44e42)

## Scenario

`continue_work()` invoked when the chain has reached the configured `maxChainLength` should return a structured rejection. Verifies the chain-depth-exhaustion guard prevents unbounded chain growth.

## Methodology evolution (substantive)

**Initial test approach (failed)**: lower `maxChainLength` mid-chain to a value below current chain depth → expect reject on next call. Did NOT work — the running chain was started with `maxChainLength=200` and config changes mid-flight didn't propagate.

**Working methodology (per figs's direction)**: restart gateway with low `maxChainLength` from boot → fresh chain reads the low cap at chain-start → as chain advances past cap, next `continue_work` call rejects.

## Command (proven path)

1. Patch fleet config: `continuation.maxChainLength: 5` (low boundary for fast test)
2. Restart cael-seat gateway → fresh chain reads `maxChainLength=5` at startup
3. Fire `continue_work({ delaySeconds: 5 })` repeatedly across chain hops
4. At chain hop 5, next call gets the structured reject

## Expected

- Gateway emits `[continuation] Bracket continuation rejected: chain length 5 reached.` to the dispatching session
- Continuation chain does NOT advance past the cap
- The next call is structurally rejected (not silently dropped)

## Observed

🩸 Cael (Discord `1507662112`, `1507663279`):

> *"🔥 **R-CW-6 PROVEN ✅ — chain length guard FIRES!**"*
>
> ```
> [continuation] Bracket continuation rejected: chain length 5 reached.
> ```
>
> *"the gateway restarted with `maxChainLength=5`. my scheduled `continue_work` fired, reached chain 5, and the system REJECTED it with the structured message. **the guard works.**"*

**Prior corpus check**: this guard has NEVER been proven in any prior proof corpus. All prior runs marked it as HONEST-LIMIT or deferred. Tonight is the FIRST TIME the chain-depth-exhaustion guard has been observed firing.

Pre-restart boundary trace [`trace-92103558.json`](./trace-92103558.json) (at the original 35/35 boundary during the initial mid-flight test) is preserved as substrate-investigation evidence — confirms the chain WAS at the boundary but mid-flight config change couldn't make the guard fire.

## Behavior verified

✅ Chain-depth-exhaustion guard exists in code (`scheduler.ts` + `agent-runner.ts` enforcement points)
✅ Guard fires when chain depth reaches configured `maxChainLength`
✅ Rejection emits structured log line `[continuation] Bracket continuation rejected: chain length <N> reached.`
✅ Chain does not advance after rejection
✅ FIRST TIME proven in this frond's substrate (prior all-deferred → PASS)

## Substrate-substrate (methodology canon)

**To test chain-depth correctly, the gateway must boot with the low cap.** Mid-flight config changes do NOT propagate to running chains. Same substantive substrate-finding as R-CW-5 — config snapshot captured at chain-start. See `WORKORDER-cost-cap-chain-depth-wiring.md` for hot-reload behavior code-walk dispatch.

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance. **HISTORICAL MILESTONE**: chain-depth guard proven for the first time in the frond's substrate.
