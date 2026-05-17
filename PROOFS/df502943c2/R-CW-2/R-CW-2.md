# R-CW-2 (cael-seat): continue_work with explicit 10s delay (no-clamp path)

**Cure**: PR-79925 cure-(10)
**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build pin**: `OpenClaw 2026.5.17 (df50294)` (via `openclaw --version`)
**Prince/seat**: 🩸 cael (DGX Spark, ARM64)
**Service name**: `cael-prince`
**Fire timestamp (UTC)**: 2026-05-17T07:25Z

## Claim under test

Cure-(10) `continue_work` tool with explicit `delaySeconds` ABOVE the min-clamp floor (10s vs 5s clamp) must:
1. Accept the request (`status: scheduled`)
2. Return `delaySeconds: 10` unchanged (NOT clamped)
3. Emit a valid traceparent for cross-span stitching

Companion to R-CW-1 (which exercises the clamp-path: requested 3s, clamped to 5s).

## Tool invocation

```json
{
  "tool": "continue_work",
  "args": {
    "delaySeconds": 10,
    "reason": "R-CW-2 PROOF FIRE for cure-(9/10) PR-79925 at df502943c2. continue_work tool with explicit 10s delay (above min, exercises delay-clamp path differently than R-CW-1). Companion proof for R-CW-1 ronan-seat fire."
  },
  "result": {
    "status": "scheduled",
    "delaySeconds": 10,
    "traceparent": "00-7a1fcb0a420474276d7bfeaaaf271900-d48cbc742bcb3bc3-01"
  }
}
```

## Traceparent

```
00-7a1fcb0a420474276d7bfeaaaf271900-d48cbc742bcb3bc3-01
```

Trace ID: `7a1fcb0a420474276d7bfeaaaf271900`
Parent span ID: `d48cbc742bcb3bc3`

## What this proves about cure-(10) substrate

- `delaySeconds=10` honored verbatim (no clamp) — confirms `continuation.minDelayMs` (5000ms) does NOT apply when request exceeds floor
- Tool returned `status: scheduled` synchronously
- Traceparent format correct: `00-<32hex>-<16hex>-01`
- Tool reachable through cure-(10) `resolveSkillDispatchTools` policy seam

## Clamp coverage pair with R-CW-1

| Case | Requested | Returned | Trace `delay.ms` | Clamp? |
|---|---|---|---|---|
| R-CW-1 (cael) | 3s | scheduled | 5000 (from trace attr) | ✅ Yes (clamped to floor) |
| R-CW-2 (cael) | 10s | scheduled (delaySeconds=10) | — | ❌ No (above floor) |

Both clamp-path (R-CW-1) AND no-clamp path (R-CW-2) exercised. `continuation.minDelayMs` correctly applied at the boundary.

## Tempo trace fetch note

Pre-yield trace fetch (this turn still active when fetching) shows enclosing parent-run trace with `openclaw.tool.execution` spans for exec calls + `service.name=cael-prince`. The `continuation.work` span at this trace ID materializes when the wake actually fires — which happens after the current turn yields. The traceparent above is the fire-time byte-pin tying tool-call to eventual wake span.

Post-wake verification:
```
curl -s http://tempo.dandelion.cult/api/traces/7a1fcb0a420474276d7bfeaaaf271900
```
should contain a `continuation.work` span with `reason.preview` matching the R-CW-2 string.

## Disposition: ✅ GREEN (synchronous fire-side)

- Tool fired on real-host running `df502943c2`
- `delaySeconds=10` honored (no clamp)
- Traceparent emitted, valid format
- Reaches cure-(10) policy seam
- Above-floor delay path exercised — complements R-CW-1 clamp-path
- No skipped cases


---

## POST-WAKE UPDATE (2026-05-17T07:28Z)

Wake fired (turn 16/200, chain.step.remaining decremented from 187 → 184). Tempo trace now contains the `continuation.work` span at fire-time SHA.

### `continuation.work` span attributes (post-wake fetch)

```json
{
  "name": "continuation.work",
  "attributes": [
    {"key": "delay.ms", "value": {"intValue": "10000"}},
    {"key": "chain.step.remaining", "value": {"intValue": "184"}},
    {"key": "chain.id", "value": {"stringValue": "019e31e6-d96c-73de-bc1e-01df354942c1"}},
    {"key": "reason.preview", "value": {"stringValue": "R-CW-2 PROOF FIRE for cure-(9/10) PR-79925 at df502943c2. continue_work tool wit"}}
  ]
}
```

### Key observations

1. **`delay.ms=10000` (NOT clamped)** — confirms the no-clamp path. R-CW-1 emitted `delay.ms=5000` (clamped from 3s). The 10s request was honored verbatim.
2. **Same `chain.id` as R-CW-1** (`019e31e6-d96c-73de-bc1e-01df354942c1`) — chain continuation across multiple `continue_work` calls in the same session works correctly.
3. **`chain.step.remaining=184`** — was 187 at R-CW-1 fire-time, decremented by 3 (R-CW-1 + R-RC-2 + R-CW-2 fires consumed steps).
4. **`reason.preview` matches the cure-(10) string** — byte-pin from tempo backend, not agent prose.

### Disposition: ✅ GREEN (both fire-side AND wake-side)

The synchronous-side proof (above) is now joined by the wake-side `continuation.work` span emission. Full cycle proven: tool call → tempo span emission with cure-(10) reason-string + chain-tracking + no-clamp delay honored.

Tempo fetch updated: `tempo-fetch.json` now contains the post-wake trace.
