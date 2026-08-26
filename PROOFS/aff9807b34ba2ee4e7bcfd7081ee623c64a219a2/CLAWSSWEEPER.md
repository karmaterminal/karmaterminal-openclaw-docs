# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify warm pure SHA
`25051f3b77409c45f5ce71c3b3b05aae85b0f8f9`, then inspect each row's
`EVIDENCE.md`. Treat execution composite `37300f29…` as historical
ancestry-bound live evidence, never as warm execution. Treat Mode-B runs
`32895790947` on source `2ffc7ca0…` and `32911065508` on frozen basis
`c7131791…` as ancestor qualification, never target Mode-B. Warm qualification
is the affected-slice/materiality packet under `artifacts/promotion/`; exact
live proof on pending runtime `a0aa4ec8…` remains pending.
