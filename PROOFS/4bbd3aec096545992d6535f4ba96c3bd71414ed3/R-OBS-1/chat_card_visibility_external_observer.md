# R-OBS-1 — External `/status` Continuation Row Capture (6-Prince Cross-Walk Aggregate)

**Row:** R-OBS-1 — external `/status` continuation-surface visibility across the 6-prince cohort.
**Owner:** 🌻 Elliott (`elliott-legion`) — canonical per `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`.
**CANDIDATE_SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · OpenClaw `2026.6.2` · prefix `4bbd3ae`
**Status:** ✅ **COMPLETE — 6/6 arms PASS.**

## Method

The continuation substrate renders a `🔄 Continuation: chain X/200[ | volitional: N]` line on each
prince's `/status` chat-card. Its presence proves the continuation-feature substrate loaded cleanly on
that seat. Canonical PASS-shape is the external-observer render (figs's Discord client → 6 simultaneous
cards); the cohort-gathered per-seat `card.md` slices banded under `R-OBS-1/<seat-name>/` are the valid
fallback this aggregate assembles — all 6 now in.

## 6-prince cross-walk verdict table — ✅ 6/6 COMPLETE

| Prince | Seat | Build | Continuation line | Compactions | volitional seg | Arm |
|---|---|---|---|---|---|---|
| 🌻 Elliott | elliott-legion | `2026.6.2 (4bbd3ae)` | `chain 0/200` | 0 | absent (omit-at-zero) | ✅ PASS |
| 🌫 Silas | silas-lothric | `2026.6.2 (4bbd3ae)` | `chain 3/200` | 0 | absent (omit-at-zero) | ✅ PASS |
| 🕯 Emeric | emeric-nuc | `2026.6.2 (4bbd3ae)` | `chain 4/200` | 0 | absent (omit-at-zero) | ✅ PASS |
| 🪨 Rune | rune-rog-ally | `2026.6.2 (4bbd3ae)` | `chain 1/200` | 0 | absent (omit-at-zero) | ✅ PASS |
| 🩸 Cael | cael-dgx | `2026.6.2 (4bbd3ae)` | `chain 6/200` | 0 | absent (omit-at-zero) | ✅ PASS |
| 🌊 Ronan | ronan-dgx | `2026.6.2 (4bbd3ae)` | `chain 6/200` | 0 | absent (omit-at-zero) | ✅ PASS |

**All 6/6 prince-seats reporting: continuation-line present, build=target, compactions=0, volitional omit-at-zero. Cross-walk COMPLETE.**

## Invariants — all satisfied

- ✅ Build SHA matches CANDIDATE_SHA prefix `4bbd3ae` on all 6 seats
- ✅ `🔄 Continuation: chain X/200` line **present** on every card (substrate loaded clean cohort-wide)
- ✅ Chain counters non-negative, under 200 cap (0/0/1/3/4/6/6 across seats; non-zero seats fired real continuation-hops this session = live counting)
- ✅ Compactions = 0 on all 6 seats
- ✅ **VOLITIONAL FIELD-SHAPE — RESOLVED at byte (omit-at-zero by design, NOT a regression):**
  The `| volitional: N` segment present on the `e90a870`/2026.5.17 exemplar is **absent** on `4bbd3ae`/2026.6.2.
  First surfaced on elliott-legion (`1514236935`); byte-resolved by Rune + Ronan: `status-message.ts:79`
  ("volitional is omitted when zero") + `:117-118` `if (volitional > 0) parts.push(...)` — the segment renders
  **only when count>0**. All 6 seats have volitional=0 → segment correctly absent. The surface is intact
  (count still computed via `getVolitionalCompactionCount` at `:103`). Corrected invariant: **"volitional
  segment present iff count>0"**; the `e90a870` exemplar rendering `volitional: 0` was the anomaly. Corroborated
  6/6. NOT a deploy display-removal — omit-at-zero by design.
- ✅ **CROSS-WALK-COMPLETENESS (N=6):** all 6 prince-seats reporting — never a partial-drop. This invariant
  is SATISFIED (6/6). This is THIS row's own corpus-completeness property (#3 below) — a SEPARATE invariant from
  the cfc-referent (everyone agrees the seat-cross-walk is not cfc); it is the #3 green leg of the gate's all-candidates-green close.

## `compactionFailureContext` "0/5 never 4" referent — REFERENT-LABEL UNPROVABLE, NON-BLOCKING (all candidates PASS)

For the record, since this aggregate's N=6 was earlier conflated with this referent: **the seat-cross-walk N=6 is NOT the
referent** (it's #3, this row's own property). Frond's harness-shorthand maps to multiple candidate surfaces; she cannot byte-prove
which, and it does NOT block — every candidate surface PASSES on `4bbd3ae` (detail below).

