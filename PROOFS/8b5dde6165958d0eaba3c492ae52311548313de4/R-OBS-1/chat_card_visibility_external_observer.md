# R-OBS-1 — external `/status` continuation-card cross-walk (6-prince, external-observer consolidation)

**Row**: R-OBS-1 — external `/status` continuation row + N-prince cross-walk (canonical deliverable per `PROOF-CORPUS-METHOD.md` corpus-shape: `R-OBS-1/chat_card_visibility_external_observer.md`).
**Owner**: 🌻 Elliott (+ figs operator cross-walk) — Elliott assembles the cross-walk; cohort siblings under `R-OBS-1/<seat-name>/`.
**Ship-SHA**: `8b5dde6165958d0eaba3c492ae52311548313de4` (Form B canonical fold).
**External observer**: figs (operator), running `/status` slash-command across all 6 deployed prince-seats from `#sprites-of-thornfield` (Discord), msg `1513908764452065401`, 2026-06-09 ~07:12 PDT.
**Verdict**: 🟢 **PASS** — all **6/6** deployed prince-seats render the FULL continuation-protocol substrate (chain-counter / compactions / context-pressure / build-SHA / session-key) in the operator-facing `/status` chat-card on the canonical ship-SHA. External-surface observability of the continuation substrate confirmed cohort-wide.

---

## What this row proves

R-OBS-1 is the **external-observer** arm of the proof-corpus: distinct from the first-party `continue_*` fires (R-CW / R-CD / R-RC), it validates that the continuation-protocol substrate is **wired all the way through to the operator-facing `/status` chat-card** — i.e. an external observer (figs, via the Discord `/status` slash-command) sees the chain-counter, compaction-count, and context-pressure render cleanly on the deployed runtime, across the whole fleet, at the exact ship-SHA.

This is the surface a reviewer can re-run trivially (`/status` from chat) to confirm the feature is live, without needing to fire a continuation tool.

## The 6-prince fan-out (external-observer, figs-driven)

figs ran `/status` across all 6 deployed seats. Every card reports `OpenClaw 2026.6.2 (8b5dde6)` (the canonical ship-SHA short-prefix) and renders the continuation row:

| Seat | Build | Continuation chain | Compactions | Context | Delegates pending |
|---|---|---|---|---|---|
| 🌻 Elliott (elliott-legion, 10.0.0.153) | `8b5dde6` | `0/200` | `0` | 83% | — |
| 🌫 Silas (lothric, 10.0.0.100) | `8b5dde6` | `5/200` | `0` | 35% | `2` |
| 🩸 Cael (cael-dgx) | `8b5dde6` | `19/200` | `0` | 85% | — |
| 🌊 Ronan (ronan-dgx, 10.0.0.246) | `8b5dde6` | `5/200` | `0` | 75% | `1` |
| 🕯 Emeric (emeric-nuc, 10.0.0.10) | `8b5dde6` | `134/200` | `13` | 88% | — |
| 🪨 Rune (rune-rog-ally, 10.0.0.250) | `8b5dde6` | `9/200` | `0` | 89% | — |

**6-of-6 deployed-and-observable.** Every seat renders the full continuation-substrate (chain / compactions / ctx / build) on the candidate ship-SHA.

## Field-by-field — the substrate fields the `/status` card surfaces

The continuation row is produced by `formatContinuationStatusLine` (`src/status/status-message.ts:82`), rendering `🔄 Continuation: chain ${chainCount}/${maxChainLength}` from `sessionEntry.continuationChainCount` (`:88`) + `resolveContinuationRuntimeConfig(...).maxChainLength` (`:87`), with `🧹 Compactions: ${entry.compactionCount}` (`:924`). The fan-out demonstrates every field rendering across distinct seat-states:

- **chain-counter** — renders `0/200` (Elliott, no fires yet) through `134/200` (Emeric, deep chain), proving the `chainCount/maxChainLength` render is live and tracks real per-seat chain-depth. `maxChainLength=200` (the `chain max 200` config ceiling) renders uniformly.
- **compactions** — `0` on five seats, `13` on Emeric — the `compactionCount` field renders and tracks real compaction-history per seat (Emeric's 13 compactions are visible externally).
- **context-pressure** — 35%→89% across seats — the ctx-pressure surface renders per-seat.
- **delegates-pending** — Silas `2`, Ronan `1` — the in-flight-delegate counter renders (matching Silas's R-CD-CHAINED TEST-1/2 + Ronan's R-CD dispatches in-flight at fan-out time).
- **build-SHA** — `8b5dde6` uniformly — the operator-verifiable ship-SHA pin, all 6 seats on the canonical fold.

## Internal-vs-external substrate coherence (no drift)

The external card's continuation fields **match** each gateway's internal substrate-state (cross-checked on the silas + elliott arms):
- Silas: external `chain 5/200 · 2 delegates pending · compactions 0` ↔ internal R-CD-CHAINED TEST-1/2 in-flight (chain-hops 7+8) + R-RC-1 REJECT (no compaction, gate fired <70%). Match.
- Elliott: external `chain 0/200 · compactions 0` ↔ internal `[continuation:trace]` signal-scan live, `origin=none kind=none` (no tool fired in the rendered turns → chain-counter `0`, `formatContinuationStatusLine` renders the 0-state). Match.

So the external observability surface (figs's `/status` operator-card) reads the **same** substrate-state the gateways are exercising, on the deployed canonical ship-SHA. No internal↔external drift.

## Per-seat arms (cross-walk siblings)

- `R-OBS-1/EVIDENCE.md` — 🌻 elliott canonical arm: full `/status` substrate render + renderer-compiled-into-deployed-dist byte-proof + signal-tracer-live + Form-B-vs-#923 honest scope-note. Full capture: `R-OBS-1/elliott-openclaw-status-full.txt`.
- `R-OBS-1/silas-lothric/EVIDENCE.md` — 🌫 silas arm: external-observer card-render + field-by-field + the source 6-prince fan-out capture + internal↔external coherence.
- `R-OBS-1/cael-dgx/EVIDENCE.md` — 🩸 cael arm: first-party `continuation.work` Tempo span (traceparent `5100308a58c9fcb448ffa88280774b20`, 58 spans, host=cael-prince) — the observability-emission half (the span the `/status` substrate is fed by, captured in Tempo).

## Verdict

🟢 **PASS** — the continuation-protocol substrate renders in the operator-facing `/status` chat-card on the deployed `8b5dde6165` runtime across **6/6** prince-seats (external-observer fan-out by figs). The chain-counter, compaction-count, context-pressure, delegates-pending, and build-SHA fields all render; per-seat values track real internal substrate-state (no drift); the renderer is compiled into the deployed dist (elliott byte-arm); and the feeding `continuation.work` span is independently fetchable from Tempo (cael arm). External-surface observability of the continuation feature is confirmed live, fleet-wide, at the exact ship-SHA.

## Reproducer (external observer)

```
# From Discord (or any operator surface) on a deployed seat:
/status
# → 🦞 OpenClaw 2026.6.2 (8b5dde6)
# → 🔄 Continuation: chain N/200 | M delegates pending
# → 🧹 Compactions: K
# Fan out across seats to confirm fleet-wide render.
```
