# PR #129388 continuation proof corpus

Target presentation SHA: `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9`.
Immediate source presentation:
`4c3314f7b587de2e955c406e9b92d1c50912ba51`.
Original proof source:
`80311e8aa07fd560cb957475517c5ea18164541c`.
Historical live execution composite:
`37300f29a7ec1f731575343c2aa73ae25f1d0efb`.

## Transposition

This is a self-contained transposition of the canonical
`PROOFS/4c3314f7b587de2e955c406e9b92d1c50912ba51/` subtree at docs commit
`66b702cc88e4d85846cca20e47ae5b022092e5d0`. Corpus identity and navigation
are rebound to `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9`;
all retained row evidence and vendored artifacts remain local to this target
subtree. Historical execution identities, verdicts, review states, timestamps,
receipts, payloads, and checksums retain their source provenance.

The target is the one-commit child of the immediate source. Its sole parent is
`4c3314f7...`; the commit changes only package agent-schema metadata 17 to 18
and the docs-i18n Go cache cleanup fixture.

No live row or Mode-B workflow ran at the current target. Mode-B run
[`33165923171`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/33165923171)
belongs to immediate source `4c3314f7...` and remains immediate-source evidence
only. It is not exact-target evidence for this corpus; `exact_target_mode_b=false`.

## Verdicts

The 37 row IDs, row states, review states, summaries, and evidence receipts are
preserved in `proofs-manifest.json` and the row-local `EVIDENCE.md` files.

## Active rows

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
| R-CW-6 | partial | Exact-pure fixture passed matrix, scheduler, recovery, typed-tool, and candidate delegate regression surfaces; a stale docs-generated selected delegate test exited before emitting its receipt, so the authoritative FAIL-fixture is retained and folded partial. |
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
| R-OBS-STATUS | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-1 | pass | Current exact execution-composite row produced a review-ready PASS-candidate receipt. |
| R-RC-2 | honest_limit | Child invoked request_compaction and produced an authoritative rejected tool result at context_threshold=70. The accepted post-compaction path was structurally unavailable on this low-context disposable session. |
| R-REGRESSION-TRAP-TESTS | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |
| R-TRACE-REDACTION-1121 | pass | Pinned historical evidence revalidated by the exact catalog static validator; carried comparison evidence, not a new live fire. |

## Rollup

`{"total_rows":37,"pass":32,"partial":4,"thin":0,"fail":0,"honest_limit":1,"missing":0}`

This matrix is not acceptance-complete. `R-CD-2`, `R-CD-CHAINED-DEPTH-2`,
`R-CD-TOKEN`, and `R-CW-6` remain partial, and `R-RC-2` remains the sole
honest limit. Zero fail and zero missing do not make the target complete or
green.

## Honest limits

- Live rows are historical execution-composite evidence, not exact-d451ef74
  execution claims.
- Mode-B run 33165923171 is immediate-source evidence, not exact-target evidence.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation
  window.
- R-CW-6 remains partial because the docs-generated selected delegate fixture
  is stale; its direct product surfaces passed.
- R-RC-2 was threshold-rejected and remains an honest limit.
