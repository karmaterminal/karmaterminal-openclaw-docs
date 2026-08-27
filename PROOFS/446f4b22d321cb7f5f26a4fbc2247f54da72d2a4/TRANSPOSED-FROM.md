# Corpus transposition

| Field | Value |
|---|---|
| Immediate source corpus | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 head | `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` |
| Canonical source docs `main` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` |
| Latest source-corpus update | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` |
| Original source docs commit | `591f8be8b7991a2ad2e7ee2b84fce5d92dfd3b8b` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

The target is the exact head of
[`openclaw/openclaw#129388`](https://github.com/openclaw/openclaw/pull/129388)
and equals the fork presentation ref
`karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates`. GitHub's
source-to-target comparison reports `ahead` by 1,244 commits, behind by zero,
with `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` as the exact merge base. The
target commit is the reviewed current-floor absorb, so the drift is material
enough to require a new presentation corpus while preserving source proof
provenance.

All 403 files from the canonical immediate source subtree were copied here,
including every row packet and vendored artifact, with zero symlinks.
Target-facing manifest and index paths resolve inside this target subtree.
Historical receipt payloads and checksums remain source-attributed; clawsweeper
does not need to follow row evidence links back to the old corpus.

This copy does not retroactively turn historical execution into exact-target
execution. Historical live rows remain attributed to execution composite
`37300f29…`, whose continuation ancestor is original proof source
`80311e8a…`. Exact-4737 Mode-B run `32859410821` remains historical
ancestry/materiality evidence only. No row was fired and no Mode-B workflow was
dispatched at `446f4b22`.

Current target upstream CI is pending and is not folded as evidence. Its future
result cannot change this transposition's unchanged source rollup:
`41 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 4 missing`.
