# Fancy-demo trace: 8-delegate full-surface coverage

**Trace ID**: `774aea0c4ffa6fd1e8893da061ac2d8d`
**Tempo fetch**: `http://tempo.dandelion.cult/api/traces/774aea0c4ffa6fd1e8893da061ac2d8d`
**Captured**: 2026-05-19 18:42 PDT (within 10min of test-fire)

## Span counts
- 111 total spans
- 9 continuation.delegate.dispatch spans (8 fired + 1 grandchild from chain-depth-2)
- 17 openclaw.run spans (chain-hop depth visible)

## Delegate dispatches captured

| # | label | mode | extras |
|---|---|---|---|
| 1 | FANCY-1-IMMEDIATE-NORMAL | normal | — |
| 2 | FANCY-2-30s-NORMAL | normal | delay=30s (scheduled in subagent) |
| 3 | FANCY-3-60s-NORMAL | normal | delay=60s |
| 4 | FANCY-4-90s-SILENT | silent | delay=90s, return-silent |
| 5 | FANCY-5-120s-SILENTWAKE | silent-wake | delay=120s, return-silent + wake |
| 6 | FANCY-6-IMMEDIATE-FANOUTALL | normal | fanoutMode=all |
| 7 | FANCY-7-PARENT-SPAWNER | normal | spawns grandchild |
| 7g | FANCY-7-GRANDCHILD-DEPTH2 | normal | chain-depth-2 |
| 8 | FANCY-8-EXPLICIT-TARGET | normal | targetSessionKey=explicit |

## Substrate-coverage validated

✅ All 4 delegate-modes (normal, silent, silent-wake, fanoutMode=all)
✅ Multiple delay-classes (immediate + 30s + 60s + 90s + 120s)
✅ Chain-depth-2 (root → child → grandchild)
✅ Explicit targetSessionKey routing
✅ Trace-context propagation across all dispatches

Note: per-dispatch `delay.ms` reports 0 because scheduling delay is enforced at
subagent-spawn time, not dispatch time. The 30s/60s/90s/120s delays are visible
via parent-span timing diffs in the trace timeline.
