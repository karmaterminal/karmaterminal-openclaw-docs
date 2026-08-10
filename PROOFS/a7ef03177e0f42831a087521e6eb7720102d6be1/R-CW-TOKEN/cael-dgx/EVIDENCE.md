# R-CW-TOKEN — PASS-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080953Z-r-cw-token-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PASS-candidate` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:verdict` |
| Verdict source | `vu-log` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PASS-candidate` | `../cael/20260810T080953Z-r-cw-token-34f430ee/candidate-run-result.json:result.outcome` |
| Effective exit code | `0` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `ready-for-human-review` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:review.status` |
| Pending receipts | `none` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `1` | `../cael/20260810T080953Z-r-cw-token-34f430ee/evidence-extraction.json:records` |

## Run-log cross-check

The row-local `k6.log` contains these verdict/summary lines:

```text
time="2026-08-10T01:10:27-07:00" level=info msg="\n[R-CW-TOKEN] VERDICT: PASS-candidate" source=console
[R-CW-TOKEN] Summary: PASS-candidate | SHA: 2e72b665229bac6c41388d10a6b979b86750211b | Seat: cael
```

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `candidateSha` | `2e72b665229bac6c41388d10a6b979b86750211b` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.candidateSha` |
| `dispatch_accepted_at_ms` | `1786349399390` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.dispatch_accepted_at_ms` |
| `duration_ms` | `30703` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.duration_ms` |
| `ended` | `2026-08-10T08:10:27.192Z` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.ended` |
| `hop_2_at_ms` | `1786349427191` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.hop_2_at_ms` |
| `hop_2_executed` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.hop_2_executed` |
| `manifest_loaded` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.manifest_loaded` |
| `parent_dispatch_accepted` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.parent_dispatch_accepted` |
| `parent_return` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.parent_return` |
| `row` | `R-CW-TOKEN` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.row` |
| `seat` | `cael` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.seat` |
| `session_created` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.session_created` |
| `started` | `2026-08-10T08:09:56.489Z` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.started` |
| `subagent_spawn_accepted` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.subagent_spawn_accepted` |
| `subagent_spawn_requested` | `true` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.subagent_spawn_requested` |
| `trace_id` | `null` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:evidence.trace_id` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `unknown` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.correlationReceipt` |
| `lifecycleReceipt` | `null` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.lifecycleReceipt` |
| `serviceLogStatus` | `captured` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `gateway-journal.log` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `gateway-journal-capture.json` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `gateway-journal-redaction.json` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json:observability.serviceLogRedaction` |


## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1453 | `6531d981e152ce21` | `../cael/20260810T080953Z-r-cw-token-34f430ee/run-result.json` |
| `candidate-run-result.json` | 2006 | `eec6ed4c43bd5817` | `../cael/20260810T080953Z-r-cw-token-34f430ee/candidate-run-result.json` |
| `candidate-run-result-validation.json` | 2006 | `eec6ed4c43bd5817` | `../cael/20260810T080953Z-r-cw-token-34f430ee/candidate-run-result-validation.json` |
| `evidence.jsonl` | 486 | `34f6e9d725c1fe05` | `../cael/20260810T080953Z-r-cw-token-34f430ee/evidence.jsonl` |
| `evidence-extraction.json` | 14 | `071e2122745db639` | `../cael/20260810T080953Z-r-cw-token-34f430ee/evidence-extraction.json` |
| `evidence-redaction.json` | 380 | `3aaca8a5413a93be` | `../cael/20260810T080953Z-r-cw-token-34f430ee/evidence-redaction.json` |
| `gateway-journal-redaction.json` | 216 | `f65f9b1e7812de9b` | `../cael/20260810T080953Z-r-cw-token-34f430ee/gateway-journal-redaction.json` |
| `gateway-journal.log` | 3306 | `a827b5b4f9334bc6` | `../cael/20260810T080953Z-r-cw-token-34f430ee/gateway-journal.log` |
| `gateway-journal-capture.json` | 244 | `5fba9f7c5b74fb17` | `../cael/20260810T080953Z-r-cw-token-34f430ee/gateway-journal-capture.json` |
| `k6.log` | 11785 | `e7f40dc7cb2a8326` | `../cael/20260810T080953Z-r-cw-token-34f430ee/k6.log` |
| `metrics-export.json` | 554 | `7f5dfeff43619f52` | `../cael/20260810T080953Z-r-cw-token-34f430ee/metrics-export.json` |
| `openclaw-proofs-k6.prom` | 3596 | `bec3197709124ce5` | `../cael/20260810T080953Z-r-cw-token-34f430ee/openclaw-proofs-k6.prom` |
| `openclaw-proofs-k6.otlp.json` | 25296 | `16f3be27acfe8564` | `../cael/20260810T080953Z-r-cw-token-34f430ee/openclaw-proofs-k6.otlp.json` |
| `row-manifest.json` | 4498 | `a46013967060b6a7` | `../cael/20260810T080953Z-r-cw-token-34f430ee/row-manifest.json` |
| `row-scenario.js` | 12725 | `c74e75c911514516` | `../cael/20260810T080953Z-r-cw-token-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 747 | `3e385d42c6acde7f` | `../cael/20260810T080953Z-r-cw-token-34f430ee/runner-metadata.json` |
| `seat-readiness.json` | 3319 | `528477922b55d62b` | `../cael/20260810T080953Z-r-cw-token-34f430ee/seat-readiness.json` |

Raw run directory file count: `20`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

