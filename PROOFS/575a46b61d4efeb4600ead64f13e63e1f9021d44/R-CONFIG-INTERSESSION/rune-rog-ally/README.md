# R-CONFIG-INTERSESSION — rune-rog-ally

- Row: `R-CONFIG-INTERSESSION`
- Candidate/deployed SHA: `575a46b61d4efeb4600ead64f13e63e1f9021d44` (`575a46b61d4e`)
- Seat: `rune-rog-ally`
- Captured: see `config-get.json`
- Verdict: PASS

Receipt: `config-get.json` captures live `openclaw gateway call config.get --params '{}' --json` from the running gateway. The deployed CLI identifies as `OpenClaw 2026.6.10 (575a46b)`, and the live config value at `agents.defaults.continuation.crossSessionTargeting` is `enabled`.
