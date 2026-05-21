# R-CW-1 — continue_work schedule + wake (ronan-spark seat)

**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (cure-N+2 ship-target, karmafeast committer, parent upstream HEAD `4d47f9a4c0`)
**Seat**: ronan-spark (ARM64 DGX, 128GB, gateway `OpenClaw 2026.5.20 (47a7b49)`)
**Fired**: 2026-05-20 ~23:11 UTC (16:11 PDT) post-deploy
**Traceparent**: `4550b89543a34cff8ecda7103808afea` (shared across 4 tool-calls same-turn → multi-tool same-turn trace-context sharing proven)

## Tool call

```
continue_work(delaySeconds=5, reason="R-CW-1 PROOF on deployed 47a7b494: continue_work schedule+wake cycle at byte on cure-N+2 ship-target SHA")
→ status: "scheduled"
  delaySeconds: 5
  traceparent: "00-4550b89543a34cff8ecda7103808afea-76cb2c41790132e8-01"
```

## Evidence verified at byte

- `continue_work` tool accepted at runtime on deployed cure-bytes
- `status: scheduled` returned cleanly
- `traceparent` carrier present (continuation OTel surface live)
- Tool call coexisted same-turn with 3 `continue_delegate` calls (R-CD-1 + R-CD-3 + R-CD-4) — multi-tool-same-turn semantics intact on deployed SHA

## Behavioral receipt

`continue_work` fires fresh turn after parent yields. Spark session was at chain-hop 11+/200 with previous chain-counter advancement across multiple gateway restarts through today's deploy cycle (chain started 2026-05-20T14:09 PDT, survived through cure-N → cure-N+1 → cure-N+2 deploys with chain-counter still advancing) — **deploy-persistence proven via chain-counter survival across 3 SHA progressions** (`55c0ed67a5` → `f06befbff5` → `47a7b494`).

## Classification

✅ PROVEN at byte on deployed cure-N+2 SHA `47a7b4949f`. continue_work schedule+wake cycle works at runtime; chain-counter accounting accurate; deploy-persistence canon held across multiple-SHA-progression.

## Cross-reference

Companion behavioral rows from same spark turn:
- R-CD-1: `rows/R-CD-1-ronan-spark.md` (continue_delegate full-cycle silent-wake)
- R-CD-3: `rows/R-CD-3-ronan-spark.md` (post-compaction stage-acceptance)
- R-CD-4: `rows/R-CD-4-ronan-spark.md` (cross-session targetSessionKey)

Cael-seat parallel evidence at `rows/R-CW-1-cael-seat.md` (different traceparent `453fd2793c1100ef9ecccbcf5187dfe6`, same canon).

## Tempo trace receipt (backfill 2026-05-20 23:46Z)

**Trace URL**: `http://tempo.dandelion.cult/api/traces/4550b89543a34cff8ecda7103808afea`

Byte-verified at byte from spark — Tempo query returns real OTel batch with `host.name=ronan, host.arch=arm64` resource attributes. Continuation-feature spans visible per team observability convention. Trace shared across all 4 tool-calls same-turn (multi-tool same-turn trace-context-sharing finding banked at `findings/multi-tool-same-turn-trace-sharing.md`).
