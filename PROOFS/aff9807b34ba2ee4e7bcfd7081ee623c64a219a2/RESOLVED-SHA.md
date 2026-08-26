# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Final presentation pure target | `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` |
| Immediate source corpus / frozen warm basis | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Pinned upstream parent | `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` |
| Ordinary merge | `353d76c565c4da43693d41f3454825d48c38e354` |
| Final maintenance receipt | `artifacts/promotion/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/materiality-report.md`; SHA-256 `da25ae8ec270dc2797fde6c56f9b35a5c799d718d76c3067a09c45f57465037e` |
| Historical live execution | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical continuation ancestor | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Exact functional-live runtime composite | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9`; functional `PASS-candidate`, observability `PARTIAL-candidate`, not aff execution |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Source ancestor Mode-B | run `32895790947` on `2ffc7ca0…`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, conclusion `failure` |
| Frozen-basis Mode-B | run `32911065508` on `c7131791…`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, conclusion `failure` |
| Frozen-basis review | `APPROVE` only at exact c713; 1 file / 40 assertions |
| Warm basis qualification | exact 250 affected slice; 11 files / 686 assertions plus independent 11 / 544 |
| Final target Mode-B | none; `target_mode_b.exact = false` |
| Final exact execution | none; `exact_target_execution = false` |
| Source docs product | `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` |
| Catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |

Final maintenance proof: `reuse`; 39/40 feature cores unchanged, the sole
changed core exact-upstream, all three proof-sensitive inputs byte-identical,
three test-only merge repairs, exact-head focused owners 84/84, and production
types/build pass. No impact is unknown within the declared maintenance slice.

Ancestor failure inventories are in [`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md)
and [`artifacts/gates/MODE-B-C713.md`](artifacts/gates/MODE-B-C713.md). Neither
is target Mode-B.
