# R-CW-MULTI-COLLAPSE — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:verdict` |
| Verdict source | `summary-file` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.candidateSha` |
| `carriedFrom` | `c868194997d0a61de2e648580afdf40e0d0b34b9` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.carriedFrom` |
| `currentProofSha` | `c868194997d0a61de2e648580afdf40e0d0b34b9` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.currentProofSha` |
| `duration_ms` | `0` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:09:44.221Z` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.manifest_loaded` |
| `row` | `R-CW-MULTI-COLLAPSE` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.row` |
| `sourceEvidenceSha` | `1cc8f4e3d617ef6f173283ef83d7b739a4995734` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.sourceEvidenceSha` |
| `sourceRow` | `R-CW-MULTI-COLLAPSE` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.sourceRow` |
| `started` | `2026-08-10T08:09:44.221Z` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.started` |
| `staticBoundaryVariant` | `false` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.staticBoundaryVariant` |
| `verdict` | `PASS-candidate` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:evidence.verdict` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 2889 | `b42064c8e4c10104` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2056 | `988e20d47b728db2` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2056 | `988e20d47b728db2` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 1801 | `7d7cc17d228198c2` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `f9b7358e68f36552` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 214 | `f0839cea4d33075a` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 86 | `d45cb86f68e52665` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 243 | `a94c4314d7f46daa` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 2446 | `20e0fb8bb119f196` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/k6.log` |
| `metrics-export.json` | 562 | `cddb2abbc7c6026a` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 1962 | `70b5b537fb79fcc9` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 12273 | `fb89a9caf81bd867` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 2103 | `e920ce36f434d521` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/row-manifest.json` |
| `row-scenario.js` | 19736 | `97cd063c7c90ccb7` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 783 | `b518973f621312f0` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/seat-readiness.json` |
| `static-corpus-row-summary.json` | 283 | `4d8620255d2c3293` | `../cael/20260810T080941Z-r-cw-multi-collapse-34f430ee/static-corpus-row-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

