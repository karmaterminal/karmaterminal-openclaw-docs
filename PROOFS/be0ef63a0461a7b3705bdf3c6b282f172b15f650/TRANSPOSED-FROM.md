# Corpus transposition

## Pre-evidence named-ref contract

| Category | Named ref | Exact SHA | Resolution |
|---|---|---|---|
| Product/base ref | `karmaterminal/karmaterminal-openclaw-docs:main` | `c26a6b492beb5336fcf7af40af443d8c616f36bf` | Source worktree, `origin/main`, and server `refs/heads/main` were equal before evidence was credited. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-be0-method-correction-20260827` | `c26a6b492beb5336fcf7af40af443d8c616f36bf` | Unchanged lane anchor was published; local, tracking, and server refs were equal before transposition. |
| CI/workflow ref | N/A | N/A | Docs validators only. Exact-target upstream product CI is separate and pending; no Mode-B workflow is folded here. |
| Presentation ref | `openclaw/openclaw#129388` head and `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` | Both GitHub refs resolved to the same exact commit. |
| Docs/proof ref | N/A before this lane; output path `PROOFS/be0ef63a0461a7b3705bdf3c6b282f172b15f650/` | N/A | This lane creates and indexes the corrected corpus; the final lane ref is recorded in the delivery receipt. |

## Provenance

| Field | Value |
|---|---|
| Immediate source corpus | `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` |
| Original proof source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Target corpus / PR #129388 head | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` |
| Canonical source docs `main` | `c26a6b492beb5336fcf7af40af443d8c616f36bf` |
| Immediate source-corpus commit | `c26a6b492beb5336fcf7af40af443d8c616f36bf` |
| Original source docs commit | `591f8be8b7991a2ad2e7ee2b84fce5d92dfd3b8b` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical exact-source Mode-B | run `32859410821`, product `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`, workflow `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Exact-target live execution | **not run** |
| Exact-target Mode-B | **not run** |

The target is the exact head of
[`openclaw/openclaw#129388`](https://github.com/openclaw/openclaw/pull/129388)
and equals the fork presentation ref
`karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates`. GitHub's
source-to-target comparison reports `ahead` by 49 commits, behind by zero,
with `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` as the exact merge base. The
target commit is the reviewed current-floor absorb, so the drift is material
enough to require a new presentation corpus while preserving source proof
provenance.

The canonical immediate source contains 403 files. Exactly four files, each the
sole `EVIDENCE.md` in one excluded observability/harness research-row subtree,
were intentionally omitted:

- `R-OBS-BACKEND-DISPOSITION`
- `R-OBS-CONT-PROVENANCE`
- `R-OBS-PROOF-MARKER`
- `R-OBS-TERMINAL-OUTCOME`

Those rows remain available in the prior `446f4b22…` corpus and Git history,
but are not PR #129388 feature acceptance contracts. The target contains all
399 retained files with zero symlinks. Target-facing manifest and index paths
resolve inside this target subtree; retained evidence payloads and historical
checksums remain source-attributed.

This copy does not retroactively turn historical execution into exact-target
execution. Historical live rows remain attributed to execution composite
`37300f29…`, whose continuation ancestor is original proof source
`80311e8a…`. Exact-4737 Mode-B run `32859410821` remains historical
ancestry/materiality evidence only. No row was fired and no Mode-B workflow was
dispatched at `be0ef63a`.

Exact-target upstream product CI is pending separately and is not folded as
evidence. The corrected active feature matrix is
`37 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 0 missing`. It is
not acceptance-complete while four required rows remain partial.
