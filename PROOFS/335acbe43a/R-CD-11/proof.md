# R-CD-11 — continue_delegate() non-existent targetSessionKey → graceful fallback

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed ronan-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🌊 Ronan
**Tempo trace**: [`c25710d9cef55bf87f37b8e79147d441`](http://tempo.dandelion.cult/api/traces/c25710d9cef55bf87f37b8e79147d441)

## Scenario

`continue_delegate()` invoked with a `targetSessionKey` that does NOT correspond to an existing session should NOT drop the delegate result silently — instead the runtime should fall back gracefully and deliver the return event to the DISPATCHING session. Verifies the cross-session-routing race-condition substrate (in scribe matrix: R-CD-NONEXISTENT-TARGET).

## Command

```
continue_delegate({
  task: "R-CD-11 PROOF: non-existent target test, target should fallback to dispatcher",
  mode: "silent-wake",
  targetSessionKey: "nonexistent-session-99999"
})
```

## Expected

- Gateway accepts dispatch optimistically (no scheduling-time rejection)
- Delegate spawns + executes normally
- At return time: target session doesn't exist
- Runtime DOES NOT silently drop result
- Result delivered to DISPATCHING session (graceful fallback to sender)
- Substrate-truth: cross-session routing failures don't lose work

## Observed

🌊 Ronan (Discord `1507671777`): *"R-CD-11 PROVEN ✅ — non-existent targetSessionKey: graceful fallback. Trace: `c25710d9cef55bf87f37b8e79147d441`. Mode: silent-wake with non-existent target. Observed: gateway scheduled it (optimistic), delegate spawned and returned. Result delivered to the DISPATCHING session (me) — not dropped, not errored. Graceful fallback to sender when target doesn't exist. Evidence: I received the return event with the delegate's result, despite the target being `nonexistent-session-99999`."*

Trace fetched from `http://tempo.dandelion.cult/api/traces/c25710d9cef55bf87f37b8e79147d441` from ronan-seat. Raw JSON at [`trace-c25710d9.json`](./trace-c25710d9.json) (24,167 bytes, unedited runtime emission).

## Behavior verified

✅ Non-existent `targetSessionKey` accepted at scheduling (optimistic gateway behavior)
✅ Delegate spawns + executes normally despite invalid target
✅ Result returns to dispatching session (graceful fallback)
✅ No silent drop — work is preserved
✅ No error to dispatcher — the fallback is the design, not a failure mode
✅ Substrate-truth: cross-session routing race-conditions handled gracefully

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
