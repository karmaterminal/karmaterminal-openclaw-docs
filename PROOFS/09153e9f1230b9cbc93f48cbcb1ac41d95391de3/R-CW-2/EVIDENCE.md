# R-CW-2 — continue_work delay-clamp (sub-minimum → minDelayMs)
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx)

## Proof: continue_work clamps a sub-minimum delay up to minDelayMs on the ship-SHA
Fired `continue_work(delaySeconds=1)` on the live deployed `8b5dde6165` gateway (1s is below `minDelayMs=5000`). Verbatim receipt:

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "note": "Requested 1s, clamped to 5s by continuation config.",
  "traceparent": "00-5100308a58c9fcb448ffa88280774b20-47c4db3d53a900d0-01"
}
```

## Field verification
- **status = "scheduled"** ✓ — the continuation was accepted + scheduled
- **delaySeconds = 5** ✓ — clamped UP from the requested 1 to the `minDelayMs=5000ms` floor (R-CONFIG-DEFAULTS confirms minDelayMs=5000)
- **note** ✓ — explicit human-readable clamp explanation ("Requested 1s, clamped to 5s by continuation config")
- **traceparent** ✓ — a W3C traceparent emitted for the continuation fire (used by R-OBS-1)

## Verdict: ✅ PASS
continue_work's delay-clamp fires-as-designed on `8b5dde6165`: a sub-`minDelayMs` request is clamped up to the 5000ms floor, with the clamp surfaced verbatim in the receipt note. The complementary upper-clamp (request > maxDelayMs → clamped to 86400000ms) is bounded by the same config.
