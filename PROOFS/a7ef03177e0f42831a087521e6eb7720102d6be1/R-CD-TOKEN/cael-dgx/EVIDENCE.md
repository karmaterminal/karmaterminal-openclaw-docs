# R-CD-TOKEN — PARTIAL-candidate

This row evidence file was assembled deterministically from the copied live-run artifacts. It does not promote candidate output into a canonical proof; `candidateOnly` and `foldRequiresReview` remain true when present in the source artifacts.

## SHA binding and ancillary provenance

- Publication / presentation SHA: `a7ef03177e0f42831a087521e6eb7720102d6be1` (`a7ef0317`).
- Runtime actually executed on seat `cael`: composite `2e72b665229bac6c41388d10a6b979b86750211b`.
- Composite parents recorded for provenance: continuation `c868194997d0a61de2e648580afdf40e0d0b34b9` and Emeric PR #121204 fix `6f276fa24da8174cd97a029ce9e47f2141032c8a`.
- Ancillary provenance note: the runtime executed was the composite (continuation + PR #121204 content), because Emeric's fix is not yet merged upstream and must not be conflated with the continuation feature; the composite runtime SHA is recorded alongside the presentation SHA.
- GitHub Actions run: `31367303220` (`project81-k6-proof.yml`); docs harness ref observed in artifacts: `c53b4c28de291067bfd11e411ba2c25b35775f31`.
- Raw artifact run directory: `../cael/20260810T080009Z-r-cd-token-34f430ee/`.

## Verdict from artifacts

| Field | Value | Source |
|---|---:|---|
| Verdict | `PARTIAL-candidate` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:verdict` |
| Verdict source | `pre-dispatch-build-identity-gate` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:verdictSource` |
| Candidate result outcome | `PARTIAL-candidate` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:verdict` |
| Effective exit code | `0` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:effectiveExitCode` |
| Review status | `review-pending` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:review.status` |
| Pending receipts | `exact-candidate-runtime-identity, attempt-state, raw-final-text-origin, parser-detected, queue-identity, child-spawned, child-completed, parent-return-event, tempo-trace-json, continuation-trace-correlation` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:review.pendingReceipts` |
| Public evidence records | `not recorded` | `missing` |

## Run-log cross-check

No row-local `k6.log` verdict/summary line was found by the deterministic extractor; the verdict above is therefore taken from `run-result.json` and any row-specific receipt files.

## Public evidence highlights

| Public field | Value | Source |
|---|---:|---|
| `dispatched` | `false` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:evidence.dispatched` |
| `row` | `R-CD-TOKEN` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:evidence.row` |

## Observability and review receipts

| Field | Value | Source |
|---|---:|---|
| `traceStatus` | `not-applicable` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.traceStatus` |
| `traceId` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.traceId` |
| `tempoTraceJson` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.tempoTraceJson` |
| `correlationReceipt` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.correlationReceipt` |
| `serviceLogStatus` | `not-started` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.serviceLogStatus` |
| `serviceLog` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.serviceLog` |
| `serviceLogCapture` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.serviceLogCapture` |
| `serviceLogRedaction` | `null` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:observability.serviceLogRedaction` |

## Honest limit / partial context

This row remains `PARTIAL-candidate`; no missing receipt was inferred or filled in.

| Receipt field | Observed value | Source |
|---|---:|---|
| `dispatched` | `false` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json:evidence.dispatched` |

## Source files present

| File | Bytes | SHA-256 prefix | Relative path |
|---|---:|---|---|
| `run-result.json` | 1062 | `7996f95f316600d6` | `../cael/20260810T080009Z-r-cd-token-34f430ee/run-result.json` |
| `row-manifest.json` | 5659 | `7b96ff5267157522` | `../cael/20260810T080009Z-r-cd-token-34f430ee/row-manifest.json` |
| `row-scenario.js` | 18916 | `e4da30a666b0ef9e` | `../cael/20260810T080009Z-r-cd-token-34f430ee/row-scenario.js` |
| `runner-metadata.json` | 765 | `875350dbecc7ccb6` | `../cael/20260810T080009Z-r-cd-token-34f430ee/runner-metadata.json` |

Raw run directory file count: `5`.

## Evidence-writer assessment

`tools/k6-proofs/scripts/evidence-writer.mjs` was read before this file was generated. It expects a k6 console-output input and writes `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/EVIDENCE.md`; this corpus must publish already-produced row artifacts and place canonical evidence at `<row>/cael-dgx/EVIDENCE.md` (or row-root for `R-TRACE-REDACTION-1121`). Therefore this file was generated directly from the real copied artifacts above rather than by rewriting the run into a new `k6-run-*` directory.

