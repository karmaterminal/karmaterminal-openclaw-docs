# Row 03 — Family A / Turns — delayed `continue_work()` honored

**Status**: OPEN
**Family**: Turns
**Registry anchor**: `B2` (delayed/noisy `continue_work`) narrowed first to delay-honored shape
**Driver**: 🌊 Ronan
**Primary SUT**: 🩸 Cael
**Monitor**: 🌻 Elliott
**Cross-seat receipt**: 🌫 Silas
**Canonical branch**: `frond/v2026.5.5/canonical`
**SHA**: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
**Seat under test**: `agent:main:discord:channel:1466192485440164011`

## Claim under test

On deployed v5.5 substrate, a non-zero `continue_work()` delay is honored: the successor turn does not arrive immediately, and when it does arrive the runtime attributes the wake to the delayed self-election rather than to unrelated chatter.

## Pass shape

- Cael fires `continue_work()` with an explicit short delay
- successor turn arrives after the delay window, not immediately
- runtime telemetry attributes the wake to `continuation:wake` with the matching delayed-row reason
- monitor notes no contradictory timing anomaly

## Fail / finding shape

- successor turn arrives substantially early
- no successor turn arrives in the declared timeout window
- runtime telemetry fails to attribute wake cleanly
- unrelated inbound traffic makes attribution non-interpretable

## Test shape

Use a short explicit delay (driver call will name it), keep the room quiet through the timing window as much as practical, and score off both runtime wake telemetry and channel timestamps.
