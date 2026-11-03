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
the installed virtual-store `lock.yaml` bytes and SHA-256 to match the
candidate's lockfile document. A pnpm 12 `pnpm-lock.yaml` is two YAML
documents: an env document that pins pnpm itself
(`packageManagerDependencies`), then the lockfile document, which is all pnpm
installs. Every package-manager pin in that env document must equal the
candidate pnpm version. It also requires `.modules.yaml` package-manager metadata to match the
candidate pnpm version (the metadata may omit the integrity suffix), and the
declared virtual store plus `tsx`/`vitest` realpaths to remain inside that
candidate `node_modules` tree. Source-tree `node_modules` is ignored. The
worktree has a temporary session store and isolated state directory. This is a
manual-only component fixture, intentionally outside the generic k6 runner and
`--live-suite`. Its `PASS-candidate` means the component contract passed at the
exact SHA; review is still required before any corpus fold, and the row itself
stays capped at `PARTIAL-candidate` (see "Required preflight: R-CW-6A" below).

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
   `chain-capped`, require no durable work record for the rejected election,
   and require the chain count to remain at the configured maximum.
5. Persist the at-limit count to the temporary session store, clear the cache,
   reload it, and repeat the rejected election through
   `scheduleContinuationWork` to prove recovery does not reset the budget.
6. Enter `runAgentAttempt`, use its forwarded continuation options to build the
   production continuation tool registry, invoke the registered `continue_work`
   executor three times, and require only the two in-budget work records plus
   the multi-election cap notice. The in-memory count is read from the
   caller's session store map, where the attempt publishes its patched entry.
7. Run a parameterized delegate test at the same selected maximum. It must
   prove that the at-limit delegate spawns with the accepted task, that the
   first-over delegate is rejected before a second spawn, and that the
   rejected delegate's custody record fails for `chain-capped`, with a trusted
   notice to the owner. Only the spawn owner and the raw system-event enqueue
   are mocked. Before it dispatches, the test refuses to run if the
   dispatcher's spawn import no longer resolves to the mocked owner. Also run
   the exact candidate's `delegate-dispatch.chain-depth-exhaustion.test.ts` as
   a regression companion.
8. Immediately after install, re-check the candidate worktree SHA and tracked
   state. Re-check both again after all proof surfaces, then remove the
   disposable worktree and isolated state before emitting the final result.
9. Reject any public receipt containing the source, artifact, or disposable
   worktree path, or secret/session/environment/process-output fields.

Durable work and delegate state live in the candidate's real continuation
custody store. Upstream removed the Tasks/TaskFlow runtime, and the fork moved
continuation custody onto that store. Custody suites run only in the
candidate's database-worker lane: `test/vitest/vitest.infra.config.ts`, whose
forked pool reaches the host SQLite broker. The scoped auto-reply config
excludes them, and a file filter it excludes exits 0 with no tests. Every
Vitest proof surface therefore runs under the infra config. The two generated
tests join it through the candidate's `OPENCLAW_VITEST_INCLUDE_FILE`
override, which the runner never inherits from the operator's shell. Each
receipt records the command and include files that actually ran.

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
  [--private-dir <new-empty-private-diagnostics-directory>] \
  --max-chain-length 3 --json
