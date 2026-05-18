# R-XSDT-1: cross-session-delivery targeting fire-and-forget contract at cure-(12) ship-SHA

**Ship SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) 6-file cohort-cosigned candidate)
**Build pin**: `OpenClaw 2026.5.17 (581678f)` (verified via `openclaw --version` on ronan-seat)
**Service**: `ronan-prince` (pid 1018183, host=ronan, arch=arm64)
**Fired at**: 2026-05-17T16:15:00-07:00 (ronan-seat)
**Traceparent**: `00-35e9f7a1ec2c8e254366d93586ba6253-4efaa71a57e93a2e-01`

## Fire

`continue_delegate` invoked from a live turn on the ronan-seat gateway with `targetSessionKey` set to a nonexistent session. Tool args: `mode=silent-wake`, `targetSessionKey=ronan-nonexistent-target-r-xsdt-1-cure12-581678f437`, `delaySeconds=0`.

Gateway response (verbatim):
```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "targetSessionKey": "ronan-nonexistent-target-r-xsdt-1-cure12-581678f437",
  "traceparent": "00-35e9f7a1ec2c8e254366d93586ba6253-4efaa71a57e93a2e-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Contract verified

- `targetSessionKey` to nonexistent session is accepted (`status=scheduled`)
- no synchronous throw / no target-resolution rejection
- `delegateIndex=1`, `delegatesThisTurn=1`
- `traceparent` emitted for telemetry cross-reference

## Tempo evidence

Fetched: `http://tempo.dandelion.cult/api/traces/35e9f7a1ec2c8e254366d93586ba6253`
File: `tempo-fetch.json` (110,504 bytes, 86 spans covering full `openclaw.run` → `model.call` → `tool.execution` chain)

## Verdict

✅ Cross-session-targeting fire-and-forget contract HOLDS on ship-SHA `581678f437`. Gateway accepted `continue_delegate` to a nonexistent session with `status=scheduled`, emitted traceparent, and persisted the dispatch without synchronous failure.
