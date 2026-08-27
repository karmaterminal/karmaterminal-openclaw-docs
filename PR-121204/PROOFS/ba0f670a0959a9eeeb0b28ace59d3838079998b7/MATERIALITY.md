# Ancestry and materiality receipt

Captured 2026-08-27 UTC for upstream PR #121204 protected head
`ba0f670a0959a9eeeb0b28ace59d3838079998b7`.

## Ancestry

Git's `merge-base --is-ancestor` returned success for all of:

- `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` ->
  `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938`;
- `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` ->
  `ba0f670a0959a9eeeb0b28ace59d3838079998b7`;
- `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` ->
  `ba0f670a0959a9eeeb0b28ace59d3838079998b7`;
- exact floor `6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578` ->
  `ba0f670a0959a9eeeb0b28ace59d3838079998b7`.

The relevant first-parent integration is merge
`2745d7617c16fbb7650c4a2fe0065ef82c1a46ff`, with parents `5d0426bb`
and exact floor `6ae89b5a`. Formatting commit `ba0f670a` follows it.

## Complete 24-path blob walk

Blob IDs are source / previous head / protected target. `same` means all three
IDs match. `reviewed drift` means the path changed in one of the two measured
legs and was included in focused or exact-target owner validation.

| Feature path | `3bf1ca1d` | `5d0426bb` | `ba0f670a` | Result |
| --- | --- | --- | --- | --- |
| `config/assertion-safety-baseline.txt` | `4bd0103a9750` | `fee15680835a` | `8538cf2b9d7b` | reviewed inventory drift |
| `docs/plugins/sdk-channel-outbound.md` | `34fa3c59a54e` | same | same | same |
| `extensions/discord/src/internal/gateway.test.ts` | `3b4d4e4f756a` | `0521575cd4b4` | same as previous | reviewed test drift |
| `extensions/discord/src/internal/listeners.ts` | `5d41670fe11c` | `9e60228403d2` | same as previous | reviewed helper privacy |
| `extensions/discord/src/monitor/ingress-channel-kind.test.ts` | `d75799ab09bb` | same | same | same |
| `extensions/discord/src/monitor/ingress-corrupt-pending.test.ts` | `55b91a0b9aac` | same | same | same |
| `extensions/discord/src/monitor/ingress-stale-direct-config.test.ts` | `e75e5e398ecf` | same | same | same; source row owner |
| `extensions/discord/src/monitor/ingress.direct-open-stale.fossil.test.ts` | `bf6708b6bac9` | same | same | same |
| `extensions/discord/src/monitor/ingress.import-boundary.test.ts` | `1eacc419eb2a` | same | same | same |
| `extensions/discord/src/monitor/ingress.test.ts` | `8d369701d0ef` | same | `f9936c7894b8` | conflict-resolved test support + formatting |
| `extensions/discord/src/monitor/ingress.ts` | `e200dbbb7ba5` | same | same | same; runtime owner |
| `extensions/discord/src/monitor/message-handler.preflight-helpers.ts` | `67350697fea0` | same | `01a4f6bfcb1b` | conflict-resolved upstream helper ownership |
| `extensions/discord/src/monitor/message-handler.preflight.ts` | `785296d36119` | same | `1948cf9c26cf` | reviewed upstream helper integration |
| `extensions/discord/src/monitor/message-handler.queue.test.ts` | `97f9d3c5e52d` | same | `175ff93d1c5b` | reviewed upstream queue tests |
| `extensions/discord/src/monitor/message-handler.raw-mention.ts` | `e513af96a294` | same | same | same |
| `extensions/discord/src/monitor/message-handler.ts` | `e9bf43326e9d` | same | same | same |
| `scripts/check-channel-agnostic-boundaries.mts` | `b6ce41690d65` | same | same | same |
| `src/channels/message/ingress-drain-pending-disposition.test.ts` | `25a67089390a` | `cd3a78b348e2` | same as previous | reviewed disposition tests |
| `src/channels/message/ingress-drain-pending-disposition.ts` | `895cf99ba269` | `c7f14310a63a` | same as previous | reviewed core follow-up |
| `src/channels/message/ingress-drain-retry-delay.test.ts` | `280d87e3c2fd` | same | same | same |
| `src/channels/message/ingress-drain-state.ts` | `9ed4084361f4` | same | same | same |
| `src/channels/message/ingress-drain.freshness.test.ts` | `00591bf2cc3a` | `ea432c0af1d9` | same as previous | reviewed freshness tests |
| `src/channels/message/ingress-drain.test-helpers.ts` | `ccd0f9101194` | same | same | same |
| `src/channels/message/ingress-drain.ts` | `efafe32a2b55` | `c904eafab831` | same as previous | reviewed FIFO integration |

