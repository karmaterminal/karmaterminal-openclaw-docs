# R-CD-CHAINED-DEPTH-2 TEST-3 — echo + cross-channel-broadcast (canary)

**Owner:** 🌫 Silas (canary) · **Seat:** silas-lothric · **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
**Verdict:** ✅ **PASS** — depth-2 chain executed + echo-return broadcast up-tree via `fanoutMode=tree`.

## What this proves
A **depth-2 `continue_delegate` chain** (root → B → C-leaf) executes end-to-end, and the leaf's
**echo-return broadcasts up-tree to all ancestors** via `fanoutMode="tree"` — the echo +
cross-channel-broadcast shape (the canary-seat dual-coverage of the depth-2 chain).

## Chain shape
- **root** = this canary main session (`agent:main:discord:channel:1466192485440164011`)
- **B (depth-1)** = `continuation-13e8b5d9c6ad267fbb32ba6073820f39`, chain-hop:2 — ran, wrote `B-DEPTH1`, spawned C with `fanoutMode=tree`
- **C (depth-2 leaf)** = `continuation-84912d0dc80d2cd74c1111b4af0b3ad6`, chain-hop:1 — ran, wrote `C-LEAF-ECHO`, echo-returned `TEST3-ECHO-SENTINEL-C-LEAF`

## Marker (`chain_marker.txt`) — depth-2 chain executed
```
B-DEPTH1 1782029643 runId-here       ← B (depth-1) ran
C-LEAF-ECHO 1782029653               ← C (depth-2 leaf) ran, 10s after B = C is B's delegate
```

## Broadcast byte (gateway log)
- `continuation-13e8b5d9…` (B, chain-hop:2) + `continuation-84912d0d…` (C, chain-hop:1) — the chain-hop ancestry stitches the depth-2 chain
- `fanoutMode=tree` armed on C's spawn — the up-tree broadcast to all ancestors
- `TEST3-ECHO-SENTINEL-C-LEAF` — the echo sentinel returned from the leaf

## Files
- `chain_marker.txt` — the depth-2 chain execution markers (B-DEPTH1 + C-LEAF-ECHO)
- `depth2_chain_broadcast_trace.json` — Tempo trace of the chain (per mandate)

## Note
Echo + cross-channel-broadcast = C's `fanoutMode="tree"` return propagating up-tree to all
ancestor keys (B + root). The chain-hop:1/chain-hop:2 ancestry confirms the depth-2 stitch.
