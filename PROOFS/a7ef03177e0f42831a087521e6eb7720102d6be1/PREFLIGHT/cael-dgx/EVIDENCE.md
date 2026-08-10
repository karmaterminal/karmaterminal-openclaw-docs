# PREFLIGHT — unclassified

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T074801Z-preflight-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `unclassified` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:verdict` |
| Verdict source | `none` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `unclassified` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:verdict` |
| Effective exit code | `0` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T074801Z-preflight-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.candidateSha` |
| `connected` | `true` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.connected` |
| `duration_ms` | `1095` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T07:48:05.439Z` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.manifest_loaded` |
| `row` | `preflight` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.seat` |
| `sessions_list_ok` | `true` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.sessions_list_ok` |
| `started` | `2026-08-10T07:48:04.344Z` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.started` |
| `tool_inventory_count` | `0` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.tool_inventory_count` |
| `tools_effective_ok` | `true` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:evidence.tools_effective_ok` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1150 | `eded7ec54fcf7d5a` | `../cael/20260810T074801Z-preflight-34f430ee/run-result.json` |
| `candidate-run-result-validation.json` | 0 | `e3b0c44298fc1c14` | `../cael/20260810T074801Z-preflight-34f430ee/candidate-run-result-validation.json` |
| `candidate-run-result-validation.error.log` | 57 | `fa63dc83b6c8672b` | `../cael/20260810T074801Z-preflight-34f430ee/candidate-run-result-validation.error.log` |
| `evidence.jsonl` | 298 | `5c730067b11c82c0` | `../cael/20260810T074801Z-preflight-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T074801Z-preflight-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `373a8bbae8d10757` | `../cael/20260810T074801Z-preflight-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 214 | `969986fd5d1bd2e9` | `../cael/20260810T074801Z-preflight-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 86 | `d45cb86f68e52665` | `../cael/20260810T074801Z-preflight-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 243 | `3755169f7cd67c09` | `../cael/20260810T074801Z-preflight-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 2250 | `9f5feee845f3654f` | `../cael/20260810T074801Z-preflight-34f430ee/k6.log` |
| `metrics-export.json` | 514 | `3a21dcae4be126b0` | `../cael/20260810T074801Z-preflight-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 1733 | `bbc443fd8319bc86` | `../cael/20260810T074801Z-preflight-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 12272 | `58144ea998a4a76c` | `../cael/20260810T074801Z-preflight-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 3111 | `c5c146f9930ed373` | `../cael/20260810T074801Z-preflight-34f430ee/row-manifest.json` |
| `row-scenario.js` | 4848 | `ca6c3300d2bcb614` | `../cael/20260810T074801Z-preflight-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 735 | `f5328fc597e4d1e2` | `../cael/20260810T074801Z-preflight-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T074801Z-preflight-34f430ee/seat-readiness.json` |

Raw run directory file count: `19`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

