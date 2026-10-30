# Method

- Harness: `karmaterminal-openclaw-docs` main, seeded at `3cb902e1f3398453278770e2041d8ecb5dc18ff6`. Each fire records its exact docs SHA, and the fold binds `harness_sha` to it.
- Runtime: the deploy-gateway stage-only build of `f15237ec92` on emeric (run 40984410162), served by an isolated loopback gateway (`comp-f15237ec`, port 18800) with its own state. Its model sign-in was moved from the F gateway with `composite-launcher.sh adopt-auth` (isolated → isolated; the live credential stores are never read). The launcher's readiness wait reported a false failure (`set -o pipefail` with `journalctl | grep -q`); the isolated-auth check and the source-row delete were completed by hand with the same predicates (receipt on emeric: `proof-gw/comp-f15237ec/receipts/auth-adopted.json`).
- `dispatch_allocation` is the only firing authority. Each row fires once; one model row fires first as a smoke check and counts as that row's fire. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after review. Non-PASS rows carry a last-known comparison (F `08c37a1562` is the nearest) and an owner.
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.

## Method change proposal (F′)

**Status: PROPOSED until merged to docs `main`. It needs 🌊 and figs; merging is the adoption.** On `main`, this section and the manifest's supplemental fields are the adopted method. On any other ref they show what adoption would produce, and the canonical state stays docs `main`'s: the three rows below required and missing.

This is the second route in 🌊's Gate 5 ruling (Discord, 2026-10-30 13:49Z, recorded in karmaterminal/openclaw-bootstrap#1727 comment 6524467488): the presentation fast-forward holds until each row that isn't PASS is "closed individually, removed by a reviewed method change, or accepted by figs explicitly with its limitation". The same record says R-RC-2's receipt-backed honest limit needs no action.

Nothing about the three rows is hidden: each keeps its directory, its `EVIDENCE.md`, its manifest entry, owner, state (`missing`) and candidate verdict. The manifest lists them under `supplemental_rows` and the `supplemental` bucket of `dispatch_allocation`, and flags each entry `"required": false, "supplemental": true`. The `supplemental` bucket assigns no new fire; the other buckets still cover every required row exactly once.

**Supersedes docs#607 for F′.** #607 (open, not merged) proposed the same move for the j9 corpus (`PROOFS/293c977f62…`), which has since been superseded by P′ `8ba08c76d8`, F `08c37a1562` and now F′. It proposed moving five rows. At F′ only three move: R-CW-5 and R-CW-6 are folded PASS here from their process-local fixtures at the exact SHA (`fixtures-f15237ec-20261030T013026Z`, docs `215235ed`), so they stay required. #607 and the j9 corpus are unchanged.

**Why:** as this corpus is built, none of the three can reach PASS. Leaving them in `required_rows` makes the presentation gate unreachable by construction, not by evidence.

| row | why it can't reach PASS here | provenance | alternatives to removal |
|---|---|---|---|
| R-CD-RETURN-COVENANT-AUTHORITY | construct-only: no runnable producer (scenario `construct-only`, method `manual-corpus-review`; the live-run guard rejects it). Its row manifest says it "remains MISSING until a reviewed restart control runs on the final successor product", and no such control exists | catalogued 2026-09-19 (docs#544); missing or unfired in every corpus that lists it, F `08c37a1562` included | build and review the restart-control scenario (ledger `AUTHORITY-RESTART-CONTROL`), then fire it once at the exact SHA; or figs accepts the row explicitly with its limitation |
| R-CW-5A | a static boundary check that the static validator reports as `construct-only` by design: it "cannot produce or fold a live R-CW-5 PASS". At F′ the run `static-validator-20261030T013043Z` checked the pinned historical R-CW-5 capture (`PROOFS/1cc8f4e3…/R-CW-5/cael-dgx`), not F′'s fixture packet, and reported `construct-only`. This corpus folds that as missing, as j9, P′ and F did | d47d83c7 (2026-07-14) | (a) figs accepts the row explicitly as construct-only. (b) Restore the earlier corpus-level fold: eleven corpora from 2026-08-25 to `7cb9d71f62` (2026-09-06) folded this row `pass`, verdict still `construct-only`, under "PASS at corpus level only with static boundary receipts; never claim live behavior". That is itself a method change for 🌊 to review |
| R-CW-6A | the same, for R-CW-6 ("cannot produce or fold a runtime R-CW-6 PASS"; pinned capture `PROOFS/1cc8f4e3…/R-CW-6/cael-dgx`) | d47d83c7 | the same two alternatives |

**Caveat on the premise.** The case for R-CW-5A/6A leans on R-CW-5 and R-CW-6 passing at F′. Both row manifests keep `tempo-trace-json` and `continuation-trace-correlation` as review debt on every fixture run, and R-CW-5's manifest caps the process-local fixture route at `PARTIAL-candidate`. This corpus, like P′ and F, folds both rows `pass` with `pending_receipts: []`. That fold predates this proposal and is not changed here. If it is reopened, the three rows' own construct-only status is unchanged, but the argument that R-CW-5A/6A are backed by a passing behavior row weakens with it.

**Validator note.** The supplemental rows stay in `rows[]`:
- `validate-corpus.mjs --sha` accepts this shape, but it tallies all of `rows[]` (38 rows, 3 missing) and reads neither `required_rows` nor the manifest's `rollup`. If `PROOFS/INDEX.json` is later pointed at this corpus with the manifest's 35-row rollup, `--index` will fail `rollup-matches-manifest` until the validator learns `supplemental_rows`.
- The `build-openclaw-proof-corpus` skill's closure check (`rows == required_rows`, `dispatch_allocation == required_rows`) fails on this shape by construction, as it does on #607.
- Neither is changed here.

**Not touched:**
- The three PARTIAL rows stay required and partial, and each still blocks presentation on its own: R-CD-2 (🌊 ruling (a); keyed PASS review recorded), R-CD-3 (openclaw#1497) and R-CD-TOKEN (method, docs#612; openclaw#1504). This proposal does not close, accept or reclassify them.
- R-RC-2 stays a receipt-backed honest limit: the structured `request_compaction` rejection (guard `context_threshold`) with the matching child threshold return. This proposal does not change it.
- No row's verdict changes and no evidence is deleted. No other corpus is edited.

**Effect if adopted:** 35 required rows, 31 pass (6 of them historical static evidence under 🌊's ruling A), 3 partial, 1 honest_limit, 0 missing, 0 fail. Plus 3 supplemental rows, all missing. Before: 38 required rows, 31 pass, 3 partial, 1 honest_limit, 3 missing, 0 fail. Either way the corpus is **not acceptance-complete** while the three partial rows stand.

The proposal is for this presentation corpus only and deletes no contract. Any of the three can return to required: R-CD-RETURN-COVENANT-AUTHORITY once a reviewed restart control exists and fires at the exact SHA, and R-CW-5A/6A if alternative (b) is adopted instead.
