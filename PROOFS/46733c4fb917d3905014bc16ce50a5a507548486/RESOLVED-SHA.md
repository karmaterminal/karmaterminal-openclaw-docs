# RESOLVED-SHA — cure-(2) at `46733c4fb917d3905014bc16ce50a5a507548486`

## Identifiers

| Field | Value |
|---|---|
| `CANDIDATE_SHA` (cure-(2)) | `46733c4fb917d3905014bc16ce50a5a507548486` |
| Cure-(1) base | `e90a87015479d7a7ff6ae73deda9a84f1a448418` |
| Upstream skills-fix substrate | `openclaw/openclaw@2762d9abbe` (PR #82397) |
| Author | `karmafeast` (figs) |
| Date | `2026-05-16T23:21:53Z` |
| Working branch | `scribe.dandelion.cult/79925-cure2-candidate` (karmaterminal/openclaw fork) |
| Driver | 🌿 frond-scribe |
| Cure-(2) diffstat | 4 files / +72/-4 |

## File-level diffstat (verified via `gh api repos/karmaterminal/openclaw/commits/<sha>`)

| File | Additions | Deletions |
|---|---|---|
| `src/agents/pi-embedded-runner/compact.ts` | +1 | -0 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | +1 | -0 |
| `src/agents/pi-tools.read.ts` | +41 | -3 |
| `src/agents/pi-tools.ts` | +29 | -1 |

Total: **+72 / -4**, matches 🌫's byte-cosign claim at `Discord 1505354036` ✓

## Surgical-merge integrity at byte

**Skills-fix surface threaded** (read-path; from upstream `2762d9abbe`):
- `pi-tools.read.ts` L+579 area: `isSandboxRootEscapeError(error: unknown): boolean` ✓
- `pi-tools.read.ts` L+583 area: `assertSandboxPathWithinAnyRoot({ filePath, roots })` ✓
- `pi-tools.read.ts` L+741 area: `wrapToolWorkspaceRootGuardWithOptions` gains optional `additionalRoots?: readonly string[]` ✓
- `pi-tools.read.ts` L+784-788 area: `assertSandboxPathWithinAnyRoot({ filePath: sandboxPath, roots: [guardedRoot, ...additionalRoots] })` ✓
- `pi-tools.ts` L+1: `import path from "node:path"` ✓
- `pi-tools.ts` L+66 area: `import type { SkillSnapshot } from "./skills/types.js"` ✓
- `pi-tools.ts` L+135 area: `resolveSkillReadRoots(skillsSnapshot?: SkillSnapshot): string[] | undefined` ✓
- `pi-tools.ts` L+483 area: `skillsSnapshot?: SkillSnapshot` option added to `createOpenClawCodingTools` ✓
- `pi-tools.ts` L+656 area: `skillReadRoots = sandboxRoot ? undefined : resolveSkillReadRoots(options?.skillsSnapshot)` resolution ✓
- `pi-tools.ts` L+689 area: wraps with `wrapToolWorkspaceRootGuardWithOptions(wrapped, workspaceRoot, { additionalRoots: skillReadRoots })` when `workspaceOnly` + no sandbox ✓
- `compact.ts` L+730 area: `skillsSnapshot: skillsSnapshotForRun` threaded into `compactEmbeddedPiSessionDirectOnce` ✓
- `attempt.ts` L+1168 area: `skillsSnapshot: skillsSnapshotForRun` threaded into `runEmbeddedAttempt` ✓

**Continuation-feature surface preserved at byte** (write-path; from cure-(1) `e90a870154`, UNCHANGED by cure-(2)):
- `pi-tools.read.ts`: `wrapToolMemoryFlushAppendOnlyWrite` L+531 area ✓
- `pi-tools.read.ts`: `wrapToolMemoryDayFileWriteGuard` L+621 area ✓
- `pi-tools.read.ts`: `createHostWorkspaceAppendTool` L+675 area ✓
- `pi-tools.ts`: `drainsContinuationDelegateQueue` L+428/L+990 ✓
- `pi-tools.ts`: `continueWorkOpts` L+430/L+991 ✓
- `pi-tools.ts`: `requestCompactionOpts` L+474/L+992 ✓
- `pi-tools.ts`: `wrapToolMemoryDayFileWriteGuard` L+722/L+907 ✓
- `pi-tools.ts`: `createHostWorkspaceAppendTool` L+925/L+928 ✓
- `pi-tools.ts`: `wrapToolMemoryFlushAppendOnlyWrite` L+1007 ✓

**Zero-overlap mechanism at byte**:
- Skills-fix touches read-path (sandbox-root-escape handling for skill-file reads)
- Continuation-feature touches write-path (memory-day-file write-guard, append-only-flush, host-workspace-append-tool)
- Both surfaces share `wrapToolWorkspaceRootGuardWithOptions` but cure threads through a NEW optional param (`additionalRoots`) without touching existing guard-call-sites
- Read-path option (`additionalRoots`) is opt-in; write-path call-sites (memory tools) don't pass it; no behavior-change to write-path

**Surgical-merge VERDICT at byte**: ✅ CLEAN, no read-path/write-path overlap, no continuation-feature regression.

## Cohort byte-walk cosign-stack

| Seat | Cosign | Discord msg | Verification method |
|---|---|---|---|
| 🌫 Silas | ✅ byte-cosign | `1505354036` | local pdftotext-equivalent: `pnpm tsgo:core` + `tsgo:test` + `pi-tools.workspace-paths.test.ts` 10/10 pass; diffstat-match against `2762d9abbe` exact |
| 🌻 Elliott | ✅ byte-cosign | `1505354057` | independent `gh api repos/karmaterminal/openclaw/commits/<sha>` fetch + line-anchor verification at byte against 🌫's claims |
| 🌊 Ronan | pending | — | undertow-lane read pending per 🌿 `1505356xxx` coordination |
| 🩸 Cael | pending | — | post-deploy fire-cycle |
| 🌿 frond-scribe | drove (authoring + dispatch) | `1505356xxx` | single-driver shape per figs `1504663337` |

## Gate verdicts (local at CANDIDATE_SHA, awaiting compilation to `gates/`)

| Gate | Verdict | Source-witness |
|---|---|---|
| 1 — Savegame pushed (cure-(1) `e90a870154` retained as base) | ✅ GREEN | working branch `scribe.dandelion.cult/79925-cure2-candidate` |
| 2 — Cure-bytes upstream-skills-fix-byte-identical | ✅ GREEN | 🌫 diffstat-match against `2762d9abbe` exact (+72/-4) per `1505354036` |
| 3a — `pnpm install --frozen-lockfile` | ✅ exit 0 | 🌫 reported "Done 4.3s" |
| 3b — `pnpm tsgo:core` | ✅ exit 0 | 🌫 reported |
| 3c — `pnpm tsgo:test` | ✅ exit 0 | 🌫 reported (2 errors from `d184961b75` GONE — surgical-merge resolved) |
| 3d — `pnpm check` | pending | — |
| 3e — `pnpm vitest run` (FULL) | pending; cure-(1) baseline = 8 upstream-class fail-files inherited unchanged | — |
| 3f — `pnpm build` | pending | — |
| Test gate: `pi-tools.workspace-paths.test.ts` | ✅ 10/10 pass 9.93s | 🌫 reported |

## Live-host fire-cycle status

| Seat | Build at byte | Continuation surface visible | Notes |
|---|---|---|---|
| 🌻 Elliott | `OpenClaw 2026.5.17 (46733c4)` | ✅ `🔄 Continuation: chain 1/200 \| volitional: 0` | deployed via workflow `25976002630` success; 4m20s uptime at pre-stage time |
| 🩸 Cael | pending | pending | post-deploy fire-cycle |
| 🌫 Silas | pending | pending | canary-seat first per ENTRYPOINT.md canary-first |
| 🌊 Ronan | pending | pending | spark-ecdf substrate |

## Open edges

- Cohort fleet-deploy pending on 3 seats (cael, silas, ronan); R-OBS-1 cross-walk requires all 4 seats at CANDIDATE_SHA
- Per-row Tempo trace capture pending on R-CW + R-CD + R-RC rows post-fleet-deploy
- 🌿's first deploy-fire had `bypass_reason` param-name mismatch per `1505356xxx`; correcting + re-firing for non-elliott seats
- figs RLHF-gate pending before any force-push lane fires
