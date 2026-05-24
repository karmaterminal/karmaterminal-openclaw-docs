# RESOLVED-SHA: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`

## Identity

- **PR**: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651) — `feat(continuation): context-pressure-aware continuation`
- **Candidate SHA**: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
- **Parent**: `483d7be6c40` (upstream/main HEAD at cohort consolidation time, 2026-05-24)
- **Shape**: single-parent squash on top of current upstream/main
- **Branch**: `silas/20260524/drift-cure-85651-rebase` on `karmaterminal/openclaw`
- **Driver of record**: 🌫 Silas
- **Independent verifier**: 🩸 Cael (Gate 3 + Gate 4 cosign)
- **Witness substrate**: 🌊 Ronan + 🌻 Elliott (recommend-canonical)
- **Ceremony arc**: 2026-05-24 0400-PDT cohort cure-cycle, 4 prior-candidates iterated before consolidation

## SHA progression (4 candidates iterated to verified)

| # | SHA | Status | Caught by |
|---|-----|--------|-----------|
| 1 | `059fdcfd9b2` | rejected (build-fail) | 🩸 independent Gate 3 — `removeReportedStaleLockIfStillStale` reference without definition |
| 2 | `6ab6963fcf8` | stale (upstream drifted before scaffold completion) | scribe wait-discipline |
| 3 | `4d6c934840` | superseded (semantic-conflict latent) | copilot merge-squash comparison |
| 4 | `0dff94dbe48` | ✅ VERIFIED CANONICAL | cohort consolidation post-substrate-walk |

## Gate verdicts at ceremony-fire

| Gate | Status | Notes |
|------|--------|-------|
| 1. Savegame | ✅ | `savegame/20260524-1014Z` (prior PR head `1efb774de45`) |
| 2. Rebase | ✅ | 10→2 conflicts resolved across iteration; final `0dff94dbe48` has semantic-fix (`run-keep-survives-ttl` adopting upstream semantics) + lint fix (`?? []`) + `readSessionEntry` import preserved |
| 3a. install | ✅ | `pnpm install --frozen-lockfile` |
| 3b. tsgo:core | ✅ | exit 0 |
| 3c. tsgo:test | ✅ | exit 0 |
| 3d. lint (3 shards + extensions) | ✅ | per 🌫 Gate 3 summary |
| 3e. vitest FULL | ✅ | **9575 passed / 0 failed** on Elliott's box (🌫's Gate 3e surface at Discord ~15:13Z) |
| 4. PROOFS corpus | ⏳ | This corpus + per-prince behavioral-row fires (in progress) |
| 5. Pre-push-intent | ⏳ | cohort cosign + figs go-signal pending |
| 6. Force-push | ⏳ | scribe-class force-push as `karmafeast` post-Gate-5 |

## Outstanding pre-push concerns (per cohort substrate-walk)

- **4 CI failures on prior PR head `1efb774de45`** (Martin's review-substrate, PR-introduced not upstream-class): `Scan changed paths (precise)`, `check-additional-extension-bundled`, `check-lint`, `checks-node-core-fast`. Will run fresh against new candidate at force-push; ship-bar = green CI per Martin's "test issues were our problem" directive (figs `~15:14:24Z`).
- **14 upstream-class test files**: cohort verifying none are in PR's actual diff (per 🌫 `~15:14:41Z`).

## Methodology landings banked from this ceremony

- **🩸's catch on first candidate `059fdcfd9b2`** = kick-(16) family substrate-canon at cohort scale (banked in `kick_in_the_teeth.md` r17 in `karmaterminal/frond-scribe`)
- **🌊's challenge of scribe's vitest-local-vs-CI conflation** = same canon at scribe-layer (kick r18)
- **🌻 + scribe's catch of 🩸's stale-SSH-config (`silas`→`10.0.0.153`)** = same canon at target-identity layer (kick r19)
- **scribe's catch of `NODE_OPTIONS=--jitless` blocking vitest** = arc-persistence layer (banked as substrate-canon class extension for kick (20))
- **Copilot merge-squash semantic-conflict catch** (`run-keep-survives-ttl` vs `run-keep-swept-after-ttl`) = independent-verification catching rebase auto-resolution silent semantic-error
- **Cohort consolidation onto single canonical candidate after 4 parallel iterations** = kick-(17) discipline re-established under figs's `~14:19:39Z` "READ runbooks FULLY" directive

## CI state

To populate after fleet-deploy + CI re-fire on `0dff94dbe48`.

## Authoring

Corpus assembly: 🌿 frond-scribe (scribe-prince of the thornfield, fifth-of-five).
Driver: 🌫 Silas.
Independent verifier: 🩸 Cael.
Substrate-walk: 🌊 Ronan + 🌻 Elliott.
External observer: 🍖 figs (forthcoming `/status` capture for R-OBS-1).
