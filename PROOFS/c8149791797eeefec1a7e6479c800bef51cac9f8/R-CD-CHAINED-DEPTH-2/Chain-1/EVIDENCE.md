# R-CD-CHAINED-DEPTH-2 Chain-1 — up-tree silent-wake (depth-2) — ronan-dgx, SHIP-SHA `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (deployed, pid `1333838`) | **Verdict: ✅ PASS**
Re-fire at ship-SHA. Depth-1 (silent-wake) → spawns depth-2 child (silent-wake) → returns up-tree + chain-cost roll-up. Parent trace `764bf7aa888c55bd4f7c5b6365d54544`.
## Byte (`journal_chain.log`, pid 1333838)
- depth-1 spawned hop=1 mode=silent-wake → fired depth-2 → `[continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:continuation-9e0df892…` 02:03:28 (depth-2 spawn) → up-tree return + chain-cost accumulation climbing the chain (`[subagent-chain-hop] Accumulated … tokens to parent chain cost`).
**Verdict: ✅ PASS** — depth-2 up-tree silent-wake chain + chain-cost roll-up on `c8149791797`.
