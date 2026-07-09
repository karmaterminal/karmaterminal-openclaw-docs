# R-CW-3 evidence — 5292af40 Project 81 corpus

- **Aggregate state:** `honest_limit`
- **Push / corpus SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Fresh 5292 proof-source SHA:** `5292af40d0ad5303b85a678f6e629503a8725848`
- **Seeded/carried corpus:** `46872994e4cae80830c381cb49456e8c77583d7e`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#372
- **Review note:** First k6 fold was not clean PASS: Cael missed wake/Tempo receipt after accepted dispatch and Ronan was HONEST-LIMIT-candidate; manual Tempo receipts now close the row. #372 remains preserved as method friction.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `true` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/cael/p81-cael-live-resume6-20260709T031952Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CW-3/cael/20260709T031955Z-r-cw-3/run-result.json` |
| ronan | `HONEST-LIMIT-candidate` | `true` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CW-3/ronan/20260709T033150Z-r-cw-3/run-result.json` |

## Notes

- Raw/redacted k6 output, row logs, report receipts, and generated `run-result.json` files are preserved under `artifacts/`.
- These are live-candidate artifacts: candidate states still require human fold review before becoming canonical PASS rows.

## Manual closeout receipt (post-merge)

Manual Tempo receipts were added after the first corpus merge:

- `manual-receipts/tempo/ronan-continue-work-schedule-trace.json`
- `manual-receipts/tempo/ronan-continue-work-schedule-trace.sha256`
- `manual-receipts/tempo/ronan-continue-work-tempo-review.json`
- `manual-receipts/MANUAL-REVIEW.md`

Ronan's live row already proved `dispatch_accepted=true`, `scheduled_sentinel=true`, `wake_observed=true`, and `public_artifact_raw_reason_absent=true`. The manual Tempo review for trace `ce3ba0648e16883ba5a8cdcb3b3d2021` shows an `openclaw.tool.execution` span for `continue_work` plus a `continuation.work` span with safe reason telemetry (`reason.present`, `reason.length`, `reason.hash`) and no raw reason sentinel strings. The aggregate row state is upgraded to `pass`; Cael's missing-wake partial artifact and #372 remain preserved as method friction.

## Fresh 5292 closeout

| Run | Seat | Verdict | k6 exit | Review | Run-result path |
|---|---|---:|---:|---|---|
| `28996281182` | cael | `HONEST-LIMIT-candidate` | `0` | `review-pending (tempo-trace-json)` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/fresh-5292/actions/28996281182/20260709T053010Z-cael-dgx-4090286/5292af40d0ad5303b85a678f6e629503a8725848/R-CW-3/cael/20260709T053013Z-r-cw-3/run-result.json` |
| `28996282368` | ronan | `HONEST-LIMIT-candidate` | `0` | `review-pending (tempo-trace-json)` | `PROOFS/5292af40d0ad5303b85a678f6e629503a8725848/artifacts/fresh-5292/actions/28996282368/20260709T053110Z-ronan-dgx-4137502/5292af40d0ad5303b85a678f6e629503a8725848/R-CW-3/ronan/20260709T053113Z-r-cw-3/run-result.json` |

**5292 interpretation:** Fresh runs observed dispatch/schedule/wake and raw-reason absence, but no fresh Tempo trace JSON was emitted in-window; fold as honest_limit for 5292.
