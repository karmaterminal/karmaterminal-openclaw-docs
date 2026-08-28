# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `4f85d9974f6b9b180dc2304fdf672bbca154da66` |
| Immediate source presentation / corpus | `c3fc615a868dcbfcf2be38e39683a25af737270c` |
| Exact Knip cure | `b1bd1ed8d7dc181cfd33bdf74f7dc2a13add643a` |
| Bounded upstream absorb | `f533cafcd2ab053f706081e7fd2168285cb8823c` |
| Included macOS singleton cure | `f9b086351a1e290cc92376606f3a6a610d15f8ca` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Earlier source Mode-B receipt | run `32820979682`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Separate c3fc CodeQL | run `33126874671`, product `c3fc615a868dcbfcf2be38e39683a25af737270c`, conclusion `success` |
| Active exact-target product CI | run `33130949624`, product `4f85d9974f6b9b180dc2304fdf672bbca154da66`, plus exact-head fanout |
| Immediate source-corpus docs commit | `48e78b484995baed1611da71e4b0f6475ba99ce0` |
| Canonical source docs `main` | `c09a10cd4c2cce946de94d4d57abdb2298c94996` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

Historical exact-4737 Mode-B run 32859410821 recorded 166,719 passing
tests, 23 failed counts, 19 deterministic failures, five greened load flakes,
and zero candidate-caused failures. The workflow conclusion remains
`failure`; it is source ancestry/materiality evidence, not exact-4f85d997
acceptance. CodeQL Critical Quality run 33126874671 passed on the immediate
source `c3fc615a`. Its dependency CI exposed the dead export cured by
`b1bd1ed8`; its macOS singleton contamination is addressed by upstream
`f9b08635`, included in `f533cafc`. Exact-target run 33130949624 and fanout are
active separately and have not been folded into row evidence.

The complete failure inventory and classification are in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
