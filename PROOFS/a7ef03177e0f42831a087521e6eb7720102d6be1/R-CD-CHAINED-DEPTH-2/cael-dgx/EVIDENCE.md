# R-CD-CHAINED-DEPTH-2 — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:verdict` |
| Effective exit code | `99` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T00:54:15-07:00" level=info msg="\n[R-CD-CHAINED-DEPTH-2] VERDICT: PARTIAL-candidate" source=console
[R-CD-CHAINED-DEPTH-2] Summary: PARTIAL-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.candidateSha` |
| `chain_return_received` | `false` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.chain_return_received` |
| `child_done_sentinel` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.child_done_sentinel` |
| `child_spawned` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.child_spawned` |
| `delegate_mode` | `silent-wake` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.delegate_mode` |
| `dispatch_accepted_at_ms` | `1786348306772` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `151179` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:54:15.750Z` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.ended` |
| `grandchild_done_sentinel` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.grandchild_done_sentinel` |
| `grandchild_spawned` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.grandchild_spawned` |
| `manifest_loaded` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.manifest_loaded` |
| `max_depth_observed` | `2` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.max_depth_observed` |
| `parent_dispatch_accepted` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.parent_dispatch_accepted` |
| `reason_hash` | `cb3a93d4bc7f558e` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.reason_hash` |
| `reason_length` | `441` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.reason_length` |
| `root_return_candidate` | `null` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.root_return_candidate` |
| `root_return_receipt` | `null` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.root_return_receipt` |
| `row` | `R-CD-CHAINED-DEPTH-2` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T07:51:44.571Z` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.started` |
| `trace_id` | `null` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `present` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `66d888a7ec742a674985bb86ded00ef6` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `tempo-trace-66d888a7ec74.json` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `continuation-trace-correlation.json` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `chain_return_received` | `false` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.chain_return_received` |
| `child_spawned` | `true` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.child_spawned` |
| `trace_id` | `null` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json:evidence.trace_id` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1728 | `475f793753747909` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 61 | `ecec5fb19d2654bb` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 628 | `e8d1abd629209399` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `331fb4dd0ef8c77d` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `1e7155f6a744d721` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 9033 | `187bec5e8bd0e8a1` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `4f74046adcacfc4a` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 28055 | `d8b77f41c421998f` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/k6.log` |
| `metrics-export.json` | 567 | `54fc4f575111327d` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3594 | `599164106d248f48` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 23667 | `32d6c60ff3af06fe` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4292 | `d44024c864d60db8` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/row-manifest.json` |
| `row-scenario.js` | 15482 | `2ae9db893db5ff47` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 771 | `304edcd32e072782` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/seat-readiness.json` |
| `continuation-trace-correlation.json` | 1664 | `e05e8f5ec4a0546b` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/continuation-trace-correlation.json` |
| `tempo-trace-66d888a7ec74.json` | 3001 | `aa4cf0b0a2c67162` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/tempo-trace-66d888a7ec74.json` |
| `r-cd-chained-depth-2-summary.json` | 378 | `653edd707b427ff1` | `../cael/20260810T075141Z-r-cd-chained-depth-2-34f430ee/r-cd-chained-depth-2-summary.json` |

Raw run directory file count: `23`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

