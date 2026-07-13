# Exact-cea9e42 Elliott direct operator-RPC receipt

- **Row:** `R-CONFIG-INTERSESSION`
- **Runtime/candidate:** `OpenClaw 2026.7.2 (cea9e42)` / `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- **One-fire workflow:** [29222117717](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29222117717) · artifact `8268529284`
- **Window:** `2026-07-13T03:38:32Z` (exact per-row bounds in `elliott/20260713T033827Z-direct-operator-rpc/run-result.json`)
- **Behavior observed:** authenticated operator `config.get` returned an accepted, redacted configuration response; the public-safe projection observed the continuation cross-session targeting setting: `crossSessionTargeting="enabled"`.
- **Why the harness changed:** the prior scenario asked a disposable non-owner agent to call the agent-facing owner-only `gateway` tool. That policy denial was correct; this receipt uses the actual authenticated operator RPC surface instead. Repair: [docs #402](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/402).

## Exact evidence bundle

`elliott/20260713T033827Z-direct-operator-rpc/` contains the raw public-safe `run-result.json`, `evidence.jsonl`, redaction receipt, runner metadata, exact-window Tempo query receipt, and a bounded gateway-journal diagnostic receipt. The raw configuration snapshot, token, session identity, and request payload are intentionally not retained. The journal records the successful `config.get` response in the row window with no matching gateway error/denial/rejection/warning/exception breadcrumb.

## Classification: behavior pass, proof-bar partial

The RPC behavior is a `PASS-candidate` (effective exit `0`; `config_read=true`), but this row is **not folded as a full exact-SHA PASS**. The exact window query for `elliott-prince` plus `.gen_ai.tool.name="config.get"` returned zero traces, so there is no attributable nonzero trace/span topology. The empty raw response and its SHA are retained in `tempo-search-config-get.json` and `tempo-correlation-receipt.json`; nearby service traces were not substituted. This preserves the gap rather than calling `trace_id:null` evidence.

## Historical provenance — not current coverage

# R-CONFIG-INTERSESSION evidence — 5292af40 Project 81 corpus

- **Historical aggregate state:** `pass` (**not counted as exact-cea9e42 coverage**)
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Fresh 5292 proof-source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seeded/carried corpus:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#369
- **Review note:** First k6 run was partial on both Cael/Ronan for config read/cross-session bytes; manual path-scoped receipts now close the row. #369 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `false` | `PROOFS/4afd560feb5102627a68a2f6a8bc545dabcfcfdc/artifacts/cael/p81-cael-live-resume3-20260709T031523Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/cael/20260709T031526Z-r-config-intersession/run-result.json` |
| ronan | `PARTIAL-candidate` | `false` | `PROOFS/4afd560feb5102627a68a2f6a8bc545dabcfcfdc/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CONFIG-INTERSESSION/ronan/20260709T033044Z-r-config-intersession/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout receipt (post-merge)

Manual path-scoped config receipts were added after the first corpus merge:

- `manual-receipts/cael-cross-session-targeting.json`
- `manual-receipts/ronan-cross-session-targeting.json`
- `manual-receipts/MANUAL-REVIEW.md`

These receipts supply `crossSessionTargeting="enabled"` from `agents.defaults.continuation.crossSessionTargeting` for Cael and Ronan without exposing secrets or mutating config. The aggregate row state is upgraded to `pass`; the original k6 partial artifacts and #369 remain preserved as method friction.

## Fresh 5292 closeout

Fresh k6 read-path attempts are preserved in failed-run logs; the row is closed by the fresh path-scoped config receipts listed above.

**5292 interpretation:** Fresh path-scoped config receipts show crossSessionTargeting="enabled" after deploy; the k6 read-path failure is preserved as harness friction.
