# PR #121204 exact-head proof corpus

This corpus is bound to the PR head **`99c99a06d0e8c26ac0ef6150f1fdfd65eff75392`**, seven commits on upstream main `23bc4d7bfe8626594f4d986814ea15855097cb6b`:
- `c6ae3d2c56` feat(channels): let a channel settle or hold pending ingress rows before claim
- `d19a007154` fix(channels): fence pre-claim disposition to the row generation it inspected
- `c395b445d1` fix(discord): keep a session-scoped channel inventory from gateway dispatches
- `bc35b4f86a` fix(discord): fail stale ambient gateway backlog before it claims a turn
- `c59f69417f` fix(discord): read the agent roster canonically and satisfy upstream lint and knip
- `c47379fbde` fix(discord): decide stale ambient rows with preflight's own mention gate
- `99c99a06d0` fix(discord): project stale rows through preflight's text resolution

**It executes those exact bytes.** The control is the same harness on `23bc4d7bfe`, the first parent of the seven-commit series (upstream main when the proof ran), in a detached worktree with the identical lockfile (`pnpm-lock.yaml` blob `f2a63c09bc` on both sides).

This answers ClawSweeper's "Real behavior" ask on revision 15: redacted evidence of stale passive suppression **followed by** fresh mention delivery **and** configured direct-open request delivery, through the production recovery path (durable SQLite queue -> drain -> dispatcher seam), as terminal traces.

## Verdict: PASS. Head and control differ in exactly the way the PR claims.

Scenario R, two processes over one SQLite state dir. **R1 (outage):** 22 raw `MESSAGE_CREATE` frames are admitted through the production Discord ingress monitor while its drain is not running, then the process exits. 20 are ambient chatter in a mention-gated channel (source timestamps T-60..T-22 min), one is an old `@bot` mention in the same channel (T-41), one is an unaddressed request in a channel configured `requireMention: false` (T-31). **R2 (recovery):** a fresh process registers a real `GatewayPlugin`, feeds it READY and GUILD_CREATE, reads the live policy from a real config, admits one fresh `@bot` mention (T-0) in the gated channel, and starts the drain.

| | Head `99c99a06d0` | Control `23bc4d7bfe` (series parent) |
| --- | --- | --- |
| **Stale ambient rows (20)** | **All 20 `failed`, `failed_reason=stale-ambient-backlog`, `attempts=0`** (never claimed; the `last_error` text is the policy's own message with the row's age and the 900000 ms limit). None reached the dispatcher. [log](logs/head-R.log) | All 20 `completed`: each was claimed and delivered to the dispatcher seam. Same-lane order is FIFO; the direct-open request sits on its own lane and reached the seam 2nd. [log](logs/control-R.log) |
| **Old mention (T-41, gated channel)** | Dispatched **1st**, `completed`. | Dispatched 12th (behind amb-01..amb-10), `completed`. |
| **Direct-open request (T-31, `requireMention:false` channel; the P1 case)** | Dispatched **2nd**, `completed`. Not expired: the policy resolved the channel as not mention-gated through the production `resolveDiscordShouldRequireMention` over the live policy (`<gated>=true <open>=false` in the log). | Dispatched 2nd (own lane), `completed`. |
| **Fresh mention (T-0, gated channel)** | Dispatched **3rd of 3; 2 rows before it**, `completed`. | Dispatched **23rd of 23; 22 rows before it**, `completed`. Starved behind every stale ambient row on its lane. |
| **Dispatch order** | `old-mention -> open-request -> fresh-mention` | `amb-01 -> open-request -> amb-02 ... amb-10 -> old-mention -> amb-11 ... amb-20 -> fresh-mention` |
| **Drain wall time (start to idle)** | 3423 ms | 3482 ms |
| **Final SQLite** | 23 rows: `{"failed":20,"completed":3}` | 23 rows: `{"completed":23}` |

Both R2 runs reached `pending=0 claims=0`; the live-policy reader made **0 REST calls** on both sides (`restFetchCalls=0`). The `[verdict]` line in each log is computed by the harness from the final SQLite projection printed just before it.

What the head log also shows, from production code with no harness help:
- `GatewayPlugin.getGatewayChannelInfo` / `isGatewayChannelInventoryHydrating` exist (`function`) and flip `hydrating(guild)` from `true` after READY to `false` after GUILD_CREATE, with the inventory holding both channels. On control both methods are `undefined` and the inventory is `null`, as expected on a tree without `c395b445d1`.
- The default resolvers in `ingress.ts` (`getGateway(accountId)?.getGatewayChannelInfo` / `...isGatewayChannelInventoryHydrating ?? true`) were used; the harness did not pass `resolveChannelInfo` or `isChannelInventoryHydrating`.

