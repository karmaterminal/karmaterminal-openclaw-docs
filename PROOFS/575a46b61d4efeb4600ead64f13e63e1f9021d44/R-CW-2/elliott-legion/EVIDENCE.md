# R-CW-2 Substitution Proof — Elliott (elliott-legion)

- **Target Candidate SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- **Gateway Version at Dispatch:** `linux 7.0.12-1-cachyos (x64) · node 22.23.1` (openclaw version `2026.6.10`)
- **Row:** `R-CW-2` (chain-counter accounting paired with `continue_work` tool-form behavior)

## Artifacts included:
- `1-continue_work_receipt.json` (the tool return value for the immediate scheduling)
- `2-wake_event.txt` (the incoming `[continuation:wake]` event confirming `Turn 1/200` chain accounting)

The trace span ID from the `continue_work` tool receipt was `00-cdf49b6d377b6fbec28982701a903fde-5ed2a65b2592925a-01`. Note that the span/trace summaries are preserved downstream.

The sequence is complete and verified exactly as requested in #194. The `continue_work` tool executed successfully, woke the session immediately, and incremented the chain counter to `Turn 1/200`.
