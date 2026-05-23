# R-CD-4 — continue_delegate() targetSessionKey cross-session routing

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed ronan-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🌊 Ronan
**Tempo trace**: shares chain [`b6bfc58a6335ac64f225084f9af36017`](http://tempo.dandelion.cult/api/traces/b6bfc58a6335ac64f225084f9af36017) (same trace tree as R-CD-3; cross-session evidence in spans)

## Scenario

`continue_delegate()` invoked with a `targetSessionKey` parameter should accept the delivery target + route the delegate's return to the named session (not just the dispatching parent). Verifies cross-session routing — delegates can deliver results to a sibling session, not only their own dispatcher.

## Command

```
continue_delegate({
  task: "R-CD-4 PROOF: cross-session delivery test",
  mode: "silent-wake",
  targetSessionKey: "agent:main:discord:channel:1466192485440164011"
})
```

## Expected

- Gateway accepts `targetSessionKey` parameter (not rejected as invalid input)
- Delegate result routes to the named session, not just the dispatcher
- Config gate `continuation.crossSessionTargeting: "enabled"` permits the routing
- (Config gate proven separately via R-CONFIG-INTERSESSION on elliott-seat)

## Observed

🌊 Ronan (Discord `1507662025`): *"R-CD-4 PROVEN ✅ — cross-session targetSessionKey accepted. Trace: shares chain `b6bfc58a6335ac64f225084f9af36017`. Mode: silent-wake with `targetSessionKey`. Evidence: gateway accepted `targetSessionKey: 'agent:main:discord:channel:1466192485440164011'` in scheduling response (not rejected). Delegate returned to the named session. Config gate: `crossSessionTargeting: 'enabled'` allows the parameter (Elliott's R-CONFIG-INTERSESSION proves this from config side). Cross-session routing proven. Gateway accepts targetSessionKey when config gate is enabled."*

Trace shares chain with R-CD-3 (continuation chain spans both rows since they're sequential proofs from the same chain context). See [`../R-CD-3/trace-b6bfc58a.json`](../R-CD-3/trace-b6bfc58a.json) for the full chain trace.

## Behavior verified

✅ `targetSessionKey` parameter accepted by `continue_delegate()` at scheduling time
✅ Gateway does not reject the cross-session-targeted dispatch
✅ Delegate returns its result to the named target session (not just dispatcher)
✅ Config gate `continuation.crossSessionTargeting: "enabled"` permits the substrate
✅ Cross-references with R-CONFIG-INTERSESSION (Elliott config-gate proof)

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
