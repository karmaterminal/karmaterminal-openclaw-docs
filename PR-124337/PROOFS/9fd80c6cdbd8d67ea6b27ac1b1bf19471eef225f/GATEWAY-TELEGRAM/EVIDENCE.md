## Evidence: Telegram interactive-submission cancellation (openclaw#124337)

**What this covers:** the Telegram plugin-callback path this PR changed (`bot-handlers.callback-router-controls.ts`, `bot-message.ts`, `bot-core.ts`, `telegram-ingress-drain.ts`).

The path:
1. A plugin's Telegram interactive handler returns `{ submitText }`.
2. The submission is queued behind a busy turn.
3. Its owner ends it before adoption.

ClawSweeper's open item asked for that submission cancelled before adoption, with:
- retry facts preserved;
- the buttons retained;
- successful redelivery through the shipped path.

**Real environment tested:** the shipped Gateway (`node scripts/run-node.mjs gateway`) on Linux x86-64, Node 26.12.1, from clean worktrees.
- **Head:** `9fd80c6cdbd8d67ea6b27ac1b1bf19471eef225f`.
- **Base:** upstream `main` `93a9fa4562b644e1e31dfed4b529bc2b1d378e2f`, the head's merge parent.
- **Identity:** each run records `git rev-parse HEAD` and `git status --porcelain | wc -l` at start and end in `meta.txt`. Every run shows `dirty=0` at both points.

The pieces:
- **Channel:** the production Telegram plugin (grammY long polling, durable SQLite ingress spool, drain, reply queue). It reaches a loopback mock of the Telegram Bot API through the production `channels.telegram.apiRoot` setting (`harness/mock-telegram.mjs`). The mock records every Bot API call: `sendMessage`, `editMessageReplyMarkup`, `answerCallbackQuery` and the rest.
- **Interactive handler:** a minimal local plugin loaded through `plugins.load.paths` (`harness/proof-interactive/`). Its one handler, `channel: "telegram"`, `namespace: "proof"`, returns `{ submitText: "MSG-SUBMIT button pressed" }` and logs each invocation with its `callbackId`. Everything after the handler is shipped code.
- **Agent:** the bundled Codex 0.162.1 app-server (`agentRuntime.id: "codex"`) against a scripted Responses endpoint (`harness/provider.mjs`, the same as the Discord proof). A `HOLD-1` message keeps one turn busy through repeated `sleep` tool calls.
- **Isolation:** each run re-execs under `unshare --map-root-user --net` with only `lo` up (`ifaces=lo,` in every `meta.txt`) and `env -i` with 5 variables. It has its own state directory and config.
  - No real Telegram, model provider or credential was involved. The bot token is a fake (`<fake-bot-token>`).
  - The Telegram ids are synthetic: `<human>` and `<bot>`.
- **Config:** `messages.queue` is `followup`, `cap: 1`, `drop: old`; `messages.inbound.debounceMs: 0`; `messages.visibleReplies: automatic`; a DM allowlist of the one synthetic user.

**Steps** (`harness/scenario.sh <scenario> <side> <n> <tree>`, 3 runs per scenario per side):
1. Start the mock, the provider and the Gateway, then send `HOLD-1`.
2. Seed a bot message `102` carrying one inline button (`callback_data: proof:approve`).
3. Press it. The update is a `callback_query`, `cbq-1`. The handler runs, and its submission queues behind `HOLD-1` as a deferred participant: the ingress row is `claimed attempts=0`.
4. Do the scenario action:
   - **restart:** SIGTERM the Gateway while the submission is queued. The reply queue settles the unadmitted source as cancelled (`dropAbortedFollowups`). Snapshot the row, check the button, start the Gateway again on the same state, and wait for the submission to reach the model and be answered.
   - **cancel:** send `/stop` while the submission is queued (`clearSessionQueues` → `cancelFollowupRunLifecycle`). Snapshot the row and the button. Wait 90 s, then press the same button again.
5. Snapshot `channel_ingress_events` from a copy of the state DB (`harness/rows.mjs`).

### Results (3/3 runs each, no exceptions)

| | Head `9fd80c6cdbd` | Base `93a9fa4562b` |
|---|---|---|
| **restart:** row after shutdown | `pending attempts=0`, no `last_error` | `pending attempts=1 last_error=turn-abandoned` |
| **restart:** button after shutdown | retained: 0 `editMessageReplyMarkup` on `102`, keyboard still present | retained |
| **restart:** redelivery | the same `cbq-1` handler runs again (2 invocations, both `cbq-1`); `MSG-SUBMIT` reaches the model; one `ack … MSG-SUBMIT` send; then one markup edit clears the button; row `completed attempts=0` | same delivery, but row `completed attempts=1` |
| **cancel (`/stop`):** row | `completed attempts=0` | `completed attempts=1` |
| **cancel:** button after Stop | retained: 0 markup edits, keyboard present | **cleared**: 1 markup edit, no keyboard |
| **cancel:** handler after Stop | not re-run (1 invocation) | re-run on the replayed `cbq-1` (2 invocations), with no model turn and no reply |
| **cancel:** pressing the button again | a new `cbq-2` runs the handler, `MSG-SUBMIT` is answered once, then the button clears | impossible: the button is gone (`no keyboard on that message`); the submission is never answered |

### What each requirement shows

- **Cancelled before adoption:** the submission's row is `claimed attempts=0` while it waits behind `HOLD-1`. The provider log has no `MSG-SUBMIT` input before the cut on either path.
- **Retry facts preserved (budget-free):**
  - restart: `pending attempts=0`, no `last_error`, against the base's `attempts=1 last_error=turn-abandoned`;
  - Stop: `completed attempts=0` against the base's `attempts=1`.
- **Buttons retained:** no `editMessageReplyMarkup` on the keyboard message after either cancellation at head. The button is cleared only after a later submission completes, through the shipped `clearCallbackButtons`. On Stop, the base clears it.
- **Successful redelivery through the shipped path:**
  - restart: the durable spool row for `cbq-1` is redelivered after start. The interactive handler runs again for the same callback, and the submission is adopted and answered exactly once.
  - Stop: the retained button lets the user submit again, and that submission is answered.

### Observed, not a defect claim

After `/stop`, the head releases the row budget-free, and the spool replays `cbq-1` once (a second `answerCallbackQuery` for `cbq-1` with no new Bot API delivery). That replay does not re-run the handler: the plugin interactive dedupe for `cbq-1` was committed when the first submission settled as cancelled without throwing (`src/plugins/interactive.ts` commits the dedupe after `afterInvoke` returns). The row then completes with `attempts=0`.

So Stop on Telegram, as on Discord, does not resubmit the stopped text by itself; the user re-presses the retained button. This is inferred from source plus the counts above; no log line names the duplicate.

### Not covered
- Real Telegram (Test Server or production) and a real model.
- The album/media-group cancellation path. That one is covered by `telegram-ingress-coalescing.cancellation.e2e.test.ts` in the gate at this SHA (`../GATEWAY-DISCORD/gate/`).
- Telegram webhook mode; only long polling was exercised.

Receipts: `runs/<scenario>-<side>-<n>/` (`meta.txt`, `rows.txt`, `telegram.jsonl` Bot API log, `handler.jsonl`, `provider.jsonl`, Gateway logs). They are sanitized by `harness/sanitize.sh`: home path and host removed, the fake tokens and synthetic ids relabelled. The only dotted quad left is `127.0.0.1`; `14.6.202.34` is the V8 version string.