```

## Failure diagnostics

The disposable worktree is always removed, so a failed proof surface keeps
its raw output elsewhere. The command, exit code, stdout and stderr of each
failed proof run (boundary matrix, candidate delegate suite, selected delegate
boundary, runtime/typed surface) go to
`<private-dir>/<surface>.json`. A surface counts as failed when its predicate
fails, even if the process exited 0. The private dir defaults to
`<artifact-dir>.private`; `--private-dir` or `OPENCLAW_RCW6_PRIVATE_DIR` can
set it. It is created only when something fails. It must be new or an empty
`0700` directory with no symlink on its path, and it may not sit inside or
around the artifact dir. It holds raw candidate output: **never publish it.**

Each public receipt fed by a failed surface carries `failureDiagnostics`:
the surface, its exit code, `privateCopyRetained`, and a bounded excerpt of
the failing lines. Terminal sequences and control characters are stripped.
Worktree, artifact, private, source, home and temp paths become placeholders;
any other absolute path becomes `<path>`; session identifiers become
`<session-key>`; credential-shaped values become `<redacted>`. The excerpt
must pass the public-artifact guard; otherwise it is withheld in favor of
the private copy. `fixture-result.json` lists the surfaces with a retained
private copy in `privateDiagnosticsRetainedFor`. The run prints the private
path to stderr.

The private dir is validated at start-up. It is created at the first failure
without reusing anything: its last component is made non-recursively, the
whole path is validated again, and files are created exclusively. Suppose
another process created the directory in between, or it cannot be written.
The run then keeps no private copy, but it still writes every public receipt,
with `privateCopyRetained: false`. It lists the surface in
`privateDiagnosticsNotRetainedFor` and warns on stderr.

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
- a missing/indirect `node_modules`, missing installed `.pnpm/lock.yaml` or one
  whose bytes/SHA do not match the candidate lockfile document, a candidate
  lockfile whose env document is unterminated or followed by a third document,
  an env document that pins a different pnpm version, incompatible
  `.modules.yaml packageManager`, or a virtual store that escapes candidate
  `node_modules`;
- missing or non-candidate-local `node_modules/.bin/tsx` or
  `node_modules/.bin/vitest` after that verified install;
- a reused, group/world-readable, file, symlink, or symlink-ancestor artifact
  path, or such a private diagnostics path, or one inside or around the
  artifact dir;
- unknown mutation/restart arguments;
- any missing structured runtime, typed-tool, dispatcher, recovery, readiness,
  cleanup, or public-artifact-safety receipt.

It never trusts, links, or mutates source-tree `node_modules`; the only PATH
resolved dependency command is the candidate-worktree `pnpm`, which is
version-checked but not hermetically attested. It never starts a gateway, reads
or writes fleet config/state, or writes the private source path into public
receipts. The readiness and runtime receipts record candidate and installed
lockfile SHA-256 values, the candidate lockfile layout and lockfile-document
SHA-256, the env document's package-manager pins, candidate `packageManager`, executing and installed
package-manager versions, the exact frozen install command, the local
executable contract, and post-install/post-proof worktree integrity checks.
Any failed install, lockfile/tree/version alignment, SHA/state check, or
cleanup fails closed. Any missing or failed receipt is `FAIL-fixture`, never a PASS.

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

## Required preflight: R-CW-6A

`r-cw-6.json` declares `R-CW-6A` in `requiredPreflights` (🌊's F″ method
ruling). The fixture's `PASS-candidate` is the behavioral verdict only. The row
verdict is the minimum of that verdict, the row's declared cap and the preflight
cap: `r-cw-6.json` declares `verdictCap.rowCap` `PARTIAL-candidate`, because this
process-local fixture is the row's only producer (🌊's ruling on docs#616). A
passing R-CW-6A is necessary, not sufficient: the row stays at
`PARTIAL-candidate` even when the R-CW-6A static check, run at the same exact
candidate, wrote a passing `required-preflight-receipt.json`. Lifting the cap
needs a superseding authority receipt from a different artifact class, adopted by
an explicit method change; none is adopted. That check reads
`PROOFS/<candidate>/R-CW-6/cael-dgx/`, never INDEX `static_evidence_sha`, and that
material must be bound to the candidate: a `source-sha.txt` that is exactly the
candidate SHA, and no provenance file naming another commit.
`grade-preflight-gated-row.mjs` joins `fixture-result.json` with the row cap and
that receipt; a missing, failed, malformed or other-SHA receipt is a second
reason for `PARTIAL-candidate`. In an F″ corpus `validate-corpus.mjs` refuses any
R-CW-6 `pass`, with or without the receipt. See "Required preflights" and "The
process-local cap" in `tools/k6-proofs/README.md`.
