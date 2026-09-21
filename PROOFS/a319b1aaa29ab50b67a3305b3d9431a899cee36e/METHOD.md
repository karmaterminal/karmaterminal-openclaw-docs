# METHOD — a319b1aaa29ab50b67a3305b3d9431a899cee36e

Runbook anchors: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` (corpus shape,
row assignments, both-forms mandate) and `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` Gate 2.7.

## How this SHA came to exist

`a319b1aaa2` is the P89 continuation assembly after three upstream absorbs, fast-forwarded onto the
presentation ref `codeagent/85651-upstream-1ba243c8-gates` so upstream PR `openclaw/openclaw#129388`
presents a head upstream can actually merge. Before the third absorb the head was 59 upstream
commits behind with 9 conflicted paths, so upstream CI could not run.

## Reproducers — static gates

Run from a `karmaterminal/openclaw` worktree checked out at the presented SHA:

```bash
git checkout a319b1aaa29ab50b67a3305b3d9431a899cee36e
pnpm install --frozen-lockfile

# typecheck
pnpm tsgo:core                                   # expect rc=0

# lint, all three oxlint shards
pnpm lint                                        # expect rc=0

# targeted behavior around the third absorb's conflict cluster
MAX_WORKERS=1 npx vitest run \
  --config test/vitest/vitest.gateway-server.config.ts \
  src/gateway/server-close.test.ts \
  src/gateway/server-maintenance.test.ts \
  src/gateway/server-maintenance.delegate-artifacts.test.ts   # expect 123/123

# the known red
MAX_WORKERS=1 npx vitest run \
  --config test/vitest/vitest.agents-core.config.ts \
  src/agents/embedded-agent-subscribe.subscribe-embedded-agent-session.text-end-reconciliation.test.ts
                                                  # expect 41 pass / 6 fail (openclaw#1350)
```

`MAX_WORKERS=1` is mandatory: OpenClaw's fixtures are not safe under concurrent access.

## Reproducers — upstream-content preservation (Gate 2.7)

Run from the same worktree, with the bootstrap tool:

```bash
bash <bootstrap>/tools/drift-cure-gate.sh upstream/main HEAD "" ./gate-out
# expect: 0 FROZEN-STALE, 0 MIXED-CLOBBER
```

The gate detects a rebased/squashed branch shipping STALE copies of shared files and thereby
reverting upstream fixes. `gates/gate-2.7-classification.tsv` is the full per-file TSV.

## Reproducers — mergeability and fast-forward safety

```bash
git merge-tree --write-tree a319b1aaa2 upstream/main   # rc=0 == clean
git rev-list --count a319b1aaa2..upstream/main         # 0 == upstream fully absorbed
git merge-base --is-ancestor upstream/main a319b1aaa2  # 0 == same

# the ff gate, all six checks
git merge-base --is-ancestor 3821eaef72 a319b1aaa2     # 0 == pure fast-forward
git rev-list --count a319b1aaa2..3821eaef72            # 0 == nothing lost by the ff
```

**Use `git merge-tree --write-tree`, never the legacy 3-argument `git merge-tree` with a grep for
conflict markers.** The legacy form reported this same pair as clean when `--write-tree` returned
rc=1 with 10 conflicted paths. That mistake was made on this lane and is recorded so it is not
repeated.

## Behavioral rows

Not fired at this SHA. See `README.md` and `RESOLVED-SHA.md`: the fleet runtime and the presented
SHA are divergent siblings, so a live fire on the fleet would be evidence about the composite, not
about this SHA. The row method itself is unchanged — `RUNBOOKS/PROOF-CORPUS-METHOD.md`, including
the BOTH-FORMS mandate (tool surface *and* token/bracket surface for `continue_work` /
`continue_delegate`) and the current-product subnetwork gate (trace the implementation that will
actually run, via the installed GitNexus fork, before designing or firing a row).
