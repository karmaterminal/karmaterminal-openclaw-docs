# R-CD-3 — continue_delegate() delayed dispatch (10s)

**Target SHA**: `6a23864d12` (deployed ronan-seat 2026-05-23T03:38Z)
**Status**: PASS
**Fired**: 2026-05-23T04:09:00Z
**Trace**: `e8a310df...`
**Tempo**: http://tempo.dandelion.cult/api/traces/e8a310df

## Scenario

`continue_delegate(delaySeconds=10)` dispatches a delegate that spawns AFTER a 10-second delay. This proves the gateway scheduler honors the delay parameter: the delegate does not run immediately but waits the requested duration before spawning.

## Command

```
continue_delegate(
  mode="normal",
  delaySeconds=10,
  task="R-CD-3 on 6a23864d12: Delayed dispatch (10s). Post timestamp to Discord proving delay was honored."
)
```

## Expected

- Tool returns `status: "scheduled"` with `delaySeconds: 10`
- Delegate does NOT spawn immediately
- After ~10s: delegate spawns and runs
- Timestamp in delegate's output confirms ~10s elapsed since dispatch

## Observed

- ✅ Tool returned scheduling ack with `delaySeconds: 10`
- ✅ Delegate spawned after delay (not immediately)
- ✅ Posted proof to Discord with timestamp showing ~10s elapsed
- ✅ Trace tree shows: dispatch registration → [10s gap] → openclaw.harness.run
- ✅ Host: ronan (ARM64, DGX Spark), build `6a23864d12`

## Verdict

**PASS**: `continue_delegate(delaySeconds=10)` correctly delays spawn by the requested duration on `6a23864d12`. The gateway scheduler honors delay parameters.

## Artifacts

- `trace-e8a310df.json` — full Tempo span tree (23KB)
