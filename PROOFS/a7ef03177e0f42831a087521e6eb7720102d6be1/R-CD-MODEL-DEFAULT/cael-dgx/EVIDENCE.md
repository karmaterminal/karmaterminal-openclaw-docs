# R-CD-MODEL-DEFAULT — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T075450Z-r-cd-model-default-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:55:21-07:00" level=info msg="\n[R-CD-MODEL-DEFAULT] VERDICT: PASS-candidate" source=console
[R-CD-MODEL-DEFAULT] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.candidateSha` |
| `child_model_byte` | `github-copilot/gpt-5.5` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.child_model_byte` |
| `child_session_observed` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.child_session_observed` |
| `dispatch_accepted` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `duration_ms` | `28898` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:55:21.796Z` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.manifest_loaded` |
| `model_matches` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.model_matches` |
| `parent_model_byte` | `github-copilot/gpt-5.5` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.parent_model_byte` |
| `return_payload` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.return_payload` |
| `row` | `R-CD-MODEL-DEFAULT` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T07:54:52.898Z` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.started` |
| `trace_id` | `null` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1397 | `17a204b0651fb457` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2030 | `99eeea383bb40ad8` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2030 | `99eeea383bb40ad8` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 442 | `eb104e3658dd1124` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `388aa715818a6c5e` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `8f3489dd8c92cbc0` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 6048 | `c27b875440f41692` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `af650e5d29620670` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 13108 | `750a9f6deaa3d6af` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/k6.log` |
| `metrics-export.json` | 562 | `10f8f4a1327d122a` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2966 | `5196ba1cfef924b9` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 19785 | `590cfcf2419765ab` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3789 | `ddc4181d0e1cfe87` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/row-manifest.json` |
| `row-scenario.js` | 8248 | `30ab243cf2e5a0bc` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 763 | `d272902278a57c0a` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/seat-readiness.json` |
| `r-cd-model-default-summary.json` | 367 | `6187aadaddc1901b` | `../cael/20260810T075450Z-r-cd-model-default-34f430ee/r-cd-model-default-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

