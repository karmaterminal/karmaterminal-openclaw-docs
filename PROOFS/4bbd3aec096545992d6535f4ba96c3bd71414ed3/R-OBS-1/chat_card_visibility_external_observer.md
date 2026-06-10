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

## `compactionFailureContext` "0/5 never 4" referent — FINAL: (a) TOOL-REGISTRATION by byte-elimination (figs can override, non-blocking)

For the record, since this aggregate's N=6 was earlier conflated with this referent: **the seat-cross-walk N=6 is NOT the
referent** (it's R-OBS-1's own property, separate). The cohort byte-ELIMINATED every other candidate; tool-registration is the sole survivor fitting
the literal "0/5 never 4"; frond accepted it FINAL on the elimination (stronger ground than name-fit). It does NOT block — figs owns the label + every surface PASSES on `4bbd3ae`.

→ **FROND'S FINAL RULING — cfc = (a) TOOL-REGISTRATION, by BYTE-ELIMINATION (frond-scribe `1514253204`, superseding ALL prior cfc pins incl her `1514248116` unprovable-close).**
Frond's pin evolved ~7× (queuedDelegates → cross-walk → tool-registration → (c) → (a)-FINAL → unprovable-close → **(a) by elimination**). The FINAL resolution
landed by **byte-elimination** of every other candidate — not name-fit. Each runtime/source-symbol candidate falls at the byte EXCEPT one:
- **queued-count ❌** — `post-compaction-delegate-dispatch.test.ts:634` asserts `{queuedDelegates: 4}` VALID (intentional accounted budget-cut, `droppedDelegates:1`), so a count the test sets to 4 by design cannot host a "never-4" invariant (Rune, 3×).
- **seat-count ❌** — it is N=6 not 5 (🌻 awake); a seat-tally would read "0/6 never 5," not "0/5 never 4."
- **volitional / `getVolitionalCompactionCount` ❌** — per-session accept-tally, not a fixed `{0,5}`.
- **`compactionFailureContext`-the-literal ❌** — phantom (grep=0 in src/+dist/+test/), it is figs's harness-shorthand, not a code symbol.
- **→ tool-registration ✅ SOLE SURVIVOR** — the ONLY candidate fitting the literal "0/5 never 4": exactly 5 continuation-tool-classes register or none,
  never the partial-4 drop (`openclaw-tools.ts:634` "only continue_delegate will register"; #917/#918/#920 half-symmetric partial-regression). Seat-N-independent, FIXED.

**THE REFERENT (FINAL): "0/5 never 4" = the continuation-tool-registration count** `{0=clean-Form-B, 5=full-stage-all-register, 4=silent-partial-drop}`, seat-independent.
**Standing caveat (frond's own):** it is frond's harness-shorthand — **figs can override the label at his discretion; non-blocking either way (every surface green on `4bbd3ae`).**
**Gate SATISFIED:** 🌊's R-CW-DELEGATE-SELF 6/6 full-tool-set registration = the check passing (5, not 4); Emeric's `R-CONTINUATION-TOOL-REGISTRATION` (`3e6decd`) misconfig-warn green + all 3 families register, none drop.

The two other invariants the cohort cycled through are REAL but file as their OWN rows, NOT under cfc:
- **(b) R-OBS-1 cross-walk-completeness N=6** — THIS row's own property (all 6 seats file /status, never a partial drop); `{0,6}`, cohort-size-tracking; SEPARATE from cfc (frond-confirmed `1514251822` + Rune-confirmed; my aggregate spec'd it apart throughout).
- **volitional omit-at-zero** — this row's display-finding (above); a render-behavior, not the cfc-invariant.

**R-OBS-1's cross-walk-completeness N=6 is the SEPARATE invariant, NOT the cfc-referent** — distinct layers, both real. cfc = the per-binary tool-registration count `{0,5}` (figs's label, figs can override, non-blocking); R-OBS-1's 6/6 is this row's corpus-completeness property. The cfc gates nothing; this row contributes the tool-registration-PASS leg + the volitional display-finding.

Referent history (frond's pin evolved ~7×; I deferred + never stamped any reading as my own claim, correctly — each interim superseded, INCLUDING frond's own): `{0,6}` seat-count (mine, retracted) → `queuedDelegates` (frond pin, byte-disproven `:634`) → cross-walk-completeness (frond interim) → tool-registration (frond `1514240649`) → (c) delegate-staging (frond `1514243060`, byte-disproven) → (a) FINAL (frond `1514244157`) → unprovable-close (frond `1514248116`) → **(a) TOOL-REGISTRATION by byte-elimination (frond FINAL `1514253204`, figs-can-override, non-blocking)** ✅.
Lesson held end-to-end: verify the LATEST authority message; surface byte-conflicts only per the authority's explicit invitation; never stamp; the byte-elimination (not name-fit) closed it; byte > pin > story — frond modeled it on her own pins repeatedly, and accepted the cohort's byte-elimination as stronger ground than her original name-fit.

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
