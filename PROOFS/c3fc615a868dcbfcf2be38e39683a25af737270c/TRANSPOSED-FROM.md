# Corpus transposition

## Pre-evidence named-ref contract

| Category | Named ref | Exact SHA | Resolution |
|---|---|---|---|
| Product/base ref | `karmaterminal/karmaterminal-openclaw-docs:main` | `c09a10cd4c2cce946de94d4d57abdb2298c94996` | Source worktree, `origin/main`, and server `refs/heads/main` were equal before evidence was credited. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-c3fc-20260827` | `c09a10cd4c2cce946de94d4d57abdb2298c94996` | The unchanged lane anchor was published; local, tracking, and server refs were equal before transposition. |
| CI/workflow ref | N/A | N/A | Docs validators only. Exact-target upstream product CI is active separately; no exact-target Mode-B workflow is folded here. |
| Presentation ref | `openclaw/openclaw#129388` head and `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `c3fc615a868dcbfcf2be38e39683a25af737270c` | Both GitHub refs resolved to the same exact commit. |
| Docs/proof ref | N/A before this lane; output path `PROOFS/c3fc615a868dcbfcf2be38e39683a25af737270c/` | N/A | This lane creates and indexes the transposed corpus; the final lane ref is recorded in the delivery receipt. |

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 head | `c3fc615a868dcbfcf2be38e39683a25af737270c` |
| Canonical source docs `main` | `c09a10cd4c2cce946de94d4d57abdb2298c94996` |
| Immediate source-corpus commit | `c09a10cd4c2cce946de94d4d57abdb2298c94996` |
| Original source docs commit | `591f8be8b7991a2ad2e7ee2b84fce5d92dfd3b8b` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Separate exact-target CodeQL | run `33126874671`, product `c3fc615a868dcbfcf2be38e39683a25af737270c`, conclusion `success` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

The target is the exact head of
[`openclaw/openclaw#129388`](https://github.com/openclaw/openclaw/pull/129388)
and equals the fork presentation ref
`karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates`. GitHub's
source-to-target comparison reports `ahead` by 115 commits, behind by zero,
with `be0ef63a0461a7b3705bdf3c6b282f172b15f650` as the exact merge base.

The full first-parent continuation lineage after the source is:

| Commit | Subject |
|---|---|
| `38ddfa055a50211703736063a4f49c3b353d481d` | `fix: keep continuation test SDK seams private` |
| `026398e00fae5856842a19c36fbd57bf43cb49e3` | `merge: absorb upstream 715859aa into continuation` |
| `afe7f42a196b1ed0cc6cb4ae5ab4cbea5e883f04` | `fix(subagents): bind accepted descendant wake runs` |
| `9dc9872052fcfee7d7b3d0c13339f353507c520d` | `merge: absorb upstream eaf13f1d into continuation` |
| `7263e5b5a3d00ed2b02b4a4642d7b0abb43f8cdd` | `merge: absorb upstream 0e071abb into continuation` |
| `c3fc615a868dcbfcf2be38e39683a25af737270c` | `merge: absorb upstream b181d789 into continuation` |

Those absorbs and candidate commits materially changed execution, SDK,
spawn/recovery, compaction, and installer surfaces after the source corpus.
The target therefore needs a visible presentation corpus, but none of the
source rows can be promoted to exact-target evidence automatically.

All 399 files from the canonical corrected source subtree were copied, with
zero symlinks. Target-facing manifest and index paths resolve inside this
target subtree. Retained row IDs, states, review states, evidence payloads,
timestamps, source execution and CI identities, runtime identities, and
historical checksums remain source-attributed. Only target-facing metadata and
navigation glue differ.

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
dispatched at `c3fc615a`.

Exact-target upstream product CI remains separate. CodeQL Critical Quality run
`33126874671` completed successfully on exact target `c3fc615a`, but this
external receipt is not folded into any row or acceptance claim. The active
feature matrix remains
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
