# openclaw/openclaw#121204 — proof of fix at the pure head

- PR: <https://github.com/openclaw/openclaw/pull/121204>
- title: fix(discord): keep stale ambient backlog from starving live mentions after gateway recovery
- **pure head SHA: `035122431921a736cd007bb46b94b765f35a5b02`**
- upstream merge-base: `b057266d78d0`
- scope: 15 files, +1261 / -56

This is a small PR, so the proof load is deliberately light: its own tests executed at its own pure
head, plus the upstream CI receipt. It is **not** measured by the continuation 38-row k6 matrix,
which lives at repository-root `PROOFS/` and belongs to the continuation corpora.

## Result

**All 4 of the PR's own test files ran and passed at `035122431921a736cd007bb46b94b765f35a5b02` — 53 tests across 2 vitest shards.**

| file | shard |
|---|---|
| `extensions/discord/src/internal/gateway-channel-inventory.test.ts` | discord |
| `extensions/discord/src/monitor/ingress.test.ts` | discord |
| `extensions/discord/src/monitor/message-handler.queue.test.ts` | discord |
| `src/channels/message/ingress-drain-pending-disposition.test.ts` | channels |

Full output: [`vitest-own-tests.log`](vitest-own-tests.log). Change inventory:
[`diffstat.txt`](diffstat.txt). Upstream CI: [`upstream-ci-receipt.json`](upstream-ci-receipt.json)
— **9 SUCCESS, 9 SKIPPED, zero failures** at this head.

## Method

```bash
git fetch --no-tags https://github.com/openclaw/openclaw.git pull/121204/head:refs/tmp/pr121204
git worktree add --detach <wt> refs/tmp/pr121204     # HEAD = 035122431921a736cd007bb46b94b765f35a5b02
node scripts/run-vitest.mjs <the 4 test files above>
```

Disclosed harness detail: the PR changes **zero** dependency files
(`git diff --name-only b057266d78d0 HEAD -- package.json pnpm-lock.yaml` → 0), so the detached
worktree reused the sibling checkout's installed workspace `node_modules` by symlink instead of a
fresh `pnpm install`. Dependency bytes are therefore identical to a normal install of this
lockfile; only the product/test sources are the PR's.

## Why fleet evidence is not attributed here

The six-seat fleet runs a local composite (`1baff536af`) that carries a **cherry-picked** variant of
this fix, not these bytes. Its file set differs from the upstream PR — the composite touches
`extensions/discord/src/internal/gateway-channel-inventory.ts`, `internal/gateway.ts`,
`monitor/message-dispatcher.ts`, `monitor/message-text.ts` which this PR does not, and this PR
touches `internal/client.ts`, `monitor/message-handler.preflight.ts`,
`message-handler.preflight-helpers.ts`, `message-handler.raw-mention.ts` which the composite does
not. Attributing fleet verdicts to this SHA would credit bytes that were never executed.
