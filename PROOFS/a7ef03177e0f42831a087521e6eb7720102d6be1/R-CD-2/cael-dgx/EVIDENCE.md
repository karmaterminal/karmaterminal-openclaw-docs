# R-CD-2 — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T074903Z-r-cd-2-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:verdict` |
| Verdict source | `r-cd-2-authoritative-receipt` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T074903Z-r-cd-2-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T074903Z-r-cd-2-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `authoritativeReceipt` | `r-cd-2-authoritative-receipt.json` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:evidence.authoritativeReceipt` |
| `row` | `R-CD-2` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:evidence.row` |
| `verdict` | `PARTIAL-candidate` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:evidence.verdict` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `r-cd-2-authoritative-receipt` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `r-cd-2-authoritative-receipt.json` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

`R-CD-2` used the row-specific authoritative receipt and that receipt states `PARTIAL-candidate`; this file does not upgrade it.

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1243 | `aa924f669aa9fd75` | `../cael/20260810T074903Z-r-cd-2-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2234 | `b2b684e5ba7fd7b7` | `../cael/20260810T074903Z-r-cd-2-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2234 | `b2b684e5ba7fd7b7` | `../cael/20260810T074903Z-r-cd-2-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 106 | `8e4020569c93b8ef` | `../cael/20260810T074903Z-r-cd-2-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T074903Z-r-cd-2-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `1cb06a1b8eadc99a` | `../cael/20260810T074903Z-r-cd-2-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `a8b0f5841f77fb43` | `../cael/20260810T074903Z-r-cd-2-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 80 | `0faee7d306cec744` | `../cael/20260810T074903Z-r-cd-2-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `156217ce2965cfdf` | `../cael/20260810T074903Z-r-cd-2-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 75 | `5d839d8b608d546d` | `../cael/20260810T074903Z-r-cd-2-34f430ee/k6.log` |
| `metrics-export.json` | 553 | `3c563eae5e241b2d` | `../cael/20260810T074903Z-r-cd-2-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2762 | `8cbe7292800215ae` | `../cael/20260810T074903Z-r-cd-2-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 19581 | `2d62dfeac5140360` | `../cael/20260810T074903Z-r-cd-2-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4197 | `2fb5221e38265e9a` | `../cael/20260810T074903Z-r-cd-2-34f430ee/row-manifest.json` |
| `row-scenario.js` | 22892 | `1cdac9a604bb3112` | `../cael/20260810T074903Z-r-cd-2-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 739 | `cb775e356cfc74f7` | `../cael/20260810T074903Z-r-cd-2-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T074903Z-r-cd-2-34f430ee/seat-readiness.json` |
| `r-cd-2-summary.json` | 718 | `303dc5de483b1719` | `../cael/20260810T074903Z-r-cd-2-34f430ee/r-cd-2-summary.json` |
| `r-cd-2-authoritative-receipt.json` | 641 | `765f2c3f87c9e1fe` | `../cael/20260810T074903Z-r-cd-2-34f430ee/r-cd-2-authoritative-receipt.json` |
| `r-cd-2-authoritative-resolution.json` | 78 | `119afecd05499bf6` | `../cael/20260810T074903Z-r-cd-2-34f430ee/r-cd-2-authoritative-resolution.json` |

Raw run directory file count: `23`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

