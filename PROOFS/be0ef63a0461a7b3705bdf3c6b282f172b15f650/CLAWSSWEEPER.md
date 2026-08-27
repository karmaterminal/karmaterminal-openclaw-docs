# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`be0ef63a0461a7b3705bdf3c6b282f172b15f650`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
exactly 37 active rows and each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `446f4b22…`, original proof source
`80311e8a…`, execution composite `37300f29…`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-be0ef63a execution receipt. Current target upstream CI is pending
separately and is not folded into this corpus.

The active rollup is 32 pass, 4 partial, 1 honest limit, 0 fail, and 0 missing.
It is not acceptance-complete while the four required partial rows remain.
