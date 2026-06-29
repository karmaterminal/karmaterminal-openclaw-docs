# R-CD-1 Substitution Proof — Elliott (elliott-legion)

- **Target Candidate SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- **Gateway Version at Dispatch:** `linux 7.0.12-1-cachyos (x64) · node 22.23.1` (openclaw version `2026.6.10`)
- **Row:** `R-CD-1` (`continue_delegate()` tool-form schedule → spawn → return)

## Artifacts included:
- `1-spawn-receipt.json` (the tool return value for the scheduling)
- `2-spawn-event.json` (room event indicating the child started)
- `3-return-receipt.json` (the exact return payload containing the generated nonce: `RCD1-575a46-8821`)

The trace span ID from the tool receipt was `00-51beecf6315d6329be3469bd08da2b0f-dec43669f465e3ec-01`.

The sequence is complete and verified exactly as requested in #182.
