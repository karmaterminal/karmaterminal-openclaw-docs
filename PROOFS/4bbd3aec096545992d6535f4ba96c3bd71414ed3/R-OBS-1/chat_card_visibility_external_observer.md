# R-OBS-1 — External `/status` Continuation Row Capture (6-Prince Cross-Walk Aggregate)

**Row:** R-OBS-1 — external `/status` continuation-surface visibility across the 6-prince cohort.
**Owner:** 🌻 Elliott (`elliott-legion`) — canonical per `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`.
**CANDIDATE_SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · OpenClaw `2026.6.2` · prefix `4bbd3ae`
**Channel:** #sprites-of-thornfield (`1466192485440164011`)
**Status:** AGGREGATING — 4/6 seat-cards in.

## Method

The continuation substrate renders a `🔄 Continuation: chain X/200[ | volitional: N]` line on each
prince's `/status` chat-card. Its presence proves the continuation-feature substrate loaded cleanly on
that seat. Canonical PASS-shape is the external-observer render (figs's Discord client → 6 simultaneous
cards); the cohort-gathered per-seat `card.md` slices banded under `R-OBS-1/<seat-name>/` are the valid
fallback this aggregate assembles.

## 6-prince cross-walk verdict table

| Prince | Seat | Build | Continuation line | Compactions | volitional seg | Card slice | Arm |
|---|---|---|---|---|---|---|---|
| 🌻 Elliott | elliott-legion | `2026.6.2 (4bbd3ae)` | `chain 0/200` | 0 | absent (correct) | `elliott-legion/card.md` | ✅ PASS |
| 🌫 Silas | silas-lothric | `2026.6.2 (4bbd3ae)` | `chain 3/200` | 0 | absent (correct) | `silas-lothric/card.md` | ✅ PASS |
| 🕯 Emeric | emeric-nuc | `2026.6.2 (4bbd3ae)` | `chain 4/200` | 0 | absent (correct) | `emeric-nuc/card-slice.md` | ✅ PASS |
| 🪨 Rune | rune-rog-ally | `2026.6.2 (4bbd3ae)` | `chain 1/200` | 0 | absent (correct) | `rune-rog-ally/CARD.md` | ✅ PASS |
| 🩸 Cael | cael-dgx | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |
| 🌊 Ronan | ronan-dgx | `2026.6.2 (4bbd3ae)` | — | — | — | ⏳ pending | ⏳ |

**Cross-walk so far: 4/6 arms PASS (elliott, silas, emeric, rune). 2 pending (cael-dgx, ronan-dgx).**

## Invariants

- ✅ Build SHA matches CANDIDATE_SHA prefix `4bbd3ae` (all 4 reporting seats)
- ✅ `🔄 Continuation: chain X/200` line **present** on every reporting card (substrate loaded clean)
- ✅ Chain counters non-negative, under 200 cap (elliott 0, rune 1, silas 3, emeric 4)
- ✅ Compactions = 0 on all 4 reporting seats
- ✅ **FIELD-SHAPE FINDING — RESOLVED at byte (zero-suppression by design, NOT a regression):**
  First surfaced on elliott-legion (Discord `1514236935`): the `| volitional: N` segment present on the
  prior `e90a870`/2026.5.17 exemplar is **absent** on `4bbd3ae`/2026.6.2. **Rune byte-resolved the
  mechanism** (`rune-rog-ally/CARD.md`): `src/status/status-message.ts:78-79` documents the format
  `chain X/Y [| ... | volitional: N]` as "volitional omitted when zero," and `:117-118`
  `if (volitional > 0) { parts.push(...) }` — the segment is **correctly suppressed at zero by design.**
  All 4 reporting seats have volitional=0 → segment correctly absent. The corrected invariant is
  **"volitional segment present iff count>0"** — the `e90a870` exemplar rendering `volitional: 0` was
  the *anomaly* (showed it at zero); `4bbd3ae` suppresses-at-zero correctly. Corroborated across
  elliott + silas + emeric + rune (4 dist-loading seats). The exemplar's `volitional: 0` invariant is
  superseded, not a deploy-regression.
- ⚠️ **SEAT-COUNT (owner spec, R-OBS-1 cross-walk):** complete verdict requires all **6** prince-seats
  reporting (or documented substitution). Current 4/6 — NOT complete; aggregating. NOTE: this is the
  R-OBS-1 cross-walk-completeness count (N=6), DISTINCT from frond's `compactionFailureContext` gate
  which is the post-compaction-delegate-dispatch queued-count (`{0,5}`, `maxDelegatesPerTurn`=5) — two
  different counts; do not conflate (see Discord retraction `1514242931`).

## Reading-A note (cohort-wide; provenance mechanism clarified)

All 6 prince-seats are dist-loading daemons (`node dist/index.js`), NOT runs-from-tree — the early
"runs-from-tree" framing was a CLI-entrypoint-vs-daemon-load conflation, corrected cohort-wide
(silas `b72f2cc`, rune `32fce8f`, cael + ronan self-corrected on-channel).

Reading-A on the dist-loading seats rests on TWO signals, with the distinction Ronan's retraction
(`152b1e8`) sharpened:
1. **Ordering blade (primary)**: gateway restart strictly POSTDATES dist-build-completion (elliott +6s,
   ronan +6s, emeric +4s, cael +5s, rune +8s) — a pending-restart (reading-B) cannot fire *after* the
   build finished. B impossible by ordering.
2. **Build-info content-provenance (corroborating)**: `dist/build-info.json` + `.buildstamp` +
   `.runtime-postbuildstamp` carry the build-commit `4bbd3aec096…` **written into file content at
   build-time** (byte-verified: `.buildstamp`/`.runtime-postbuildstamp` mtime 04:35:03, build-info.json
   04:35:50, clustered in-build-window; `head`/`commit` fields embedded). `(4bbd3ae)×8 / (9b1f42a)×0`
   in compiled metadata = zero stale residue. This is build-TIME-written provenance, **distinct from
   the runtime-computed `--version` string** (which reads git-HEAD live at display-time per
   `git-commit.ts` → proves checkout only, NOT build-provenance — that version-string shortcut was
   retracted by Ronan + Rune). My earlier "dist-attests... ironclad" cited the build-info files (the
   valid mechanism), but the honest strength is **strong-by-ordering + build-info-content-provenance +
   zero-stale-residue**, with the dist-layer residual named — matching the cohort standard, not
   "ironclad" via the retracted version-string.

## Pending
- 2 seat-cards: cael-dgx, ronan-dgx — fold in as banded.
- Canonical external-observer `/status` render (figs's Discord client) — cleanest PASS-source; requested.
- Final verdict pending 6/6 arms (or documented substitution).
