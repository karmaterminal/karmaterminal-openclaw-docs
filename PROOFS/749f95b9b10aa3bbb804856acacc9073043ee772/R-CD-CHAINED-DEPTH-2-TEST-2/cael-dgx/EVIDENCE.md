# R-CD-CHAINED-DEPTH-2-TEST-2 — cael-dgx (cross-seat assist) — SHA `749f95b9b10`

**Seat:** cael-dgx (DGX Spark GB10, ARM64) — cross-seat assist for 🪨 Rune's lane (substitution-seat for the TEST-2 leg) per figs's split-not-lock directive. Canonical owner: 🪨 Rune; live-fire on cael-dgx unblocked aarch64.
**Date:** 2026-06-21 ~13:23 PDT
**Result:** ✅ **PASS** — up-tree silent-wake from a depth-2 chain: depth-1 silent-wake delegate dispatches a depth-2 grandchild, the grandchild EXECUTES, the chain returns up-tree.

## The byte (firsthand, live)
- depth-1 delegate: `agent:main:subagent:continuation-41abd708813f01281c5e10a116fc770d`, traceparent `4bb0dad088003150974a8ea931ed065d`
- depth-2 grandchild: `agent:main:subagent:continuation-00c7fe73b82a0072559f2ef1033ec56a`

Markers (both landed):
- depth-1: `RCD-DEPTH2-TEST2-DEPTH1-cael-dgx-749f95b 2026-06-21T20:23:12Z`
- **depth-2 grandchild: `RCD-DEPTH2-TEST2-DEPTH2-GRANDCHILD-cael-dgx-749f95b 2026-06-21T20:23:31Z`** — the grandchild EXECUTED its marker-turn.

The up-tree return chain (journal):
```
13:23:27 [delegate-spawned] hop=1/200 mode=silent-wake session=...41abd708 (depth-1 dispatches depth-2)
13:23:38 [enrichment-return] Delivered to ...41abd708 from ...00c7fe73   ← grandchild returns up-tree to depth-1
13:23:39 [enrichment-return] Delivered to ...discord:channel from ...41abd708   ← depth-1 returns up-tree to root
```
So the chain returned up-tree through the silent-wake mechanism (grandchild → depth-1 → root), the TEST-2 distinguishing behavior.

## The flat-key byte (independently confirms 🕯's d73594e finding firsthand)
The depth-2 grandchild key is **FLAT single-subagent**: `agent:main:subagent:continuation-00c7fe73...` (ONE `:subagent:`, `getSubagentDepth=1`) — NOT double-nested `…:subagent:…:subagent:…`. Because `deriveContinuationDelegateChildSessionKey` uses `parsed.agentId` (=`main`), not the nested parent key (`subagent-continuation-ids.ts:12`). **So the depth-2 grandchild is KEY-IDENTICAL to a depth-1 child** → same clause-2 recognition → same `:740` direct-run → same `:256` exemption → drives exactly like depth-1. There is no structural depth-2 seam: at the key/routing level there is no depth-2; it's another depth-1. (🕯 found this on emeric-nuc `d73594e`; confirmed here firsthand on cael-dgx — the grandchild key `00c7fe73` is flat.)

## What it proves
Up-tree silent-wake chain (TEST-2): a depth-1 silent-wake delegate dispatches a depth-2 grandchild; the grandchild executes (drives its marker-turn, flat depth-1-shaped key, subagent-exempt); the chain returns up-tree through the silent-wake mechanism. The depth-2 grandchild executes like depth-1 (key-identical), confirming the #1057 resolution (no depth-boundary, subagent-exempt at the flat key).

## Provenance
Owner-credit: 🪨 Rune; live-fire-execution: 🩸 cael-dgx (per figs split-not-lock; Rune's lane was parked on the stale HOLD, cael-dgx assisted the live-fireable rows).

## Artifacts
- `depth1.txt` / `depth2-grandchild.txt` — the chain markers
- `trace-4bb0dad0.json` — Tempo trace
