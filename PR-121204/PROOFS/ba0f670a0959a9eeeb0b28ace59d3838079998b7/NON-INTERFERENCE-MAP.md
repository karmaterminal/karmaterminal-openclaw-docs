# Source, follow-up, and target non-interference map

## Source row ownership

| Row | Production owner | Source result | Target treatment |
| --- | --- | --- | --- |
| Stale direct-open ambient vs fresh mention | `extensions/discord/src/monitor/ingress.ts`; core pending disposition | Source-isolating PASS | Owner implementation and regression blob are unchanged at target |
| Corrupt pending vs fresh addressed | Same Discord/core seam | Source-isolating PASS for null payload | Selected source assertion and owner implementation are unchanged |
| Watchdog bounded recovery/no replay | `src/channels/message/ingress-drain.ts` | Composite-context PASS; source non-isolating | Remains context-only; no transposition promotion |

The stale-direct regression blob is
`e75e5e398ecf26b30ce292f9ffb788ddfb6b72c5` at source, previous head, and
target. `extensions/discord/src/monitor/ingress.ts` is likewise unchanged at
blob `e200dbbb7ba5189fd28cbbd4e78d80e6b39ccd31`.

## Changed bytes

Across all 24 PR feature paths, 13 are byte-identical from source through
target. Seven paths changed from source to `5d0426bb` for reviewed
follow-up/upstream integration, and four test/helper paths changed from
`5d0426bb` through the upstream-floor merge. The assertion baseline also changed
on both legs as its tracked line inventory followed those source changes.

The merge conflicts were restricted to:

1. `extensions/discord/src/monitor/ingress.test.ts` — retained the PR's
   `ChannelType` test coverage and private helper boundary while adopting the
   upstream channel-ingress test support; obsolete direct queue/deferred imports
   were not restored.
2. `extensions/discord/src/monitor/message-handler.preflight-helpers.ts` —
   adopted upstream's centralized `isDiscordThreadChannelType` and
   `DiscordChannelInfo` ownership while preserving the PR's private helper
   types and fail-open stale-ambient policy.

Formatting commit `ba0f670a` changed only import formatting in
`extensions/discord/src/monitor/ingress.test.ts`; it did not change runtime
owner bytes.

See [MATERIALITY.md](MATERIALITY.md) for the complete 24-path blob walk.
