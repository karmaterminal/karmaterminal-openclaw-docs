# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Warm pure target | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Immediate source corpus | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Frozen qualified basis | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` |
| Pinned upstream parent | `80985b9663252da97bf8d67dd2cbeba0fa03aeea` |
| Historical live execution | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical continuation ancestor | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Pending exact-live runtime composite | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Source ancestor Mode-B | run `32895790947` on `2ffc7ca0…`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, conclusion `failure` |
| Frozen-basis Mode-B | run `32911065508` on `c7131791…`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, conclusion `failure` |
| Frozen-basis review | `APPROVE` only at exact c713; 1 file / 40 assertions |
| Warm target Mode-B | none; `target_mode_b.exact = false` |
| Warm exact execution | none |
| Source docs product | `e19110e419b67118fd8e890f1f3075c51acd8e4d` |
| Catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |

Warm affected-slice proof: 11 files / 686 owner assertions, independent 11 files
/ 544 assertions, production types, full test types, build, and three generated
snapshots current.

Ancestor failure inventories are in [`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md)
and [`artifacts/gates/MODE-B-C713.md`](artifacts/gates/MODE-B-C713.md). Neither
is target Mode-B. Exact live proof at pending `a0aa4ec8…` awaits Ronan.
