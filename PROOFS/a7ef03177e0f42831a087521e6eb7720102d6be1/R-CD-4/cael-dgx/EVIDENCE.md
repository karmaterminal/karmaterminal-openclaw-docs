# R-CD-4 — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T075003Z-r-cd-4-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:verdict` |
| Effective exit code | `99` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T075003Z-r-cd-4-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:51:38-07:00" level=info msg="\n[R-CD-4] VERDICT: PARTIAL-candidate" source=console
[R-CD-4] Summary: PARTIAL-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `agent_turn_observed` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.agent_turn_observed` |
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.candidateSha` |
| `child_completed` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.child_completed` |
| `child_session_ambiguous` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.child_session_ambiguous` |
| `child_session_invalid` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.child_session_invalid` |
| `delegate_mode` | `silent-wake` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.delegate_mode` |
| `dispatch_accepted_at_ms` | `1786348209512` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `92252` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:51:38.545Z` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.manifest_loaded` |
| `parent_return_candidate` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.parent_return_candidate` |
| `parent_return_receipt` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.parent_return_receipt` |
| `parent_session_created` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.parent_session_created` |
| `reason_hash` | `59e0cf3674b56c70` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `127` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.reason_length` |
| `return_in_parent` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.return_in_parent` |
| `return_in_target` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.return_in_target` |
| `row` | `R-CD-4` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.seat` |
| `started` | `2026-08-10T07:50:06.293Z` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.started` |
| `target_return_candidate` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.target_return_candidate` |
| `target_return_receipt` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.target_return_receipt` |
| `target_session_created` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.target_session_created` |
| `tool_accepted` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.tool_accepted` |
| `trace_id` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.trace_id` |
| `wake_gate_ms` | `5000` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.wake_gate_ms` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `present` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `608836f4e924dfbbf7126efdeee149e1` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `tempo-trace-608836f4e924.json` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `continuation-trace-correlation.json` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `return_in_target` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.return_in_target` |
| `return_in_parent` | `false` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.return_in_parent` |
| `child_completed` | `true` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.child_completed` |
| `trace_id` | `null` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json:evidence.trace_id` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1960 | `9f593d3f46d4175c` | `../cael/20260810T075003Z-r-cd-4-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T075003Z-r-cd-4-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 61 | `ecec5fb19d2654bb` | `../cael/20260810T075003Z-r-cd-4-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 826 | `09a1e58362061444` | `../cael/20260810T075003Z-r-cd-4-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T075003Z-r-cd-4-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `78b7de8761b9490b` | `../cael/20260810T075003Z-r-cd-4-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `2f1a74095a01b1e6` | `../cael/20260810T075003Z-r-cd-4-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 5243 | `b6c236c66b81539e` | `../cael/20260810T075003Z-r-cd-4-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `b479d79eb1261056` | `../cael/20260810T075003Z-r-cd-4-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 16231 | `d435ceb83d55d8be` | `../cael/20260810T075003Z-r-cd-4-34f430ee/k6.log` |
| `metrics-export.json` | 553 | `22bc82670c1c506f` | `../cael/20260810T075003Z-r-cd-4-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3269 | `b7ed157b5e04a9ac` | `../cael/20260810T075003Z-r-cd-4-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 23342 | `cf7d5a8634f52206` | `../cael/20260810T075003Z-r-cd-4-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4168 | `5121d45e70673061` | `../cael/20260810T075003Z-r-cd-4-34f430ee/row-manifest.json` |
| `row-scenario.js` | 18844 | `bb9a116243488f44` | `../cael/20260810T075003Z-r-cd-4-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 753 | `78ced8ab41e27f3c` | `../cael/20260810T075003Z-r-cd-4-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T075003Z-r-cd-4-34f430ee/seat-readiness.json` |
| `continuation-trace-correlation.json` | 1650 | `708903b905421ca8` | `../cael/20260810T075003Z-r-cd-4-34f430ee/continuation-trace-correlation.json` |
| `tempo-trace-608836f4e924.json` | 3001 | `5f66e7ba5498a528` | `../cael/20260810T075003Z-r-cd-4-34f430ee/tempo-trace-608836f4e924.json` |
| `r-cd-4-summary.json` | 358 | `5ebc47ef3e4790e2` | `../cael/20260810T075003Z-r-cd-4-34f430ee/r-cd-4-summary.json` |

Raw run directory file count: `23`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

