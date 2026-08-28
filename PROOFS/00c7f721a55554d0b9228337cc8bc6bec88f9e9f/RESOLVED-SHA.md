# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` |
| Target tree | `55e2dc3b66ae909b37f948f4f96ebe9988cb8aae` |
| Immediate source presentation / corpus | `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` |
| Target sole parent | `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Immediate source-corpus docs commit on this branch | `e2b3c19ffd6314ad521806faa09163eb54c75f92` |
| Exact-target live execution | **not run** |
| Historical immediate-lineage Mode-B | run `33165923171`, product `4c3314f7...`, **not immediate-source or target evidence** |
| Exact-target Mode-B | **not run** |

The target is the one-commit child of `d451ef74...`. Its test-only commit makes
the schema-v18 registry fixture use the schema constant and gives the persisted
fixed-store usage test explicit ownership of its physical-file-resolution
mock. Historical runtime receipts retain their source classification.
Mode-B run 33165923171 belongs to grandparent product `4c3314f7...` and does not establish
exact-target acceptance, so `exact_target_mode_b=false`.

The complete historical failure inventory and classification remain in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
