# METHOD — 139e3657b1fd5e53166789b8676f18578e209393

Runbook anchors: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`
and `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` Gate 2.7.

## How this SHA came to exist

The P89 continuation assembly after **four** upstream absorbs, fast-forwarded
onto the presentation ref so `openclaw/openclaw#129388` presents it. The fourth
absorb took upstream `715077a3be` (#153989, *preserve operator authority through
queued and child runs*) and `00caa84ce7` (#153834, transcript-FTS row ownership),
which together bumped the agent schema **21 → 22**.

## Reproducers — static gates

```bash
git checkout 139e3657b1fd5e53166789b8676f18578e209393
pnpm install --frozen-lockfile

pnpm tsgo:core                                    # expect rc=0

MAX_WORKERS=1 npx vitest run \
  src/agents/subagent-registry-registration-rollback.test.ts        # 10/10

MAX_WORKERS=1 npx vitest run --config test/vitest/vitest.infra.config.ts \
  src/infra/delivery-queue-sqlite.test.ts \
  src/infra/delivery-queue-sqlite-claim.test.ts \
  src/infra/delivery-queue-terminal.test.ts \
  src/infra/session-delivery-queue.storage.test.ts \
  src/infra/session-delivery-queue.recovery.test.ts                 # 124/124

MAX_WORKERS=1 npx vitest run --config test/vitest/vitest.gateway-server.config.ts \
  src/gateway/server-close.test.ts \
  src/gateway/server-maintenance.test.ts \
  src/gateway/server-maintenance.delegate-artifacts.test.ts         # 123/123

MAX_WORKERS=1 npx vitest run \
  src/agents/subagents/spawn/subagent-spawn.production-boundary.test.ts \
  src/agents/subagents/spawn/subagent-spawn-cleanup.test.ts         # 28/30
```

`MAX_WORKERS=1` is mandatory: OpenClaw's fixtures are not safe under concurrent
access.

Note the last two commands take **no** `--config` — those files resolve through
their own vitest projects. Passing the wrong config silently reports
"No test files found, exiting with code 0", which reads as success. Always check
the `Test Files` count.

## Reproducers — Gate 2.7, run twice and read both

```bash
# vs the base we actually absorbed -- the apples-to-apples preservation check
bash <bootstrap>/tools/drift-cure-gate.sh 715077a3be HEAD "" ./gate-out-base

# vs current upstream -- measures DRIFT, not clobber
bash <bootstrap>/tools/drift-cure-gate.sh upstream/main HEAD "" ./gate-out-now
```

The first is clean. The second reports 44 MIXED-CLOBBER purely because upstream
has moved 175 commits past our merge base, so files we touched now lack lines
written after it. **FROZEN-STALE is 0 in both**, and that is the number which
detects a pure stale-copy clobber.

## Reproducers — diff size and mergeability

```bash
# what upstream actually sees on the PR
git diff --stat $(git merge-base upstream/main HEAD) HEAD | tail -1   # 839 files

# NOT what a PR shows -- symmetric difference, inflated by upstream's own commits
git diff --stat upstream/main HEAD | tail -1                          # 2358 files

git merge-tree --write-tree HEAD upstream/main >/dev/null; echo $?    # 1 = conflicts
git rev-list --count HEAD..upstream/main                              # 175
```

**Use `git merge-tree --write-tree`, never the legacy three-argument form with a
grep for conflict markers.** The legacy form once reported a pair as clean when
`--write-tree` returned rc=1 with ten conflicted paths. That mistake was made on
this lane and is recorded so it is not repeated.

## Behavioral rows

Not fired at this SHA — see `README.md` and `RESOLVED-SHA.md`. The row method is
unchanged: `RUNBOOKS/PROOF-CORPUS-METHOD.md`, including the BOTH-FORMS mandate
(tool surface *and* token/bracket surface for `continue_work` /
`continue_delegate`) and the current-product subnetwork gate — trace the
implementation that will actually run before designing or firing a row.
