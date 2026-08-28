# Resolved identities and gates

| Role | SHA / receipt |
|---|---|
| Target presentation / upstream PR #129388 head | `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` |
| Immediate source presentation / corpus | `4c3314f7b587de2e955c406e9b92d1c50912ba51` |
| Target sole parent | `4c3314f7b587de2e955c406e9b92d1c50912ba51` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical runtime execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| #124337 head | `d81272c117ef7a2ac765450d682309a941d58463` |
| #121204 head | `5d0426bbedfe3634a142c7a0ddfc6d33b3bc1938` |
| Historical exact-4737 Mode-B | run `32859410821`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Historical Ronan deploy | run `32828846929` |
| Historical catalog | `19b095ef0d356c6d68985ea26bc1bd958f53f144` |
| Immediate source-corpus docs commit | `66b702cc88e4d85846cca20e47ae5b022092e5d0` |
| Canonical source docs `main` | `66b702cc88e4d85846cca20e47ae5b022092e5d0` |
| Exact-target live execution | **not run** |
| Immediate-source Mode-B | run `33165923171`, **source evidence only** |
| Exact-target Mode-B | **not run** |

The target is the one-commit child of `4c3314f7...`. Its commit changes only
package agent-schema metadata 17 to 18 and the docs-i18n Go cache cleanup
fixture. Historical runtime receipts retain their source classification.
Mode-B run 33165923171 belongs to the immediate source and does not establish
exact-target acceptance, so `exact_target_mode_b=false`.

The complete historical failure inventory and classification remain in
[`artifacts/gates/MODE-B.md`](artifacts/gates/MODE-B.md).
