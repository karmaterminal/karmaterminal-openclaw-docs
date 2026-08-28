# Corpus transposition

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 candidate | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` |
| Target tree | `55e2dc3b66ae909b37f948f4f96ebe9988cb8aae` |
| Immediate source docs commit on this branch | `e2b3c19ffd6314ad521806faa09163eb54c75f92` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Historical immediate-lineage Mode-B | run `33165923171`, grandparent product `4c3314f7...` only |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

## Product ancestry

| Commit | Role |
|---|---|
| `d451ef74009f667bcdd58239c7d8a1d8c5a2a9b9` | Immediate source presentation and target parent |
| `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | Final candidate; one-commit child of the source |

The target descends from the immediate source. All 399 files from the canonical
source subtree were copied with zero symlinks and zero inventory delta.
Target-facing manifest and index paths resolve inside the target subtree.
Retained row IDs, states, review states, evidence payloads, timestamps, source
execution and CI identities, runtime identities, and historical checksums
remain source-attributed. Only the seven target-facing metadata files differ.

The target commit is test-only: the schema-v18 registry fixture uses the schema
constant, and the persisted fixed-store usage test explicitly owns its
physical-file-resolution mock. This copy does not retroactively turn
historical execution into exact-target execution. Mode-B run 33165923171
belongs to grandparent product `4c3314f7...` and remains historical
immediate-lineage evidence only.
No Mode-B ran at the target. The active feature matrix remains
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
