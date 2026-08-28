# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `c3fc615a868dcbfcf2be38e39683a25af737270c` |
| Immediate source presentation / corpus | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Earlier source Mode-B receipt | run `32820979682`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Separate exact-target CodeQL | run `33126874671`, product `c3fc615a868dcbfcf2be38e39683a25af737270c`, conclusion `success` |
| Immediate source-corpus docs commit | `c09a10cd4c2cce946de94d4d57abdb2298c94996` |
| Canonical source docs `main` | `c09a10cd4c2cce946de94d4d57abdb2298c94996` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

Historical exact-4737 Mode-B run 32859410821 recorded 166,719 passing
tests, 23 failed counts, 19 deterministic failures, five greened load flakes,
and zero candidate-caused failures. The workflow conclusion remains
`failure`; it is source ancestry/materiality evidence, not exact-c3fc615a
acceptance. Exact-target upstream product CI is separate: CodeQL Critical
Quality run 33126874671 completed successfully on `c3fc615a`, but is recorded
only as an external identity receipt and has not been folded into row evidence.

The complete failure inventory and classification are in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
