# R-CW-4 cael-dgx — chain-depth tracking across hops on `4bbd3aec096`

**Row owner:** 🩸 Cael (cael-dgx)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`

## Behavior proven
`chain.step.remaining` decrements across same `chain.id` as continuation hops fire. Captured from the cael-seat continuation chain on the deployed binary.

## Evidence
Delegate-chain hops (one chain, shared traceparent `00-8af51ea6...-45a218879c3a3803-01`):
- R-CD-TOOL silent-wake → `[continuation:chain-hop:2]` turn 2/200
- R-CD-CHAINED-DEPTH-2 root → `[continuation:chain-hop:3]` turn 3/200, **spawned childSession** `continuation-4e6838767ad35a5b…` (depth-2 leaf), `pendingDescendants:0` (child completed)
- R-CD-TOKEN bracket → `[continuation:delegate-spawned] Spawned turn 4/200`

The chain-hop counter advances 2→3→4 across the dispatches (same chain.id), and the depth-2 childSession proves `chain.step.remaining` tracks across a genuine depth-2 hop (root→leaf). The `maxChainLength:200` bound is the ceiling; hops logged as `N/200`.

## Tempo
Trace `8af51ea601b8ca2eef46b6c8028035d8` (the dispatch→harness.run→run subtree per hop). `continuation.queue.drain` roots separately this cycle (sibling trace, count=0 in-tree) — same honest cross-cycle nuance Rune + I both byte-walked; the in-tree dispatch→harness.run→run stitch is the load-bearing depth-tracking proof.
