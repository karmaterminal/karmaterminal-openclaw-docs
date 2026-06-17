# R-OBS-1 — operator `/status` surface: 6-prince external-observer continuation-row cross-walk on ship-tip `8cafdcd`

**Owner:** 🌻 Elliott (elliott-legion seat) + figs external-observer fan-out
**Captured:** 2026-06-17 ~00:12 PDT — figs (external operator) posted the 6-prince `/status` cards to `#sprites-of-thornfield` (`message_id 1516701994155249805`)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (`OpenClaw 2026.6.8 (8cafdcd)`) — the post-FF ship-tip
**Raw cards:** `raw_status_cards_6prince.txt` · **Writeup:** `chat_card_visibility_external_observer.md` · **Per-seat snapshots:** `status_snapshot_8cafdcd_{elliott,silas,cael,ronan,emeric,rune}.txt`

## Behavior proven
The continuation feature exposes an operator status-surface (`🔄 Continuation: chain N/200`) that must render in the external `/status` card on the deployed runtime. R-OBS-1 is the canonical operator-status-surface row: it certifies (a) the fleet is uniformly running the candidate bytes (build string `(8cafdcd)` == deployed tip on all 6 seats), and (b) the continuation banner renders correctly post-deploy (chain/compactions/context all present and well-formed) — verified by an **external party (figs)**, not self-reported by each seat.

## SHA-convergence — ALL 6 on the FF'd ship-tip `8cafdcd` ✅
| Seat | Runtime (from `/status`) | Model | Continuation row | On `8cafdcd`? |
|---|---|---|---|---|
| 🌻 Elliott | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.8 | `chain 0/200` ✅ | ✅ |
| 🌫 Silas | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.6 (fallback live) | `chain 0/200` ✅ | ✅ |
| 🩸 Cael | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.8 | `chain 0/200` ✅ | ✅ |
| 🌊 Ronan | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.8 | `chain 0/200` ✅ | ✅ |
| 🕯 Emeric | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.8 | `chain 0/200` ✅ | ✅ |
| 🪨 Rune | `OpenClaw 2026.6.8 (8cafdcd)` | opus-4.8 | `chain 0/200` ✅ | ✅ |

**6/6 fleet converged on `8cafdcd`** — externally observed via figs's `/status` cross-walk. The `Continuation: chain N/200` line (the continuation feature's status-surface) renders fleet-wide on the deployed ship bytes.

## Live continuation-activity captured in the cards (robustness on top of the static render)
- **🕯 Emeric** — Tasks row: `[continuation:chain-hop:1] Delegated task (turn 1/200): PROOF-FIRE (R-CW-DELEGA…` — his R-CW-DELEGATE continuation proof-fire is VISIBLE in the live `/status` card (chain-hop subagent task), externally observed at capture-time.
- **🌻 Elliott** — Tasks row carries the continuation/restart task (`[System] Your previous turn was interrupted by a gateway restart…`).

So the cards capture not just the static continuation-row but **live continuation-chain activity** at observation-time.

## Cross-arch corroboration
The 6 seats span 2 vendors + 2 ISAs on the one deployed tip: x86_64 (elliott-legion AMD, silas Intel, emeric-nuc Intel, rune-rog-ally AMD) + arm64 (cael-dgx, ronan-dgx, both DGX Spark GB10). Identical continuation-banner render across x86 AND arm = arch-independent on `8cafdcd`, not a one-box/one-arch artifact.

## HONEST CAVEAT — per-seat context %s are point-in-time snapshots with skew (NOT live state)
The cards show `📚 Context: N/1.0m (P%)`. **These %s are transient snapshot readings, not current**, and must NOT be read as live state. Two byte-confirmed skew sources:
1. **Cache-weighting:** the card `(P%)` is cache-INCLUSIVE. The compaction-guard measures the ACTUAL window. (🪨 Rune earlier this cycle: card `90%` but `895k` cached → guard's real usage `23%`.) Card-% ≠ guard-%.
2. **Snapshot-lag:** seats compact between snapshot + read. (🩸 Cael: this snapshot read `83%`/7-compactions; his live byte shortly after was `27%`/8-compactions — compacted since the snapshot.)

**The DURABLE R-OBS-1 byte is the uniform ship-SHA `8cafdcd` + the continuation-row rendering + continuation-live across all 6 — NOT the per-seat %s.** Same `card-%-vs-guard-%` family as the inventory-vs-runtime-divergence: gate on the runtime/guard byte, not the display %.

## Verdict: ✅ PASS ship-current — CANONICAL OPERATOR-SURFACE BAR MET
External `/status` cross-walk (figs-observed) confirms on `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`: (a) 6/6 fleet converged on the FF'd ship-tip, (b) the continuation status-row renders in the `/status` card on every seat, (c) live continuation-chain activity (Emeric's R-CW-DELEGATE chain-hop) visible in the cards, (d) cross-arch (x86 ×4 + arm64 ×2) identical render. The continuation feature's external operator-status-surface is live on the shipped bytes, fleet-wide.

> **Scope note:** R-OBS-1 is the operator-status-surface row (session_status/`/status` render verification). The OTel/Tempo span-emission observability surface is R-OBS-2 (🪨 Rune). This row certifies the status-card renders the candidate bytes; the span-landing certification is R-OBS-2's lane.

## HONEST-LIMIT (byte-honest scope of this filing, vs the `077b261d` exemplar standard)
**What this row PROVES (filed):** the external-observer 6-prince `/status` fan-out (figs-driven) with full continuation-substrate render + SHA-convergence + live chain-activity + cross-arch, on `8cafdcd`. ✅
**What this filing carried as PARTIAL until now:** the exemplar's R-OBS-1 (`077b261d`) additionally carries per-seat `crosswalk.md` files + `seatside_card_*.txt` (the seat-side self-report half, complementing the external-observer half) + an explicit `EVIDENCE.md` canonical doc. This `8cafdcd` filing had the writeup + raw cards + 6 `status_snapshot_*.txt` but **lacked this EVIDENCE.md and the seat-side/crosswalk breakout** — filed but not exemplar-complete. This EVIDENCE.md closes the canonical-doc gap; the seat-side `crosswalk.md`/`seatside_card` dual-capture remains an optional robustness-add (the external-observer fan-out alone meets the canonical R-OBS-1 bar, as it did on `077b261d`).

_Captured by 🌻 Elliott from figs's external-observer `/status` fan-out on the deployed fleet (`OpenClaw 2026.6.8 (8cafdcd)`). This EVIDENCE.md added 2026-06-17 ~01:30 PDT to bring the row to the `077b261d` exemplar canonical-doc standard, after byte-walking the corpus and owning that the prior "full exemplar shape" cosign was overstated — the row was filed but missing this canonical doc._
