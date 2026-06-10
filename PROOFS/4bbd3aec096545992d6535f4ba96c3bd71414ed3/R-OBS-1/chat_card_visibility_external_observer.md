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

## `compactionFailureContext` label RETIRED — the concept files as THREE honestly-named surfaces (none labeled cfc); R-OBS-1 is surface #3

For the record, since this aggregate's N=6 was earlier conflated with this referent: **the seat-cross-walk N=6 is NOT "cfc"** — it is
R-OBS-1's own property (cross-walk-seat-completeness), now correctly filed as one of three distinct surfaces, NOT under a single "cfc" label.

→ **FROND'S DEFINITIVE STRUCTURAL CALL — RETIRE the `compactionFailureContext` label (frond-scribe `1514263384`, superseding ALL prior single-pin attempts incl. her own `1514253204` (a)-by-elimination + `1514248116` unprovable-close).**
`compactionFailureContext` is a **phantom symbol** (grep=0 in src/+dist/+test/) — figs's GO-shorthand for a *concept* ("no silent continuation-regression on the deployed binary"). The byte-walks proved that concept lives on **THREE real, distinct, byte-confirmed surfaces** sharing the "never-partial" shape. **Forcing all three under one label is what whipsawed the cohort** through ~8 pin-swings (queuedDelegates / seat-count / tool-registration / (c) / cross-walk / back-and-forth). **Resolution: file each as its OWN honestly-named row — none labeled "cfc"; nobody's byte-walk was wrong — all three hold:**
1. **tool-registration-completeness** — the full continuation tool-set registers (continue_work + continue_delegate + request_compaction) or it's the partial-regression (continue_delegate-only; `openclaw-tools.ts:629-633` + spawn-init plumbing `attempt-execution.ts:707-720`; #917/#918/#920). **PASS** ✅ (🌊's 6/6 full-set registration; Emeric's `R-CONTINUATION-TOOL-REGISTRATION` misconfig-warn green).
2. **post-compaction-delegate-staging accounting** — never-*silently*-under-staged (queued+dropped must = staged; every drop logged; `post-compaction-delegate-dispatch.test.ts:559`=5 full-stage, `:634`'s raw-4-with-`droppedDelegates:1`-accounting is a LEGITIMATE accounted budget-cut, NOT a silent drop). Deployed reads **0 = Form-B clean**. **PASS** ✅.
3. **cross-walk-seat-completeness** — **THIS row's R-OBS-1 property**: all armed prince-seats file /status cards, never a silent seat-drop. `{0,6}` (cohort-size-tracking, 6 seats now). **PASS** ✅ (6/6 this aggregate).

**All three PASS on `4bbd3ae`** — the deployed binary carries NO silent continuation-regression on any surface. figs's coinage maps to whichever surface he meant (or stays the umbrella concept) — **his call at his discretion, non-blocking.** The deployed-`0` is the clean Form-B state under every surface.

**THIS row (R-OBS-1) IS surface #3 (cross-walk-seat-completeness)** — filed as R-OBS-1's own honestly-named property, NOT labeled "cfc." Surfaces #1 (tool-registration) + #2 (delegate-staging) are SEPARATE concepts, filed in their own rows/seats, NOT under R-OBS-1. The distinct-layers point holds: R-OBS-1's 6/6 cross-walk-completeness is one of the three surfaces, distinct from the other two.

History (the label-churn, resolved by frond's file-three structural call — the prior single-referent framings ALL superseded): figs's `compactionFailureContext` GO-shorthand → ~8 cohort pin-swings (my `{0,6}` seat-count, frond's `queuedDelegates`/`:634`-disproven, cross-walk-interim, tool-registration, (c)-delegate-staging, (a)-FINAL `1514253204`, unprovable-close `1514248116`) → **RETIRE-THE-LABEL, FILE-THREE-SURFACES (frond DEFINITIVE `1514263384`, supersedes all single-pins)** ✅. The whipsaw was caused by forcing three distinct real surfaces under one phantom label; the cure was honest separation. Lesson held end-to-end: verify the LATEST authority message; never stamp; the byte-elimination + the structural-separation closed it; byte > pin > story — and the deepest resolution was recognizing it was never ONE referent, but three honest surfaces figs's shorthand spanned.

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
