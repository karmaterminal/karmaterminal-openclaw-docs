# R-CONFIG-DEFAULTS — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080011Z-r-config-defaults-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:00:17-07:00" level=info msg="\n[R-CONFIG-DEFAULTS] VERDICT: PASS-candidate" source=console
[R-CONFIG-DEFAULTS] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.candidateSha` |
| `config_read` | `true` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.config_read` |
| `duration_ms` | `2114` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.duration_ms` |
| `enabled` | `true` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.enabled` |
| `ended` | `2026-08-10T08:00:17.471Z` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.ended` |
| `manifest_loaded` | `true` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.manifest_loaded` |
| `max_chain_length` | `200` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.max_chain_length` |
| `max_delegates_per_turn` | `500` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.max_delegates_per_turn` |
| `row` | `R-CONFIG-DEFAULTS` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.seat` |
| `started` | `2026-08-10T08:00:15.357Z` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.started` |
| `trace_id` | `null` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1614 | `be80b4dc1890ca51` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/run-result.json` |
| `candidate-run-result.json` | 1984 | `126ea2231bc4d0a8` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 1984 | `126ea2231bc4d0a8` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 619 | `7722fb4f8a44897f` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `43982bc55b1324ce` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 214 | `885b3bd713dc023a` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 794 | `267bd64150dabe7a` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 243 | `5d9aa937c0d646b7` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 1721 | `069d678fc6b4ca0f` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/k6.log` |
| `metrics-export.json` | 522 | `5a32928975180a1b` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 1850 | `47ed2cc66bdcfb89` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 12389 | `0242830dbd17e932` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 2205 | `dec0be0a591aecf9` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/row-manifest.json` |
| `row-scenario.js` | 5647 | `ee6994ff6e2963dc` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 759 | `e20e304fd0728125` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T080011Z-r-config-defaults-34f430ee/seat-readiness.json` |

Raw run directory file count: `19`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

