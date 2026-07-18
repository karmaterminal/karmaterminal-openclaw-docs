# R-CW-6 isolated max-chain runtime surface

`continue_work` is a session-elected internal primitive. It is not exposed by
the exact candidate's gateway/MCP loopback, so a WebSocket `tools.invoke`
scenario cannot prove its max-chain behavior. The former R-CW-6 scaffold also
required shared config mutation and a gateway restart, which is unnecessary
for the runtime boundary and unsafe on a production fleet.

The supported fixture is process-local and **does not patch or restart a gateway**.
It runs the exact candidate's production modules in a disposable worktree with
a temporary session store and isolated state directory. This is a manual-only
component fixture, intentionally outside the generic k6 runner and
`--live-suite`. Its `PASS-candidate` means the component contract passed at the
exact SHA; review is still required before any corpus fold.

The fixture:

1. Sets an explicit small `maxChainLength` (default `3`) in the disposable
   runtime config.
2. Seed `currentChainCount=maxChainLength-2`.
3. Send three elections through `scheduleContinuationWorkBatch`:
   - the below-limit hop (`max-2 -> max-1`) schedules;
   - the at-limit hop (`max-1 -> max`) schedules;
   - the first over-limit hop (`max -> max+1`) is rejected.
4. Require the production budget helper to return the structured code
   `chain-capped`, require no TaskFlow row for the rejected election, and
   require the chain count to remain at the configured maximum.
5. Persist the at-limit count to the temporary session store, clear the cache,
   reload it, and repeat the rejected election through
   `scheduleContinuationWork` to prove recovery does not reset the budget.
6. Enter `runAgentAttempt`, use its forwarded continuation options to build the
   production continuation tool registry, invoke the registered `continue_work`
   executor three times, and require only the two in-budget TaskFlow rows plus
   the multi-election cap notice.
7. Run a parameterized delegate test at the same selected maximum to prove the
   at-limit delegate spawns, the first-over delegate is rejected before a
   second spawn, and its TaskFlow is failed. Also run the exact candidate's
   `delegate-dispatch.chain-depth-exhaustion.test.ts` as a regression companion.
8. Remove the disposable worktree and isolated state before emitting the final
   result.
9. Reject any public receipt containing the source, artifact, or disposable
   worktree path, or secret/session/environment/process-output fields.

This is not a copied implementation of the predicate. The matrix imports
`checkContinuationBudget`; the runtime receipt uses
`scheduleContinuationWorkBatch` and `scheduleContinuationWork`; the typed
receipt uses `runAgentAttempt`, `createOpenClawContinuationTools`, and the real
registered `continue_work.execute()` bridge; and the dispatcher receipt runs
the candidate's production boundary suite.

## Command

```bash
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <clean-exact-candidate-worktree-with-preinstalled-dependencies> \
  --candidate-sha <40-char-candidate-sha> \
  --artifact-dir <new-empty-private-directory> \
  --max-chain-length 3 --json
```

The command refuses:

- a SHA/source mismatch;
- staged or unstaged tracked candidate changes before execution or final
  certification;
- missing dependencies, a symlinked source `node_modules`, or a preinstalled
  pnpm virtual-store lockfile that is absent or byte-different from the
  candidate's committed `pnpm-lock.yaml`;
- missing pinned pnpm metadata or required local `tsx`/`vitest` executables;
- a reused, group/world-readable, file, symlink, or symlink-ancestor artifact
  path;
- unknown mutation/restart arguments;
- any missing structured runtime, typed-tool, dispatcher, recovery, readiness,
  cleanup, or public-artifact-safety receipt.

It never runs an install, starts a gateway, reads or writes fleet config/state,
or writes the private source path into the public readiness receipt. The
readiness receipt records the candidate and installed lockfile SHA-256 values,
the pinned package-manager declaration, and the verified local executables.
Any missing or failed receipt is `FAIL-fixture`, never a PASS.

## Required receipts

- `fixture-readiness.json`
- `boundary-matrix.json`
- `runtime-boundary.json`
- `durable-state-recovery.json`
- `typed-tool-surface.json`
- `dispatch-boundary-suite.json`
- `cleanup.json`
- `public-artifact-safety.json`
- `fixture-result.json`

The expected default boundary is:

```text
current=1, attempted hop=2 -> allow (below limit)
current=2, attempted hop=3 -> allow (at limit)
current=3, attempted hop=4 -> chain-capped (first over limit)
```

A fixture `PASS-candidate` remains review-required. It does not rewrite the
original skipped corpus row, automatically fold R-CW-6 as canonical PASS, or
claim an external gateway invocation.
