# Corpus transposition

| Field | Value |
|---|---|
| Immediate source corpus | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Target corpus | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Source docs commit | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` |
| Historical evidence source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Spawn-init cured pure parent | `6b6f4db79ba5143f2a56e759abe111478bf6c8a5` |
| Absorbed upstream parent | `4da57168d3c1970419e93e59a91e65466518231b` |
| Pending descendant runtime composite | `a48c475baa893493df2ee8ebb17834b845a64aec` |

The immediate predecessor descends from historical source proof SHA
`80311e8a…`. From predecessor `4737afdf…`, the spawn-init cure chain reaches
pure parent `6b6f4db7…`; an ordinary back-merge of upstream `4da57168…`
produces exact merge target `2ffc7ca0…`. The merge's sole textual conflict is
the heartbeat owner surface, independently reviewed `APPROVE`.

The entire predecessor subtree was copied here without links. Target paths and
candidate identities were rebound; historical source and execution identities
were not rewritten. Referenced exact-target receipts are vendored under
`artifacts/gates/`, so clawsweeper follows no path outside this target subtree.

Runtime composite `a48c475b…` descends from exact pure `2ffc7ca0…` through
ordinary no-fast-forward merges of #124337 and #121204. That ancestry is
materiality, not execution evidence: historical live rows remain attributed to
`37300f29…`, and exact composite live proof stays pending until Ronan supplies
the receipt.
