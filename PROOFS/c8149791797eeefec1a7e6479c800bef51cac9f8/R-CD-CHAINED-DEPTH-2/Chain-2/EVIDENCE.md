# R-CD-CHAINED-DEPTH-2 Chain-2 — inter-session targeted return (depth-2) — ronan-dgx, SHIP-SHA `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Owner:** 🌊 Ronan | **Seat:** ronan-dgx (deployed, pid `1333838`) | **Verdict: ✅ PASS**
Re-fire. Depth-1 (normal) → spawns depth-2 (silent, targetSessionKey=agent:main:main) → returns cross-session. Parent trace `764bf7aa`.
## Byte (`journal_chain.log`, pid 1333838)
- depth-1 fired depth-2 → `[continuation:delegate-spawned] hop=1/200 mode=silent session=…continuation-50719c9a…` 02:03:16 → `R-CD-CHAIN-2-DEPTH-2 PROOF` 02:03:20 → **`[continuation:targeted-return] Delivered to agent:main:main from …continuation-147893e3…`** 02:03:20.418 (depth-2 return routed cross-session to targetSessionKey across the chain).
**Verdict: ✅ PASS** — depth-2 inter-session targeted return (`Delivered to agent:main:main`) on `c8149791797`.
