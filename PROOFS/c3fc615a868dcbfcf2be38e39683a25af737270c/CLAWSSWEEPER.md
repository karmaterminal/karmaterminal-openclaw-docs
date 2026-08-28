# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`c3fc615a868dcbfcf2be38e39683a25af737270c`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
exactly 37 active rows and each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `be0ef63a…`, original proof source
`80311e8a…`, execution composite `37300f29…`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-c3fc615a execution receipt. Exact-target upstream CI is active separately
and has not yet been folded into this corpus.

The active rollup is 32 pass, 4 partial, 1 honest limit, 0 fail, and 0 missing.
It is not acceptance-complete while the four required partial rows remain.
