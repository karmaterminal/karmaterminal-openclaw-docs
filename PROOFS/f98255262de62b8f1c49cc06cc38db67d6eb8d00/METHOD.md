# METHOD.md

Methodology for the `f98255262de62b8f1c49cc06cc38db67d6eb8d00` corpus.

## Substrate baselines

| Baseline | SHA | Purpose |
|---|---|---|
| `bare-upstream` | `e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6` | openclaw/openclaw:main at PR-head's rebase-base time |
| `PR-head` | `f98255262de62b8f1c49cc06cc38db67d6eb8d00` | Cure-bundle: cure-(22) bytes + agents-core fileParallelism: false + event-projector test alignment, atop bare-upstream |

## Gate procedure

Per `karmaterminal/openclaw-bootstrap:RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md`.

### Gate 1 — Savegame verification

```bash
git ls-remote https://github.com/karmaterminal/openclaw.git refs/heads/savegame/cure-24-reworded-f98255262d
# expect → f98255262de62b8f1c49cc06cc38db67d6eb8d00
```

### Gate 2 — Cure-bytes byte-identical reproduction

```bash
cd <openclaw-checkout>
git fetch https://github.com/openclaw/openclaw.git main
git fetch origin
git diff e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6..f98255262de62b8f1c49cc06cc38db67d6eb8d00 --stat
# expect → 356 files changed, +41082 / -2323
```

Captured at `cure-bytes/gate-4a-cure-bytes-4path.log`.

### Gate 3 — Local gate suite

Per PR-DRIFT-CURE-GATES-RUNBOOK §Gate 3, run from PR-head worktree:

```bash
cd <pr-head-worktree>
git checkout f98255262de62b8f1c49cc06cc38db67d6eb8d00
pnpm install --frozen-lockfile
NODE_OPTIONS='--max-old-space-size=33000' OPENCLAW_VITEST_MAX_WORKERS=16 pnpm vitest run | tee gates/gate-3e-pnpm-vitest.log
```

Captured at `gates/gate-3e-pnpm-vitest.log` (8 failed / 60320 passed / 53 skipped).

### Upstream-baseline broken-class receipt

Per `PROOF-CORPUS-METHOD.md` line 27:

```bash
cd <upstream-baseline-worktree>
git checkout e00cb664ad4bd346866dfb1ad863e7b6c72dd7e6
pnpm install --frozen-lockfile
NODE_OPTIONS='--max-old-space-size=33000' OPENCLAW_VITEST_MAX_WORKERS=16 pnpm vitest run | tee gates/upstream-main-broken-class-receipt.log
```

Captured at `gates/upstream-main-broken-class-receipt.log` (9 failed / 60320 passed / 53 skipped on bare upstream).

## Per-test attribution methodology

Cross-walk PR-head failure-set vs bare-upstream failure-set. Failures appearing in both sets are upstream-class (PR-head inherits). Failures appearing only in PR-head set would be PR-introduced (none in this corpus). Failures appearing only in bare-upstream are PR-head fixes (`runtime-config/io.write-config` here).

## Behavioral rows

This corpus omits R-CW / R-CD / R-RC / R-OBS behavioral rows per `PROOF-CORPUS-METHOD.md` substrate-cost-axis at submission-time. Behavioral surface previously banked at `PROOFS/47c9280234.../` and `PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/`; substantive feature-surface unchanged between those candidates and this PR-head SHA.

## Notes

- Test runs at 33GB heap via `NODE_OPTIONS='--max-old-space-size=33000'` to prevent V8 process-internal OOM under FULL-suite parallel load
- 16-worker parallelism via `OPENCLAW_VITEST_MAX_WORKERS=16`
- agents-core shard uses `fileParallelism: false` per cohort precedent (extension-telegram + tasks + cron + live shards) to serialize timing-sensitive QuickJS-WASI tests
