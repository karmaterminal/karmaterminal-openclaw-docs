# Method

- Harness: `karmaterminal-openclaw-docs` at `180ebdc41b7729bd1e467da8bb44ff6127c9a7da`. It includes the #593 HISTORY_UNBOUND fix and the #602 envelope fix. #600 (trace gate keyed on reason) is still open, so trace-required rows get a manual same-trace topology read.
- Runtime: the deploy-gateway stage-only build of `293c977f62` on emeric (run 40795175253), served by an isolated loopback gateway with its own state. k6 2.0.0. Seat-readiness passed with exact runtime/docs/target binding.
- `dispatch_allocation` is the only firing authority: emeric fires the 27 live rows once each. A consumed or possibly-consumed row is not refired silently.
- Runner output is candidate evidence only. A row becomes `pass` only after its identity, behavior, trace/journal and safety receipts are reviewed. Non-PASS rows carry a last-known-PASS comparison and an owner (product, harness or infrastructure).
- Canonical process: `RUNBOOKS/PROOF-CORPUS-METHOD.md` in openclaw-bootstrap.

## Method change proposal: supplemental rows

**Status: PROPOSED, and not adopted until 🌊 and figs review it** (🌊 ruling B, Discord `1565214416730066967`). Until it is adopted, the five rows below stay **required and non-PASS**. Merging this PR is the adoption. Nothing about these rows is hidden: each keeps its directory, its `EVIDENCE.md` and its manifest entry, now listed under `supplemental_rows`.

**Why:** under the current harness none of these five can produce a PASS for this candidate. Leaving them in `required_rows` makes the presentation gate unreachable by construction, not by evidence.

| row | why it can't pass here | provenance | alternative to removal |
|---|---|---|---|
| R-CD-RETURN-COVENANT-AUTHORITY | construct-only: no runnable scenario. Its manifest says it "remains MISSING until a reviewed restart control runs on the final successor product" | catalogued 2026-09-19 (#544); never passed | build and review the restart-control scenario, then fire it at the exact SHA |
| R-CW-5 | scaffold: an exact-candidate, process-local typed-tool claim (cost cap) with no live scenario | #117 (2026-06-24) | re-run the process-local fixture route at `293c977f62` |
| R-CW-6 | scaffold: an exact-candidate, process-local claim (max chain length) | #117; its last PASS was a process-local fixture at product `989d2022` | re-run that process-local fixture at `293c977f62` |
| R-CW-5A | a static boundary variant that **always** emits construct-only by design ("cannot produce or fold a live R-CW-5 PASS") | d47d83c7 (2026-07-14) | none: by design it can never PASS |
| R-CW-6A | the same, for R-CW-6 | d47d83c7 | none: by design it can never PASS |

**Effect if adopted:** 33 required rows, 25 pass (6 carried as historical static evidence), 1 honest_limit, 7 partial, 0 missing, 0 fail. Plus 5 supplemental rows, all missing.

The proposal is for this presentation corpus only. It does not delete any contract. R-CW-5 and R-CW-6 can return to required once their process-local fixtures are fired at the exact SHA.
