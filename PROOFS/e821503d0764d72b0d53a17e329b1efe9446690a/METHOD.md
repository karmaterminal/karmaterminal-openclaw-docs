# METHOD — corpus at `e821503d0764`

## Reproducers

Every gate below was run from a `karmaterminal/openclaw` worktree at the presented tree
`c9a3793d0a84bce990caf76e69be41f25bf8b782`.

```bash
pnpm tsgo:core
pnpm tsgo:scripts
pnpm format:check
pnpm lint
node --import ./scripts/tsx.mjs scripts/check-continuation-guard-callsites.mts
```

Gate 2.7, keyed to the **absorbed** upstream base rather than current upstream — running it against
current upstream measures drift that arrived after the absorb and misreports it as clobber:

```bash
bash <bootstrap>/tools/drift-cure-gate.sh 6d65c8b7f2 HEAD
```

Affected surface — 116 files: the 9 conflicted modules of the absorb plus all 11 pinned guards' modules
plus `test/scripts/check.test.ts`:

```bash
MAX_WORKERS=1 taskset -c 0-7 pnpm vitest run $(cat surface.txt)
```

`MAX_WORKERS=1` is mandatory: OpenClaw's fixtures are not safe under concurrency. `taskset -c 0-7` is
the standing Raptor Lake mitigation for this host class.

## Naive-upstream byte-walk

The method that answers "is it us" rather than "did this change it":

```bash
git worktree add --detach <W> upstream/main
ln -s <absorb-worktree>/node_modules <W>/node_modules
# and EVERY workspace-level node_modules, or vitest dies during projects setup on
# @vitest/browser-playwright, which lives in ui/node_modules rather than the root:
find . -name node_modules -type d -not -path './node_modules/*' -not -path '*/node_modules/*'
```

Valid **only** while `pnpm-lock.yaml` is identical between the two trees; verified byte-identical here,
so the shared store introduces no confound. `pnpm install` was never run.

Two constraints learned the hard way and recorded so they are not re-learned:

- **`tsgo` refuses symlinked dependencies outright** — "Declaration input escapes checkout … shared
  installs and external symlinks are unsupported". Only **vitest** can be run in a symlinked comparison
  worktree. No typecheck result in this corpus comes from one.
- **Vitest test names carry a per-run `NNms` timing suffix.** Comparing failure sets without stripping
  it produces wrong attribution in both directions. All set comparisons here normalize with
  `sed -E 's/ [0-9]+ms$//'` first.

## Failure-set comparison

```bash
comm -13 base.set head.set   # head-only  -> introduced
comm -23 base.set head.set   # base-only  -> fixed
comm -12 base.set head.set   # both       -> pre-existing
```

Applied per surface, always on normalized, sorted, de-duplicated sets.

## Runbook anchors

- `RUNBOOKS/ENTRYPOINT.md` — decision tree; read before acting. Its absorb branch requires
  `openclaw-local-ci.yml` green **and** Gate 2.7 clean **before** fast-forwarding the presentation ref.
- `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` — Gate 2.7 classifier and remediation by class.
- `RUNBOOKS/PROOF-CORPUS-METHOD.md` — corpus shape and publication rules.
- `RUNBOOKS/PATH-B-BUILD-ONCE-DEPLOY-MANY-RUNBOOK.md` — donor build + deploy dispatch.
