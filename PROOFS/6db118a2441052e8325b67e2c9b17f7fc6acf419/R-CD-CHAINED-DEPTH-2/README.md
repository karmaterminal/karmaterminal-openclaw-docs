# R-CD-CHAINED-DEPTH-2: Depth-2 Chained Delegation

SHA: `b4ce9883591904361c91d55d5f3ddb31125080cf` (rebased `6db118a2` onto upstream/main)
Date: 2026-05-12 ~17:36-17:38 PDT
Fired from: silas-seat (urudyne WSL2, canary host)

Three test-shapes fired as depth-2 chained `continue_delegate` calls:

| Test | Shape | Verdict |
|------|-------|---------|
| 1 | root → cd() → cd() (depth 2) → return flow up tree (fanoutMode=tree, silent-wake) | ✓ PASS |
| 2 | root → cd() → cd() (depth 2) → return inter-session to root | ✓ PASS |
| 3 | root → cd() → cd() (depth 2) → return echo (fanoutMode=tree, mode=normal) | ✓ PASS |

## Substantive substrate at byte

- Chained continue_delegate at depth-2: VERIFIED (3 independent outer-links at chain counters 7, 9, 11)
- Tree-fanout return-up-tree with silent-wake: VERIFIED (TEST 1)
- Inter-session cross-session-return to root: VERIFIED (TEST 2 — inner leaf at depth 2/5 returned to root session)
- fanoutMode=tree + mode=normal echo-to-ancestors: VERIFIED (TEST 3)
- Chain counter tracking across hops: VERIFIED (monotonic 7→9→11 across 3 test dispatches)
- Depth-bound observable: depth 2/5 captured at inner leaf (maxChainLength=5 from config)

## Receipt files

- `test_1_tree_fanout.txt` — UP-TREE fanout with silent-wake
- `test_2_inter_session.txt` — inter-session cross-session return to root
- `test_3_echo_and_channel_broadcast.txt` — echo/broadcast via tree fanout

## Verdict

Depth-2 chained delegation with all three return-path shapes (UP-TREE, INTER-SESSION, ECHO)
proven at byte on rebased SHA `b4ce988359` (feature-identical to `6db118a2`).
