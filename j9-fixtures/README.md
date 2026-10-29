# R-CW-5 / R-CW-6 process-local fixtures at exact pure j9 `293c977f62`

Lane `codeagent/j9-cw5-cw6-fixtures`, bound to
`karmaterminal/openclaw-bootstrap#1727`. These are lane receipts and notes
only. Nothing here is folded into `PROOFS/` (frond-scribe folds after review).

## Verdicts

| Row | Fixture | Verdict (fixture's own fail-closed contract) | Product boundary exercised |
|---|---|---|---|
| R-CW-5 | `run-cost-cap-fixture.mjs --cap 100` | **FAIL-fixture**: exit 2, only `fixture-readiness.json`, no `fixture-result.json` | no |
| R-CW-6 | `run-max-chain-fixture.mjs --max-chain-length 3` | **FAIL-fixture**: exit 2, no receipts | no |

Both failures are **fixture code vs candidate**, not environment. The candidate
moved to pnpm `12.15.0`, which breaks two assumptions in the docs harness. No
environment change can satisfy either check without editing the candidate or
running a pnpm version the fixtures forbid. Per the workorder, the fixtures
were not patched. Neither row reached a production proof surface, so these
results say nothing about cost-cap or max-chain product behaviour at
`293c977f62`, in either direction.

## Named refs

| Category | Ref | Full SHA | Equality |
|---|---|---|---|
| Product/base (candidate) | `karmaterminal/openclaw` `codeagent/absorb-8083-j9-cand` | `293c977f629f872a643fb94892603310b887293b` | local branch == `origin/` tracking == `git ls-remote` server, checked before firing |
| Harness | `karmaterminal/karmaterminal-openclaw-docs` `main` | `59c328b06fe4c3fb4e420a0f8e8c7bd10ae3f374` | local == tracking == server; both fixtures ran from this exact tree |
| Lane | `codeagent/j9-cw5-cw6-fixtures` | base `59c328b06fe4c3fb4e420a0f8e8c7bd10ae3f374` | published unchanged to `origin` before any evidence; receipts are commits on top |
| CI/workflow | N/A | N/A | process-local fixtures; no Mode-B dispatch (no product or harness code changed) |
| Presentation / deploy / live gateway | N/A | N/A | no gateway started, no fleet config or state touched |

Source dir: a clean detached `git worktree` of the openclaw clone at
`source/WORKTREES/openclaw-j9-fixture-src`, `HEAD` = candidate, zero
`git status --porcelain` lines, no local `filter.*`/`include.*` git config, and
no `node_modules`. It was clean again after every attempt.

## Toolchain

- Node `v26.12.1` (`$HOME/.nvm/versions/node/v26.12.1/bin` first on `PATH`), npm `11.20.0`
- `NO_COLOR=1`, `FORCE_COLOR` unset
- Candidate `packageManager`: `pnpm@12.15.0+sha512.b3951d6d…128e61`
- Host `pnpm` in the candidate: `12.15.0` via the corepack `0.36.0` shim. It
  already matched exactly, so no corepack change was needed.
- R-CW-6 only: `pnpm_config_store_dir=<lane-local stable store>`. The host pnpm
  config `storeDir` points into an Actions runner `_temp` directory, which was
  absent and which a live runner job could create or wipe mid-install. pnpm 12
  honours `pnpm_config_store_dir`, not `npm_config_store_dir`. Store location
  does not affect `lock.yaml` contents.
- R-CW-5 ignores host pnpm by design. It strips `npm_`/`pnpm_`/`corepack_`
  env, uses a private HOME/XDG tree, npm-installs `pnpm@<candidate version>`
  into a private toolchain, and passes a private `--store-dir`.

## Commands

```bash
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <src> --candidate-sha 293c977f629f872a643fb94892603310b887293b \
  --artifact-dir <new empty 0700 dir> --cap 100 --json

pnpm_config_store_dir=<lane-local store> \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <src> --candidate-sha 293c977f629f872a643fb94892603310b887293b \
  --artifact-dir <new empty 0700 dir> --max-chain-length 3 --json
```

## Attempt log

| Row | Attempt | UTC | Exit | Fixture message |
|---|---|---|---|---|
| R-CW-5 | 1 | 2026-10-29 04:18:27 to 04:18:35 | 2 | `candidate-pinned pnpm install did not produce a real pnpm script` |
| R-CW-6 | 1 | 2026-10-29 04:19:19 to 04:19:34 | 2 | `installed node_modules/.pnpm/lock.yaml bytes do not match candidate pnpm-lock.yaml` |

There were no retries. Both causes are deterministic and were reproduced or
confirmed independently (below), so a retry could only repeat the same result.
After each attempt the disposable worktree was confirmed absent from
`git worktree list`.

## R-CW-5 cause: pnpm 12 package layout

`resolvePinnedPnpm` npm-installs `pnpm@12.15.0` into a private toolchain and
requires `node_modules/pnpm/bin/pnpm.cjs`. The published `pnpm@12.15.0` tarball
contains `bin/pnpm.mjs` and root launchers `pnpm`/`pn`, but **no
`bin/pnpm.cjs`**. Its registry `dist.integrity` decodes to exactly the
candidate's `packageManager` sha512, so the fixture installed the correct
package. `pnpm@11.22.0`, the pin at the earlier passing candidate
`80311e8aa07fd560cb957475517c5ea18164541c`, does ship `bin/pnpm.cjs`.

R-CW-5 also carries the R-CW-6 lockfile byte-equality check
(`run-cost-cap-fixture.mjs`, virtual-store lock sha256 == candidate lockfile
sha256), so it would fail there next.

## R-CW-6 cause: whole-file lockfile equality vs a two-document lockfile

The frozen install succeeded and the post-install worktree integrity check
passed. The run then failed in `assertInstalledPnpmDependencyTree`, which
requires `node_modules/.pnpm/lock.yaml` to byte-equal the whole committed
`pnpm-lock.yaml`.

The lane reproduced the fixture's exact install step in a scratch detached
worktree, outside `source/WORKTREES`, removed afterwards:

- The candidate `pnpm-lock.yaml` (sha256 `01c02f06…4627fc`, 18883 lines) has
  **two YAML documents**:
  - lines 1–157 are an env document with `packageManagerDependencies` for pnpm
    12.15.0 and the per-platform `@pnpm/exe.*` packages;
  - after the separator at line 158 comes the main lockfile.
- pnpm writes only the main document to `node_modules/.pnpm/lock.yaml`
  (sha256 `39a639ee…1c01d`, 18725 lines). That file is **byte-identical to the
  candidate's main document**.
- Installed `.modules.yaml` reports `packageManager: pnpm@12.15.0` and
  `virtualStoreDir: .pnpm`, so the later provenance checks would have passed.
- At `80311e8a` (pnpm 11.22.0) the lockfile was a single document, which is why
  this check held there.

The R-CW-6 next blocker is still open:
[`karmaterminal-openclaw-docs#516`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/516).
The delegate template mocks `src/agents/subagent-spawn.js`, which no longer
exists; the owner is `src/agents/subagents/spawn/subagent-spawn.ts`. Its
system-events mock also lacks `enqueueSystemEventRaw`. Safety note (plausible,
not demonstrated): if the lockfile gate is fixed without #516, the stale spawn
mock would not intercept the real spawn owner, which carries gateway caller
wiring. Do not re-fire on a host with a live local gateway until the template
is updated.

## Public-safe copy

The rule was to copy only files that the fixture's `public-artifact-safety.json`
declares safe.

- R-CW-5 never emits `public-artifact-safety.json` (by design, independent of
  this failure), and its only output was `fixture-readiness.json`. **No fixture
  file was copied.** Its non-sensitive readiness values (candidate match,
  tracked-clean, lockfile sha256, cap, no production mutation) are restated in
  `R-CW-5/lane-receipt.json` with their provenance.
- R-CW-6 produced no files. **Nothing to copy.**

The committed files are lane-authored: `README.md`, `R-CW-5/lane-receipt.json`
and `R-CW-6/lane-receipt.json`. Before commit, the lane ran two scans over them:
the harness's own `assertPublicArtifactSafe` predicate, imported unchanged from
`run-max-chain-fixture.mjs` at the harness SHA, and a credential-value scan.
Both passed (see `output.md` in the lane worktree).

## What exact-head proof now needs (harness work, outside this lane)

1. R-CW-5: resolve the candidate-pinned pnpm entrypoint for the pnpm ≥12
   package layout, without loosening the integrity pin.
2. R-CW-5 and R-CW-6: restate the lockfile/tree alignment invariant for pnpm
   multi-document lockfiles. The design needs review so the check is not
   weakened.
3. R-CW-6: docs#516 (delegate template owners and exports, plus failure
   diagnostics).
4. Then re-fire both rows at exact `293c977f629f872a643fb94892603310b887293b`.
