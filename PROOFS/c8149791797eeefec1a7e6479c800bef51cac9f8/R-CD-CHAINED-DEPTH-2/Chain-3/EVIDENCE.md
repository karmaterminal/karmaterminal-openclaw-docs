# R-CD-CHAINED-DEPTH-2 Chain-3 — fanoutMode=tree echo-broadcast (depth-2) — ronan-dgx, SHIP-SHA `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (deployed, pid `1333838`) | **Verdict: ✅ PASS**
Re-fire. Depth-1 (normal) → spawns depth-2 (silent, fanoutMode=tree) → broadcasts return to EVERY ancestor. Parent trace `764bf7aa`.
## Byte (`journal_chain.log`, pid 1333838)
- depth-1 fired depth-2 → `[continuation:delegate-spawned] hop=1/200 mode=silent session=…continuation-d7a82514…` 02:03:18 → `R-CD-CHAIN-3-DEPTH-2 PROOF` 02:03:22 → **`[continuation:targeted-return] Delivered to …continuation-d7a8251407…,agent:main:discord:channel:1466192485440164011 from …continuation-519f587f…`** 02:03:22.640 — MULTI-ANCESTOR tree-broadcast (delivered to both the depth-1 parent AND the root channel; `fanoutMode=tree` routes to ALL ancestor keys).
**Verdict: ✅ PASS** — depth-2 fanoutMode=tree echo-broadcast (multi-ancestor delivery) on `c8149791797`.
