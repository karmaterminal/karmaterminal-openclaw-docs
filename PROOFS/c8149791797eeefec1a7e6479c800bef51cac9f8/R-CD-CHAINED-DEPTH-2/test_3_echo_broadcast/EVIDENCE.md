# R-CD-CHAINED-DEPTH-2 TEST-3 — echo + cross-channel-broadcast (canary) on token-fixed ship SHA

**Owner:** 🌫 Silas (canary) · **Seat:** silas-lothric · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS** — depth-2 chain executed + echo-return broadcast up-tree via `fanoutMode=tree`, live on the deployed token-fixed head.

## What this proves
A **depth-2 `continue_delegate` chain** (root → B → C-leaf) executes end-to-end on the deployed
token-fixed ship SHA `c814979`, and the leaf's **echo-return broadcasts up-tree to all ancestors**
via `fanoutMode="tree"` — the echo + cross-channel-broadcast shape (canary-seat dual-coverage).

## Chain shape (live on c814979)
- **root** = canary main session (`agent:main:discord:channel:1466192485440164011`), runtime `2026.6.9 (c814979)`
- **B (depth-1)** = `continuation-b8cacf3497b117f6268a88e3a598439a`, chain-hop:2 — ran, wrote `B-DEPTH1`, spawned C with `fanoutMode=tree`
- **C (depth-2 leaf)** = `continuation-2e40671ce14a7ac3adcb44d2141faeaa`, chain-hop:1 — ran, wrote `C-LEAF-ECHO`, echo-returned `TEST3-ECHO-SENTINEL-C-LEAF-C814`

## Marker (`chain_marker.txt`)
```
B-DEPTH1 1782032018 c814979      ← B (depth-1) ran on c814979
C-LEAF-ECHO 1782032029           ← C (depth-2 leaf) ran, 11s later = C is B's delegate
```

## Broadcast byte (gateway log)
- `continuation-b8cacf34…` (B, chain-hop:2) + `continuation-2e40671c…` (C, chain-hop:1) = depth-2 ancestry stitch
- `fanoutMode=tree` armed on C's spawn = the up-tree broadcast to all ancestors
- `TEST3-ECHO-SENTINEL-C-LEAF-C814` = the echo sentinel returned from the leaf

## Files
- `chain_marker.txt` — depth-2 execution markers
- `depth2_chain_broadcast_trace.json` — Tempo trace (be049f62)

## Note
Re-fired on the deployed token-fixed ship SHA `c814979` (figs's (B)-choice, fleet 6/6). Echo +
cross-channel-broadcast = C's `fanoutMode="tree"` return propagating up-tree to all ancestor keys.
