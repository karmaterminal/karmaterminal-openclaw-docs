# R-CD-3 — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T074943Z-r-cd-3-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T074943Z-r-cd-3-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T074943Z-r-cd-3-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:50:00-07:00" level=info msg="\n[R-CD-3] VERDICT: PASS-candidate" source=console
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.candidateSha` |
| `compaction_accepted` | `false` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.compaction_accepted` |
| `compaction_requested` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.compaction_requested` |
| `context_usage` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.context_usage` |
| `delegate_staging_requested` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.delegate_staging_requested` |
| `dispatch_accepted` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `duration_ms` | `14216` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:50:00.397Z` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.ended` |
| `guard` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.guard` |
| `lifeboat_return_observed` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.lifeboat_return_observed` |
| `manifest_loaded` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.manifest_loaded` |
| `row` | `R-CD-3` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T07:49:46.180Z` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.started` |
| `threshold` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.threshold` |
| `threshold_refusal_observed` | `false` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.threshold_refusal_observed` |
| `trace_id` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.trace_id` |
| `verdict` | `PASS-candidate` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:evidence.verdict` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1470 | `d597206d288a5693` | `../cael/20260810T074943Z-r-cd-3-34f430ee/run-result.json` |
| `candidate-run-result.json` | 1990 | `e123f5bc8430dee8` | `../cael/20260810T074943Z-r-cd-3-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 1990 | `e123f5bc8430dee8` | `../cael/20260810T074943Z-r-cd-3-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 503 | `87d6d3586975b36a` | `../cael/20260810T074943Z-r-cd-3-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T074943Z-r-cd-3-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `9c3d9b3885dfad4b` | `../cael/20260810T074943Z-r-cd-3-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 215 | `85fc372090a72294` | `../cael/20260810T074943Z-r-cd-3-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 990 | `0367e305ec2c408e` | `../cael/20260810T074943Z-r-cd-3-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `f91f64f2a694cd1e` | `../cael/20260810T074943Z-r-cd-3-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 3684 | `3bedb1d3e8d3448d` | `../cael/20260810T074943Z-r-cd-3-34f430ee/k6.log` |
| `metrics-export.json` | 549 | `fe781e31da74f1cc` | `../cael/20260810T074943Z-r-cd-3-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2277 | `36cf756a20718ae7` | `../cael/20260810T074943Z-r-cd-3-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 15842 | `86af75d4d18f5c62` | `../cael/20260810T074943Z-r-cd-3-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3851 | `2ee3461c50d8786c` | `../cael/20260810T074943Z-r-cd-3-34f430ee/row-manifest.json` |
| `row-scenario.js` | 11020 | `dcd26f9f9006d7bf` | `../cael/20260810T074943Z-r-cd-3-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 747 | `43fcdc12b6e8c587` | `../cael/20260810T074943Z-r-cd-3-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T074943Z-r-cd-3-34f430ee/seat-readiness.json` |
| `r-cd-3-summary.json` | 375 | `6c554c6a022d0f11` | `../cael/20260810T074943Z-r-cd-3-34f430ee/r-cd-3-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

