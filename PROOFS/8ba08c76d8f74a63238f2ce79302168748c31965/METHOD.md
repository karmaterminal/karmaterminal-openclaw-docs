# Method

- Harness: `karmaterminal-openclaw-docs` main. The seed is at `94f63c05df362c8a89754d611b90789dd5eaf1df`, which carries docs#610 (R-CW-6 on custody seats) and docs#611 (R-CW-5 drift). Each fire records its exact docs SHA, and the fold binds `harness_sha` to it.
- Runtime: the deploy-gateway stage-only build of `8ba08c76d8` on emeric (run 40835050338), served by an isolated loopback gateway (`openclaw-proof-comp-8ba08c76`, `:18798`) with its own state and its own model sign-in. Nothing is read from the live credential stores.
- `dispatch_allocation` is the only firing authority. Each row fires once; a consumed or possibly-consumed row is not refired silently. One model row is fired first as a smoke check, then the matrix.
- Runner output is candidate evidence only. A row becomes `pass` only after its identity, behavior, trace/journal and safety receipts are reviewed. Non-PASS rows carry a last-known-PASS comparison (the `293c977f62` corpus is the nearest) and an owner (product, harness or infrastructure).
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.
