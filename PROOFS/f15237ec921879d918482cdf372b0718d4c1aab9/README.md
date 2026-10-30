# Continuation proof corpus: `f15237ec921879d918482cdf372b0718d4c1aab9` (F′)

The replacement pure candidate for [openclaw/openclaw#129388](https://github.com/openclaw/openclaw/pull/129388), on `codeagent/absorb-8083-j11-cand`. It is F `08c37a1562` plus 🌊's Gate 2 scope ruling: `412b3e5394` narrowed to continuation wakes, and the fleet-only D3b fossil moved to fleet #1468. It fast-forwards the presentation from `f4675cff00` (a verified ancestor) and absorbs upstream main through U11 `4fc73d6995`.

**Status: folded, NOT acceptance-complete.** 31 pass / 2 partial / 1 honest-limit / 4 missing. Partial: R-CD-2 (🌊 ruling (a); keyed PASS review recorded), R-CD-TOKEN (method; openclaw#1504). Honest limit: R-RC-2. Missing: R-CD-3 (corrected 2026-10-30: a harness false positive; the lifeboat never fired); construct-only: R-CD-RETURN-COVENANT-AUTHORITY, R-CW-5A, R-CW-6A. The six static passes are historical static evidence under 🌊's ruling A (validator against captures pinned at `1cc8f4e3`), not exact-F′ live execution. R-CW-1 passed on a 🌊-authorized refire; its first fire is kept as a cross-row lane-contention observation (`proofs-manifest.json` `refires`). Do not read structural completeness as proof.

F (`08c37a1562`) and earlier corpora are historical diagnostics only; nothing carries.

- **Live rows (27):** fired once each on an isolated proof gateway at exact runtime `f15237ec92` on emeric.
- **Static rows (8):** the static validator at this exact SHA; 6 pass under 🌊's ruling A (historical static evidence), 2 construct-only.
- **Fixture rows (2):** `R-CW-5`, `R-CW-6`, fired canonically from docs main at this exact SHA.
- **Construct-only (1):** `R-CD-RETURN-COVENANT-AUTHORITY`.
- **R-CD-TOKEN** is expected PARTIAL by method (docs#612, 🌊's row-level ruling; the delivery→run join gap is openclaw#1504).

See `RESOLVED-SHA.md`, `METHOD.md`, and `gates/`.

**Correction, 2026-10-30:** R-CD-3 is now **missing**, not partial. Its "behavior observed" was a harness false positive, and the lifeboat never fired. See `R-CD-3/EVIDENCE.md` § Correction.
