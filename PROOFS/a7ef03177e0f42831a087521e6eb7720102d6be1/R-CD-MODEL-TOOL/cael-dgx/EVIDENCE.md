# R-CD-MODEL-TOOL — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:verdict` |
| Effective exit code | `99` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:59:05-07:00" level=info msg="\n[R-CD-MODEL-TOOL] VERDICT: PARTIAL-candidate" source=console
[R-CD-MODEL-TOOL] Summary: PARTIAL-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.candidateSha` |
| `child_metadata_model_byte` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_metadata_model_byte` |
| `child_metadata_model_source` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_metadata_model_source` |
| `child_metadata_requested` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_metadata_requested` |
| `child_self_reported_model` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_self_reported_model` |
| `child_self_reported_model_source` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_self_reported_model_source` |
| `child_session_metadata` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_session_metadata` |
| `child_session_metadata_observed` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_session_metadata_observed` |
| `child_session_observed` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_session_observed` |
| `dispatch_accepted` | `true` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `duration_ms` | `181430` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:59:05.918Z` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.manifest_loaded` |
| `model_classification_reason` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.model_classification_reason` |
| `model_matches` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.model_matches` |
| `parent_scheduled_sentinel` | `true` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.parent_scheduled_sentinel` |
| `requested_model_byte` | `openai/gpt-5.6-luna` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.requested_model_byte` |
| `return_payload` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.return_payload` |
| `row` | `R-CD-MODEL-TOOL` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T07:56:04.488Z` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.started` |
| `trace_id` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `return_payload` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.return_payload` |
| `child_session_observed` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_session_observed` |
| `child_session_metadata_observed` | `false` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.child_session_metadata_observed` |
| `dispatch_accepted` | `true` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `trace_id` | `null` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json:evidence.trace_id` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1789 | `b6b17abf1df2756d` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 61 | `ecec5fb19d2654bb` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 772 | `ca41af657dc9b98b` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `ba9caeee7edcab74` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 218 | `6c2a85abac64cd5a` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 23604 | `5a95fa0138bed3d0` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 245 | `d8d0bb09dc29cd1d` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 33713 | `94716bfaa86593dc` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/k6.log` |
| `metrics-export.json` | 562 | `aefd847611855de2` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2925 | `a0260477f769c36b` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 19744 | `8753e49d9c63bca3` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4195 | `df83ff8ee2bdb2e7` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/row-manifest.json` |
| `row-scenario.js` | 13654 | `2d66462b9e98fe75` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 751 | `cce9ae3e93a1ecfd` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/seat-readiness.json` |
| `r-cd-model-tool-summary.json` | 518 | `2a7c03298b4f0a87` | `../cael/20260810T075601Z-r-cd-model-tool-34f430ee/r-cd-model-tool-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

