# R-RC-2 — final proof evidence

- canonical pure SHA: `5035aac3a96df18f0a5d5a5c3e91a516a32daf32`
- product tree: `5ff71a670d75022c45e0ecaf9ecddcf57d2a33a2`
- execution runtime SHA: `dbf5795bd5dd406f586575d883a7878288e591ad` (ancillary deployment provenance only)
- harness SHA: `5384acb5a137fdcfe30f1742bdc6af86ef8899d1`
- run ID: `20260903T025704Z-r-rc-2-ecde7aa4`
- execution seat: `elliott`
- canonical state: `partial`
- candidate verdict: `PARTIAL-candidate`

No child session or nonce-bound structured request_compaction tool result; text-only threshold report is insufficient.

## Ownership handoff

A dedicated lane owns further threshold/log regression attribution and any unit fix. This PARTIAL attempt remains immutable read-only provenance and must not be refired by the final-proof lane.

## Path-specific live evidence — do not average

The product lane is:

- branch: `codeagent/129388-rrc2-threshold-log-regression`
- current head: `e008fe0f1bd922211a7cf280827556626da9a341`
- tree: `aad05880143adbb2a0419e212b9c10d1da69be1b`

Its live evidence is deliberately preserved by path:

| path | turn | context usage | threshold | meaning |
|---|---:|---:|---:|---|
| Elliott | 2 | `10` | `70` | Numeric live-runner control; the same child produced a finite below-threshold result. |
| Rune | 2 | unknown | unknown | Separate path-specific unknown; no causal attribution is assigned. |

Discord receipts:

- Elliott: `1544929079554347151`, `1544929082704142356`
- Rune: `1544924842439090209`, `1544924976417734669`

The two paths are not averaged, majority-voted, or used to replace one another.
Rune's unknown does not erase Elliott's numeric control; Elliott's numeric
control does not classify Rune's route.

The current harness now rejects threshold receipts unless `contextUsage` and
`threshold` are finite numbers, `threshold` is exactly `70`,
`contextUsage < threshold`, and the child-bound report repeats the same two
numbers. Null, missing, string, non-finite, mismatched, or prose-only values
remain PARTIAL.

No R-RC-2 acceptance refire is authorized until the product lane is accepted
into the final successor and that exact successor is deployed fleet-wide.
