# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` |
| Immediate source presentation / corpus | `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Earlier source Mode-B receipt | run `32820979682`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Immediate source-corpus docs commit | `c26a6b492beb5336fcf7af40af443d8c616f36bf` |
| Canonical source docs `main` | `c26a6b492beb5336fcf7af40af443d8c616f36bf` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

Historical exact-4737 Mode-B run 32859410821 recorded 166,719 passing
tests, 23 failed counts, 19 deterministic failures, five greened load flakes,
and zero candidate-caused failures. The workflow conclusion remains
`failure`; it is source ancestry/materiality evidence, not exact-be0ef63a
acceptance. Exact-target upstream product CI is pending separately and is not
folded here.

The complete failure inventory and classification are in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
