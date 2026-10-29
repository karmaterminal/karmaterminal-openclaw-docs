# R-CW-5A: missing at `8ba08c76d8`

Offline source/harness contract check for R-CW-5; cannot establish live cap exhaustion.

Seeded 2026-10-29. No receipt is folded yet. Static row, allocated to the frond-scribe static validator run at exact `8ba08c76d8f74a63238f2ce79302168748c31965`. It is folded only after review. The `293c977f62` receipt for this row is historical and is not carried.

## Static validator run (20261029T080845Z)

- Result: construct-only (static boundary variant; by design never a fresh R-CW-5/6 cap receipt)
- Construct-only by design: validates the same committed material as R-CW-5/6 but never emits a cap receipt. R-CW-5/6 themselves pass at this head by the fixture.
- Artifacts: `static-validator-20261029T080845Z/` (k6.log, static-corpus-row-summary.json)
