# R-OBS-1 cael-dgx — `/status` continuation-card cross-walk piece on `4bbd3aec096`

**Row owner:** 🌻 Elliott (canonical, aggregates 6-prince verdict). This is the **cael-dgx cross-walk piece**.
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB)
**Captured:** 2026-06-10 ~05:53 PDT (live `session_status` on deployed binary)

## Cael-seat `/status` continuation render (the cross-walk data Elliott needs)
- **build-prefix:** `4bbd3ae` (`OpenClaw 2026.6.2 (4bbd3ae)`) ✓ — target
- **Continuation line (verbatim):** `🔄 Continuation: chain 6/200`
- **Compactions:** `0`
- Context at capture: 466k/1.0m (47%)

## Field-shape note (corroborates Elliott's volitional-finding — RESOLVED framing)
The `| volitional: N` segment present on the `e90a870` (2026.5.17) exemplar card is **ABSENT** on cael's `4bbd3ae` (2026.6.2) card — same as Elliott's finding, now 6/6 cohort-wide. The continuation line renders `chain 6/200` with no `| volitional` segment.

**Resolved framing (aligns my own `card.md` + Elliott's aggregate + the source): omit-at-zero BY DESIGN, surface INTACT — NOT a deploy display-removal.** `status-message.ts:79` ("volitional is omitted when zero") + `:117-118` (`if (volitional > 0) push(...)`). The segment isn't removed/restructured in the deploy; it's suppressed-at-zero by design. The `e90a870` `volitional: 0` render was the ANOMALY (a zero that shouldn't have rendered), not the deploy removing the surface. NOT a fail: the continuation line is present, chain non-negative under cap, volitional correctly omitted at zero.

NB: this volitional omit-at-zero is **orthogonal to + decoupled from** the `compactionFailureContext`/"0-5-never-4" referent. **The cfc referent is UNPROVABLE from the code — figs's harness-shorthand to confirm at his discretion, non-blocking** (frond retracted all her pins at `1514248116`; close-out `1514249272`: "contested + figs's to rule"). It is NOT the seat-count (seat-count fails the literal: we're 6 princes → `{0,6}`, but the label's `{0,5}`; the fixed `{0,5}` fits tool-registration-classes, seat-independent). All candidate surfaces pass on `4bbd3ae`; the gate clears regardless of which the label names. The card's volitional-display is a separate green invariant, not the cfc-referent.

## Verdict piece: ✅ cael-seat continuation-card GREEN — line present, build=target, compactions=0, volitional-segment absent (omit-at-zero by design, cross-seat-confirmed 6/6).
