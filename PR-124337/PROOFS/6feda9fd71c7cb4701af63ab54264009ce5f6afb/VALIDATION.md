# Validation

## Exact behavioral execution

The strengthened pushed harness at docs commit
`52c11aa552f08201a91421afe5532fd694c7c873` executed from the exact product
worktree. `run-summary.json` and both row receipts are Ed25519-signed PASS
envelopes. Payload hashes are derived from the closed durable store and row A
asserts that the dead-letter's embedded Discord message hash equals the admitted
transport payload hash. It also asserts that the distinctly later-admitted
same-lane follower completes strictly after head terminalization. The rejected
`03edde2b0b0b7bfc7afef7ac2eb36994971ff301` control produced equal terminal
timestamps (`1277001 == 1277001`) and failed the independent strict predicate;
the successor produced `1277001 < 1277002`.

## Focused repository proof

All commands used the repository runner and one worker:

```bash
node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.channels.config.ts \
  --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts \
  src/channels/message/ingress-drain.cancellation.test.ts

node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.plugin-sdk.config.ts \
  --maxWorkers=1 \
  src/plugin-sdk/channel-ingress-runtime.test.ts

node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.extension-discord.config.ts \
  --maxWorkers=1 \
  extensions/discord/src/monitor/message-handler.queue.test.ts
```

Results: channels 7/7, Plugin SDK 8/8, Discord 23/23.

## Broad acceptance

Mode-B run `33318993673` targets product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb` from workflow ref
`codeagent/124337-feac2430-routing-independent-review-20260829`, whose run
`headSha` is `d05778e6a96dd9a96946eff483e80c4d9ff9575e`.

The run completed `failure`. Its authoritative artifact reports:

- all 167 planned shards routed and all 69 routed-job receipts valid;
- static gates, routing eligibility, the `channels` shard, the full
  `extension-discord` shard, and `agentic-plugin-sdk` green;
- 179,809 passed test executions, 25 failed executions, five load-flakes
  greened, and 20 deterministic failures;
- failed hosted, self-hosted, and self-hosted-dist lane guards.

Every failure reds broad acceptance. See [`MODE-B.md`](MODE-B.md) and the
unchanged aggregate receipts under
[`artifacts/mode-b-33318993673/`](artifacts/mode-b-33318993673/).
The proof correction changes no product input, so Mode-B was not rerun.
