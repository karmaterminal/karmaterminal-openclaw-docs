# Method

- Harness: `karmaterminal-openclaw-docs` main, seeded at `0f126c8396a2adeaa8d8a49cd0f3b4347cd65ea0` (includes docs#610, #611 and #612). Each fire records its exact docs SHA, and the fold binds `harness_sha` to it.
- Runtime: the deploy-gateway stage-only build of `08c37a1562` on emeric (run 40955469626), served by an isolated loopback gateway with its own state. Its model sign-in is moved from the previous isolated gateway with `composite-launcher.sh adopt-auth` (isolated → isolated; the live credential stores are never read).
- `dispatch_allocation` is the only firing authority. Each row fires once; one model row fires first as a smoke check and counts as that row's fire. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after review. Non-PASS rows carry a last-known comparison (P' `8ba08c76d8` is the nearest) and an owner.
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.
