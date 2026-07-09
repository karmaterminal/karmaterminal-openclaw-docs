# PROOFS / 24838c4d470804425da59279647745dcac555a25

Full copied Project 81 proof corpus for safe assembly push SHA `24838c4d470804425da59279647745dcac555a25` (`OpenClaw 2026.6.11`), transposed from live proof source SHA `5292af40d0ad5303b85a678f6e629503a8725848`.

## Rollup

`35 total / 34 pass / 0 partial / 1 honest_limit / 0 fail / 0 missing`

The fresh rerun leaves one row honest-limit in this corpus:

- `R-RC-2`: both seats rejected delegated `request_compaction` at the context-threshold guard; no accepted-compaction window existed.

## Why this corpus exists

The prior full-copy corpus for `46872994e4cae80830c381cb49456e8c77583d7e` was valid for that safe push, but upstream/main advanced again before PR-presentation. The safe assembly branch was refreshed to `5292af40d0ad5303b85a678f6e629503a8725848`, and that refresh touched runtime/continuation-adjacent surface. Cael and Ronan were therefore redeployed to `5292af40d0ad5303b85a678f6e629503a8725848` and the gateway-live Project 81 rows were rerun against the deployed 5292 gateways.

After the 5292 proof corpus was finalized, upstream/main advanced again. The safe assembly branch absorbed current upstream/main cleanly, refreshed generated/docs surfaces where needed, and landed at push SHA `24838c4d470804425da59279647745dcac555a25`. This tree is the required full-copy corpus at that safe push SHA; `proof_source_sha` remains the deployed 5292 rerun.

## Methodology upgrade

This corpus uses the Project 81 k6 proof harness as the default proof surface. The harness submits row-shaped traffic over the Gateway WebSocket/API, writes row-scoped artifacts, and makes proof traffic attributable by row/run/seat. It is not just a link bundle: fresh 5292 artifacts live directly under `artifacts/fresh-5292/` inside this `PROOFS/<sha>/` tree.

Rows that validate committed proof packets rather than live Gateway behavior remain carried from the `46872994e4cae80830c381cb49456e8c77583d7e` full-copy seed and are classified as static/corpus-dependent. They are not treated as failed live reruns.

## Evidence classes

- **Fresh 5292 live k6 artifacts:** `artifacts/fresh-5292/actions/`
- **Failed/partial workflow logs preserved for review:** `artifacts/fresh-5292/actions-logs/`
- **Fresh path-scoped config receipts:** `R-CONFIG-DEFAULTS/manual-receipts/` and `R-CONFIG-INTERSESSION/manual-receipts/`
- **Fresh late Tempo receipts for R-CW-3:** `R-CW-3/manual-receipts/fresh-5292/tempo/`
- **Carried static/corpus-dependent evidence:** existing row `EVIDENCE.md` files and seeded artifacts from `46872994e4cae80830c381cb49456e8c77583d7e`

## Postprocessor mismatches preserved honestly

- `R-CD-MODEL-TOOL`: generated `run-result.json` says `PARTIAL-candidate`, but console evidence on both seats records `requested_model_byte == child_model_byte == github-copilot/gemini-3.1-pro-preview`, `model_matches=true`, and `return_payload=true`; folded as pass.
- `R-RC-2`: generated `run-result.json` says `PASS-candidate`, but console evidence records context-threshold rejection and no accepted compaction; folded as honest-limit.

## Navigation

- `proofs-manifest.json` — machine-readable rollup, row states, and fresh artifact paths
- `ARTIFACTS.md` — artifact root index
- `METHOD.md` — repeatable proof method and classification policy
- `<ROW>/EVIDENCE.md` — row-level evidence and fresh 5292 closeout
