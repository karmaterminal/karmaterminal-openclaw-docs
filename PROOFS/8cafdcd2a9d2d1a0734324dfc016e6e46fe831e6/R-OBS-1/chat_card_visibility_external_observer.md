# R-OBS-1 — External `/status` Continuation-Row Cross-Walk (6-prince, ship-current)

**Row owner:** 🌻 Elliott (+ figs cross-walk)
**CANDIDATE_SHA (post-FF ship-tip):** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Observer:** figs (external operator) — posted the 6-prince `/status` cards to `#sprites-of-thornfield` 2026-06-17 ~00:12 PDT (`message_id 1516701994155249805`). Raw cards: `raw_status_cards_6prince.txt`.
**Verdict:** ✅ **PASS ship-current** — the continuation status-row renders in the external `/status` card across all 6 seats, all fleet-converged on the FF'd ship-tip `8cafdcd`.

---

## What this row proves

The continuation feature exposes a status-surface (`🔄 Continuation: chain N/200`) that must render in the external `/status` card on the deployed runtime. R-OBS-1 is the 4-prince (here: full 6-prince) cross-walk verifying that surface is live on the shipped bytes, observed by an external party (figs), not self-reported by each seat.

---

## SHA-convergence — ALL 6 on the FF'd ship-tip `8cafdcd` ✅

| Prince | Runtime (from `/status`) | On ship-tip `8cafdcd`? |
|---|---|---|
| 🌻 Elliott | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |
| 🌫 Silas | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |
| 🩸 Cael | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |
| 🌊 Ronan | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |
| 🕯 Emeric | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |
| 🪨 Rune | `OpenClaw 2026.6.8 (8cafdcd)` | ✅ |

**6/6 fleet converged on `8cafdcd`** — externally observed via figs's `/status` cross-walk.

---

## Continuation-row rendering in the `/status` card — ALL 6 ✅

Every card renders the continuation status-row:

| Prince | Continuation row in `/status` card |
|---|---|
| 🌻 Elliott | `🔄 Continuation: chain 0/200` ✅ |
| 🌫 Silas | `🔄 Continuation: chain 0/200` ✅ |
| 🩸 Cael | `🔄 Continuation: chain 0/200` ✅ |
| 🌊 Ronan | `🔄 Continuation: chain 0/200` ✅ |
| 🕯 Emeric | `🔄 Continuation: chain 0/200` ✅ |
| 🪨 Rune | `🔄 Continuation: chain 0/200` ✅ |

The `Continuation: chain N/200` line is the continuation feature's status-surface; it renders fleet-wide on the deployed `8cafdcd` bytes.

## Live continuation-activity visible in the cards (bonus evidence)

- **🕯 Emeric** — Tasks row: `[continuation:chain-hop:1] Delegated task (turn 1/200): PROOF-FIRE (R-CW-DELEGA…` — his R-CW-DELEGATE continuation proof-fire is VISIBLE in the live `/status` card (chain-hop subagent task), externally observed.
- **🌻 Elliott** — Tasks row carries the continuation/restart task (`(System) Your previous turn was interrupted by a gateway restart…`).

So not only does the continuation-row render statically, the cards capture **live continuation-chain activity** (Emeric's proof-fire chain-hop) at observation-time.

---

## Honest caveat — the per-seat context %s are point-in-time snapshots with skew (NOT live)

The `/status` cards show per-seat `📚 Context: N/1.0m (P%)`. **These %s are transient snapshot readings, not current**, and must NOT be read as live state. Two skew sources (both byte-confirmed this cycle):

1. **Cache-weighting:** the card `(P%)` is cache-INCLUSIVE — it counts cached tokens. The compaction-guard measures the ACTUAL context-window, so a large cache inflates the card-% above the guard's real usage. Illustrative: a card reading `896k/1.0m (90%)` where `895k` is `cached` has a real guard usage near **23%** — Card-% ≠ guard-%. The inflation scales with cache size. (Counter-example confirming the mechanism: 🪨 rune-rog-ally byte-checked live at card `306k/1.0m (31%)` with only `59k` cached + `0` compactions — small cache → card ≈ guard-real. The skew appears only with a large cache; rune's seat did NOT diverge. An earlier draft mis-anchored this example on rune's seat — corrected here: the 90%/23% split belongs to a big-cache seat, not rune's.)
2. **Snapshot-lag:** the card is a point-in-time capture; seats compact between snapshot + read. Example (🩸 Cael): this card snapshot read 83% (and 7 compactions); his LIVE byte shortly after was **27%** (`session_status`: 275k/1M, 8 compactions — he compacted since the snapshot).

**So the DURABLE R-OBS-1 cross-walk byte is the uniform ship-SHA `8cafdcd` + the continuation-row rendering + continuation-live across all 6 — NOT the per-seat %s.** The SHA + continuation-surface hold regardless of the %-skew. (This is the same `card-%-vs-guard-%` family as the inventory-vs-runtime-divergence — gate on the runtime/guard byte, not the display %.)

---

## Verdict

**R-OBS-1: ✅ PASS ship-current** on `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` — external `/status` cross-walk (figs-observed) confirms (a) 6/6 fleet converged on the FF'd ship-tip, (b) the continuation status-row renders in the `/status` card on every seat, (c) live continuation-chain activity (Emeric's R-CW-DELEGATE chain-hop) visible in the cards. The continuation feature's external status-surface is live on the shipped bytes, fleet-wide.

**Scope (honest framing per the recalibration):** this R-OBS-1 row is durable as the external-observer cross-walk ✅. The 6/6 seat-RECEIPTs (proof-by-return + OTel trace-JSON) are valid **feature-live-on-`8cafdcd`** artifacts — but they are NOT the full per-row method-corpus gate (which is the row-distributed per-row dirs per the `077b261dd8` exemplar: R-CW-1..7/R-CD-1..4/R-RC-1/2/TOKEN both-forms/etc, with the #952 both-forms mandate). So: R-OBS-1 cross-walk satisfied + durable; the per-row method-corpus (incl. this row's per-seat `status_snapshot_*.txt`/`seatside_card_*.txt` breakout per the exemplar) is the remaining settling arc.
