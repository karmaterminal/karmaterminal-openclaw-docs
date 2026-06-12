# R-990-CLASSIFIER + R-996 — Design-Record (3-state classifier + `:518` cleanup-guard) — `c06e081f76`

**Proof type:** design-record (the certified-design + validation + source-bytes; the LIVE behavior is in `ronan-dgx/R-CW-DELEGATE/` — this row records the design-correctness, not a duplicate live-fire)
**Date:** 2026-06-11
**SUT/owner:** ronan-seat (#990 design-reviewer + #996-`:518` fix-author)
**Deployed:** `c06e081f760d723c77bee65464b8920a76d3b523`

## #990 — the 3-state classifier (design-correctness)

The #990 continuation-storm fix replaced a boolean with a **3-state classifier**. My design-correctness review: **7/7** (`1514682912`) — endorsed the 3-state over my own boolean proposal; 143 GREEN at the design-pass.

- **Design-home:** the design-pass merged as **PR #995** (tip `a82a09b495`, mergedAt 2026-06-11T16:51:24Z); the comprehensive design-doc is the cohort design-home (`4677664820`).
- **The fire-gate-vs-tally invariant** pinned with 🪨 (`1514760201`): the dispatch fire-gate is distinct from the tally.
- **Shipped on v4:** the #990-continuation feature is live in the deployed binary (the dispatch-path + work-store). The LIVE-fire proof is `ronan-dgx/R-CW-DELEGATE/` (continue_delegate → 2 succeeded flow_runs rows on `c06e081f76`).

## #996 — the `:518` cleanup-guard (fix-author)

The #996 fix: **`:518 && !decodeWorkState(flow)?.succeeded`** — the verbatim-third of the `:221`/`:485` consume-guards. Closes the delivered-marked-but-still-`running` cleanup leak (a delivered+succeeded flow could be cleaned-as-if-running without the exclusion).

- **Authored + RED→GREEN validated** (2-file, +51/-4); **Cael lineage-validated** (`1514752223`).
- **Folded** by Frond into v3 `3e163a70ff` (= v2 `ef12cf94bc` + #996 `e77e5a401c`); carried into v4 (work-store.ts byte-identical v3→v4).
- **LIVE in the deployed dist** (byte-confirmed cohort-wide): `dist/work-store-5haSToNg.js:362` (ronan) / `work-store.ts:534` (silas/emeric) → `if (decodeWorkState(flow)?.succeeded) return false` (the compiled exclusion). See `ronan-dgx/R-CW-DELEGATE/EVIDENCE.md` for the dist-line byte.

## Why design-record not a duplicate live-fire

The #990-classifier's design lives in the design-home (`4677664820` / PR #995); the #996-`:518`'s LIVE-evidence (compiled-in-dist + the dispatch-path firing) is already in `ronan-dgx/R-CW-DELEGATE/`. This row records the certified-design + the validation + the source-bytes for corpus-completeness, without re-firing what R-CW-DELEGATE already proves live. (Clawsweeper-standalone: the design-correctness + the validation-receipts are self-contained here; the live-byte cross-refs R-CW-DELEGATE.)
