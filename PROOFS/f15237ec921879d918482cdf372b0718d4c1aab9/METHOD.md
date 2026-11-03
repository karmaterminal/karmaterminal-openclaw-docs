# Method

- Harness: `karmaterminal-openclaw-docs` main, seeded at `3cb902e1f3398453278770e2041d8ecb5dc18ff6`. Each fire records its exact docs SHA, and the fold binds `harness_sha` to it.
- Runtime: the deploy-gateway stage-only build of `f15237ec92` on emeric (run 40984410162), served by an isolated loopback gateway (`comp-f15237ec`, port 18800) with its own state. Its model sign-in was moved from the F gateway with `composite-launcher.sh adopt-auth` (isolated → isolated; the live credential stores are never read). The launcher's readiness wait reported a false failure (`set -o pipefail` with `journalctl | grep -q`); the isolated-auth check and the source-row delete were completed by hand with the same predicates (receipt on emeric: `proof-gw/comp-f15237ec/receipts/auth-adopted.json`).
- `dispatch_allocation` is the only firing authority. Each row fires once; one model row fires first as a smoke check and counts as that row's fire. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after review. Non-PASS rows carry a last-known comparison (F `08c37a1562` is the nearest) and an owner.
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.
