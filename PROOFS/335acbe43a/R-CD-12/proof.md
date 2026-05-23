# R-CD-12 — Mixed continuation chain: continue_work → continue_delegate → continue_work → "hooray!"

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed ronan-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🌊 Ronan
**Tempo traces** (3-step chain):
- Step 1 (`continue_work`): [`bffb261e3ced56ab6107cdc44314023d`](http://tempo.dandelion.cult/api/traces/bffb261e3ced56ab6107cdc44314023d)
- Step 2 (`continue_delegate` silent-wake): [`c51e2ad6a29616fe507cc86f38d05d94`](http://tempo.dandelion.cult/api/traces/c51e2ad6a29616fe507cc86f38d05d94)
- Step 3 (`continue_work(7s)` from delegate → "hooray!"): same chain as Step 2 (delegate's continuation hop)

## Scenario

This is **figs's specifically-requested continuation-chain proof**: prove that the three continuation tools can chain into each other across sessions:

1. Parent calls `continue_work()` → schedules its own next turn
2. On wake, parent calls `continue_delegate(...)` → spawns delegate session
3. Delegate calls `continue_work(7s)` from within its substrate → schedules its own next turn
4. On delegate wake, posts "hooray!" as completion signal

Verifies tool-mix interop: both continuation tools can chain into each other across the parent→delegate session boundary, with each tool honoring its own contract along the way.

## Command (3-step sequence)

```
# Step 1: parent (ronan-seat) calls continue_work
continue_work({ delaySeconds: 7, reason: "R-CD-12 step 1: parent's own wake" })

# (On wake)
# Step 2: parent calls continue_delegate to spawn a delegate
continue_delegate({
  task: "R-CD-12 step 3: as the delegate, call continue_work(7s) then post 'hooray!'",
  mode: "silent-wake"
})

# Step 3 (inside delegate session):
continue_work({ delaySeconds: 7, reason: "R-CD-12 step 3: delegate-self-elects wake" })

# (On delegate wake)
# Post: "hooray!"
```

## Expected

- All 3 continuation tool invocations succeed (no rejection at any step)
- Trace tree shows parent→delegate→delegate-wake span chain
- Final "hooray!" posts to channel as visible completion signal
- Mixed tool-axis interop is honored (continue_work and continue_delegate chain cleanly)

## Observed

🌊 Ronan (Discord `1507675287`, `1507676708`):

> *"HOORAY"* (chain completion signal at `09:23:19`)
>
> *"R-CD-12 trace IDs (3 steps):*
> *1. Step 1 (continue_work): `bffb261e3ced56ab6107cdc44314023d` (clamped to 5s)*
> *2. Step 2 (continue_delegate silent-wake): `c51e2ad6a29616fe507cc86f38d05d94`*
> *3. Step 3 (continue_work(7s) from delegate → 'hooray!'): trace from the delegate's own chain (same parent as step 2)"*
>
> *"Framing: R-CD-12 is its own row — 'mixed continuation chain: continue_work → continue_delegate → continue_work(7s) → hooray!' This is figs's specific ask. It proves tool-mix interop (both continuation tools chaining into each other across sessions)."*

Traces fetched from ronan-seat:
- Step 1 trace at [`trace-bffb261e-step1.json`](./trace-bffb261e-step1.json) (11,723 bytes)
- Step 2 trace at [`trace-c51e2ad6-step2.json`](./trace-c51e2ad6-step2.json) (33,157 bytes) — includes the delegate's full chain context including step 3 wake

Step 1's requested 7s wake clamped to 5s (per `minDelayMs` config — same clamping behavior as cael's R-CW-2 substrate).

## Behavior verified

✅ Step 1: parent's `continue_work` schedules → wakes (clamped delay honored)
✅ Step 2: parent's `continue_delegate` silent-wake spawns delegate
✅ Step 3: delegate calls `continue_work(7s)` from within its own substrate → schedules + wakes
✅ Final "hooray!" posts to channel — visible completion signal
✅ Mixed-tool interop: `continue_work` + `continue_delegate` chain cleanly across parent→delegate boundary
✅ Distinct from R-CD-CHAINED-DEPTH-2 (recursive delegation depth-2 = same tool, recursive depth); R-CD-12 = different tools chaining

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance. **figs's specifically-requested chain-proof row.**
