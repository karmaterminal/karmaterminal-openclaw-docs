# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `4c3314f7b587de2e955c406e9b92d1c50912ba51` |
| Immediate source presentation / corpus | `4f85d9974f6b9b180dc2304fdf672bbca154da66` |
| Accepted covenant checkpoint / first absorb ancestor | `c2aef2172949383bbb1606682487370fb13fbac8` |
| Target first parent | `f04d8fcf7fda6721731b97385968929f4896a13c` |
| Target second parent | `df905a6cb652ca9a7c441c6c9a881bb6bdc1f13e` |
| Additional first-parent parent | `f7e5add45288ab095e7bfb9aaa8d719a8ce73b49` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Immediate source-corpus docs commit | `1d023b1b9e48edcb409ddceda8988532ef1efc7d` |
| Canonical source docs `main` | `1d023b1b9e48edcb409ddceda8988532ef1efc7d` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | run `33165923171` **active separately; not folded** |

The target is a merge of `f04d8fcf...` and `df905a6c...`.
`f04d8fcf...` is a merge of accepted covenant checkpoint `c2aef217...` and
`f7e5add4...`. Historical runtime and Mode-B receipts retain their source
classification and do not establish exact-target acceptance. Run 33165923171
remains active separately, so `exact_target_mode_b=false`.

The complete historical failure inventory and classification remain in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
