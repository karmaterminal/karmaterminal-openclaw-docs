# R-CD-1 — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T074808Z-r-cd-1-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T074808Z-r-cd-1-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T074808Z-r-cd-1-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:48:55-07:00" level=info msg="\n[R-CD-1] VERDICT: PASS-candidate" source=console
[R-CD-1] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.candidateSha` |
| `delegate_delay_ms` | `1000` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.delegate_delay_ms` |
| `delegate_mode` | `normal` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.delegate_mode` |
| `delegate_scheduled_at_ms` | `1786348120699` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.delegate_scheduled_at_ms` |
| `delegate_scheduled_sentinel` | `true` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.delegate_scheduled_sentinel` |
| `delegate_wake_gate_ms` | `5000` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.delegate_wake_gate_ms` |
| `dispatch_accepted_at_ms` | `1786348093454` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `44381` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:48:55.700Z` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.manifest_loaded` |
| `parent_return_event` | `true` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.parent_return_event` |
| `parent_return_event_at_ms` | `1786348130523` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.parent_return_event_at_ms` |
| `reason_hash` | `ead2bcd1eb4e7ae5` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `139` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.reason_length` |
| `row` | `R-CD-1` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T07:48:11.319Z` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.started` |
| `task_ledger_entry_optional` | `false` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.task_ledger_entry_optional` |
| `tool_invoke_accepted` | `true` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.tool_invoke_accepted` |
| `trace_collect_after_ms` | `1786348135699` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.trace_collect_after_ms` |
| `trace_id` | `null` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.trace_id` |
| `wake_gate_ms` | `5000` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:evidence.wake_gate_ms` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `present` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `608836f4e924dfbbf7126efdeee149e1` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `tempo-trace-608836f4e924.json` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `continuation-trace-correlation.json` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1849 | `8fdf54757c619807` | `../cael/20260810T074808Z-r-cd-1-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2061 | `46f468e093e5afd3` | `../cael/20260810T074808Z-r-cd-1-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2061 | `46f468e093e5afd3` | `../cael/20260810T074808Z-r-cd-1-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 741 | `be0570501f9d1bab` | `../cael/20260810T074808Z-r-cd-1-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T074808Z-r-cd-1-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `ae5d80f9a1692e6f` | `../cael/20260810T074808Z-r-cd-1-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `458817ebff168bac` | `../cael/20260810T074808Z-r-cd-1-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 3269 | `c76f94603f8e8991` | `../cael/20260810T074808Z-r-cd-1-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `f3e0b236ce71dd0d` | `../cael/20260810T074808Z-r-cd-1-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 10389 | `f4a9fa6da8c3b619` | `../cael/20260810T074808Z-r-cd-1-34f430ee/k6.log` |
| `metrics-export.json` | 549 | `54852d32014416cb` | `../cael/20260810T074808Z-r-cd-1-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2499 | `ac6e2fa603bc627e` | `../cael/20260810T074808Z-r-cd-1-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 17691 | `022689f98959eeba` | `../cael/20260810T074808Z-r-cd-1-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3520 | `6b1cff32a674f6d8` | `../cael/20260810T074808Z-r-cd-1-34f430ee/row-manifest.json` |
| `row-scenario.js` | 14480 | `45aaad43cc5fff6a` | `../cael/20260810T074808Z-r-cd-1-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 745 | `567564325fd2ca68` | `../cael/20260810T074808Z-r-cd-1-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T074808Z-r-cd-1-34f430ee/seat-readiness.json` |
| `continuation-trace-correlation.json` | 1550 | `8d70de0650c63689` | `../cael/20260810T074808Z-r-cd-1-34f430ee/continuation-trace-correlation.json` |
| `tempo-trace-608836f4e924.json` | 2734 | `a9eb58ff832e6b5f` | `../cael/20260810T074808Z-r-cd-1-34f430ee/tempo-trace-608836f4e924.json` |
| `r-cd-1-typed-delegate-summary.json` | 355 | `d62b917d3484ae6a` | `../cael/20260810T074808Z-r-cd-1-34f430ee/r-cd-1-typed-delegate-summary.json` |

Raw run directory file count: `23`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

