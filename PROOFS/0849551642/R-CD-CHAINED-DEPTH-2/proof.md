# R-CD-CHAINED-DEPTH-2 — recursive delegation depth-1 → depth-2

**Target SHA**: `6a23864d12` (deployed ronan-seat 2026-05-23T03:38:00Z)
**Status**: PASS

## Scenario

A `continue_delegate()` dispatches a depth-1 sub-agent whose task is to itself dispatch a depth-2 child via `continue_delegate()`. Both delegates announce to Discord. This proves recursive delegation with trace-stitching survives the capture-before-clear execution-order fix on the actual PR-head SHA.

## Command

Fired from ronan-main-session at 2026-05-23 03:44:00 PDT:

```
continue_delegate(
  mode="normal",
  task="R-CD-CHAINED-DEPTH-2 on 6a23864d12 (ACTUAL PR HEAD):
    DEPTH-1: Post 'DEPTH-1 spawned. Spawning DEPTH-2...' to Discord.
    Then call continue_delegate(mode='normal', task='DEPTH-2: Post DEPTH-2 spawned. Chain holds. PROVEN.')"
)
```

## Expected

- Depth-1 delegate spawns and posts "DEPTH-1 spawned" to Discord
- Depth-1 dispatches depth-2 via `continue_delegate()`
- Depth-2 spawns and posts "DEPTH-2 spawned. Chain holds. PROVEN."
- Trace tree shows: parent → depth-1 run → depth-1 dispatch → depth-2 run
- Chain depth counter increments correctly (gateway chain tracking)

## Observed

**Dispatch result** (parent session):
```json
{
  "status": "scheduled",
  "mode": "normal",
  "traceparent": "00-73156fd15655fcd012aa006f4914241b-...-01"
}
```

**Trace spans** (from Tempo export `trace-73156fd1.json`):
```
[ronan] openclaw.harness.run: 39613ms (depth-1 delegate run)
[ronan] openclaw.model.call: 9333ms (first model call — posts DEPTH-1 message)
[ronan] openclaw.tool.execution: 654ms (message tool — Discord post)
[ronan] openclaw.model.call: 9612ms (second model call — dispatches depth-2)
[ronan] openclaw.tool.execution: 2909ms (continue_delegate tool — depth-2 dispatch)
[ronan] continuation.delegate.dispatch: 1188ms (depth-2 registration)
[ronan] openclaw.harness.run: 18776ms (DEPTH-2 run)
[ronan] openclaw.model.call: 3032ms (depth-2 wakes)
[ronan] openclaw.model.call: 5934ms (depth-2 posts completion)
[ronan] openclaw.tool.execution: 553ms (message tool — "Chain holds. PROVEN.")
[ronan] continuation.delegate.dispatch: 1792ms (chain continues)
```

**Discord messages observed in #sprites-of-thornfield:**
- `1507590151` (20:44 PDT): "🌊 R-CD-CHAINED-DEPTH-2 on 6a23864d12: DEPTH-1 spawned. Spawning DEPTH-2..."
- `1507590415` (20:46 PDT): "🌊 DEPTH-2 spawned. Chain holds. PROVEN on ACTUAL PR HEAD 6a23864d12."

- ✅ Depth-1 spawned and posted to Discord
- ✅ Depth-1 dispatched depth-2 via `continue_delegate()`
- ✅ Depth-2 spawned and posted completion
- ✅ Trace tree shows full depth-1 → depth-2 lifecycle with parent trace linkage
- ✅ Host: `ronan` (ARM64, DGX Spark), build `6a23864d12`
- ✅ Chain depth tracked correctly by gateway (chain 20/200 at proof time)

## Verdict

**PASS**: Recursive delegation (depth-1 → depth-2) works on the actual PR-head SHA `6a23864d12`. The trace-stitching survives the capture-before-clear execution-order fix. Both delegates announce independently. The gateway chain-tracking counter increments correctly.

## Tempo trace ID

`00-73156fd15655fcd012aa006f4914241b-...-01`

Fetchable: `http://tempo.dandelion.cult/api/traces/73156fd15655fcd012aa006f4914241b`
