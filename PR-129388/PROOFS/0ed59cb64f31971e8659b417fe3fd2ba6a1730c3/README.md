# Exact continuation proof attempt for `0ed59cb6`

Verdict: **BLOCKED**

This corpus records the attempted exact execution requested for
`openclaw/openclaw#129388`. It does not transpose evidence, carry historical
PASS states forward, or claim acceptance.

Execution stopped before firing behavioral rows because the exact product tree
does not contain the product-owned
`openclaw.k6.return-covenant-fixture-driver.v1` command required by the accepted
return-covenant harness. Without that command, the harness cannot create the
canonical migration fixtures, hold and release an accepted return, inspect the
product stores, or emit a signed product verdict. The workorder permits no
missing required row other than the separately receipt-backed `R-RC-2` honest
limit, so continuing with a partial corpus would not produce an acceptable
result.

No product, presentation, component, fleet, live seat, or docs-main ref was
changed. No deployment was attempted.

## Contents

- `NAMED-REFS.md` — pre-evidence named-reference contract.
- `IDENTITIES.json` — exact product, harness, workflow, and runtime bytes.
- `ROWS.md` — complete required row disposition.
- `AUTHORITY-MATRIX.md` — allowed and forbidden covenant cases.
- `MIGRATION-MATRIX.md` — required schema and generation transitions.
- `MODE-B.json` — exact existing broad-acceptance receipt.
- `CLEANUP.md` — cleanup and non-interference result.
- `aggregate.json` — machine-readable terminal totals.
- `manifest.json` — corpus file and verdict registry.
- `validation.json` — validation receipts and blocker control.
- `CHECKSUMS.sha256` — SHA-256 inventory for the immutable corpus payload.

## Terminal rule

`BLOCKED` is not PASS, FAIL, PARTIAL, or HONEST-LIMIT. It means the required
proof authority could not be invoked at the frozen product byte. All ordinary
rows remain `NOT_EXECUTED`; the covenant row is `BLOCKED`.
