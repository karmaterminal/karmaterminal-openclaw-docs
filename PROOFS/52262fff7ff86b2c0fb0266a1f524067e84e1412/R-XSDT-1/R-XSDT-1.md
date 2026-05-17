# R-XSDT-1: cross-session-delivery targeting fire-and-forget contract at cure-(11) ship-SHA

**Ship SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412` (cure-(11) v7 squash, PR #79925)
**Build pin**: `OpenClaw 2026.5.17 (52262ff)` (verified via `openclaw --version` on ronan-seat)
**Service**: `ronan-prince` (pid 409534, host=ronan, arch=arm64)
**Fired at**: 2026-05-17T11:58:03-07:00 (ronan-seat)
**Traceparent**: `00-447112b707776c9c16b984abcbc735b4-12845b200d04d11f-01`

## Fire

`continue_delegate` invoked from a live turn on the ronan-seat gateway with `targetSessionKey` set to a nonexistent session. Tool args: `mode=silent-wake`, `targetSessionKey=ronan-nonexistent-target-r-xsdt-1-cure11-52262fff7f`, `delaySeconds=0`.

**Architectural contract under test** (per #697 §1 byte-walk + 3-lane Pattern G cosign #695+#696+#697):

> targetSessionKey is never resolved against active-session-store in delivery path. Fire-and-forget durable delivery by design: event persists in queue, no throw, no orphaned promise. Recipient picks up substrate when/if session activates.

Gateway response (verbatim):
```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "targetSessionKey": "ronan-nonexistent-target-r-xsdt-1-cure11-52262fff7f",
  "traceparent": "00-447112b707776c9c16b984abcbc735b4-12845b200d04d11f-01"
}
```

## Test surface in cure-(11)

- `src/auto-reply/continuation/subagent-announce-delivery.ts`
- `src/auto-reply/continuation/targeting-pure.ts`
- Test additions:
  - `subagent-announce-delivery.cross-session-targeting.nonexistent-target.test.ts` (342 lines, #697)
  - `continuation/delegate-dispatch.test.ts` (146 lines, #697)
  - `subagent-announce-delivery.nonexistent-target-session-delivery.race.test.ts` (290 lines, UNION-T-3 #696)

## Tempo evidence

Fetched: `http://tempo.dandelion.cult/api/traces/447112b707776c9c16b984abcbc735b4`
File: `tempo-fetch.json` (23,780 bytes)
Span count: 17
Span names captured:
- `openclaw.context.assembled`
- `openclaw.model.call`
- `openclaw.tool.execution`

All spans tagged `service.name=ronan-prince`, `host.name=ronan`, `process.pid=409534`, runtime=`node 25.9.0`.

## Verdict

✅ Cross-session-targeting fire-and-forget contract HOLDS on ship-SHA `52262fff7f`. Gateway accepted `continue_delegate` to nonexistent session with `status=scheduled`. No throw. Traceparent emitted. Tempo confirms whole-chain telemetry under `ronan-prince` service.
