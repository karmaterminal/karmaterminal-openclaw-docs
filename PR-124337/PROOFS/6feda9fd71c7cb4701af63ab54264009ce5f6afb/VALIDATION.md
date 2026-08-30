# Validation

## Exact behavioral execution

The pushed harness at docs commit
`7cc7dc68f3f6d5371e89de2f2697ca06d3f04379` executed from the exact product
worktree. `run-summary.json` and both row receipts are Ed25519-signed PASS
envelopes.

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

The final artifact disposition is recorded after the run completes.

