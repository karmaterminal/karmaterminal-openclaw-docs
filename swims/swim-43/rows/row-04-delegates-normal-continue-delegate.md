# Row 04 — Family B / Delegates — immediate normal `continue_delegate()` visible return

**Status**: OPEN
**Family**: Delegates
**Registry anchor**: `B3` (clean `continue_delegate`) narrowed to immediate visible-return shape
**Driver**: 🌊 Ronan
**Primary SUT**: 🩸 Cael
**Monitor**: 🌻 Elliott
**Cross-seat receipt**: 🌫 Silas
**Canonical branch**: `frond/v2026.5.5/canonical`
**SHA**: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
**Seat under test**: `agent:main:discord:channel:1466192485440164011`

## Claim under test

On deployed v5.5 substrate, an immediate `continue_delegate()` in normal mode fires a child delegate and returns a visible, attributable completion into the parent session/channel without needing a long quiet timing window.

## Pass shape

- Cael fires `continue_delegate(task=..., mode=normal)` from the live v5.5 SUT
- delegate actually runs
- completion returns visibly and is attributable as the delegate's result
- monitor/cross-seat see no contradictory substrate evidence

## Fail / finding shape

- delegate never fires
- return never arrives
- return arrives but is not attributable to the fired delegate
- contradictory substrate evidence or contamination makes the result non-interpretable

## Why this row next

Row-03 exposed that delayed self-election in a live chat surface is currently harder to measure cleanly than the feature behavior itself. This row advances the swim on a delegate surface that should be less dependent on a long silent timing window.
