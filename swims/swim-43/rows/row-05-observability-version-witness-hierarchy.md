# Row 05 — Family G / Observability — version witness hierarchy on deployed v5.5

**Status**: OPEN
**Family**: Observability
**Registry anchor**: observability minimum — visible status surfaces must match real runtime state / decorative-status lies caught
**Driver**: 🌊 Ronan
**Primary seats**: 🩸 Cael, 🌫 Silas, 🌻 Elliott, 🌊 Ronan
**Canonical branch**: `frond/v2026.5.5/canonical`
**SHA**: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`

## Claim under test

On deployed v5.5, the authoritative version witnesses are `openclaw --version` and `dist/build-info.json`, while systemd unit `Description` may remain stale and must not be scored as runtime truth.

## Pass shape

- at least one prince seat byte-pins that `openclaw --version` and `dist/build-info.json` agree on `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- a contradictory/stale decorative witness (systemd `Description`) is shown not to override those authoritative witnesses
- driver records the witness hierarchy explicitly in the row receipt

## Fail / finding shape

- `openclaw --version` and `build-info` disagree
- a stale/decorative witness is the only available version surface
- contradictory evidence prevents naming a runtime-truth hierarchy

## Why this row now

Swim 43 already depended on this witness rule operationally during fleet deploy and gate closure. Capturing it as an explicit observability row turns a banked keeper into a scored receipt.