Totals:

- source -> previous: 7 changed paths, +115/-66;
- previous -> target: 5 changed paths, +92/-143;
- source -> target: 11 unique changed paths, +204/-206;
- 13 of 24 paths byte-identical source -> previous -> target.

The two source-isolating behavior owners remain byte-identical:
`ingress.ts` at `e200dbbb...` and
`ingress-stale-direct-config.test.ts` at `e75e5e39...`.

## Two semantic conflict resolutions

`git show --remerge-diff 2745d761...` reported exactly two content conflicts:

1. `extensions/discord/src/monitor/ingress.test.ts`: keep the PR's
   `ChannelType` coverage and private helper boundary, adopt current channel
   ingress test support, and drop obsolete `ChannelIngressQueue` /
   `createDeferred` direct imports.
2. `extensions/discord/src/monitor/message-handler.preflight-helpers.ts`: adopt
   centralized `isDiscordThreadChannelType` and `DiscordChannelInfo`, while
   keeping the PR's private `Message` type and conservative fail-open
   stale-ambient semantics.

The merge commit message states the same semantic intent: preserve generic FIFO
freshness and Discord's fail-open stale ambient disposition while adopting
upstream channel ingress test support and Discord channel helper ownership.
`ba0f670a` then changed only `ingress.test.ts` formatting.

## Current upstream merge tree

At review time:

- upstream `main`: `71d4a8c3e305c623aa3ffe92696eec18f116cfc6`;
- GitHub merge ref: `975c1c4ec06be37c4cb3736506584427d7552c02`;
- merge-ref parents: current upstream main and protected target `ba0f670a`;
- GitHub merge-ref tree:
  `67edb2ab085c46af1b8632a8aecca44022178db8`;
- fresh local `git merge-tree --write-tree` tree:
  `67edb2ab085c46af1b8632a8aecca44022178db8`.

The trees are equal. The current merge result contains all 24 PR feature paths
with +3895/-109 against review-time upstream main.

## Focused and causal evidence

The copied source execution provides three isolated-state owner-surface rows:
two source-isolating PASS receipts and one explicitly non-isolating
composite-context watchdog receipt.

The target-local [causal control](CAUSAL-CONTROL/README.md) preserves the
identical production-shaped Fossil A fixture:

- RED before the repair: stale ambient and fresh addressed work both
  dispatched;
- GREEN after the repair: only fresh addressed work dispatched.

The repaired historical exact-composite focused suites passed 85/85:
Discord 40/40, generic channel ingress 37/37, retry-delay 3/3, and Telegram
sibling 5/5. These remain historical focused evidence, not a new target run.

Exact-target Mode-B independently reports channels 1171/0, Discord 3046/0,
Signal 833/0, all eight core-tooling shards 9317/0, channel contracts 493/0,
repo tooling 178/0, and static gates green.

## Mode-B aggregate and honest limits

[MODE-B-RECEIPT.json](MODE-B-RECEIPT.json) preserves run `33033099410`:
168,528 passed, 28 failed, 5 load flakes greened, and 23 deterministic
failures. All seven deterministic failure files are outside the 24 feature
paths and have identical Git blobs at floor `6ae89b5a` and target `ba0f670a`.
The aggregate therefore remains honestly `failure`; only the affected feature
slice is classified green.

No new live exact-target behavior execution exists. No deployed gateway,
Discord, or Signal mutation occurred. Downstream agent execution remains
outside the copied source rows. GitNexus was unavailable, so no graph-derived
materiality claim is made.
