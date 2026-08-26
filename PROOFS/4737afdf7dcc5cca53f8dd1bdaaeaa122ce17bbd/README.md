# PR #85651 replacement proof corpus

Pure presentation SHA: `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`.
Historical live execution composite:
`37300f29a7ec1f731575343c2aa73ae25f1d0efb`, which contains source proof SHA
`80311e8aa07fd560cb957475517c5ea18164541c` plus #124337 and #121204. The
target candidate descends from that source proof SHA; it is not an ancestor of
the historical execution composite.

## Transposition

This is a complete in-subtree transposition of
`PROOFS/80311e8aa07fd560cb957475517c5ea18164541c/` after the required
conflict-bearing upstream absorb. Candidate and corpus paths are rebound to
`4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`; copied row evidence remains
explicitly marked as historical ancestry/materiality evidence unless a receipt
states that it was executed at the target SHA.

Exact-target Mode-B run
[`32859410821`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32859410821)
completed with 166,719 passing tests and no candidate-caused failure. Its
non-green workflow conclusion is preserved and fully classified in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).

## Acceptance classification

`proofs-manifest.json` preserves all 41 historical row records, while
classifying 38 as continuation acceptance requirements and three product-owned
fleet telemetry contracts as supplemental/future work:

- required: 38 rows, including harness-integrity row
  `R-OBS-BACKEND-DISPOSITION`;
- supplemental/future: `R-OBS-CONT-PROVENANCE`,
  `R-OBS-PROOF-MARKER`, and `R-OBS-TERMINAL-OUTCOME`;
- required target: 37 `pass` plus the receipt-backed `R-RC-2`
  `honest_limit`, with no other required non-PASS state.

The supplemental rows remain `missing`; this correction does not relabel any
evidence. `dispatch_allocation` contains each required row exactly once and no
supplemental row.

## Required acceptance verdicts

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
| R-CW-5 | pass | Exact-pure disposable fixture passed the boundary matrix, dispatcher, typed-tool, cleanup, and rejected-hop no-spawn contracts. |
| R-CW-5A | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-CW-6 | partial | Exact-pure fixture passed every independently measured product boundary, but its docs-generated selected delegate test is stale and exited before emitting a receipt; the authoritative FAIL-fixture is retained. |
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
| R-OBS-STATUS | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-2 | honest_limit | Child invoked request_compaction and produced an authoritative rejected tool result at context_threshold=70. The accepted post-compaction path was structurally unavailable on this low-context disposable session. |
| R-REGRESSION-TRAP-TESTS | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-TRACE-REDACTION-1121 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |

## Supplemental/future contracts

| Row | State | Provenance |
|---|---|---|
| R-OBS-CONT-PROVENANCE | missing | Fleet communication-health telemetry remedy contract from `karmaterminal/openclaw#1254`; no historical PASS. |
| R-OBS-PROOF-MARKER | missing | Fleet communication-health telemetry remedy contract from `karmaterminal/openclaw#1254`; no historical PASS. |
| R-OBS-TERMINAL-OUTCOME | missing | Fleet communication-health telemetry remedy contract from `karmaterminal/openclaw#1254`; no historical PASS. |

## Rollup

- Catalog/history (all preserved rows):
  `{"total_rows":41,"pass":32,"partial":4,"thin":0,"fail":0,"honest_limit":1,"missing":4}`
- Required acceptance:
  `{"total_rows":38,"pass":32,"partial":4,"thin":0,"fail":0,"honest_limit":1,"missing":1}`
- Supplemental/future:
  `{"total_rows":3,"pass":0,"partial":0,"thin":0,"fail":0,"honest_limit":0,"missing":3}`
- Required semantic target:
  `{"total_rows":38,"pass":37,"partial":0,"thin":0,"fail":0,"honest_limit":1,"missing":0}`

## Honest limits

- Live rows are historical execution-composite evidence, not exact-target execution claims.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions despite byte evidence that the underlying paths executed.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation window.
- R-CW-6 remains partial because the docs-generated selected delegate fixture is stale; its direct product surfaces passed.
- R-RC-2 was threshold-rejected and remains the sole allowed required honest
  limit, backed by the structured run result named in
  `acceptance.honest_limit_receipts`.
- Required harness-integrity row R-OBS-BACKEND-DISPOSITION remains missing in
  this historical corpus and is tracked by
  `karmaterminal/karmaterminal-openclaw-docs#517`.
- The three product telemetry contracts tracked by
  `karmaterminal/openclaw#1254` remain explicit supplemental `missing` rows and
  do not enter required acceptance arithmetic.
