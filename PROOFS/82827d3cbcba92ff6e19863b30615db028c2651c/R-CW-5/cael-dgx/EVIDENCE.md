# R-CW-5 — cost-cap rejection (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ⚠️ SUBSTRATE-FINDING / HONEST-LIMIT — current-SHA source/config prove the cost-cap gate is present, but a live `cost-capped` reject was not safely forceable from this fresh lane without config edit + restart or artificial token-burning.

## Requirement

Strict R-CW-5 is `costCapTokens` exhaustion, not merely any cap. The expected runtime boundary is `accumulatedChainTokens > agents.defaults.continuation.costCapTokens`, producing a clean reject such as `[continuation:work-rejected] cost-capped` or the bracket-path `cost cap exceeded` message.

## Current live substrate

`live-config-continuation.json` pins Cael's deployed continuation config:

```json
{
  "costCapTokens": 500000,
  "maxChainLength": 200,
  "maxDelegatesPerTurn": 500
}
```

`service-bytepin.txt` pins the running gateway to `OpenClaw 2026.6.9 (82827d3)` / source `82827d3cbcba92ff6e19863b30615db028c2651c`.

`source-budget-gates.txt` captures the source gates on this SHA:

- `scheduler.ts` returns `cost-capped` when `accumulatedChainTokens > costCapTokens`.
- `work-dispatch.ts` logs `[continuation:work-rejected] cost-capped`.
- `delegate-dispatch.ts` logs `[continuation:delegate-rejected] cost-capped` / `cost cap exceeded`.
- `agent-runner.ts` rejects bracket continuation with `Continuation cost cap exceeded (...)`.

## Honest limit

No post-828 `cost-capped` journal line was present in the proof window, and Cael's cost cap is the normal high value (`500000`). The previous pending-cap class (`pending-capped 32/32`) is **not** claimed as strict R-CW-5 here. A strict live PASS would require a boot-time low cap or an already-over-cap chain; neither condition was safe to induce from this `/new` recovery lane.
