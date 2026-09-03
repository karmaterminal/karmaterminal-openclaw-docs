# R-CW-6 — approved current-fixture producer PASS

- canonical pure SHA: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- ancillary runtime provenance: `dbf5795bd5dd406f586575d883a7878288e591ad`
- approved source harness: `f90999198987f7710924ab05512df01d2408c160`
- integrated docs checkpoint: `af001b21dd17d7da788502d3ad1c2215c59d9922`
- run: `run-20260903T083304Z-159f4b0e`
- canonical state: `pass`
- candidate verdict: `PASS-candidate`

The exact-pure process-local fixture passed:

- pnpm 12.1 package-manager and installed-graph provenance;
- below/at/first-over boundary matrix;
- independent runtime/durable command;
- independent typed-tool command through current `runAgentAttempt` admission;
- independent selected-delegate command using the current spawn owner;
- candidate regression companion;
- durable recovery;
- source/worktree cleanup; and
- public-artifact safety.

The prior terminal FAIL attempt
`run-20260903T055951Z-ff3429fc` remains preserved. It was not overwritten or
retried blindly; this one new attempt was explicitly authorized under the
reviewed f909 repair.
