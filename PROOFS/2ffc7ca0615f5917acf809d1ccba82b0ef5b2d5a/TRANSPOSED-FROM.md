# Corpus transposition

| Field | Value |
|---|---|
| Source corpus | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Source docs commit | `591f8be8b7991a2ad2e7ee2b84fce5d92dfd3b8b` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Absorbed upstream | `1ba243c88ed800986909bc50e4ce7b8139891b94` |

The target descends from the source proof SHA through an ordinary upstream
back-merge and reviewed semantic repairs. The entire source corpus subtree was
copied here. Referenced historical evidence needed by copied rows is vendored
inside the corresponding target row; clawsweeper does not need to follow links
to another corpus.

The upstream absorb was material enough to require Gates 2, 2.5, 2.7, and 3,
but it does not retroactively turn historical execution into exact-target
execution. Every copied machine receipt carries transposition metadata.
Historical live rows remain attributed to execution composite `37300f29…`,
whose continuation ancestor is source proof SHA `80311e8a…`. Exact-target
Mode-B and independent reproof/review are separate receipts.
