# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`4c3314f7b587de2e955c406e9b92d1c50912ba51`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
exactly 37 active rows and each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `4f85d997...`, original proof source
`80311e8a...`, execution composite `37300f29...`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-`4c3314f7` execution receipt. Exact-target Mode-B run `33165923171` is
currently active separately and is not row evidence.

The active rollup is 32 pass, 4 partial, 1 honest limit, 0 fail, and 0 missing.
It is not acceptance-complete while the four required partial rows remain.
