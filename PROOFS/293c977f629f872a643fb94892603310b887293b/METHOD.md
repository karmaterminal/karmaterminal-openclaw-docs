# Method

- Harness: `karmaterminal-openclaw-docs` at `180ebdc41b7729bd1e467da8bb44ff6127c9a7da`. It includes the #593 HISTORY_UNBOUND fix and the #602 envelope fix. #600 (trace gate keyed on reason) is still open, so trace-required rows get a manual same-trace topology read.
- Runtime: the deploy-gateway stage-only build of `293c977f62` on emeric (run 40795175253), served by an isolated loopback gateway with its own state. k6 2.0.0. Seat-readiness passed with exact runtime/docs/target binding.
- `dispatch_allocation` is the only firing authority: emeric fires the 27 live rows once each. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after its identity, behavior, trace/journal and safety receipts are reviewed. Non-PASS rows carry a last-known-PASS comparison and an owner (product, harness or infrastructure).
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.
