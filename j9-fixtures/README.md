# R-CW-5 / R-CW-6 process-local fixtures at exact pure j9 `293c977f62` (retry)

Lane `codeagent/j9-cw5-cw6-fixtures-2`, bound to
`karmaterminal/openclaw-bootstrap#1727`. This is the retry after docs#609 fixed
the pnpm-12 toolchain defects that stopped the first attempt
(`codeagent/j9-cw5-cw6-fixtures`). These are lane receipts and notes only.
Nothing here is folded into `PROOFS/`; frond-scribe folds after review.

## Verdicts

| Row | Fixture | Verdict (the fixture's own fail-closed receipts) | Cause class |
|---|---|---|---|
| R-CW-5 | `run-cost-cap-fixture.mjs --cap 100` | **FAIL-fixture** (exit 1): `matrixPassed`, `dispatchPassed`, `toolSurfacePassed` all `false` | fixture code against this candidate |
| R-CW-6 | `run-max-chain-fixture.mjs --max-chain-length 3` | **FAIL-fixture** (exit 1): `matrixPassed` `true`; `dispatchPassed`, `runtimeSurfacePassed`, `structuredChainCapped`, `durableRecoveryPassed`, `typedSurfacePassed` `false` | fixture code against this candidate: docs#516 **plus** drift beyond #516 |

The docs#609 toolchain fixes hold in both rows. The pinned pnpm 12.15.0
resolved, its native `@pnpm/exe.linux-arm64` matched the lockfile env-document
pin, the installed `.pnpm/lock.yaml` byte-matched the candidate lockfile
document, worktree integrity held before and after, and cleanup completed.

Every failing surface fails because the fixture code no longer fits candidate
`293c977f62`. No environment change can fix any of them. The failures are
not evidence that the cost-cap or max-chain product behaviour is wrong. The
one product surface that ran (R-CW-6's production `checkContinuationBudget`
matrix) passed. Per the workorder, the fixtures were not patched and neither
row was retried.

## Named refs

| Category | Ref | Full SHA | Equality |
|---|---|---|---|
| Product/base (candidate) | `karmaterminal/openclaw` `codeagent/absorb-8083-j9-cand` | `293c977f629f872a643fb94892603310b887293b` | local branch == `origin/` tracking == `git ls-remote` server, checked before firing |
| Harness | `karmaterminal/karmaterminal-openclaw-docs` `main` | `e2189c34ed4aba958d7a0e4e2e9327557bdcdff6` | tracking == server == lane base. R-CW-5 ran from this exact tree. R-CW-6 ran from `90254d5b`, which is `e2189c34` plus the R-CW-5 receipt commit only (no `tools/` change). |
| Lane | `codeagent/j9-cw5-cw6-fixtures-2` | base `e2189c34ed4aba958d7a0e4e2e9327557bdcdff6` | published unchanged to `origin` before any evidence; receipts are commits on top |
| CI/workflow | N/A | N/A | process-local fixtures, no product or harness code changed, so no Mode-B |
| Presentation / deploy / live gateway | N/A | N/A | no gateway started, no fleet config or state touched, no seat contact (see the R-CW-6 isolation section) |

Source dir: the detached worktree `source/WORKTREES/openclaw-j9-fixture-src`
of the same-host openclaw clone, `HEAD` = candidate. `git status --porcelain
--untracked-files=all --ignored` was empty, no `filter.*`/`include.*` local git
config, and no `node_modules`. Both fixtures re-verified it as clean after
their runs (`sourceTrackedCleanAfter: true`).

## Toolchain

- Host: ronan, `aarch64`
- Node `v26.12.1` (`$HOME/.nvm/versions/node/v26.12.1/bin` first on `PATH`), npm `11.20.0`
- `NO_COLOR=1`, `FORCE_COLOR` unset
- Candidate `packageManager`:
  `pnpm@12.15.0+sha512.b3951d6d…ea128e61`. Lockfile layout is
  `env-and-lockfile-documents`, and the env document pins `pnpm: 12.15.0`.
- R-CW-5 ignores host pnpm by design. It npm-installs the pinned
  `pnpm@12.15.0` plus `@pnpm/exe.linux-arm64@12.15.0` into a private toolchain,
  launches it through `/bin/sh` (pnpm 12's shebang-less launcher), and uses a
  private store, HOME and XDG tree.
- R-CW-6 uses host `pnpm` from `PATH`: corepack `0.36.0` shim to `12.15.0`.
  That already matched exactly, so no corepack change was needed.
- R-CW-6 only: `pnpm_config_store_dir=<lane-local stable store>`. The host pnpm
  `storeDir` points into an Actions runner `_temp` directory. The store location
  does not affect `lock.yaml` contents.

## R-CW-6 safety isolation (environment only, fixture unchanged)

ronan runs a live seat gateway on `127.0.0.1:18789`. The R-CW-6 delegate
template (`fixtures/r-cw-6/max-chain-delegate-boundary.test.ts`) mocks
`src/agents/subagent-spawn.js` and `src/tasks/task-flow-registry.js`, and
neither exists at `293c977f62`. If the test body ever ran, the real
`spawnSubagentDirect` would reach `callGateway`. Under the test's isolated,
empty config the gateway URL defaults to `ws://127.0.0.1:18789`, which is the
live seat. The first attempt flagged this hazard as plausible.

To make seat contact impossible, R-CW-6 ran inside an unprivileged user and
network namespace:

```bash
unshare --user --map-current-user --net --keep-caps -- /bin/sh -c \
  'ip link set lo up && exec setpriv --inh-caps=-all --ambient-caps=-all --bounding-set=-all -- "$@"' sh \
  env pnpm_config_store_dir=<lane-local store> node tools/k6-proofs/scripts/run-max-chain-fixture.mjs ...
```

Verified before use:

- uid stays `1000`;
- all capability sets are `0` after `setpriv`;
- only a private `lo` exists, with no routes and no DNS;
- a TCP connect to `127.0.0.1:18789` gets `ECONNREFUSED`.

Because the namespace has no network, the lane-local store was pre-warmed by
the fixture's own install command in a scratch detached worktree outside
`source/WORKTREES`. That worktree was removed afterwards. Before the fixture
ran, the same frozen install was repeated offline inside the namespace (exit 0,
installed lock SHA-256 `39a639ee…1c01d`, `.modules.yaml`
`packageManager: pnpm@12.15.0`).

In the event the hazard did not trigger: the delegate test failed at
collection, so no test body ran (see below). The namespace removed the risk
anyway.

R-CW-5 ran without a namespace. Its private npm and pnpm installs need the
registry, and its runner strips `npm_`/`pnpm_`/`corepack_` env and sets its own
HOME. Every R-CW-5 template mock target exists at the candidate, and all three
of its proof commands died with `SyntaxError` before loading any test code.

## Commands

```bash
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH NO_COLOR=1; unset FORCE_COLOR

node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <src> --candidate-sha 293c977f629f872a643fb94892603310b887293b \
  --artifact-dir <new empty 0700 dir> --cap 100 --json

<netns wrapper above> env pnpm_config_store_dir=<lane-local store> \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <src> --candidate-sha 293c977f629f872a643fb94892603310b887293b \
  --artifact-dir <new empty 0700 dir> --max-chain-length 3 --json
```

## Attempt log

| Step | UTC | Exit | Result |
|---|---|---|---|
| R-CW-5 attempt 1 | 2026-10-29 05:46:34 to 05:47:12 | 1 | `FAIL-fixture`, full receipt set |
| R-CW-5 diagnosis (scratch, fixture exports imported unchanged) | ended 05:48:56 | 0 | captured `node <sh shim>` `SyntaxError`, plus the shard move (below) |
| R-CW-6 store pre-warm (scratch, online) + offline repeat in netns | ended 05:50:33 / 05:50:51 | 0 / 0 | store complete; scratch worktree removed |
| R-CW-6 attempt 1 (netns) | 2026-10-29 05:52:24 to 05:53:26 | 1 | `FAIL-fixture`, full receipt set, `public-artifact-safety.json` passed |
| R-CW-6 diagnosis (scratch, netns, fixture exports and templates unchanged) | ended 05:57:38 | 0 | captured all three failure messages, plus the candidate-suite control |

Neither row was retried. Every cause is deterministic, comes from the code
(a module that is not found, a missing mock export, the wrong shard, a shell
shim run as JS), and was reproduced with captured output. A retry could only
repeat it. After every step, `git worktree list` showed no leftover disposable
or scratch worktree.

## R-CW-5: receipts and causes

| Receipt | `passed` | Exit | Cause |
|---|---|---|---|
| `fixture-readiness.json` | (readiness) | | source head == candidate, tracked clean, lockfile SHA-256 `01c02f06…4627fc` |
| `boundary-matrix.json` | `false` | 1 | **C1** |
| `dispatch-boundary-suite.json` | `false` (all 4 asserted `false`) | 1 | **C1**, then **C2** |
| `typed-tool-surface.json` | `false` (all 3 asserted `false`) | 1 | **C1**, then **C3** |
| `cleanup.json` | | | disposable worktree removed; source head and tracked state intact |

- **C1, pnpm 12 `.bin` shims.** pnpm 12.15.0 writes `node_modules/.bin/tsx` and
  `.bin/vitest` as POSIX `#!/bin/sh` shims, not symlinks.
  `resolveCandidateLocalExecutable` returns `realpath(.bin/x)`. For a shim that
  is the shim itself, so the containment check still passes. The runner then
  executes `node <shim> …`, and Node throws
  `SyntaxError: Invalid or unexpected token` at shim line 2, exiting 1.
  Diagnosis: running the same entries as executables (the R-CW-6 shape) works.
  This same invocation line returned `PASS-candidate` at `80311e8a` (pnpm
  11.22.0, harness `86b39d87`). It has not changed since. The runner strips
  `pnpm_*` env and isolates pnpm config, so no environment knob can change the
  bin layout.
- **C2, candidate shard move and rename (`311bc66fca`, fork-side, 2026-09-29,
  "migrate delegate dispatch suites onto real custody").**
  - The commit put `delegate-dispatch.cost-cap-exhaustion.test.ts` (and the
    chain-depth suite) into `databaseWorkerCoreTestFiles`.
    `vitest.auto-reply.config.ts` now excludes that list. The fixture's
    hard-coded `--config test/vitest/vitest.auto-reply.config.ts <suite>`
    therefore selects nothing: `No test files found, exiting with code 0`. The
    owning config is now `vitest.infra.config.ts`.
  - The commit also renamed `marks TaskFlow records as failed for
    cost-cap-rejected delegates` to `marks custody records as failed for
    cost-cap-rejected delegates`. The fixture's `overCapMarksFlowFailed`
    regex can no longer match.
- **C3, TaskFlow runtime removed upstream (`6652f7eac8`, upstream, 2026-09-27,
  "refactor: remove Tasks and TaskFlow runtime (#159179)").** The R-CW-5 typed
  template asserts `listTaskFlowsForOwnerKey(sessionKey)` from
  `src/tasks/task-flow-registry.js`, which no longer exists. The template's
  "no TaskFlow row" contract has to be restated against custody records.

## R-CW-6: receipts and causes

| Receipt | `passed` | Exit | Cause |
|---|---|---|---|
| `fixture-readiness.json` | (readiness) | | executing, candidate and installed pnpm `12.15.0`; lockfile document == installed lock `39a639ee…1c01d`; `tsx`/`vitest` inside the verified tree |
| `boundary-matrix.json` | **`true`** | 0 | production `checkContinuationBudget`: `1→2 null`, `2→3 null`, `3→4 chain-capped` |
| `dispatch-boundary-suite.json`, `selectedBoundary` | `false` (all 8 asserted `false`, no receipt) | 1 | **D1 (docs#516)** |
| `dispatch-boundary-suite.json`, `candidateRegressionSuite` | `false` (all 3 asserted `false`) | 0 | **C2** (shard move, plus `marks the TaskFlow record` renamed to `marks the custody record`) |
| `runtime-boundary.json` | `false` (no runtime receipt) | runtime vitest exit 1 | **D2** |
| `durable-state-recovery.json` | `false` | (same run) | **D2** |
| `typed-tool-surface.json` | `false` (no typed receipt) | (same run) | **D2** |
| `cleanup.json` | | | disposable worktree removed, no gateway, source intact |
| `public-artifact-safety.json` | `true` | | the 8 receipts checked, with no private paths or forbidden fields |

- **D1, docs#516, unchanged.** The generated delegate test fails at
  collection, so no test runs:
  `[vitest] No "enqueueSystemEventRaw" export is defined on the
  "../../src/infra/system-events.js" mock.` The candidate's `delegate-dispatch.ts`
  imports `enqueueSystemEventRaw`. The template's spawn mock also targets the
  pre-refactor `src/agents/subagent-spawn.js`, and the task-flow mock targets
  the removed `src/tasks/task-flow-registry.js`. This is the failure docs#516
  records (generated Vitest exits 1 before its receipt).
- **D2, beyond docs#516.** Both runtime-template tests fail in `beforeEach`:
  `Cannot find module '/src/tasks/task-runtime.test-helpers.js'`
  (`ERR_MODULE_NOT_FOUND`), removed by **C3** (`6652f7eac8`). The template's
  `scheduledFlows`, `firstOverLimitFlowPresent` and no-spawn assertions all
  read the removed TaskFlow registry. At `80311e8a` these three receipts
  passed.

So R-CW-6 fails in the docs#516 way **and more**. Fixing only the delegate
template, as #516 scopes it, will not give `PASS-candidate` at `293c977f62`.
The runtime template and the candidate-regression invocation need the same
custody-era rewrite.

## Control: the candidate's own dispatch suites (informative, not a fixture receipt)

This is evidence that the product boundaries behind C2 and D1 are intact at
the exact candidate. It does not replace the fixture verdict. It ran in the
R-CW-6 diagnosis, inside the netns, from a fresh frozen install at `293c977f62`:

```bash
node scripts/run-vitest.mjs run --config test/vitest/vitest.infra.config.ts --maxWorkers=1 <suite> --reporter=verbose
```

- `delegate-dispatch.chain-depth-exhaustion.test.ts`: **3/3 passed**
  - rejects at `currentChainCount == maxChainLength`;
  - accepts 9/10, then rejects 10/10;
  - marks the custody record failed.
- `delegate-dispatch.cost-cap-exhaustion.test.ts`: **5/5 passed**
  - 1 below the cap allows;
  - 1 over rejects;
  - rejects all remaining queued delegates;
  - marks custody records failed;
  - the exact boundary is not over.

## Public-safe copy

- **R-CW-6.** The 8 files that `public-artifact-safety.json` declares checked,
  plus that receipt, copied byte-identical into `R-CW-6/`.
- **R-CW-5.** The runner never emits `public-artifact-safety.json`. Its 6
  receipts (the 5 that `fixture-result.json` lists, plus `fixture-result.json`)
  were gated with the harness's own `assertPublicArtifactSafe` predicate,
  imported unchanged from `run-max-chain-fixture.mjs`. They then went through a
  credential-value scan and a private-path scan, and were copied
  byte-identical into `R-CW-5/`.
- Both sets were scanned with `diagnostics/public-safety-scan.mjs`: all `safe`.
  The scanner was negative-controlled first: a planted private path, a fake
  `ghp_` token and a `stderr` key were each reported `UNSAFE`.
- No raw logs are committed. Child stdout/stderr stays in lane-private storage.

## What exact-head proof needs (harness work, outside this lane)

1. **R-CW-5, C1.** Invoke the candidate-local `tsx`/`vitest` as executables, or
   resolve their package JS entry, rather than `node <realpath(.bin/x)>`. Keep
   the containment check.
2. **R-CW-5 and R-CW-6, C2.** Run the candidate dispatch suites under their
   owning config (`vitest.infra.config.ts` at this SHA, or discover it). Track
   the `TaskFlow` to `custody` test renames without loosening the
   four- and three-point assertions.
3. **R-CW-5 and R-CW-6, C3/D2.** Re-express the "no durable flow for the
   rejected hop" and "rejected flow failed" contracts on the custody records
   that replaced TaskFlow (`6652f7eac8`, `311bc66fca`). Then update the R-CW-5
   typed template and the R-CW-6 runtime template.
4. **R-CW-6, D1.** docs#516 (spawn owner, `enqueueSystemEventRaw`, task-flow
   mock, failure diagnostics). Its scope should grow to cover items 2 and 3.
5. Keep the R-CW-6 netns isolation, or an equivalent, on any seat host with a
   live gateway until the delegate template's spawn mock binds the real owner.
6. Then re-fire both rows at exact `293c977f629f872a643fb94892603310b887293b`.

## Reproduce the diagnoses

`diagnostics/rcw5-diag.mjs` and `diagnostics/rcw6-diag.mjs` import the
fixtures' own exported functions and templates unchanged. They repeat the same
install and invocations in a scratch worktree, keep the child output the
fixtures drop, and then remove the worktree. Run `rcw6-diag.mjs` inside the
netns wrapper:

```bash
node j9-fixtures/diagnostics/rcw5-diag.mjs <docs-checkout> <openclaw-clone> <private-scratch> 293c977f629f872a643fb94892603310b887293b
<netns wrapper> env pnpm_config_store_dir=<store> \
  node j9-fixtures/diagnostics/rcw6-diag.mjs <docs-checkout> <openclaw-clone> <private-scratch> 293c977f629f872a643fb94892603310b887293b 3
```
