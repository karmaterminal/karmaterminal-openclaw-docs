# Clawsweeper entrypoint

Read `proofs-manifest.json`, verify current presentation SHA
`446f4b22d321cb7f5f26a4fbc2247f54da72d2a4`, and require
`exact_target_execution=false` plus `exact_target_mode_b=false`. Then inspect
each row's locally copied `EVIDENCE.md`.

Treat immediate source presentation `4737afdf…`, original proof source
`80311e8a…`, execution composite `37300f29…`, and exact-4737 Mode-B run
`32859410821` as historical ancestry/materiality evidence. None is an
exact-446f execution receipt. Current target upstream CI is pending separately.
