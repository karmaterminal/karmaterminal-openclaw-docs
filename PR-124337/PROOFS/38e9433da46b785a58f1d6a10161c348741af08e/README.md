# openclaw/openclaw#124337 — proof of fix at the pure head

- PR: <https://github.com/openclaw/openclaw/pull/124337>
- title: fix(ingress): bound pre-adoption abandonment with the existing retry budget
- **pure head SHA: `38e9433da46b785a58f1d6a10161c348741af08e`**
- upstream merge-base: `40a01c9744c2`
- scope: 8 files, +171 / -56

Small PR, light proof load: its own tests executed at its own pure head, plus the upstream CI
receipt. It is **not** measured by the continuation 38-row k6 matrix at repository-root `PROOFS/`.

## Result

**All 5 of the PR's own test files ran and passed at `38e9433da46b785a58f1d6a10161c348741af08e` — 35 tests across 3 vitest shards.**

| file | shard | tests |
|---|---|---|
| `src/channels/message/ingress-drain.test.ts` | channels | (30 with the two below) |
| `src/channels/message/ingress-drain.abandonment.test.ts` | channels | |
| `src/channels/message/ingress-drain.cancellation.test.ts` | channels | |
| `src/channels/message/ingress-drain-lifecycle.test.ts` | channels-adjacent | 1 |
| `extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts` | extension-msteams | 4 |

Full output: [`vitest-own-tests.log`](vitest-own-tests.log). Change inventory:
[`diffstat.txt`](diffstat.txt).

## Upstream CI at this head is red for infrastructure reasons — stated plainly

[`upstream-ci-receipt.json`](upstream-ci-receipt.json) records **422 SUCCESS, 73 FAILURE,
98 SKIPPED, 2 CANCELLED, 1 NEUTRAL**. The failures are **not** product failures in any sampled
case: annotations read *"The self-hosted runner lost communication with the server"* (the 46
`checks-node-changed-extensions-config` shards, `checks-node-compact-large`, bundle shards) and
git-level *"Process completed with exit code 128"* (`check-guards`). The shards that would have
covered this PR's changed files were lost to that runner event, so **upstream CI does not by itself
prove these tests green at this head**; the local run above does. A CI re-run is still owed before
landing.

## Method

```bash
git fetch --no-tags https://github.com/openclaw/openclaw.git pull/124337/head:refs/tmp/pr124337
git worktree add --detach <wt> refs/tmp/pr124337     # HEAD = 38e9433da46b785a58f1d6a10161c348741af08e
node scripts/run-vitest.mjs <the 5 test files above>
```

Disclosed harness detail: the PR changes **zero** dependency files, so the detached worktree reused
the sibling checkout's installed workspace `node_modules` by symlink rather than a fresh
`pnpm install`.

## Why fleet evidence is not attributed here

The fleet composite (`1baff536af`) carries a cherry-picked variant, not these bytes. Upstream
#124337 is tightly scoped to 8 files; the composite additionally changes
`src/auto-reply/inbound-debounce.ts`, `reply/dispatch-from-config.prepare-context.ts`,
`reply/queue/drain.ts`, `reply/queue/lifecycle.ts` and `reply/queue/recent-message-ids.ts`, which
are **local integration work and are not part of this PR**. Fleet verdicts therefore cannot be
credited to this SHA.
