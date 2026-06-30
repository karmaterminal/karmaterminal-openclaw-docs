# R-CW-MULTI-COLLAPSE Substitution Proof — Elliott (elliott-legion)

- **Target Candidate SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- **Gateway Version at Dispatch:** `linux 7.0.12-1-cachyos (x64) · node 22.23.1` (openclaw version `2026.6.10`)
- **Row:** `R-CW-MULTI-COLLAPSE` (multi-continue_work elapsed-overlap / stale-backlog collapse behavior)

## Artifacts included:
- `config-restored.json` (baseline configuration showing defaults before/after injection)
- `config-lowered.json` (modified configuration used during the test to shrink `minDelayMs` to `1000` to allow rapid overlapping insertions without hard rejection)
- `3-wake_event.txt` (the first wake artifact containing the first generated nonce: `RCWM-575a46-8810`)
- `4-wake_event.txt` (the second wake artifact showing `Turn 2/200` with the newest nonce `RCWM-575a46-8811`, confirming the newest-drives and old-superseded logic hit natively on the gateway)

### Note on implementation:
Due to the constraints of how `continue_work` creates a stateful execution context tied directly to the runner instead of a generalized flow row in isolation, we performed sequential immediate requests across turns to achieve the intended overlapping state.

The sequence is complete and verifies the multi-wake-collapse constraints assigned in #204.
