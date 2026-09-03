# R-CW-6 isolated max-chain runtime surface

`continue_work` is a session-elected internal primitive. It is not exposed by
the exact candidate's gateway/MCP loopback, so a WebSocket `tools.invoke`
scenario cannot prove its max-chain behavior. The former R-CW-6 scaffold also
required shared config mutation and a gateway restart, which is unnecessary
for the runtime boundary and unsafe on a production fleet.

The supported fixture is process-local and **does not patch or restart a gateway**.
It checks out the exact candidate SHA in a disposable worktree, verifies that
the candidate committed `package.json` and `pnpm-lock.yaml`, requires the
`packageManager` field to be exact `pnpm@<semver>` (an optional `+sha...`
suffix is allowed), checks that host-resolved `pnpm --version` is exactly that
semantic version, then runs `pnpm install --frozen-lockfile --prefer-offline
--ignore-scripts` in that worktree before any proof command. It then requires
the installed virtual-store workspace graph—including importers and package
integrities—to byte-match the candidate lockfile's workspace document. pnpm 12
may place package-manager bootstrap metadata in a separate YAML document; that
document is validated independently against the exact `packageManager` pin and
is not confused with the installed dependency graph. `.modules.yaml`
package-manager metadata must match the candidate pnpm version, and the
declared virtual store plus `tsx`/`vitest` realpaths must remain inside that
candidate `node_modules` tree. Source-tree `node_modules` is ignored. The
worktree has a temporary session store and isolated state directory. This is a
manual-only component fixture, intentionally outside the generic k6 runner and
`--live-suite`. Its `PASS-candidate` means the component contract passed at the
exact SHA; review is still required before any corpus fold.

This is **lockfile/tree/version alignment, not a hermetic or cryptographic
host-toolchain proof**. The fixture resolves the host `pnpm` from PATH, records
its exact `--version`, and fails if it cannot create the required verified
candidate-local tree; it does not attest the host executable's origin.

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
6. Run the runtime/durable and typed-tool generated files as independent
   candidate-local Vitest commands. The typed fixture enters `runAgentAttempt`
   through the candidate's current `createTestPreparedRunAdmission` seam and
   supplies the current routing/plugin-generation contract. It uses the
   forwarded continuation options to build the production continuation tool
   registry, invokes the registered `continue_work` executor three times, and
   requires only the two in-budget TaskFlow rows plus the multi-election cap
   notice.
7. Run a third independent parameterized delegate test at the same selected
   maximum, importing the current
   `src/agents/subagents/spawn/subagent-spawn.ts` owner, to prove the
   at-limit delegate spawns, the first-over delegate is rejected before a
   second spawn, and its TaskFlow is failed. Also run the exact candidate's
   `delegate-dispatch.chain-depth-exhaustion.test.ts` as a regression companion.
8. Immediately after install, re-check the candidate worktree SHA and tracked
   state. Re-check both again after all proof surfaces, then remove the
   disposable worktree and isolated state before emitting the final result.
9. Retain each generated command's raw receipt, stdout, and stderr in the
   explicitly selected private diagnostics directory outside `PROOFS` and the
   public artifact tree, even when a different generated command fails. A
   sibling failure never synthesizes another surface's receipt as false.
10. Reject any public receipt containing the source, artifact, or disposable
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
  --source-dir <clean-exact-candidate-source-worktree> \
  --candidate-sha <40-char-candidate-sha> \
  --artifact-dir <new-empty-private-directory> \
  --private-diagnostics-dir <new-empty-private-directory-outside-PROOFS> \
  --max-chain-length 3 --json
```

The command refuses:

- a SHA/source mismatch;
- staged or unstaged tracked candidate changes before execution or final
  certification;
- a candidate worktree whose `HEAD` is not the requested SHA, or whose
  committed `package.json` or `pnpm-lock.yaml` is missing;
- a non-pnpm, tag, range, or otherwise non-exact candidate `packageManager`,
  or a `pnpm --version` that does not exactly equal the candidate's fixed
  semantic version;
- a failed `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts`;
- a missing/indirect `node_modules`, installed workspace graph/importer/package
  integrity mismatch, invalid package-manager bootstrap document, incompatible
  `.modules.yaml packageManager`, or a
  virtual store that escapes candidate `node_modules`;
- missing or non-candidate-local `node_modules/.bin/tsx` or
  `node_modules/.bin/vitest` after that verified install;
- a reused, group/world-readable, file, symlink, or symlink-ancestor artifact
  path;
- a reused or group/world-readable private diagnostics directory;
- a diagnostics directory inside `PROOFS` or the public artifact directory;
- unknown mutation/restart arguments;
- any missing structured runtime, typed-tool, dispatcher, recovery, readiness,
  cleanup, or public-artifact-safety receipt.

It never trusts, links, or mutates source-tree `node_modules`; the only PATH
resolved dependency command is the candidate-worktree `pnpm`, which is
version-checked but not hermetically attested. It never starts a gateway, reads
or writes fleet config/state, or writes the private source path into public
receipts. The readiness and runtime receipts record candidate and installed
lockfile SHA-256 values, candidate `packageManager`, executing and installed
package-manager versions, the exact frozen install command, the local
executable contract, and post-install/post-proof worktree integrity checks.
Any failed install, lockfile/tree/version alignment, SHA/state check, or
cleanup fails closed. Any missing or failed receipt is `FAIL-fixture`, never a PASS.

Raw generated receipts and command output are intentionally not public
receipts. They remain in the explicitly supplied private diagnostics directory
for detached failure attribution and cannot be placed inside `PROOFS` or the
public artifact directory.

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
