# Method

- Harness: `karmaterminal-openclaw-docs` main, seeded at `3cb902e1f3398453278770e2041d8ecb5dc18ff6`. Each fire records its exact docs SHA, and the fold binds `harness_sha` to it.
- Runtime: the deploy-gateway stage-only build of `f15237ec92` on emeric (run 40984410162), served by an isolated loopback gateway (`comp-f15237ec`, port 18800) with its own state. Its model sign-in was moved from the F gateway with `composite-launcher.sh adopt-auth` (isolated → isolated; the live credential stores are never read). The launcher's readiness wait reported a false failure (`set -o pipefail` with `journalctl | grep -q`); the isolated-auth check and the source-row delete were completed by hand with the same predicates (receipt on emeric: `proof-gw/comp-f15237ec/receipts/auth-adopted.json`).
- `dispatch_allocation` is the only firing authority. Each row fires once; one model row fires first as a smoke check and counts as that row's fire. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after review. Non-PASS rows carry a last-known comparison (F `08c37a1562` is the nearest) and an owner.
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.

## Method change proposal (F′)

**Status: PROPOSED. It needs 🌊 and figs.** Merging the PR that adds this section to docs `main` is the adoption; on any other ref it is a proposal only. It is the "reviewed method change" route in 🌊's Gate 5 ruling (Discord, 2026-10-30 13:49Z): the presentation fast-forward holds until each row that isn't PASS is closed individually, removed by a reviewed method change, or accepted by figs. Until it is adopted, the three rows below stay **required and missing**. Nothing about them is hidden: each keeps its directory, its `EVIDENCE.md`, its manifest entry, owner, state (`missing`) and candidate verdict. The manifest lists them under `supplemental_rows` and the `supplemental` bucket of `dispatch_allocation`, and flags each entry `"required": false, "supplemental": true`. The `supplemental` bucket assigns no new fire; the other buckets still cover every required row exactly once.

**Supersedes docs#607 for F′.** #607 proposed the same move for the j9 corpus (`PROOFS/293c977f62…`), which F′ superseded. It moved five rows. At F′ only three move: R-CW-5 and R-CW-6 PASS here through their process-local fixtures at the exact SHA (`fixtures-f15237ec-20261030T013026Z`, docs `215235ed`), so they stay required. #607 and the j9 corpus are unchanged.

**Why:** under the current harness none of these three can produce a PASS for this candidate. Leaving them in `required_rows` makes the presentation gate unreachable by construction, not by evidence.

| row | why it can't pass here | provenance | alternative to removal |
|---|---|---|---|
| R-CD-RETURN-COVENANT-AUTHORITY | construct-only: no runnable producer (scenario `construct-only`, method `manual-corpus-review`; the live-run guard rejects it). Its row manifest says it "remains MISSING until a reviewed restart control runs on the final successor product", and no such control exists | catalogued 2026-09-19 (docs#544); never passed (missing at F `08c37a1562` too) | build and review the restart-control scenario (ledger `AUTHORITY-RESTART-CONTROL`), then fire it once at the exact SHA |
| R-CW-5A | a static boundary variant that **always** emits construct-only by design: it validates the same committed material as R-CW-5 but "cannot produce or fold a live R-CW-5 PASS". The static run `static-validator-20261030T013043Z` reported `construct-only` | d47d83c7 (2026-07-14) | none: by design it can never PASS. The contract it backs is R-CW-5, which PASSes at F′ |
| R-CW-6A | the same, for R-CW-6 ("cannot produce or fold a runtime R-CW-6 PASS") | d47d83c7 | none: by design it can never PASS. R-CW-6 PASSes at F′ |

**Not touched:**
- The three PARTIAL rows stay required and partial, and each still blocks presentation on its own: R-CD-2 (🌊 ruling (a); keyed PASS review recorded), R-CD-3 (openclaw#1497) and R-CD-TOKEN (method, docs#612; openclaw#1504). This proposal does not close, accept or reclassify them.
- R-RC-2 stays a receipt-backed honest limit: the structured `request_compaction` rejection (guard `context_threshold`) with the matching child threshold return.
- No row's verdict changes and no evidence is deleted. No other corpus is edited.

**Effect if adopted:** 35 required rows, 31 pass (6 of them historical static evidence under 🌊's ruling A), 3 partial, 1 honest_limit, 0 missing, 0 fail. Plus 3 supplemental rows, all missing. Before: 38 required rows, 31 pass, 3 partial, 1 honest_limit, 3 missing, 0 fail. The corpus stays **not acceptance-complete** either way, because of the three partial rows.

The proposal is for this presentation corpus only. It does not delete any contract. R-CD-RETURN-COVENANT-AUTHORITY can return to required once a reviewed restart control exists and fires at the exact SHA.
