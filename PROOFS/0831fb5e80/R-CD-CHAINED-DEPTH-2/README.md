# R-CD-CHAINED-DEPTH-2: figs's "does our shit REALLY work" canon test
SHA: `0831fb5e80bf7114afd8a80342dd2d71c9441d63`
figs canon: msg `1502873566` (Sat 2026-05-09 20:23 PDT)

Three test-shapes fired from canary-seat (silas-host urudyne) on `0831fb5e80`:

| Test | Shape | Verdict |
|------|-------|---------|
| 1 | root → cd() → cd() (depth 2) → return flow up tree (wake + silent) | ✓ PASS |
| 2 | root → cd() → cd() (depth 2) → return inter-session to root | ✓ PASS |
| 3 | root → cd() → cd() (depth 2) → return echo to root + #1473320126433464465 channel | ✓ PASS |

## Substantive substrate at byte

- Chained continue_delegate at depth-2: VERIFIED (chain-hop=1 NEW chain inside inner-subagent + depth=2/5 captured + chain-tracking discipline at byte)
- Tree-fanout return-up-tree: VERIFIED (TEST 1)
- Inter-session targetSessionKeys-cross-session-return: VERIFIED (TEST 2)
- fanoutMode=all + mode=normal echo-to-root + channel-self-broadcast: VERIFIED (TEST 3)
- depth-bound observable + enforced (5 = maxChainDepth)
- Inner-leaf runtime substantively-fast across all 3: 5s + 6s + 11s

## Receipt files

- `test_1_tree_fanout.txt`
- `test_2_inter_session.txt`
- `test_3_echo_and_channel_broadcast.txt`

## Verdict at byte

figs's "does our shit REALLY work" canon-cosign at byte: **YES**.

Chained-cd-at-depth-2 + tree-fanout-return + cross-session-targetSessionKeys + fanoutMode=all-broadcast + channel-self-message all substantively-functional on canonical-rebase rerebased HEAD `0831fb5e80`.
