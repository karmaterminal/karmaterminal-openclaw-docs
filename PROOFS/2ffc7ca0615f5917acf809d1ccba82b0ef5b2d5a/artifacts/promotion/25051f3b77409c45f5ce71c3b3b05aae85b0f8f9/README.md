# Promotion applicability receipt

This packet evaluates whether frozen proof basis
`c7131791a6d33ab83d1a820c7cdb81c1b1384931` applies to warm descendant
`25051f3b77409c45f5ce71c3b3b05aae85b0f8f9`, whose second parent is pinned
upstream `80985b9663252da97bf8d67dd2cbeba0fa03aeea`.

It does **not** relabel any execution as having run on the warm descendant.
Execution identity remains immutable. `materiality.json` records the proposed
content-addressed applicability relation; `affected-slice.log` is a direct
exact-head receipt for 11 owner files, 544 assertions, and generated snapshot
currency.

The current owner verdict is `affected-slice-rerun`. Independent review must
derive `reuse`, `invalidate`, or `unknown` from these receipts and the exact Git
objects before presentation credit is granted.

| Artifact | SHA-256 |
|---|---|
| `materiality.json` | `57eb2921217f7513f414d9e6bef2e25835c2eaf3522e89975c91ffdf7f3ad3e0` |
| `affected-slice.log` | `669b1b1019ebc553daf4ad11fff5d7aaf2fd007dcc17401f8294cfbd332b0cf5` |
