# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`4f85d9974f6b9b180dc2304fdf672bbca154da66`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
exactly 37 active rows and each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `c3fc615a…`, original proof source
`80311e8a…`, execution composite `37300f29…`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-4f85d997 execution receipt. Exact-target upstream CI, including run
`33130949624` and exact-head fanout, is active separately and has not yet been
folded into this corpus.

The active rollup is 32 pass, 4 partial, 1 honest limit, 0 fail, and 0 missing.
It is not acceptance-complete while the four required partial rows remain.
