# R-REGRESSION-TRAP-TESTS — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:verdict` |
| Verdict source | `summary-file` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.candidateSha` |
| `currentProofSha` | `c868194997d0a61de2e648580afdf40e0d0b34b9` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.currentProofSha` |
| `duration_ms` | `0` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:16:38.802Z` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.manifest_loaded` |
| `row` | `R-REGRESSION-TRAP-TESTS` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.row` |
| `shard_pass_text_present` | `true` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.shard_pass_text_present` |
| `sourceCheckoutSha` | `bca2b0b89ab886bf23a10e4983926f6b374b3188` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.sourceCheckoutSha` |
| `sourceEvidenceSha` | `1cc8f4e3d617ef6f173283ef83d7b739a4995734` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.sourceEvidenceSha` |
| `source_sha_present` | `true` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.source_sha_present` |
| `started` | `2026-08-10T08:16:38.802Z` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.started` |
| `test_count_text_present` | `true` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.test_count_text_present` |
| `verdict` | `PASS-candidate` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.verdict` |
| `verdict_text_present` | `true` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:evidence.verdict_text_present` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 2360 | `d9833d071e992478` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2066 | `ce848956d5a99a3c` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2066 | `ce848956d5a99a3c` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 1326 | `51edaad353317ac1` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `97ee22147c03224f` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 214 | `cedcfcff0af458cf` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 86 | `d45cb86f68e52665` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 243 | `c53d4bdbb61f8ff8` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 1973 | `8724d5ca2e3737ec` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/k6.log` |
| `metrics-export.json` | 566 | `8ab6d157539bdc36` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 1975 | `2230494723dc4e2b` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 12286 | `6a313f2213808cc3` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 2164 | `5c9577e54a200635` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/row-manifest.json` |
| `row-scenario.js` | 4564 | `14cfdb0ec302aecf` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 783 | `022395c6da17cc4f` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/seat-readiness.json` |
| `r-regression-trap-tests-summary.json` | 287 | `60b83162e64c445e` | `../cael/20260810T081635Z-r-regression-trap-tests-34f430ee/r-regression-trap-tests-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

