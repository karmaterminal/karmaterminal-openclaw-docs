# R-CW-1 — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080029Z-r-cw-1-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:verdict` |
| Effective exit code | `0` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `review-pending` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:review.status` |
| Pending receipts | `continuation-trace-correlation, tempo-trace-json` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T080029Z-r-cw-1-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:00:53-07:00" level=info msg="\n[R-CW-1] VERDICT: PASS-candidate" source=console
[R-CW-1] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.candidateSha` |
| `continue_work_tool_result_scheduled` | `true` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.continue_work_tool_result_scheduled` |
| `dispatch_accepted_at_ms` | `1786348835613` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `21230` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:00:53.393Z` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.manifest_loaded` |
| `reason_hash` | `42ce8aa4d8f45556` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `121` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.reason_length` |
| `row` | `R-CW-1` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.row` |
| `scheduled_result_at_ms` | `1786348853373` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.scheduled_result_at_ms` |
| `seat` | `cael` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:00:32.163Z` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.started` |
| `tool_invoke_accepted` | `true` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.tool_invoke_accepted` |
| `trace_id` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.trace_id` |
| `wake_delay_ms` | `20` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.wake_delay_ms` |
| `work_woke_event` | `true` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.work_woke_event` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `missing` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row reports a candidate pass but still carries review-pending receipts; the pending receipt list is preserved above.

| Receipt field | Observed value | Source |
|---|---:|---|
| `trace_id` | `null` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json:evidence.trace_id` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1524 | `d0d1424942cd9e76` | `../cael/20260810T080029Z-r-cw-1-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T080029Z-r-cw-1-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 90 | `035422e76458e664` | `../cael/20260810T080029Z-r-cw-1-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 488 | `640aac8bb5c57e65` | `../cael/20260810T080029Z-r-cw-1-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T080029Z-r-cw-1-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `739a0ea72ae4d1f1` | `../cael/20260810T080029Z-r-cw-1-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `578765ad6692f496` | `../cael/20260810T080029Z-r-cw-1-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 5541 | `128dd8f5b50ad2c4` | `../cael/20260810T080029Z-r-cw-1-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `1afc19d3f66b6055` | `../cael/20260810T080029Z-r-cw-1-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 5081 | `0eec6d22ee6c0346` | `../cael/20260810T080029Z-r-cw-1-34f430ee/k6.log` |
| `metrics-export.json` | 550 | `2d15b21c5cd3861e` | `../cael/20260810T080029Z-r-cw-1-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3041 | `808a335acd62a331` | `../cael/20260810T080029Z-r-cw-1-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 21487 | `f24f48446d7151c5` | `../cael/20260810T080029Z-r-cw-1-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3177 | `6159bf0cdeb38e3e` | `../cael/20260810T080029Z-r-cw-1-34f430ee/row-manifest.json` |
| `row-scenario.js` | 11343 | `a511f5815c9dffe1` | `../cael/20260810T080029Z-r-cw-1-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 753 | `9493a4db8bf34d80` | `../cael/20260810T080029Z-r-cw-1-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T080029Z-r-cw-1-34f430ee/seat-readiness.json` |
| `r-cw-1-tool-schedule-wake-summary.json` | 355 | `a94b88afaecf1c63` | `../cael/20260810T080029Z-r-cw-1-34f430ee/r-cw-1-tool-schedule-wake-summary.json` |

Raw run directory file count: `22`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

