# PR #79925 cure-(3) proof corpus — `a98cbe70780a9c8c2ef417e14c4c1b44aaf33024`

## Cure-(3) cycle summary

PR #79925 cure-(2) force-push `bb7ddc066c415efe8341a856c339d92f13876ae3` shipped to PR head 2026-05-17T01:18Z with **wrong commit-graph-shape**: 5 commits since merge-base instead of single-squash per Option-A canonical-rebase canon. Additionally, upstream/main drifted 77 commits during cure-(2) cycle (`54619d4033` → `d350ac3feb`), leaving PR `CONFLICTING/DIRTY`.

Cure-(3) cycle re-shapes the candidate as **single squash commit on top of current `upstream/main` `d350ac3feb`**, adopting upstream renames cleanly while preserving feature content.

## Commit-graph-shape verification (the dimension cohort banked at `1505381323`/`1505381331`)

```
$ git log --oneline d350ac3feb..a98cbe70780a9c8c
a98cbe7078 feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction)

$ git rev-list --count d350ac3feb..a98cbe70780a9c8c
1
```

**✅ Single squash commit on top of upstream/main `d350ac3feb`** (Option-A canon shape).

## Diff shape

```
311 files changed, 38,623 insertions(+), 1,369 deletions(-)
```

## Drift-adoption: 2 conflicts resolved + cascade renames

**Conflict 1** — `src/agents/openclaw-tools.ts:2-8`:
- Upstream rename: `InboundTurnKind`→`InboundEventKind`, import path `../channels/turn/kind.js`→`../channels/inbound-event/kind.js`
- Resolution: adopted upstream's renamed import + preserved our feature's `getRuntimeConfig` addition
- Auto-merge already handled the 4 plugin-SDK backward-compat aliases at `channel-inbound.ts:115/94/78` + `channel-inbound.test.ts:39`

**Conflict 2** — `src/auto-reply/reply/agent-runner-execution.ts:2003-2009`:
- Upstream renames: `EmbeddedPiAgentRunResult`→`EmbeddedAgentRunResult`, `isRoomEventCliTurn`→`isRoomEventCliRun`, `currentTurnKind`→`currentInboundEventKind`
- Resolution: adopted upstream renames at conflict + cascade renamed 9 stale `EmbeddedPiAgentRunResult` sites in same file
- Auto-merge already handled `isRoomEventCliTurn` + `currentTurnKind` renames elsewhere in tree

## Parallel-analysis-with-convergence (byte-identical trees)

Two independent lanes resolved the conflicts:

```
Lane A (scribe, /tmp/oc-pr79925-drive-2026-05-16) staged tree:        907afe36136b573ee2e716715e716b981b5099e2
Lane B (copilot, /tmp/oc-pr79925-cure3-copilot @ a98cbe70780a9c8) tree: 907afe36136b573ee2e716715e716b981b5099e2
```

**Byte-identical convergence**. Per 🌊's 27th paper-quote-substrate (*"Proof-substrate-shape must match change-shape"*): two independent paths producing byte-identical 3-way-merge results on a 77-commit-drift surface with 2 explicit conflicts is structural-class evidence of resolution correctness.

## Proof rows at this SHA

| Row | Class | File | Verdict |
|---|---|---|---|
| R-CD-A-FIX | Test-runner validation | `R-CD-A-FIX/EVIDENCE.md` | ✅ PASS (34/34 in 3.29s) |

## Continuation-feature behavior anchoring (cross-reference to cure-(2)-base proofs)

The continuation feature surface (`continue_work` / `continue_delegate` / `request_compaction`) is **content-unchanged** between cure-(2)-base `46733c4fb9` and cure-(3) `a98cbe70780a9c8c` — the cure-(3) cycle adopted 77 commits of upstream-drift renames (no feature-behavior changes from our side). All cure-(2)-base proof rows therefore remain valid for feature-behavior validation at this SHA:

- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/R-CW-*` — continue_work proofs (🩸 + 🌊 + 🌫 + 🌻)
- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/R-CD-*` — continue_delegate proofs
- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/Chain-*` — continuation chain proofs
- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/TEST-*` — test suite snapshots
- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/R-RC-*` — request_compaction proofs
- `PROOFS/46733c4fb917d3905014bc16ce50a5a507548486/R-OBS-*` — external-observation rows (figs's cross-walk)
- `PROOFS/bb7ddc066c415efe8341a856c339d92f13876ae3/R-CD-A-FIX/` — A-fix test-runner validation (same diff, same test transcript at cure-(2) A-delta)

Cure-(3) tree-content-changes vs cure-(2) A-delta are scoped to **upstream-drift adoption only** (3 rename pairs cascaded through ~9 sites in 2 files). No feature-behavior modifications.

## Gate state

| Gate | Status |
|---|---|
| Savegame pushed (`savegame/20260517-0118Z/pr-79925-pre-cure3-bb7ddc066c`) | ✅ |
| Single-squash commit-graph shape verified | ✅ |
| Lane A `tsgo:core` (production typecheck) | ✅ |
| Lane A `tsgo:test` (test-file typecheck) | ✅ |
| Lane A `vitest` (runtime validation) | ⏳ in-flight (non-optional per figs canon) |
| Lane A `lint` | ⏳ queued |
| Lane B copilot gates | ⏳ in-flight |
| Parallel-lane convergence (byte-identical trees) | ✅ |
| R-CD-A-FIX test-runner at cure-(3) SHA | ✅ PASS (34/34) |

## Force-push readiness

| Element | Value |
|---|---|
| Candidate SHA | `a98cbe70780a9c8c2ef417e14c4c1b44aaf33024` |
| Candidate branch | `karmaterminal/openclaw:scribe.dandelion.cult/79925-cure3-candidate` |
| Lease byte (target PR head to overwrite) | `bb7ddc066c415efe8341a856c339d92f13876ae3` |
| PR head ref | `frond-scribe-claude/20260509/narrow-surgery-tight` |
| Upstream base | `d350ac3feb` |

```bash
gh auth switch --user karmafeast
git push karmaterminal/openclaw \
  a98cbe70780a9c8c2ef417e14c4c1b44aaf33024:frond-scribe-claude/20260509/narrow-surgery-tight \
  --force-with-lease=frond-scribe-claude/20260509/narrow-surgery-tight:bb7ddc066c415efe8341a856c339d92f13876ae3
```