## Honest limits

- **No Discord socket, no Discord REST, no model.** The `GatewayPlugin`'s `client` is a two-method stub and READY / GUILD_CREATE are synthetic frames handed to `handleDispatch`; the live-policy fetcher throws and was never called. `dispatch` is a stub at the exact seam `createDiscordMessageHandler` passes to the monitor: it records the event and calls `lifecycle.onAdopted()`. "Dispatched" means "claimed from the durable queue and delivered to the dispatcher seam". Production preflight is not run, so on control the 20 ambient rows would be preflight-skipped as unmentioned (no agent turn) but, as the control log shows, each is still claimed and delivered ahead of the fresh mention on the same lane; that serialization is the starvation the PR removes.
- `mapGatewayDispatchData` runs with `client = {}`, the same as the PR's own boundary test; it only reads the raw frame for these fixtures.
- Backlog frames are admitted at wall-clock T with Discord `timestamp`s in the past (RESUME-replay shape); the policy ages them by send time because the durable receipt is not newer. Rows admitted at their send time and left pending by a stuck drain would age the same way.
- Scenario P2 (same-tick claim -> fail -> resubmit fence on `updatedAt`) is not re-run here; it is covered by `src/channels/message/ingress-drain-pending-disposition.test.ts` and `ingress-queue.generation.test.ts` at this head.
- The pending-history entry preflight records for a skipped unmentioned message is not written for a row failed pre-claim (the PR states this tradeoff); this harness does not observe it.
- Single run per side; the ordering within a drain pass between the two lanes (`old-mention` vs `open-request`, `amb-01` vs `open-request`) is scheduling, not a contract.

## Files

- [`METHOD.md`](METHOD.md): what the harness wires, what is production and what isn't, exact commands, environment
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md): identities
- [`proofs-manifest.json`](proofs-manifest.json): scenario rows with their evidence files
- [`harness/discord-recovery-proof.mts`](harness/discord-recovery-proof.mts): the harness, sha256 `7ad9de9a21c04496887a075c767615e357ac4b3bdd40e2b3101049647402a536`
- `logs/{head,control}-R.log`: R1 and R2 output concatenated, local paths replaced by `<scratch>` / `<home>`. The SQLite row projections are inline (`[sqlite] …`).

No credentials, hostnames or real Discord identifiers appear. Guild, channel, bot and user snowflakes are synthetic constants (`1000…01`, `2000…01/02`, `3000…01`, `4000…01`); message ids are `amb-NN`, `old-mention`, `open-request`, `fresh-mention`; message bodies are fixture strings. The config token is the literal string `proof-token-not-a-credential` and is not logged.

## This head vs the previously proven heads

`99c99a06d0` adds round 5 on top of `c47379fbde`. The policy now takes its text from preflight's own `resolveDiscordMessageText` (native `<@id>` rewritten to `@username`; 🩸's finding), and it runs mention patterns only on typed content, as preflight does: embed or component text is never a mention. `message-text.ts` is byte-identical to upstream again. The remaining divergences are conservative supersets (the policy keeps where preflight may drop): bot-author `@everyone`, member-allowlist denials, ACP-bound channels and text-command authorization.

`c47379fbde` added one commit on top of `c59f69417f`, which answers ClawSweeper rev 17 and closes the class of "our addressed-check differs from preflight" findings:
- **The policy's "addressed?" verdict is now production preflight's own chain.** It uses `resolveGroupThreadMentionFacts` (broadcast participants with unfiltered patterns, the rev-17 case), `resolveInboundMentionDecision` and `resolveDiscordMentionPolicy`, all through the plugin-SDK exports preflight itself uses. The bespoke helpers (`isAddressedToBot`, `matchesConfiguredMentionText`, the raw `<@id>` scan) are deleted, and `message-handler.preflight.ts` / `message-handler.preflight-helpers.ts` are byte-identical to upstream again.
- **A parity test** (`ingress-stale-policy.preflight-parity.test.ts`) runs the real `preflightDiscordMessage` against the policy over the same frames (14 frames, plus a both-verdicts-covered meta test), asserting *policy keeps ⇔ preflight admits*.
- One verdict changed deliberately to match preflight: a bare `<@id>` in text with no native `mentions[]` entry is not a mention to preflight, so it no longer rescues a stale row.

`c59f69417f` (rev-16 P1) read the agent roster canonically and fixed upstream lint and knip. `bc35b4f86a` is the stale policy.

This harness scenario uses native mentions, a reply-free old mention and a direct-open request, so it doesn't exercise the broadcast or roster paths; the unit, boundary and parity tests do. It was re-run unchanged (same harness sha256) at this head and against the same control, with identical outcomes.
