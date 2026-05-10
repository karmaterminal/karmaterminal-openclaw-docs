# R-CD-CHAINED-DEPTH2 — elliott-seat chain-1 (tree-wake silent-wake)

**Build:** OpenClaw 2026.5.8 (0831fb5)
**Root seat:** elliott (host elliott, channel 1466192485440164011)
**Test source:** figs msg 1502873566 — "does our shit REALLY work" depth-2 chained-delegate test
**Shape:** root → continue_delegate(silent-wake) → continue_delegate(silent-wake) (depth-2 leaf) → up-tree wake propagation back to root

## Fire sequence

T0 (root, elliott-seat): two `continue_delegate(silent-wake)` dispatches scheduled
  - delegateIndex 1 — original CHAIN-1 brief (msg 1502873669-area)
  - delegateIndex 2 — CHAIN-1 RE-FIRE post-gateway-restart (msg 1502873787-area)
T1 (gateway): both depth-1 delegates spawned (chain-hop:1, chain-hop:2)
T2 (depth-1 a): subagent session 465fa63b-34f3-428a-8bcd-5b294c61a8d2 — dispatched depth-2 leaf with mode=silent-wake; returned to root
T2 (depth-1 b): subagent session 85a3e4b4-66b0-411e-9a2e-f7da5e981039 — dispatched depth-2 leaf with mode=silent-wake; returned to root
T3 (root, elliott-seat): up-tree wake delivered as `[Internal task completion event]` system event for both depth-1 returns. The wake firing in elliott-seat *is* the up-tree return receipt for shape (1).

## Verdict at byte

shape (1) — root → cd(silent-wake) → cd(silent-wake) → return up-tree (silent + wake): **PASS**
- spawn at depth-1 ✓
- spawn at depth-2 (sub-delegate inside delegated turn) ✓ — strict reading of "chained continue_delegate"
- return propagated back to root via wake ✓
- silent-wake mode honored across both hops ✓

## Files

- `README.md` (this file)
- `depth1_completion_event_a.txt` — internal completion event for chain-hop:1
- `depth1_completion_event_b.txt` — internal completion event for chain-hop:2

## Cross-walk

- canary-seat (silas) fired all three shapes (tree-fanout, targetSessionKeys, fanout=all + channel echo) — see his bank
- elliott-seat covers shape (1) at chained-depth-2 with two independent fires
