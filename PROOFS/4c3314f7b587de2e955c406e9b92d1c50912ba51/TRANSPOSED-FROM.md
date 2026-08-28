# Corpus transposition

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `4f85d9974f6b9b180dc2304fdf672bbca154da66` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 candidate | `4c3314f7b587de2e955c406e9b92d1c50912ba51` |
| Immediate source docs commit | `1d023b1b9e48edcb409ddceda8988532ef1efc7d` |
| Canonical source docs main | `1d023b1b9e48edcb409ddceda8988532ef1efc7d` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Active exact-target Mode-B | run `33165923171`, active separately and not folded |
| Exact-target live execution | **not run** |
| Exact-target Mode-B evidence | **not folded** |

## Product ancestry

| Commit | Role |
|---|---|
| `4f85d9974f6b9b180dc2304fdf672bbca154da66` | Immediate source presentation |
| `c2aef2172949383bbb1606682487370fb13fbac8` | Accepted covenant checkpoint and first absorb ancestor |
| `f7e5add45288ab095e7bfb9aaa8d719a8ce73b49` | Second parent absorbed by `f04d8fcf...` |
| `f04d8fcf7fda6721731b97385968929f4896a13c` | Target first parent; parents `c2aef217...` and `f7e5add4...` |
| `df905a6cb652ca9a7c441c6c9a881bb6bdc1f13e` | Target second parent |
| `4c3314f7b587de2e955c406e9b92d1c50912ba51` | Covenant target; merge of `f04d8fcf...` and `df905a6c...` |

The target descends from the immediate source. All 399 files from the canonical
source subtree were copied with zero symlinks and zero inventory delta.
Target-facing manifest and index paths resolve inside the target subtree.
Retained row IDs, states, review states, evidence payloads, timestamps, source
execution and CI identities, runtime identities, and historical checksums
remain source-attributed. Only the seven target-facing metadata files differ.

This copy does not retroactively turn historical execution into exact-target
execution. Exact-target Mode-B run 33165923171 is active separately and has
not been folded into a row or corpus verdict. The active feature matrix remains
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
