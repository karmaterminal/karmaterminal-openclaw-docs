# openclaw/openclaw#124337 exact transport proof

Created and executed
`PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/`
from a pushed docs harness against exact product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb`.

| Row | Handling | Signed verdict |
| --- | --- | --- |
| Genuine abandonment ceiling | exact Discord transport execution | PASS |
| Mixed fan-in and explicit cancellation | exact Discord transport execution | PASS |
| Prior `eee69b3d` component rows | inspected, not transposed | N/A |

The corpus binds product/tree/harness identity, PID/start time, Discord route
and channel identity, durable session row, durable attempt sequence,
dead-letter payload hashes, strict follower completion ordering
(`1277001 < 1277002`), reopen state, replay absence, and external cleanup.
The rejected `03edde2b` control fails the same strict predicate because its
timestamps are equal. Four historical fail-closed harness diagnostics and
their Ed25519 public keys are retained and independently verifiable.

Focused serial proofs passed for channels (7), Plugin SDK (8), and Discord
(23). Mode-B run `33318993673` used product
`6feda9fd71c7cb4701af63ab54264009ce5f6afb` and workflow
`d05778e6a96dd9a96946eff483e80c4d9ff9575e`; it completed red with 20
deterministic failures. The unchanged aggregate artifacts and byte-provenance
classification are committed. No broad acceptance is claimed.
The proof-only correction did not change product inputs, so Mode-B was not
rerun; this lane's acceptance path is focused-only with the preserved red
Mode-B disclosure.

No docs-main index/current pointer, product branch, presentation ref, fleet
runtime, or prince deployment was changed.

## Exact controls and focused validation

The rejected harness at
`03edde2b0b0b7bfc7afef7ac2eb36994971ff301` was executed unchanged against the
exact product and produced its signed historical PASS, then an independent
strict predicate rejected its equal timestamps:

```text
head.failed_at        = 1277001
follower.completed_at = 1277001
strict-control exit   = 1
```

The pushed successor harness at
`52c11aa552f08201a91421afe5532fd694c7c873` used the same product and production
Discord composition boundary. Its signed row A receipt records:

```text
head.received_at      = 10000
follower.received_at  = 10001
head.failed_at        = 1277001
follower.completed_at = 1277002
```

The successor retained the exact attempt sequence, terminal reason, payload
hash, one-dead-letter count, canonical close/reopen projections, and empty
replay list. Row B retained zero retry charge for current, legacy-fallback, and
explicit cancellation, while its genuine-abandonment sibling reached the
ceiling.

Focused product proof used the repository runner with one worker:

```bash
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts \
  --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts \
  src/channels/message/ingress-drain.cancellation.test.ts
node scripts/run-vitest.mjs run --config test/vitest/vitest.plugin-sdk.config.ts \
  --maxWorkers=1 src/plugin-sdk/channel-ingress-runtime.test.ts
node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.extension-discord.config.ts --maxWorkers=1 \
  extensions/discord/src/monitor/message-handler.queue.test.ts
node PR-124337/PROOFS/6feda9fd71c7cb4701af63ab54264009ce5f6afb/verify.mjs
```

Results were 7/7 channels, 8/8 Plugin SDK, 23/23 Discord, and corpus verification
PASS with three signed PASS receipts, four signed historical FAIL diagnostics,
33 checksums, and 34 corpus files. The product worktree remained clean and no
matching temporary proof directory remained.
