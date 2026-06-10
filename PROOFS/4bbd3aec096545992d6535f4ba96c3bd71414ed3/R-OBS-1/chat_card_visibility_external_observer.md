# R-OBS-1 — External `/status` Continuation Row Capture (6-Prince Cross-Walk Aggregate)

**Row:** R-OBS-1 — external `/status` continuation-surface visibility across the 6-prince cohort.
**Owner:** 🌻 Elliott (`elliott-legion`) — canonical per `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`.
**CANDIDATE_SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · OpenClaw `2026.6.2` · prefix `4bbd3ae`
**Channel:** #sprites-of-thornfield (`1466192485440164011`)
**Status:** AGGREGATING — owner-authored table; per-seat `card.md` slices fold in as each seat fires.

## Method

The continuation substrate renders a `🔄 Continuation: chain X/200[ | volitional: N]` line on each
prince's `/status` chat-card. Its presence on a seat proves the continuation-feature substrate loaded
cleanly there; absence would indicate the substrate didn't load. Canonical PASS-shape is the
**external-observer** render (figs invoking `/status` from the Discord client → 6 simultaneous cards);
the cohort-gathered per-seat `card.md` slices banded under `R-OBS-1/<seat-name>/` are the valid
fallback this aggregate assembles (per runbook per-seat-subdir cross-walk shape).

## 6-prince cross-walk verdict table

| Prince | Seat | Build | Continuation line | Compactions | volitional seg | Card slice | Arm |
|---|---|---|---|---|---|---|---|
| 🌻 Elliott | elliott-legion | `2026.6.2 (4bbd3ae)` | `chain 0/200` | 0 | ABSENT | `elliott-legion/card.md` | ✅ PASS |
| 🌫 Silas | silas-lothric | `2026.6.2 (4bbd3ae)` | `chain 3/200` | 0 | ABSENT | `silas-lothric/card.md` | ✅ PASS |
| 🩸 Cael | cael-dgx | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |
| 🌊 Ronan | ronan-dgx | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |
| 🕯 Emeric | emeric-nuc | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |
| 🪨 Rune | rune-rog-ally | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |

**Cross-walk so far: 2/6 arms PASS (elliott-legion, silas-lothric). 4 pending seat-cards.**

## Invariants

- ✅ Build SHA matches CANDIDATE_SHA prefix `4bbd3ae` (both reporting seats)
- ✅ `🔄 Continuation: chain X/200` line **present** on every reporting card (substrate loaded clean)
- ✅ Chain counters non-negative integers, under 200 cap (elliott 0/200, silas 3/200)
- ✅ Compactions = 0 on both reporting seats
- ⚠️ **FIELD-SHAPE-DELTA FINDING (banked, NOT a fail):** the `| volitional: N` segment present on the
  prior `e90a870`/2026.5.17 exemplar card is **ABSENT** on `4bbd3ae`/2026.6.2. First surfaced on
  elliott-legion (Discord `1514236935`), independently corroborated on silas-lothric. Either the
  volitional display was removed/restructured 2026.5.17→2026.6.2 or it is zero-state-suppressed.
  The exemplar's `volitional: 0` invariant **no longer applies as written** and must be re-derived
  against the 2026.6.2 display. This is a render-surface delta, distinct from the seat-count
  cross-walk-completeness invariant (`compactionFailureContext`, byte-resolved by Rune).
- ⚠️ **SEAT-COUNT INVARIANT (owner spec):** the cross-walk-completeness invariant ("never silently
  drop a seat") is **N=6** for this cohort. A complete verdict requires all 6 prince-seats reporting
  (or a documented substitution). A 5-seat "complete" claim would itself be the silent-drop the
  invariant guards against. Current: 2/6 — NOT YET COMPLETE; aggregating.

## Reading-A note (cohort-wide, residual closed)

All 6 prince-seats are dist-loading daemons (`node dist/index.js`), NOT runs-from-tree — the early
"runs-from-tree" framing was a CLI-entrypoint-vs-daemon-load conflation, corrected cohort-wide
(silas `b72f2cc`, rune `32fce8f`). Reading-A holds uniformly via dist-freshness; the dist-sha-stamp
residual (honestly named by elliott + emeric) is **CLOSED** by Rune's `dist/build-info.json` +
`.buildstamp` content-provenance finding (`96517da`) — dist attests its own build-commit. Reading-A
is ironclad cohort-wide.

## Pending

- 4 seat-cards (cael-dgx, ronan-dgx, emeric-nuc, rune-rog-ally) — fold in as fired; owner updates table.
- Canonical external-observer `/status` render (figs's Discord client) — cleanest PASS-source; requested.
- Final verdict pending 6/6 arms (or documented substitution).
