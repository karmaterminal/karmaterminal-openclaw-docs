# R-RC-1 — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T081107Z-r-rc-1-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T081107Z-r-rc-1-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T081107Z-r-rc-1-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:11:23-07:00" level=info msg="\n[R-RC-1] VERDICT: PASS-candidate" source=console
[R-RC-1] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `assistant_sentinel_observed` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.assistant_sentinel_observed` |
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.candidateSha` |
| `context_usage` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.context_usage` |
| `dispatch_accepted` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `dispatch_accepted_at_ms` | `1786349472162` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `13224` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:11:23.588Z` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.ended` |
| `guard` | `context_threshold` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.guard` |
| `history_attempts` | `2` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.history_attempts` |
| `history_requested` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.history_requested` |
| `manifest_loaded` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.manifest_loaded` |
| `no_compaction_side_effect` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.no_compaction_side_effect` |
| `row` | `R-RC-1` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:11:10.364Z` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.started` |
| `threshold` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.threshold` |
| `tool_call_id` | `exec-1686250e-9956-4934-b192-617ef6e9d4eb` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_call_id` |
| `tool_inventory_checked` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_inventory_checked` |
| `tool_invocation_observed` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_invocation_observed` |
| `tool_invoke_rejected` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_invoke_rejected` |
| `tool_name` | `request_compaction` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_name` |
| `tool_registered` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_registered` |
| `tool_result_observed` | `true` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_result_observed` |
| `tool_result_status` | `rejected` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.tool_result_status` |
| `trace_id` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1762 | `b2c8b1c37b6f9f62` | `../cael/20260810T081107Z-r-rc-1-34f430ee/run-result.json` |
| `candidate-run-result.json` | 1992 | `6dfff6d11512616b` | `../cael/20260810T081107Z-r-rc-1-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 1992 | `6dfff6d11512616b` | `../cael/20260810T081107Z-r-rc-1-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 753 | `9fd6a5408c0366bd` | `../cael/20260810T081107Z-r-rc-1-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T081107Z-r-rc-1-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `3d102bfb12580277` | `../cael/20260810T081107Z-r-rc-1-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 215 | `afc513b2483fcb73` | `../cael/20260810T081107Z-r-rc-1-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 990 | `905e5d433ccca54a` | `../cael/20260810T081107Z-r-rc-1-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `b9b0df9674885873` | `../cael/20260810T081107Z-r-rc-1-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 4297 | `3404100c75cf5414` | `../cael/20260810T081107Z-r-rc-1-34f430ee/k6.log` |
| `metrics-export.json` | 549 | `ac0e8390185b66d0` | `../cael/20260810T081107Z-r-rc-1-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2249 | `9d55b7af571281d2` | `../cael/20260810T081107Z-r-rc-1-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 15814 | `9d1c188c138c3063` | `../cael/20260810T081107Z-r-rc-1-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 2973 | `8e2cb6d5333545ec` | `../cael/20260810T081107Z-r-rc-1-34f430ee/row-manifest.json` |
| `row-scenario.js` | 13404 | `57608c4f10ddcb6d` | `../cael/20260810T081107Z-r-rc-1-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 749 | `b5de89ec5ee21b42` | `../cael/20260810T081107Z-r-rc-1-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T081107Z-r-rc-1-34f430ee/seat-readiness.json` |
| `r-rc-1-summary.json` | 355 | `144770d167db1026` | `../cael/20260810T081107Z-r-rc-1-34f430ee/r-rc-1-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

