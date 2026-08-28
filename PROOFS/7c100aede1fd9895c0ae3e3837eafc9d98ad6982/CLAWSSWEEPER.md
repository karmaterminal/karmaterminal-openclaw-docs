# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`7c100aede1fd9895c0ae3e3837eafc9d98ad6982`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
exactly 37 active rows and each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `00c7f721...`, original proof source
`80311e8a...`, execution composite `37300f29...`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-`7c100aed` execution receipt. Mode-B run `33165923171` targeted ancestor
product `4c3314f7...` and is historical lineage evidence only; no Mode-B ran at
the target.

The active rollup is 32 pass, 4 partial, 1 honest limit, 0 fail, and 0 missing.
It is not acceptance-complete while the four required partial rows remain.
