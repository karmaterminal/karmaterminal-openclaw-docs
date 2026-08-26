# PR #129388 final-presentation proof corpus

Final presentation pure target SHA:
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.
Qualification mode: **maintenance-materiality-reuse**. The final target has no
exact-target Mode-B and no exact standalone or live execution.

The complete immediate source corpus and frozen warm basis is
`25051f3b77409c45f5ce71c3b3b05aae85b0f8f9`. Final `aff9807b...` descends from
ordinary merge `353d76c565c4da43693d41f3454825d48c38e354`, whose parents are that
warm basis and pinned upstream `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91`,
plus three test-only semantic merge-repair commits. Their execution and
qualification identities are not relabeled.

Historical live execution remains
`37300f29a7ec1f731575343c2aa73ae25f1d0efb`, which contains historical source
proof SHA `80311e8aa07fd560cb957475517c5ea18164541c`. Runtime composite
`a0aa4ec8aefe95ced34342978b64c270c16ec3e9` contains warm basis `25051f3b...`,
not final `aff9807b...`; its exact R-CW-1 functional verdict remains
`PASS-candidate` and its OTel/Tempo verdict remains `PARTIAL-candidate`.

## Transposition and applicability

All 595 regular files from source corpus `25051f3b...` at docs commit
`b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` were copied into this subtree
without symlinks. Target paths and presentation identity were rebound locally;
ancestor Mode-B, warm qualification, historical execution, exact a0aa runtime,
and raw promotion receipts retain their original identities.

The final maintenance applicability packet is vendored at
[`artifacts/promotion/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/`](artifacts/promotion/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/).
Its report SHA-256 is
`da25ae8ec270dc2797fde6c56f9b35a5c799d718d76c3067a09c45f57465037e`.
It records 39/40 feature-core blobs unchanged, the sole changed core as an
exact-upstream projection, all three proof-sensitive inputs byte-identical,
three test-only merge-seam repairs, exact-head focused owners at 84/84, and
passing production types/build. The prior warm affected-slice packet remains
exact to `25051f3b...`.

| Disposition | Result |
|---|---|
| `REUSE` | Immutable historical row corpus plus bounded final maintenance applicability. |
| `INVALIDATE` | Ancestor and a0aa execution cannot transfer into an exact aff execution claim. |
| `UNKNOWN` | None within the declared final maintenance slice. |

## Ancestor qualification

- Source ancestor `2ffc7ca0...`: Mode-B run `32895790947`, workflow
  `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, 165,696 passed / 39 failed /
  9 load flakes / 32 deterministic; authoritative conclusion `failure`.
- Frozen basis `c7131791...`: Mode-B run `32911065508`, the same workflow SHA,
  167,237 passed / 21 failed / 3 load flakes / 18 deterministic; authoritative
  conclusion `failure`.
- The independent `APPROVE` review and 40/40 focused proof are bound only to
  exact c713 qualification identity.
- Warm basis `25051f3b...`: affected-slice qualification remains exactly 11
  owner files / 686 assertions, an independent 11-file / 544-assertion subset,
  production types, full test types, build, and three generated snapshots.
- Final `aff9807b...`: applicability is established only by the checksum-pinned
  maintenance materiality report. It has no exact Mode-B or execution receipt.

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

- Live rows are historical execution-composite evidence from `37300f29...`, not
  exact final-target execution claims.
- Final `aff9807b...` has no exact-target Mode-B or execution; qualification mode
  is `maintenance-materiality-reuse`.
- Warm `25051f3b...` affected-slice receipts remain exact to that basis.
- Runtime `a0aa4ec8...` passed exact functional R-CW-1 scheduling and wake
  behavior on a runtime that contains 250 but not aff; OTel/Tempo remains
  `PARTIAL-candidate`.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions despite byte evidence that the underlying paths executed.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation window.
- R-CW-6 remains partial because the docs-generated selected delegate fixture is stale; its direct product surfaces passed.
- R-RC-2 was threshold-rejected and remains an honest limit.
- Four construct-only observability rows remain explicit missing: three wait on product instrumentation tracked by `karmaterminal/openclaw#1254`; the harness-only backend-disposition row is tracked by `karmaterminal-openclaw-docs#517`.
