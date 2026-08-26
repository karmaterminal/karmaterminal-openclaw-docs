# PR #129388 warm-target proof corpus

Warm pure target SHA: `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9`.
Qualification mode: **affected-slice-materiality**. The warm pure target
intentionally has no exact-target Mode-B and was not executed standalone.

The complete immediate source corpus remains
`2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a`. Frozen qualified basis
`c7131791a6d33ab83d1a820c7cdb81c1b1384931` and pinned upstream parent
`80985b9663252da97bf8d67dd2cbeba0fa03aeea` are the two parents of the warm
target. Their execution and qualification identities are not relabeled.

Historical live execution remains
`37300f29a7ec1f731575343c2aa73ae25f1d0efb`, which contains historical source
proof SHA `80311e8aa07fd560cb957475517c5ea18164541c`; neither identity is a warm
execution claim. Runtime composite `a0aa4ec8aefe95ced34342978b64c270c16ec3e9`
contains the warm target and has an exact R-CW-1 functional
`PASS-candidate` receipt. Its OTel/Tempo receipt remains partial.

## Transposition and applicability

All 544 regular files from source corpus `2ffc7ca0...` at docs commit
`e19110e419b67118fd8e890f1f3075c51acd8e4d` were copied into this subtree.
Target paths and candidate identity were rebound locally; ancestor Mode-B,
review, historical execution, and raw promotion receipts retain their original
identities.

The independent applicability packet is vendored at
[`artifacts/promotion/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/`](artifacts/promotion/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/).
It records 11 owner files / 686 assertions, an independent 11 files / 544
assertions subset, production types, full test types, build, and three current
generated snapshots. Every raw output in that packet is content-addressed.

| Disposition | Result |
|---|---|
| `REUSE` | Immutable historical row corpus plus bounded structural applicability. |
| `INVALIDATE` | Ancestor execution cannot transfer into an exact warm-target execution claim. |
| `UNKNOWN` | None within the declared affected slice after the docs `e19110e4...` receipt closure. |

## Ancestor qualification

- Source ancestor `2ffc7ca0...`: Mode-B run `32895790947`, workflow
  `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, 165,696 passed / 39 failed /
  9 load flakes / 32 deterministic; authoritative conclusion `failure`.
- Frozen basis `c7131791...`: Mode-B run `32911065508`, the same workflow SHA,
  167,237 passed / 21 failed / 3 load flakes / 18 deterministic; authoritative
  conclusion `failure`.
- The independent `APPROVE` review and 40/40 focused proof are bound only to
  exact c713 qualification identity. They are not a review of warm 25051.

These are ancestor Mode-B runs, not target Mode-B.

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
| R-OBS-CONT-PROVENANCE | missing | Accepted continuation entry spans carry primitive/origin classification plus stable public-safe run, session, and turn correlation, so a typed-tool span and its accepted-entry span can be causally joined after the fact. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-OBS-PROOF-MARKER | missing | Proof-originated traffic is separable from organic fleet traffic by a durable telemetry marker carrying the Project-81/k6 proof run id, the row id, the product candidate SHA, and the immutable harness ref. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-OBS-STATUS | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-OBS-TERMINAL-OUTCOME | missing | Continuation and finalization terminate into a canonical outcome enum on a span, replacing the log-string heuristics that are currently the only available signal for zero-payload and finalization failure. Not executed in run 32231533500; retained as an explicit missing row for refinement. |
| R-RC-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-2 | honest_limit | Child invoked request_compaction and produced an authoritative rejected tool result at context_threshold=70. The accepted post-compaction path was structurally unavailable on this low-context disposable session. |
| R-REGRESSION-TRAP-TESTS | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-TRACE-REDACTION-1121 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |

## Rollup

`{"total_rows":41,"pass":32,"partial":4,"thin":0,"fail":0,"honest_limit":1,"missing":4}`

## Honest limits

- Live rows are historical execution-composite evidence from `37300f29…`, not
  exact warm-target or descendant-composite execution claims.
- Warm `25051f3b…` has no exact-target Mode-B; qualification is compositional.
- Exact descendant runtime `a0aa4ec8…` passed functional R-CW-1 scheduling and
  wake behavior; OTel/Tempo correlation remains explicit receipt debt.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions despite byte evidence that the underlying paths executed.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation window.
- R-CW-6 remains partial because the docs-generated selected delegate fixture is stale; its direct product surfaces passed.
- R-RC-2 was threshold-rejected and remains an honest limit.
- Four construct-only observability rows remain explicit missing: three wait on product instrumentation tracked by `karmaterminal/openclaw#1254`; the harness-only backend-disposition row is tracked by `karmaterminal-openclaw-docs#517`.
