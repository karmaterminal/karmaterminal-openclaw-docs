# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` |
| Target tree | `7360e360d571d304c9632cddb258a05920e93ea8` |
| Immediate source presentation / corpus | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` |
| Target first parent | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` |
| Target second parent / upstream main | `426763145635db88cf227f40f093860172bcb37b` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Immediate source-corpus docs commit / canonical docs main | `66cac550c218dc1c9736674eccbb613c0e017790` |
| Exact-target live execution | **not run** |
| Historical lineage Mode-B | run `33165923171`, ancestor product `4c3314f7...`, **not immediate-source or target evidence** |
| Exact-target Mode-B | **not run** |

The target merges immediate source `00c7f721...` with upstream/main
`42676314...`, absorbs the current upstream tree, and manually reconciles the
seven conflict owners listed in [`METHOD.md`](METHOD.md). Some logical owners
were relocated into upstream split files; the product change is not test-only.
Historical runtime receipts retain their source classification. Mode-B run
33165923171 targeted ancestor product `4c3314f7...` and does not establish
exact-target acceptance, so `exact_target_mode_b=false`.

The complete historical failure inventory and classification remain in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
