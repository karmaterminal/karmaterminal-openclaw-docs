# Corpus transposition

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `4c3314f7b587de2e955c406e9b92d1c50912ba51` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 candidate | `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` |
| Immediate source docs commit | `66b702cc88e4d85846cca20e47ae5b022092e5d0` |
| Canonical source docs main | `66b702cc88e4d85846cca20e47ae5b022092e5d0` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Immediate-source Mode-B | run `33165923171`, source evidence only |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

## Product ancestry

| Commit | Role |
|---|---|
| `4c3314f7b587de2e955c406e9b92d1c50912ba51` | Immediate source presentation and target parent |
| `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` | Final covenant target; one-commit child of the source |

The target descends from the immediate source. All 399 files from the canonical
source subtree were copied with zero symlinks and zero inventory delta.
Target-facing manifest and index paths resolve inside the target subtree.
Retained row IDs, states, review states, evidence payloads, timestamps, source
execution and CI identities, runtime identities, and historical checksums
remain source-attributed. Only the seven target-facing metadata files differ.

The target commit changes only package agent-schema metadata 17 to 18 and the
docs-i18n Go cache cleanup fixture. This copy does not retroactively turn
historical execution into exact-target execution. Mode-B run 33165923171
belongs to the immediate source and remains immediate-source evidence only.
No Mode-B ran at the target. The active feature matrix remains
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
