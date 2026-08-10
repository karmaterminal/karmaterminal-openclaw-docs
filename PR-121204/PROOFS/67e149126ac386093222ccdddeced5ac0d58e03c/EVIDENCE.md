# PR 121204 — ClawSweeper follow-up evidence

- Product repository: `karmaterminal/openclaw`
- Follow-up PR: `#1237`
- Exact product head: `67e149126ac386093222ccdddeced5ac0d58e03c`
- Base: `codeagent/wo1229-upstream-pr` at `02bd9d77142248a07e4ad50387a166db1823b494`
- Scope: Discord durable stale-ambient classification and Plugin SDK compatibility follow-up

## Finding addressed

Normal Discord Gateway `MESSAGE_CREATE` ingress persists the raw Gateway payload. The earlier stale classifier inspected a synthetic `rawMessage.channel` object that normal Gateway events do not contain, so production rows could not prove their channel kind.

This head corrects the owner boundary:

- `MessageCreateListener` accepts the real `GatewayMessageCreateDispatchData` contract.
- Admission synchronously normalizes event-owned `channel_type` into an optional private v1 `channelKind: "thread" | "non-thread"` fact before the durable append.
- Only the closed whitelist of known guild text/announcement/voice/stage channel types becomes `non-thread`; all three known thread types become `thread`.
- DM, group DM, missing, malformed, and future channel types omit the fact and fail open.
- The payload remains version 1; existing rows without the additive fact decode and dispatch.
- No REST/cache lookup, channel name, SQLite migration, or public Plugin SDK surface was introduced.

## Focused verification

The following exact-head checks passed locally:

- Discord production typecheck: `node scripts/run-tsgo.mjs -p extensions/discord/tsconfig.json --noEmit`
- Full extension test typecheck: `node scripts/run-tsgo.mjs -p test/tsconfig/tsconfig.extensions.test.json --noEmit`
- Focused Discord tests: 4 files / 81 tests passed
- Extension lint over all touched Discord files
- Both extension Plugin SDK boundary checks
- Plugin SDK API baseline check
- Plugin SDK surface check (`package-exported forbidden subpaths: 0`)
- `git diff --check`

The first hosted exact-head run on parent `f6c4aec240743acfd16e6f78166e9687c121bddb` found one attributable test-only type error: Vitest widened the three thread literals in an `it.each` table to the full `ChannelType` enum. This head narrows that fixture with `as const`; the full extension test-type configuration and focused behavior suite then passed locally before push.

The focused corpus proves:

- raw Gateway `channel_type` crosses the Gateway forwarding boundary unchanged;
- `channelKind` is present in the encoded queue payload before append release;
- admission performs no channel REST lookup;
- restart recovery consumes the persisted fact and suppresses eligible stale ambient backlog;
- legacy v1, malformed, and unknown future facts dispatch without dead-lettering;
- all three thread kinds dispatch;
- global configured text mentions dispatch on a mention-required persisted guild channel;
- a fresh direct mention becomes durable while stale same-lane settlement is deliberately blocked, then dispatches after settlement.

## Build disposition

The full build completed all nine unified TypeScript bundle invocations and passed the CLI bootstrap import guard. Runtime-postbuild then stopped on shared dependency state: `node_modules` had no `@openclaw/ai` package, while the locally built AI dist contained 72 files. This is an environment-only postbuild stop; no product compile error was emitted.

`pnpm check:changed` was unavailable because its Crabbox workload router failed its own binary sanity check. The underlying focused type, lint, API, surface, and test gates above were run directly.

## Proof boundary

This records source-contract and deterministic durable-ingress evidence. It does **not** claim a live recovered Discord Gateway replay. That live suppression/no-prompt plus prompt fresh-direct receipt remains outstanding for the upstream presentation.

No Discord payloads, transcripts, account IDs, event IDs, channel IDs, host/process data, credentials, tokens, or local paths are included.
