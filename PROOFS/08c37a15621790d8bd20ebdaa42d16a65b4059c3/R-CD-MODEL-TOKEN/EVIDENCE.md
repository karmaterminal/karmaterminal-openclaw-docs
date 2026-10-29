# R-CD-MODEL-TOKEN at `08c37a1562`: **pass**

continue_delegate bracket/token form parses and forwards model=<provider/model> to the delegate child.

- Candidate verdict: PASS-candidate (refire 220416Z)
- Review: reviewed: frond-scribe (single seat), 2026-10-29; refire authorized by 🌊 (Discord 1565486385207578655)
- Summary: PASS-candidate with complete receipts in the authorized refire 220416Z (20261029T220426Z-r-cd-model-token-c686f848): served model, return payload and trace present. The first fire (20261029T214158Z-r-cd-model-token-7ec4c1cf, matrix-213356Z) is kept as a latency observation: the delegate ran and ended ok but took 317 s, past the window ('selection matched; served route unproven'). The refire does not erase it.
- Runs: `20261029T214158Z-r-cd-model-token-7ec4c1cf` (first fire, latency observation) and `20261029T220426Z-r-cd-model-token-c686f848` (refire), both under `emeric-isolated-composite/`

Runtime and candidate `08c37a15621790d8bd20ebdaa42d16a65b4059c3` on emeric's isolated gateway `:18799`, docs harness `860bd4ec` for both fires.
