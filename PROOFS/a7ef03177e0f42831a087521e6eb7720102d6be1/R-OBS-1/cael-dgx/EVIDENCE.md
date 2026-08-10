# R-OBS-1 — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T081030Z-r-obs-1-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:verdict` |
| Verdict source | `summary-file` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T081030Z-r-obs-1-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T081030Z-r-obs-1-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `build_visible` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.build_visible` |
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.candidateSha` |
| `context_visible` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.context_visible` |
| `continuation_chain_visible` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.continuation_chain_visible` |
| `dispatch_accepted` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.dispatch_accepted` |
| `duration_ms` | `18736` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:10:51.910Z` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.manifest_loaded` |
| `route_visible` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.route_visible` |
| `row` | `R-OBS-1` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:10:33.174Z` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.started` |
| `status_card_observed` | `true` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.status_card_observed` |
| `trace_id` | `null` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1334 | `515c0407a1bf7cb6` | `../cael/20260810T081030Z-r-obs-1-34f430ee/run-result.json` |
| `candidate-run-result.json` | 1970 | `3a08752725f8c677` | `../cael/20260810T081030Z-r-obs-1-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 1970 | `3a08752725f8c677` | `../cael/20260810T081030Z-r-obs-1-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 396 | `c416fc768acaf574` | `../cael/20260810T081030Z-r-obs-1-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T081030Z-r-obs-1-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `6258768ad824a583` | `../cael/20260810T081030Z-r-obs-1-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `98dd9f54fab8a95c` | `../cael/20260810T081030Z-r-obs-1-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 4112 | `8bd2db680c773ac4` | `../cael/20260810T081030Z-r-obs-1-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `29a860a911bb2ff4` | `../cael/20260810T081030Z-r-obs-1-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 3968 | `0d9ece02e15d621b` | `../cael/20260810T081030Z-r-obs-1-34f430ee/k6.log` |
| `metrics-export.json` | 550 | `b83dd6e4207c87fe` | `../cael/20260810T081030Z-r-obs-1-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 2240 | `6a15a21363e0d4e1` | `../cael/20260810T081030Z-r-obs-1-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 15805 | `38a19fc88e898d99` | `../cael/20260810T081030Z-r-obs-1-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 2931 | `63588a11932ad789` | `../cael/20260810T081030Z-r-obs-1-34f430ee/row-manifest.json` |
| `row-scenario.js` | 9338 | `e4ff43d0a361cf20` | `../cael/20260810T081030Z-r-obs-1-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 719 | `5a79a4bd5c617475` | `../cael/20260810T081030Z-r-obs-1-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T081030Z-r-obs-1-34f430ee/seat-readiness.json` |
| `r-obs-1-summary.json` | 295 | `a81a01073da6eb7f` | `../cael/20260810T081030Z-r-obs-1-34f430ee/r-obs-1-summary.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

