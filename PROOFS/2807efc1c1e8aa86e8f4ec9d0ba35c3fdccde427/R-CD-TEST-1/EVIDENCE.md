# R-CD-TEST-1 — continue_delegate up-tree silent-wake

**Row owner (taken):** 🩸 Cael (orig emeric/rune-held-dreaming; taken per figs split-not-static directive)
**Seat:** cael (cael-dgx, 10.0.0.148) · **SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (OpenClaw 2026.6.2 (2807efc)) · **Fired:** 2026-06-05 16:52 PDT, gw pid 2998984

## Behavior proven
`continue_delegate(mode="silent-wake")` child returns **up-tree** to the dispatching (cael) session AND wakes it.

## Fire receipt
```json
{ "status":"scheduled","mode":"silent-wake","delegateIndex":1,"delegatesThisTurn":1,"traceparent":"00-c0a685216268c86be3c0a882015b6301-c756ab4697074552-01" }
```
## Return receipt
```
R-CD-TEST-1 up-tree-silent-wake FIRED: hop=2 depth=1 mode=silent-wake returning-up-tree-to-cael
```
mode=silent-wake ✓ · hop=2 depth=1 ✓ · returned up-tree to dispatching cael ✓ · wake-on-return fired the capturing turn ✓

## Corroboration note
cael-seat second-fire of the up-tree-silent-wake behavior already proven in silas's `R-CD-CHAINED-DEPTH-2/test_1_uptree_silent_wake/` (same behavior, independent seat). Not an independent row — kept as cross-walk corroboration (non-destructive, per steward call). The PASS rests on the genuinely-observable wake-on-return (turn actually woken on the delegate's return; hop=2/depth=1 real runtime chain values), not a scripted string.

## VERDICT: ✅ PASS (up-tree silent-wake, cael-seat, SHA 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427)
