# R-CD-CHAINED-DEPTH-2 — depth-2 delegate chain + fanoutMode=tree broadcast — FRESH exact-SHA on c4f15321

**Row owner:** 🌊 Ronan · **Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `c4f15321fb5f6b161b7e0153f72ef0538a04b2fc` (`OpenClaw 2026.6.2`) — **fresh exact-SHA, proof-SHA == deployed runtime-SHA** (clawsweeper-valid)
**Fired:** 2026-06-08 21:47:34 PDT (dispatched after the dispatching turn completed)

## Behavior proven
Two coupled continuation behaviors on the live ship-SHA:
1. **Depth-2 delegate chaining** — a depth-1 delegate shard itself fires a further `continue_delegate`, reaching **depth-2**, with chain-tracking (cost/depth accumulation) propagating up the chain.
2. **`fanoutMode="tree"` broadcast return** — the depth-2 leaf's return is **Delivered to ALL ancestors in the chain** (depth-1 parent + the dispatching session + the channel root), not just its immediate parent.

## The chain (3 hops, `tree-broadcast-journal.txt`)
Captured from `journalctl --user -u openclaw-gateway`, gateway live on `c4f15321fb`:
```
21:47:34  [continuation:delegate-spawned] hop=1/200 mode=silent
          session=...subagent:0166e10f...  task=PROOF-MARKER-RONAN-RCD-CHAINED-DEPTH-2-c4f15321 (depth-1)
21:47:46  [continuation:delegate-spawned] hop=1/200 mode=silent
          session=...subagent:continuation-28e3fe55...  task=PROOF-MARKER-RONAN-RCD-DEPTH2-LEAF-c4f15321 (depth-1 fires the depth-2 leaf)
21:47:47  RCD-CHAINED-DEPTH-2 depth-1 fired depth-2 fanoutMode=tree on c4f15321fb — chain-tracking + tree-broadcast leg exercised. (depth-1 return)
21:47:51  PROOF-MARKER-RONAN-RCD-DEPTH2-LEAF-c4f15321: depth-2 leaf reached via fanoutMode=tree ... returned to tree (all ancestors). (depth-2 leaf return)
21:47:51  [continuation:targeted-return] Delivered to
            agent:main:subagent:continuation-28e3fe55...,         ← depth-1 parent (immediate)
            agent:main:subagent:0166e10f...,                       ← the dispatching session (me)
            agent:main:discord:channel:1466192485440164011         ← the channel root (top ancestor)
          from agent:main:subagent:continuation-69f53500... (the depth-2 leaf)
21:47:52  [subagent-chain-hop] Accumulated 322 tokens from ...continuation-28e3fe55... to parent chain cost
```

## Why this is the complete proof (fresh exact-SHA)
- **Depth-2 reached** ✓ — the dispatch chain went `0166e10f` (me, depth-1 origin) → `continuation-28e3fe55` (depth-1 shard) → `continuation-69f53500` (depth-2 leaf). Three distinct sessions in the chain.
- **`fanoutMode=tree` broadcast** ✓ — **THE defining byte**: the depth-2 leaf's `[continuation:targeted-return] Delivered` line lists **THREE recipients** (the immediate depth-1 parent, the dispatching session, AND the channel root). A non-tree (default) return would deliver only to the immediate parent. The multi-ancestor delivery IS the tree-broadcast behavior, byte-proven on the live runtime.
- **Chain-tracking** ✓ — `[subagent-chain-hop] Accumulated N tokens ... to parent chain cost` propagated cost up the chain (cost-cap/depth-limit accounting applies across the depth-2 chain).
- **All three markers returned verbatim** ✓ — `PROOF-MARKER-RONAN-RCD-CHAINED-DEPTH-2-c4f15321` (depth-1 task), `RCD-CHAINED-DEPTH-2 depth-1 fired depth-2 fanoutMode=tree...` (depth-1 result), `PROOF-MARKER-RONAN-RCD-DEPTH2-LEAF-c4f15321` (depth-2 leaf result).

## Honest scope
- Proves depth-2 chaining + tree-broadcast return-targeting on the live ship-SHA. Does not stress the depth-limit ceiling (separate boundary row: Rune's R-CW-6 covers `maxSpawnDepth=1` enforcement on the subagent surface). The continuation-chain `hop=N/200` ceiling here is the chain-hop budget, distinct from spawn-depth.
