# R-CW-3 evidence — e08f696 live P81 run

- **Aggregate state:** `honest_limit`
- **Candidate SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Issue links:** karmaterminal/karmaterminal-openclaw-docs#372
- **Review note:** No clean PASS fold: Cael partial on missing wake/Tempo receipt after accepted dispatch; Ronan HONEST-LIMIT-candidate. Tracked in #372.

## Seat artifacts

| Seat | Run-result verdict | Evidence object | Run-result path |
|---|---:|---:|---|
| cael | `PARTIAL-candidate` | `true` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/cael/p81-cael-live-resume6-20260709T031952Z/out/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CW-3/cael/20260709T031955Z-r-cw-3/run-result.json` |
| ronan | `HONEST-LIMIT-candidate` | `true` | `PROOFS/e08f696618da57e7267a2148578fa4ab0d8b0d01/artifacts/ronan/p81-ronan-live-e08f696-20260709T032347Z/artifacts/e08f696618da57e7267a2148578fa4ab0d8b0d01/R-CW-3/ronan/20260709T033150Z-r-cw-3/run-result.json` |

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
