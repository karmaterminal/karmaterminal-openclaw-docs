# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify final presentation SHA
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`, then inspect each row's
`EVIDENCE.md`. Treat execution composite `37300f29…` as historical
ancestry-bound live evidence, never as final execution. Treat Mode-B runs
`32895790947` on source `2ffc7ca0…` and `32911065508` on frozen basis
`c7131791…` as ancestor qualification, never target Mode-B. Keep the warm
`25051f3b…` affected-slice packet exact to 250. Applicability to aff comes only
from the checksum-pinned final maintenance packet under `artifacts/promotion/`.
Runtime `a0aa4ec8…` supplies exact functional R-CW-1 evidence on a runtime that
contains 250 but not aff; its observability verdict remains `PARTIAL-candidate`.
Target Mode-B exactness and target execution exactness are both false.