→ **FROND'S HONEST CLOSE — REFERENT-LABEL UNPROVABLE, DOES NOT BLOCK (frond-scribe `1514248116`, retracting BOTH the interim (c) AND the later (a) pins).**
Frond re-opened her own `1514244157` (a) pin and re-settled honestly: she **cannot byte-prove** which surface her
"0/5 never 4" harness-shorthand names — it maps to (at least) TWO distinct code-grounded candidate surfaces, and Emeric's
byte confirmed surface #1 *exists* as a `{0,5}` invariant but did NOT confirm the *label points at #1* vs #2 (same
shape-matched story-pin that bit the (c) reading). Frond's words: "not (a), not (c) — 'all candidates green, referent-label
is figs's.'" The label→referent map is **figs's harness-shorthand to confirm at his discretion; it does NOT block the gate.**

The two live candidate surfaces (the third, seat-cross-walk, is THIS row's R-OBS-1 N=6 — separate, everyone agrees it's not cfc):
- **#1 continuation-tool-registration count** (`openclaw-tools.ts:634` "only continue_delegate will register") — `{0,5}`, seat-independent;
  5 = cw+cd+rc all register, 4 = the half-symmetric partial-drop (#917/#918/#920), 0 = clean Form-B. Canon-grounded #868/#79925/#85651.
- **#2 volitional-compaction surface** (`getVolitionalCompactionCount`, threaded in-dist at `:103`) — the surface this row's `| volitional`
  display-delta (above) touches: omit-at-zero by design, reads 0 = clean.
- (Earlier-eliminated, NOT the referent: delegate-dispatch `queuedDelegates` — DISPROVEN, `post-compaction-delegate-dispatch.test.ts:634`
  asserts `{queuedDelegates: 4}` VALID, so 4 is legal → can't host a "never-4" invariant; `maxDelegatesPerTurn`=5 config-constant; `compactionFailureContext` literal greps to 0.)

**THE BYTE-DEFENSIBLE CLOSE — the gate clears under ALL readings; the deployed `4bbd3ae` binary carries NO continuation-regression on any candidate surface:**
- **#1 tool-registration PASS** ✅ — 🌊's R-CW-DELEGATE-SELF 6/6 full-tool-set registration = the check passing (5, not 4); Emeric's
  `R-CONTINUATION-TOOL-REGISTRATION` row (`3e6decd`) confirms (misconfig-warn 12/12 + all 3 families register, none drop).
- **#2 volitional-surface PASS** ✅ — `getVolitionalCompactionCount` intact + threaded in-dist; omit-at-zero by design; reads 0 = clean
  (this row's `| volitional` finding corroborates it: the `e90a870` `volitional: 0` render was the omit-at-zero anomaly, NOT a deploy removal; corroborated 6/6).
- **#3 R-OBS-1 cross-walk PASS** ✅ — 6/6 prince-seats file /status cards, never a partial drop (THIS row's own corpus-completeness property).

**R-OBS-1's cross-walk-completeness N=6 is the SEPARATE invariant (#3 above), NOT the cfc-referent** — distinct layers, both real. The cfc
label is figs's-to-pin and non-blocking; this row contributes the #3 green leg + the #2-corroborating display finding. Aligned to frond's honest
close at `f2101d7` (emeric-nuc's parallel re-alignment).

Referent history (frond's pin evolved ~6×; I deferred + never stamped any reading as my own claim, correctly — each interim was
superseded, INCLUDING frond's own (a) FINAL): my `{0,6}` seat-count (retracted) → `queuedDelegates` (frond pin, byte-disproven `:634`) →
cross-walk-completeness (frond interim) → tool-registration (frond `1514240649`) → (c) delegate-staging (frond `1514243060`,
byte-disproven `:634`) → (a) tool-registration FINAL (frond `1514244157`) → **HONEST CLOSE: referent-unprovable, all-candidates-green, figs's-shorthand, non-blocking (frond `1514248116`)** ✅.
Lesson held end-to-end: verify the LATEST authority message; surface byte-conflicts only per the authority's explicit invitation; never stamp; byte > pin > story — frond modeled it on her own pins, twice.

## Reading-A (cohort-wide, content-closed)
All 6 seats dist-loading daemons (`node dist/index.js`); reading-A closed via three strands, AIRTIGHT on the content leg:
- **AIRTIGHT — code-content-closure** (the bytes-attestation): target-only symbols compiled INTO dist chunks, absent at source `9b1f42a`
  → the compiled output contains target-only code = built-from-target (Emeric's symbol-in-chunk; my negative complement: zero `9b1f42a` bytes in dist).
- **STRONG corroboration — build-stamp** (`.buildstamp.head`/`build-info.json.commit`): `scripts/write-build-info.ts` → `git rev-parse HEAD` at
  build-time, frozen-in-dist. Records build-time-HEAD-**checkout** (rules out stale-dist; mtime < restart = build-time not runtime), NOT a
  hash of the compiled bytes — so it is strong frozen-HEAD corroboration, NOT the airtight closer (a build at target compiling stale bytes would
  still record target-HEAD). Cohort retracted the earlier "`.buildstamp` attests-own-build-commit airtight" overclaim; content-closure is the load-bearer.
- **Circumstantial — ordering**: restart postdates dist-build.
No tree-shape seat (uniform repo-tree dist, not node_modules). Detail carried in prior aggregate revisions + per-seat EVIDENCE files.

**FINAL VERDICT: R-OBS-1 ✅ PASS, 6/6 cross-walk complete on deployed `4bbd3aec096`.**
