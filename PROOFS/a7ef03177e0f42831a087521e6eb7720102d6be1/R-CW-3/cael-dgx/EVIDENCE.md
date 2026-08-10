# R-CW-3 — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080429Z-r-cw-3-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:verdict` |
| Effective exit code | `0` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `review-pending` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:review.status` |
| Pending receipts | `continuation-trace-correlation, tempo-trace-json` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T080429Z-r-cw-3-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:04:53-07:00" level=info msg="\n[R-CW-3] VERDICT: PARTIAL-candidate" source=console
[R-CW-3] Summary: PARTIAL-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.candidateSha` |
| `dispatch_accepted` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `dispatch_accepted_at_ms` | `1786349074092` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `21059` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:04:53.056Z` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.manifest_loaded` |
| `public_artifact_raw_reason_absent` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.public_artifact_raw_reason_absent` |
| `reason_hash` | `654ec9e63d277e34` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `139` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.reason_length` |
| `row` | `R-CW-3` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.row` |
| `scheduled_result_at_ms` | `1786349093019` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.scheduled_result_at_ms` |
| `scheduled_sentinel` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.scheduled_sentinel` |
| `seat` | `cael` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:04:31.997Z` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.started` |
| `tempo_assertion` | `pending-review` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.tempo_assertion` |
| `trace_id` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.trace_id` |
| `trace_id_source` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.trace_id_source` |
| `wake_delay_ms` | `37` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.wake_delay_ms` |
| `wake_observed` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.wake_observed` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `missing` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `dispatch_accepted` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `wake_observed` | `true` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.wake_observed` |
| `trace_id` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.trace_id` |
| `trace_id_source` | `null` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json:evidence.trace_id_source` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1626 | `bdd8df1ff06a96e2` | `../cael/20260810T080429Z-r-cw-3-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T080429Z-r-cw-3-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 90 | `035422e76458e664` | `../cael/20260810T080429Z-r-cw-3-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 565 | `674d347eeefaa4db` | `../cael/20260810T080429Z-r-cw-3-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T080429Z-r-cw-3-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `ddd6e2410bd36474` | `../cael/20260810T080429Z-r-cw-3-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `a65d43e9ac9f9fb5` | `../cael/20260810T080429Z-r-cw-3-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 3386 | `fdf55ff2eeb12009` | `../cael/20260810T080429Z-r-cw-3-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `c013aee1de8ae32b` | `../cael/20260810T080429Z-r-cw-3-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 5030 | `0b231ffbdd0506bc` | `../cael/20260810T080429Z-r-cw-3-34f430ee/k6.log` |
| `metrics-export.json` | 553 | `00f8727c48ceaf53` | `../cael/20260810T080429Z-r-cw-3-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3328 | `92ec7694693d5f74` | `../cael/20260810T080429Z-r-cw-3-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 23401 | `ca97ccdaaa9a8ead` | `../cael/20260810T080429Z-r-cw-3-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3744 | `55857909cb34dfac` | `../cael/20260810T080429Z-r-cw-3-34f430ee/row-manifest.json` |
| `row-scenario.js` | 12917 | `825e4d1afdb39ce0` | `../cael/20260810T080429Z-r-cw-3-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 749 | `551126d3c14e16f1` | `../cael/20260810T080429Z-r-cw-3-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T080429Z-r-cw-3-34f430ee/seat-readiness.json` |
| `r-cw-3-reason-telemetry-summary.json` | 1340 | `220b817e186fc7f1` | `../cael/20260810T080429Z-r-cw-3-34f430ee/r-cw-3-reason-telemetry-summary.json` |

Raw run directory file count: `22`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

