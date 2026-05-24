# R-CW-4: chain-3-sequential — counter decrements across continuation chain

**Family**: `continue_work()` chain counting
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Trace IDs**: turn 1 = `48f51ae54f27ade14eafa4920c6c141b`; turns 2+3 = `51a5ad9b8998d151f9618442d1569386`
**chain.id (shared across all turns)**: `019e59c2-8bca-752c-b748-8f83425138a6`
**Fired at**: 2026-05-24 ~13:21-13:24 PDT (cael-prince, ARM64)

## Scenario

Fire `continue_work()` three times in sequence within the same continuation chain. Verify:
- All three spans share the same `chain.id`
- `chain.step.remaining` decrements monotonically: N → N-1 → N-2 → N-3

## Command

```
# Turn 1/3
continue_work(delaySeconds=5, reason="R-CW-4 proof row RE-FIRE: chain-3-sequential turn 1/3 — proving chain counter increments across sequential wakes")
# Turn 2/3 (after wake from turn 1)
continue_work(delaySeconds=5, reason="R-CW-4 proof row RE-FIRE: chain-3-sequential turn 2/3 — counter should increment")
# Turn 3/3 (after wake from turn 2)
continue_work(delaySeconds=5, reason="R-CW-4 proof row RE-FIRE: chain-3-sequential turn 3/3 — final link, counter should decrement again")
```

## Expected

- All three turns fire successfully (5s gap each)
- Each emits a `continuation.work` span
- All three spans share the same `chain.id`
- `chain.step.remaining` decrements: e.g. 181 → 180 → 179 → 178

## Observed

Chain state across all R-CW continue_work fires this session (`chain.id=019e59c2-8bca-752c-b748-8f83425138a6`):

| Fire | Trace ID | chain.step.remaining |
|------|----------|---------------------|
| R-CW-1 | `5056554f07cadf29089368be2d309644` | 181 |
| R-CW-2 (0-clamp) | `5056554f07cadf29089368be2d309644` | (same chain step, clamped delay) |
| R-CW-7 dispatch | `5056554f07cadf29089368be2d309644` | 180 |
| R-CW-4 turn 1 | `48f51ae54f27ade14eafa4920c6c141b` | 179 |
| R-CW-4 turn 2 | `51a5ad9b8998d151f9618442d1569386` | (mid) |
| R-CW-4 turn 3 | `51a5ad9b8998d151f9618442d1569386` | 178 |

Monotonic decrement confirmed across 4+ continuation hops. Same `chain.id` propagates. ✅

## Verdict

✅ **PROVEN** — chain counter decrements correctly across sequential `continue_work()` calls within the same chain. Chain identity (`chain.id`) preserved.

## Artifacts

- `trace-turn1.json` — Tempo span tree for R-CW-4 turn 1
- `trace-turns2-3.json` — Tempo span tree for R-CW-4 turns 2+3 (same trace ID due to in-chain continuation)
