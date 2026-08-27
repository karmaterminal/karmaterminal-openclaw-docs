# PR 121204 exact-head live proof at `4435e132`

This packet records the single isolated Cael execution requested for
`4435e132ffb5b7d34fa05ad2c9bc275a24f565e9`.

## Verdict

**PASS.** In one gateway start and one behavior run:

1. The controlled-aged, positively ambient Discord row became terminal
   `failed` with reason `stale-ambient-backlog`.
2. Its attempt count remained zero and exactly one payload-free committed
   disposition receipt was emitted.
3. The later fresh addressed row in the same lane was dispatched after that
   receipt through the isolated Codex app-server runtime.
4. One `openai/gpt-5.6-sol` turn completed and produced one non-empty visible
   Discord response.

The final queue projection clears transient claim fields. Fresh-after-stale
ownership is therefore established by the same-run structured lifecycle
ordering in [LIFECYCLE-RECEIPT.json](LIFECYCLE-RECEIPT.json), not by a non-null
final `claimedAt`.

## Identity

- Product commit: `4435e132ffb5b7d34fa05ad2c9bc275a24f565e9`
- Product tree: `685ac7c314566d6c8043a22ebc2749eaffdf6fd9`
- Lockfile blob: `ee207271c23169c76ca8bfd65400207e252ef699`
- Build metadata commit: `4435e132ffb5b7d34fa05ad2c9bc275a24f565e9`
- Installed Codex package: `0.149.1`
- Codex source tag commit inspected: `ff29a44391deccde0aba0f8390337d7f3c319ea4`

## Packet

- [manifest.json](manifest.json): machine-readable rollup.
- [LIVE-RECEIPT.json](LIVE-RECEIPT.json): queue and visible-response receipt.
- [LIFECYCLE-RECEIPT.json](LIFECYCLE-RECEIPT.json): redacted same-run ordering.
- [P1-DETERMINISTIC-RECEIPT.json](P1-DETERMINISTIC-RECEIPT.json): exact-head
  synchronous-throw and rejected-promise observer regression result.
- [PUBLIC-SAFETY-RECEIPT.json](PUBLIC-SAFETY-RECEIPT.json): private-value and
  secret-pattern scan result.
- [METHOD.md](METHOD.md): execution and runtime-contract boundary.
- [NON-INTERFERENCE.md](NON-INTERFERENCE.md): isolation and cleanup record.

## Honest limits

- The two inbound queue rows were controlled seeds. This proves the production
  SQLite queue, drain, Discord classification/dispatch, model runtime, and
  Discord send path, but not a real user-authored Discord `MESSAGE_CREATE`
  ingress.
- The synthetic fresh source message did not exist remotely. Best-effort
  acknowledgement cleanup reported Discord `Unknown Message`; the model turn,
  visible response, and completed queue outcome still succeeded.
- The bot's visible response re-entered Discord ingress as a third row and was
  self-filtered/completed. It did not create a second model turn.
- No message content, prompt, response, raw platform identifier, credential,
  session identifier, or raw log is published.
