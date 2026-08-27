# Resolved identities

| Identity | Full SHA / run | Role |
| --- | --- | --- |
| Protected PR target | `ba0f670a0959a9eeeb0b28ace59d3838079998b7` | Corpus and presentation target |
| Previous PR head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` | Intermediate ancestry/materiality point |
| Accepted proof source | `3bf1ca1d211f4f303ca1bfec9e47daef8f4192f9` | Source behavior and copied corpus |
| Exact pinned upstream floor | `6ae89b5a8ed6a1bdbd0d9b7639fc8162afbb7578` | Merge second parent and Mode-B failure control |
| Upstream-floor merge | `2745d7617c16fbb7650c4a2fe0065ef82c1a46ff` | Two-conflict semantic integration |
| Source execution composite | `6e6da7bba079b0fc50d134b96657cda683985837` | Immutable Rune behavior execution context |
| Source hybrid-CI run | `32649941654` | Source-era run; original record was incomplete |
| Exact-target Mode-B run | `33033099410` | Broad current-head build/static/test receipt |
| Mode-B workflow head | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` | Workflow implementation |
| Review-time upstream main | `71d4a8c3e305c623aa3ffe92696eec18f116cfc6` | Current merge-tree first parent |
| Review-time merge ref | `975c1c4ec06be37c4cb3736506584427d7552c02` | Clean current upstream merge |
| Review-time merge tree | `67edb2ab085c46af1b8632a8aecca44022178db8` | GitHub and locally computed tree |

Verified ancestry is:

```text
3bf1ca1d -> 5d0426bb -> 2745d761 -> ba0f670a
                                /
6ae89b5a ----------------------/
```

The server-side safe branch
`codeagent/121204-current-drift-6ae89b5a-20260827` and upstream PR head both
resolved to `ba0f670a0959a9eeeb0b28ace59d3838079998b7` during capture.

There is no new live exact-target behavior execution receipt.
