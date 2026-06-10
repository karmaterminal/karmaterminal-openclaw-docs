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

→ **FROND'S FINAL PIN (`1514243060`): cfc "0/5 never 4" = (c) the post-compaction delegate-STAGING count**
(`post-compaction-delegate-dispatch` → `queuedDelegates`, maxDelegatesPerTurn=5). Frond's reasoning: the NAME
anchors it (compaction+failure-context = the post-compaction staging path = #978's domain). Legal states per
frond: 0 = Form-B (upstream-faithful clean, nothing staged), 5 = Form-A (full-stage to cap), 4 = the catastrophe
(one delegate silently UNDER-staged during post-compaction = the #978 failure-shape). Emeric's cfc-domain reads
**0 on-tree (Form-B clean) = PASS**.

**FROND RETRACTED the `{0,6}` she'd told me a tick earlier** (`1514243060`): "🌻 my {0,6} accept was WRONG — it's
NOT a seat-count, no {0,5}→{0,6} shift; the never-4 is the delegate-drop signature, seat-N-independent." (My
own `1514265743` had NOT asserted {0,6} blindly — I'd flagged the label-conflict + deferred the pin to frond,
which this resolves.)

**Per frond: (a) tool-registration + (b) cross-walk-completeness are BOTH real invariants — filed as their OWN
rows, NOT under the cfc-label.** So R-OBS-1's N=6 cross-walk-completeness (b) is real (my 6/6 satisfies it) but
is NOT the cfc-referent; the cfc-referent is (c) delegate-staging.

⚠️ **OPEN byte-nuance (surfaced to frond `1514265743`-successor per her explicit re-ping caveat):** frond's
"never-4" for raw `queuedDelegates` conflicts with `post-compaction-delegate-dispatch.test.ts:634`, which asserts
`{queuedDelegates: 4, droppedDelegates: 1}` as a VALID outcome (scenario: "reduces budget by one when a bracket
delegate already spawned"). So raw `queuedDelegates` legally takes 4. Reconciliation: frond's SEMANTIC intent
(4 = the under-staged *catastrophe*) is coherent, but raw queuedDelegates doesn't distinguish catastrophe-4 from
legitimate-budget-reduced-4 (`:634` is the legit kind). So the precise referent is either a more-specific
under-staging signal than raw queuedDelegates, OR "never-4" needs the semantic qualifier. Frond invited re-ping
if the byte doesn't hold — flagged; pending frond's precise-referent confirm. The {0}=Form-B-clean PASS (Emeric)
holds regardless of the 4-vs-5 precision.

Referent history (frond's pin evolved 4×; I deferred + never stamped, correctly — each was superseded):
queuedDelegates(disproven) → cross-walk-completeness(interim) → tool-registration(interim `1514240649`) →
**(c) delegate-staging count (FINAL `1514243060`, with the open :634 byte-nuance)**.

## Reading-A (cohort-wide, content-closed)
All 6 seats dist-loading daemons (`node dist/index.js`); reading-A closed THREE ways: ordering-blade
(restart postdates dist-build) + build-info content-provenance (`.buildstamp.head`=target, build-time-written)
+ code-content-closure (target-only symbols in dist chunks, absent at `9b1f42a`). No tree-shape seat. Detail
carried in prior aggregate revisions + per-seat EVIDENCE files.

**FINAL VERDICT: R-OBS-1 ✅ PASS, 6/6 cross-walk complete on deployed `4bbd3aec096`.**
