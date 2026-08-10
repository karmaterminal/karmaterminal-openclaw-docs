# R-RC-2 — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T081126Z-r-rc-2-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:verdict` |
| Effective exit code | `0` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `review-pending` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:review.status` |
| Pending receipts | `continuation-trace-correlation, tempo-trace-json` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T081126Z-r-rc-2-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:13:30-07:00" level=info msg="\n[R-RC-2] VERDICT: PARTIAL-candidate" source=console
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.candidateSha` |
| `child_history_available` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.child_history_available` |
| `child_history_requests` | `0` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.child_history_requests` |
| `child_reported_context_threshold` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.child_reported_context_threshold` |
| `child_session_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.child_session_observed` |
| `context_usage` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.context_usage` |
| `delegate_child_report_observed` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.delegate_child_report_observed` |
| `delegate_mode` | `normal` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.delegate_mode` |
| `delegate_requested` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.delegate_requested` |
| `dispatch_accepted_at_ms` | `1786349491935` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `121301` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:13:30.915Z` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.ended` |
| `guard` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.guard` |
| `manifest_loaded` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.manifest_loaded` |
| `parent_dispatch_accepted` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.parent_dispatch_accepted` |
| `post_compaction_path_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.post_compaction_path_observed` |
| `reason_hash` | `77662cb3ae5db0db` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `618` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.reason_length` |
| `reported_context_usage` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.reported_context_usage` |
| `reported_threshold` | `70` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.reported_threshold` |
| `request_compaction_accepted` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_accepted` |
| `request_compaction_accepted_reported` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_accepted_reported` |
| `request_compaction_invocation_bound` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_invocation_bound` |
| `request_compaction_receipt_role` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_receipt_role` |
| `request_compaction_receipt_status` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_receipt_status` |
| `request_compaction_receipt_tool_name` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_receipt_tool_name` |
| `request_compaction_rejected_context_threshold` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_rejected_context_threshold` |
| `request_compaction_tool_result_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_tool_result_observed` |
| `row` | `R-RC-2` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:11:29.614Z` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.started` |
| `threshold` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.threshold` |
| `trace_id` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.trace_id` |
| `verdict` | `PARTIAL-candidate` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.verdict` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `missing` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `child_session_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.child_session_observed` |
| `trace_id` | `null` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.trace_id` |
| `delegate_child_report_observed` | `true` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.delegate_child_report_observed` |
| `request_compaction_tool_result_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.request_compaction_tool_result_observed` |
| `post_compaction_path_observed` | `false` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json:evidence.post_compaction_path_observed` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 2243 | `ab7f4ef3ecc81c7c` | `../cael/20260810T081126Z-r-rc-2-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T081126Z-r-rc-2-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 90 | `035422e76458e664` | `../cael/20260810T081126Z-r-rc-2-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 1112 | `f0ce9726b67be862` | `../cael/20260810T081126Z-r-rc-2-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T081126Z-r-rc-2-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `a9a75ac42500f4f2` | `../cael/20260810T081126Z-r-rc-2-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `cad1f8ccdf26c431` | `../cael/20260810T081126Z-r-rc-2-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 4107 | `c52f40ded728b1a7` | `../cael/20260810T081126Z-r-rc-2-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `861ce54914047ace` | `../cael/20260810T081126Z-r-rc-2-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 28046 | `96ee13067f90d891` | `../cael/20260810T081126Z-r-rc-2-34f430ee/k6.log` |
| `metrics-export.json` | 550 | `366b3f633bef07ec` | `../cael/20260810T081126Z-r-rc-2-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3090 | `59fcc3dd54a9e73b` | `../cael/20260810T081126Z-r-rc-2-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 21536 | `e5f54267dd18f594` | `../cael/20260810T081126Z-r-rc-2-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4014 | `229d9f7b30df3e18` | `../cael/20260810T081126Z-r-rc-2-34f430ee/row-manifest.json` |
| `row-scenario.js` | 18620 | `0e155329a73c2695` | `../cael/20260810T081126Z-r-rc-2-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 771 | `7e783beb45860876` | `../cael/20260810T081126Z-r-rc-2-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T081126Z-r-rc-2-34f430ee/seat-readiness.json` |
| `r-rc-2-summary.json` | 381 | `2a36c143a2715e80` | `../cael/20260810T081126Z-r-rc-2-34f430ee/r-rc-2-summary.json` |

Raw run directory file count: `23`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

