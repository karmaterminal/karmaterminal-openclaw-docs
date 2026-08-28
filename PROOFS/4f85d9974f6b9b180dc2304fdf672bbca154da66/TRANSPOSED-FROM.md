# Corpus transposition

## Pre-evidence named-ref contract

| Category | Named ref | Exact SHA | Resolution |
|---|---|---|---|
| Product/base ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-c3fc-20260827` | `48e78b484995baed1611da71e4b0f6475ba99ce0` | Worktree, tracking ref, and server branch were equal before this transposition. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-c3fc-20260827` | `48e78b484995baed1611da71e4b0f6475ba99ce0` | Existing published PR #532 head; local, tracking, and server refs were equal. |
| CI/workflow ref | `openclaw/openclaw:codeagent/85651-upstream-1ba243c8-gates`, CI run `33130949624` | `4f85d9974f6b9b180dc2304fdf672bbca154da66` | Exact-target CI and fanout are active separately; no Mode-B result is folded here. |
| Presentation ref | `openclaw/openclaw#129388` head and `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4f85d9974f6b9b180dc2304fdf672bbca154da66` | Both GitHub refs resolved to the same exact commit. |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-c3fc-20260827`, source path `PROOFS/c3fc615a868dcbfcf2be38e39683a25af737270c/` | `48e78b484995baed1611da71e4b0f6475ba99ce0` | Existing review-clean corpus is the immutable immediate source for the new target path. |

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `c3fc615a868dcbfcf2be38e39683a25af737270c` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 head | `4f85d9974f6b9b180dc2304fdf672bbca154da66` |
| Immediate source docs commit | `48e78b484995baed1611da71e4b0f6475ba99ce0` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Separate c3fc CodeQL | run `33126874671`, product `c3fc615a868dcbfcf2be38e39683a25af737270c`, conclusion `success` |
| Active exact-target CI | run `33130949624`, product `4f85d9974f6b9b180dc2304fdf672bbca154da66`, plus exact-head fanout |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

The target is the exact head of
[`openclaw/openclaw#129388`](https://github.com/openclaw/openclaw/pull/129388)
and equals the fork presentation ref
`karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates`. GitHub's
source-to-target comparison reports `ahead` by 46 commits, behind by zero,
with `c3fc615a868dcbfcf2be38e39683a25af737270c` as the exact merge base.

The product lineage relevant to this transposition is:

| Commit | Role |
|---|---|
| `c3fc615a868dcbfcf2be38e39683a25af737270c` | Immediate source presentation |
| `b1bd1ed8d7dc181cfd33bdf74f7dc2a13add643a` | Exact candidate Knip cure: keeps spawn dependency injection test-owned |
| `f9b086351a1e290cc92376606f3a6a610d15f8ca` | Upstream macOS singleton-contamination cure included in the bounded absorb |
| `f533cafcd2ab053f706081e7fd2168285cb8823c` | Bounded upstream absorb tip |
| `4f85d9974f6b9b180dc2304fdf672bbca154da66` | Merge of `b1bd1ed8…` with `f533cafc…`; final presentation |

The ordering is exact: `b1bd1ed8` is one commit ahead of `c3fc615a`;
`4f85d997` has first parent `b1bd1ed8` and second parent `f533cafc`; and
`f9b08635` is an ancestor of `f533cafc`.

Source CodeQL Critical Quality run `33126874671` passed on exact c3fc. The
separate c3fc dependency CI exposed the dead export cured by `b1bd1ed8`.
The c3fc macOS singleton contamination is addressed by upstream `f9b08635`,
which is included in bounded upstream tip `f533cafc`. These product changes
make the new presentation materially different, but do not retroactively
upgrade any proof row to exact-target evidence.

All 399 files from the canonical corrected c3fc subtree were copied, with zero
symlinks and zero inventory delta. Target-facing manifest and index paths
resolve inside this target subtree. Retained row IDs, states, review states,
evidence payloads, timestamps, source execution and CI identities, runtime
identities, and historical checksums remain source-attributed. Only the seven
target-facing metadata files differ.

The four historical non-feature observability rows remain excluded from the
active target:

- `R-OBS-BACKEND-DISPOSITION`
- `R-OBS-CONT-PROVENANCE`
- `R-OBS-PROOF-MARKER`
- `R-OBS-TERMINAL-OUTCOME`

This copy does not retroactively turn historical execution into exact-target
execution. Historical live rows remain attributed to execution composite
`37300f29…`, whose continuation ancestor is original proof source
`80311e8a…`. Exact-4737 Mode-B run `32859410821` remains historical
ancestry/materiality evidence only. No row was fired and no Mode-B workflow was
dispatched at `4f85d997`.

Exact-target product CI run `33130949624` and exact-head fanout are active
separately and have not yet been folded as evidence. The active feature matrix
remains `37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`.
It is not acceptance-complete while four required rows remain partial.
