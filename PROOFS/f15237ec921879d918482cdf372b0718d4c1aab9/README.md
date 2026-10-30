# Continuation proof corpus: `f15237ec921879d918482cdf372b0718d4c1aab9` (F′)

The replacement pure candidate for [openclaw/openclaw#129388](https://github.com/openclaw/openclaw/pull/129388), on `codeagent/absorb-8083-j11-cand`. It is F `08c37a1562` plus 🌊's Gate 2 scope ruling: `412b3e5394` narrowed to continuation wakes, and the fleet-only D3b fossil moved to fleet #1468. It fast-forwards the presentation from `f4675cff00` (a verified ancestor) and absorbs upstream main through U11 `4fc73d6995`.

**Status: folded, NOT acceptance-complete.** 35 required rows: 31 pass / 3 partial / 1 honest-limit / 0 missing / 0 fail. Partial: R-CD-2 (🌊 ruling (a); keyed PASS review recorded), R-CD-3 (openclaw#1497), R-CD-TOKEN (method; openclaw#1504). Honest limit: R-RC-2. Supplemental (construct-only, all missing, outside `required_rows`): R-CD-RETURN-COVENANT-AUTHORITY, R-CW-5A, R-CW-6A, under `METHOD.md` § Method change proposal (F′). That change needs 🌊 and figs, is adopted only by merging to docs `main`, and supersedes docs#607 for F′; before it, the rollup was 38 required, 31 pass / 3 partial / 1 honest-limit / 3 missing. The six static passes are historical static evidence under 🌊's ruling A (validator against captures pinned at `1cc8f4e3`), not exact-F′ live execution. R-CW-1 passed on a 🌊-authorized refire; its first fire is kept as a cross-row lane-contention observation (`proofs-manifest.json` `refires`). Do not read structural completeness as proof.

F (`08c37a1562`) and earlier corpora are historical diagnostics only; nothing carries.

- **Live rows (27):** fired once each on an isolated proof gateway at exact runtime `f15237ec92` on emeric.
- **Static rows (8):** the static validator at this exact SHA; 6 pass under 🌊's ruling A (historical static evidence), 2 construct-only (`R-CW-5A`, `R-CW-6A`; supplemental).
- **Fixture rows (2):** `R-CW-5`, `R-CW-6`, fired canonically from docs main at this exact SHA.
- **Construct-only (1):** `R-CD-RETURN-COVENANT-AUTHORITY` (supplemental).
- **R-CD-TOKEN** is expected PARTIAL by method (docs#612, 🌊's row-level ruling; the delivery→run join gap is openclaw#1504).

See `RESOLVED-SHA.md`, `METHOD.md`, and `gates/`.
