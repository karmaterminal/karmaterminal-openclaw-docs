# R-OBS-1 cael-dgx — `/status` continuation-card cross-walk piece on `4bbd3aec096`

**Row owner:** 🌻 Elliott (canonical, aggregates 6-prince verdict). This is the **cael-dgx cross-walk piece**.
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB)
**Captured:** 2026-06-10 ~05:53 PDT (live `session_status` on deployed binary)

## Cael-seat `/status` continuation render (the cross-walk data Elliott needs)
- **build-prefix:** `4bbd3ae` (`OpenClaw 2026.6.2 (4bbd3ae)`) ✓ — target
- **Continuation line (verbatim):** `🔄 Continuation: chain 6/200`
- **Compactions:** `0`
- Context at capture: 466k/1.0m (47%)

## Field-shape note (corroborates Elliott's display-delta)
The `| volitional: N` segment present on the `e90a870` (2026.5.17) exemplar card is **ABSENT** on cael's `4bbd3ae` (2026.6.2) card — same as Elliott's finding. The continuation line renders `chain 6/200` with no `| volitional` segment. This is the **deploy's display-change** (volitional-display removed/restructured 5.17→6.2 OR zero-suppressed), **NOT a per-seat miss** — confirmed on a 2nd seat (cael) beyond Elliott's. NOT a fail: the continuation line is present + chain non-negative under cap.

NB: this display-delta is **orthogonal** to the `compactionFailureContext`/"0-5-never-4" referent (which resolved to the cohort cross-walk SEAT-COUNT, not the volitional surface) — the card's volitional-display change doesn't affect the seat-count invariant.

## Verdict piece: ✅ cael-seat continuation-card GREEN — line present, build=target, compactions=0, volitional-segment absent (deploy display-change, cross-seat-confirmed).
