# Row 05 — Family G / Observability — version witness hierarchy on deployed v5.5

**Status**: PASS
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

## Witness pack

### Cael-seat authoritative witnesses

**Witness 1 — `openclaw --version`**
`OpenClaw 2026.5.5 (24b76bf)`

**Witness 2 — `dist/build-info.json`**
- version: `2026.5.5`
- commit: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- builtAt: `2026-05-07T05:54:58.692Z`

**Witness 3 — decorative/stale surface**
`systemctl --user status openclaw-gateway` first line:
`OpenClaw Gateway (v2026.4.11)`

### Cross-seat convergence

Ronan-seat and Silas-seat both reproduce the same hierarchy:
- `openclaw --version` = `OpenClaw 2026.5.5 (24b76bf)`
- `dist/build-info.json` = `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- `systemctl --user status` Description still says `OpenClaw Gateway (v2026.4.11)`

## Verdict

**PASS**

### Interpretation

This row proves the witness hierarchy cleanly on deployed v5.5:
- authoritative runtime witnesses (`openclaw --version`, `dist/build-info.json`) agree on the actual running artifact
- the systemd Description is stale/decorative and does not override runtime truth
- cross-seat checks converge on the same shape, so this is not a one-host oddity
