# PR #85651 replacement proof corpus

Pure presentation SHA: `80311e8aa07fd560cb957475517c5ea18164541c`. Live execution composite: `37300f29a7ec1f731575343c2aa73ae25f1d0efb` (pure ancestor plus #124337 and #121204).

## Verdicts

| Row | State | Summary |
|---|---|---|
| R-CD-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-2 | partial | Two isolated signed catalog receipts classify delegate-replay-unsafe, while the same runtime trace shows one typed continue_delegate, one silent-wake dispatch/fire, completed child, enrichment return, and queue drain. Folded partial under the catalog resolver’s known false-failure shape; never promoted to PASS. |
| R-CD-3 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-4 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-CHAINED-DEPTH-2 | partial | Child and grandchild both spawned and completed with depth 2 observed, but the root return did not land within the 150-second observation window. |
| R-CD-COLLECTION-ON-COLLAPSE | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CD-MODEL-CHAINED-ALT | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-MODEL-DEFAULT | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-MODEL-TOKEN | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-MODEL-TOOL | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-RETURN-OVERLAP | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CD-SILENT | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CD-TOKEN | partial | Exact raw-final-text run parsed the bracket in the origin child, armed/fired a hop-2 delegate, completed the delegate, and delivered the return. Catalog task correlation remained incomplete because the token-created task is unlabeled; folded partial. |
| R-CONFIG-DEFAULTS | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CONFIG-INTERSESSION | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CW-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CW-2 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CW-3 | pass | Schedule/wake behavior passed. The catalog trace collector rejected a shared trace with multiple continue_work spans; manual TraceQL correlation by the row’s exact reason.hash found one continuation.work and one continuation.work.fire followed by one completed wake model call. |
| R-CW-4 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CW-5 | missing | Cost-cap exhaustion uses a disposable exact-candidate typed-tool fixture; continue_work is intentionally not externally invocable through the gateway loopback. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-CW-5A | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-6 | missing | The max-chain boundary uses a disposable exact-candidate runtime fixture; continue_work is intentionally not externally invocable through the gateway loopback. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-CW-6A | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-7 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-DELEGATE-CHILD-LIVE | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-DELEGATE-SELF-CONTINUATION | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-CW-DELEGATE-TOKEN | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-MULTI | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-MULTI-COLLAPSE | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-TOKEN | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-OBS-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-OBS-2 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-OBS-BACKEND-DISPOSITION | missing | A degraded telemetry backend produces explicit unavailable/partial evidence plus the keys needed to rebind the same slice later, instead of a zero that reads as absence. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-OBS-CONT-PROVENANCE | missing | Accepted continuation entry spans carry primitive/origin classification plus stable public-safe run, session, and turn correlation, so a typed-tool span and its accepted-entry span can be causally joined after the fact. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-OBS-PROOF-MARKER | missing | Proof-originated traffic is separable from organic fleet traffic by a durable telemetry marker carrying the Project-81/k6 proof run id, the row id, the product candidate SHA, and the immutable harness ref. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-OBS-STATUS | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-OBS-TERMINAL-OUTCOME | missing | Continuation and finalization terminate into a canonical outcome enum on a span, replacing the log-string heuristics that are currently the only available signal for zero-payload and finalization failure. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-RC-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-2 | honest_limit | Child invoked request_compaction and produced an authoritative rejected tool result at context_threshold=70. The accepted post-compaction path was structurally unavailable on this low-context disposable session. |
| R-REGRESSION-TRAP-TESTS | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-TRACE-REDACTION-1121 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |

## Rollup

`{"total_rows":41,"pass":31,"partial":3,"thin":0,"fail":0,"honest_limit":1,"missing":6}`

## Honest limits

- Live rows are execution-composite evidence, not exact-pure execution claims.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions despite byte evidence that the underlying paths executed.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation window.
- R-RC-2 was threshold-rejected and remains an honest limit.
- Six non-runnable canonical rows remain explicit missing.
