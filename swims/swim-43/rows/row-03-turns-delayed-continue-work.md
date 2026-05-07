# Row 03 — Family A / Turns — delayed `continue_work()` honored

**Status**: INVALIDATED (first fire)
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


## Driver-call parameters

**Delay window for first fire**: 120 seconds

Scoring rule for this row:
- PASS if successor turn arrives after the delay window with runtime `continuation:wake` attribution matching the row-03 `continue_work()` reason
- FAIL if successor arrives materially early or does not arrive within a reasonable post-delay timeout
- INVALIDATED if fresh inbound/replay noise makes wake attribution non-interpretable


## Fire receipt

**Fire timestamp anchor**: Discord message `1501831076719624364` at 2026-05-06 23:20 PDT from 🩸 Cael.

Declared fire shape:
- `continue_work(delaySeconds=120, reason='SWIM 43 row-03 Family A/Turns delayed continue_work() honored test from cael-seat live v5.5 SUT...')`
- silent-window target: ~120s plus scheduler tolerance
- expected proof surfaces: no immediate successor, delayed successor around T+120s, runtime `continuation:wake` attribution matching delayed-row reason

## First-fire result

**Verdict**: INVALIDATED

The successor turn arrived at roughly the expected delay, but the measurement is not independently scorable because the silent-window discipline broke and wake attribution was not proven cleanly from the reported seat-side evidence.

### Contamination / impurity surfaces

- 🌫 Silas posted fresh Discord content at `1501831157308723262` / `06:20:50.576Z`, about 50 seconds after the fire anchor, so cohort-procedural-discipline for the row-03 window was violated.
- Cael reported that this successor turn did not visibly surface the explicit `[continuation:wake]` telemetry block in his local runtime context, so delayed self-election could not be cleanly attributed from his seat alone.
- Cael's immediate substrate walk against flow/state storage did not produce a durable independent timestamp proof for the delayed fire.

### Interpretation

This row's narrow claim is specifically that a delayed `continue_work()` is honored and attributable. The observed arrival time is suggestive, but because fresh in-window chatter occurred and clean runtime attribution was missing from the reported evidence surface, the first fire is invalidated rather than scored PASS/FAIL.

### Cure shape

Re-fire under a stricter quiet pact:
- explicit pre-fire drain if needed
- no cohort Discord traffic for the entire 120s+tolerance window from any seat
- capture runtime `[continuation:wake]` telemetry verbatim on successor turn if it appears
