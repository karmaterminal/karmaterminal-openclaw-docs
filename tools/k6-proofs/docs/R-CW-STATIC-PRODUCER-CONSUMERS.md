# R-CW-5A and R-CW-6A reviewed producer consumers

`R-CW-5A` and `R-CW-6A` are construct-only current-corpus consumers. They do
not inspect historical `cael-dgx` source snippets or independently prove
runtime behavior.

The consumer reads the current corpus's `proofs-manifest.json` and requires:

1. canonical candidate identity;
2. exactly one row entry for the producer;
3. producer state `pass`, candidate verdict `PASS-candidate`, review status
   `reviewed`, and `fired=true`;
4. exactly one safe `test_cases_executed` run ID;
5. receipts under
   `PROOFS/<candidate>/<producer>/local/<run-id>/`.

`R-CW-5A` requires one agreeing set of:

- `fixture-result.json`
- `fixture-readiness.json`
- `boundary-matrix.json`
- `typed-tool-surface.json`
- `dispatch-boundary-suite.json`
- `cleanup.json`

The set must bind the exact candidate, preserve the exact pinned package
manager and native package integrity, prove candidate/installed graph
equivalence, keep every observed worktree phase clean, pass all producer
surfaces, and complete disposable cleanup.

`R-CW-6A` applies the analogous checks and additionally requires:

- `runtime-boundary.json`
- `durable-state-recovery.json`
- `public-artifact-safety.json`

It cannot pass while the current `R-CW-6` producer is FAIL, PARTIAL, MISSING,
unreviewed, ambiguous, or represented by more than one selected run. A future
producer PASS must have agreeing dependency provenance across every receipt.

Wrong candidate identity, missing files, non-PASS producer state, receipt-map
drift, dependency-provenance disagreement, dirty worktree observations,
incomplete cleanup, or failed public safety all fail closed.
