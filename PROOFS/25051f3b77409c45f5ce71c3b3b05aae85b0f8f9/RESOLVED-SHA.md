# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Exact pure target | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Predecessor corpus target | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Feature parent | `6b6f4db79ba5143f2a56e759abe111478bf6c8a5` |
| Ordinary upstream parent | `4da57168d3c1970419e93e59a91e65466518231b` |
| Historical live execution | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical continuation ancestor | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Pending descendant runtime composite | `a48c475baa893493df2ee8ebb17834b845a64aec` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Mode-B | run `32895790947`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b`, conclusion `failure` |
| Heartbeat merge review | `APPROVE` at exact target; 5 files / 67 assertions |
| Docs product | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` |
| Catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |

Mode-B: 165,696 passed; 39 failed; nine load flakes greened; 32
deterministic failures classified. Its red conclusion remains authoritative.
The exact target has no live execution claim; the `a48c475b…` receipt is
explicitly pending.

The complete failure inventory and classification are in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
