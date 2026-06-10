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
  is SATISFIED (6/6). NOTE: this cross-walk-completeness property is the **leading candidate referent for
  frond's "0/5 never 4" `compactionFailureContext` label** (see below) — by elimination it is most likely a
  harness/corpus-completeness assertion (all-armed-seats-report OR clean-zero, never a partial that silently
  drops a seat), not a grep-able runtime counter.

## `compactionFailureContext` "0/5 never 4" referent — OPEN (all runtime candidates eliminated)

For the record, since this aggregate's N=6 was earlier conflated with this referent: **the referent is NOT
resolved.** Three runtime candidates were proposed + eliminated:
- **delegate-dispatch `queuedDelegates`** (frond pinned it `1514237988`) — **DISPROVEN** by Rune: `post-compaction-delegate-dispatch.test.ts:634` asserts `{queuedDelegates: 4}` VALID ("reduces budget by one when a bracket delegate already spawned"), so 4 is a legal value → can't be a "never 4" invariant.
- **tool-registration count** (cw+cd-classes+rc) — a SEPARATE real finding, not this referent.
- **`maxDelegatesPerTurn`=5** — a config constant, not a 0/5/never-4 invariant.
- `compactionFailureContext` literal greps to 0 in src/+dist/+test/ (not a code symbol).

→ **RESOLVED — FROND PINNED IT (frond-scribe `1514239178`): the referent = the COMPLETENESS-GATE**, NOT a
runtime counter. "0/5 never 4" = the **cross-walk invariant: every armed seat files its row, none silently
dropped** (N-armed-seats = N-rows-filed; "never 4" = a silent-drop signature). It is NOT a code symbol
(`compactionFailureContext` greps to 0), NOT keyed to queued-count (`:634` asserts qd=4 valid → disproven).
Frond's pin supersedes all runtime-counter candidates.

**R-OBS-1's own 6/6 cross-walk SATISFIES this gate**: all 6 armed prince-seats filed their `/status` card-slice,
none dropped → N-seats (6) = N-rows (6), no partial-drop. The completeness-gate is met. (Fittingly, the "elliott
asleep / 5-of-6" tally-cascade earlier this roll was a live instance of exactly the silent-drop the gate guards
against — a count dropping a live seat.)

NOTE — tool-registration is a SEPARATE finding, not this referent: Rune's later byte (`1514238753`) +
Emeric's `R-CONTINUATION-TOOL-REGISTRATION` row (`3e6decd`) proved the deployed binary registers all 3
continuation-tool-families (not the partial-regression where only continue_delegate registers,
`openclaw-tools.ts:634`). That is TRUE + valuable, but per frond's pin it is a distinct finding, NOT the
"0/5 never 4" referent — the referent is the completeness-gate.

Referent history (none stamped by me — deferred to frond throughout, correctly, since even frond's own interim
queuedDelegates pin got byte-disproven): (1) my `{0,6}` seat-count → wrong, retracted; (2) `queuedDelegates`
→ interim-pinned then byte-DISPROVEN (`:634`); (3)/(4) cross-walk-completeness ↔ tool-registration oscillation
→ **frond pinned cross-walk-completeness as final**; tool-registration is the separate runtime finding.

## Reading-A (cohort-wide, content-closed)
All 6 seats dist-loading daemons (`node dist/index.js`); reading-A closed THREE ways: ordering-blade
(restart postdates dist-build) + build-info content-provenance (`.buildstamp.head`=target, build-time-written)
+ code-content-closure (target-only symbols in dist chunks, absent at `9b1f42a`). No tree-shape seat. Detail
carried in prior aggregate revisions + per-seat EVIDENCE files.

**FINAL VERDICT: R-OBS-1 ✅ PASS, 6/6 cross-walk complete on deployed `4bbd3aec096`.**
