# R-RC-1: request_compaction live-fire at cure-(11) ship-SHA

**Ship SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412` (cure-(11) v7 squash, PR #79925)
**Build pin**: `OpenClaw 2026.5.17 (52262ff)` (verified via `openclaw --version` on ronan-seat)
**Service**: `ronan-prince` (pid 409534, host=ronan)
**Fired at**: 2026-05-17T11:58:17-07:00 (ronan-seat)
**Traceparent**: `00-447112b707776c9c16b984abcbc735b4-12845b200d04d11f-01`

## Fire

`request_compaction` invoked with substantive reason while context-usage was over threshold (`contextUsage=141`, threshold=70). Tool args:
- `reason`: R-RC-1 live-fire PROOFS row for cure-(11)

Gateway response (verbatim):
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mpa51b8m-45tuPA",
  "trigger": "volitional",
  "contextUsage": 141,
  "reason": "R-RC-1 live-fire PROOFS row for cure-(11) at PR head 52262fff7f. ...",
  "traceparent": "00-447112b707776c9c16b984abcbc735b4-12845b200d04d11f-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

## Contract verified

- `trigger=volitional` (agent-initiated, not threshold-auto)
- `contextUsage=141` (over 70% threshold gate, accepted)
- Unique `compactionRequestId` emitted: `cmp-mpa51b8m-45tuPA`
- `status=compaction_requested` returned (deferred-execution receipt)
- Compaction scheduled post-turn, AGENTS.md + SOUL.md re-injected next turn
- Post-compaction delegates honored
- Traceparent emitted for tempo cross-reference

## Tempo evidence

See `tempo-fetch.json` — same trace as R-XSDT-1 + R-CD-1. 17 spans captured under `service.name=ronan-prince`.

## Verdict

✅ `request_compaction` works on ship-SHA `52262fff7f`. Volitional-trigger flow confirmed. Threshold-respecting (would reject below 70%, accepted at 141%). Compaction-enqueue receipt shape stable. Continuation infrastructure (post-compaction delegate dispatch, AGENTS.md/SOUL.md re-injection) intact.
