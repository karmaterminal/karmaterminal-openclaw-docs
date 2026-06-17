# Gate — board state on the FF'd ship-tip `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`

The authoritative gate for this SHA is the PR #85651 board on the FF'd merge tip `8cafdcd` (`Merge upstream/main into frond-scribe/20260613/assembly-drift-cure`). This is the **deploy-now + runtime-proofs** SHA; the board is FF-ready (a flake-retry from green), the merge gated on figs's call.

## Board verdict (PR #85651 on `8cafdcd`)

| Gate | Verdict |
|---|---|
| Entire code-check surface (~45: build-export trio + check-dependencies + checks-node-core ×30+) | ✅ GREEN — **zero code-reds** |
| `mergeable` (GitHub recompute) | flaps `null↔true` on recompute → re-resolve at instant-of-use; was `true` post-FF (the `dirty` conflict cleared by the merge) |
| `merged` | `false` — NOT merged yet; FF-merge gated on the flake-retry + figs's call |
| android-test-play · android-test-third-party | 🔴 flakes (retryable; keep the rollup `unstable`) — NOT product-regressions |

## Why `8cafdcd` is green where `10a0427` was `dirty`

`8cafdcd` is the **FF re-sync merge** that reconciled the assembly's #85651 re-exports against upstream/main's strips:
- parent-1 (assembly tip): `10a0427ca33b98b5a19de6a0a22c16ce95d9ebe8` (the prod-re-export-both fix — was one-behind, pre-re-sync)
- parent-2 (upstream): `18aa3276554cf9862a7c6cf94c14785491582de0` (upstream/main at merge-time)
- author-date: 2026-06-16 23:35:01 -0700

The merge cleared the `dirty`/conflict state (`10a0427` showed `mergeable:dirty` against the advanced upstream; the merge reconciled it). Post-merge `mergeable` resolved `true`; the only remaining reds are the android flakes (retryable, not ours, not product).

## Source-intact gate (the #85651 fix survives the FF — see also `cure-bytes/`)

- `STALE_UNENDED_SUBAGENT_RUN_MS` = `export const` ✅ (`src/agents/subagent-run-liveness.ts`)
- `isCoreToolResultMediaTrustedName` = `export function` ✅ (`src/agents/embedded-agent-subscribe.tools.ts`)
- check-prod-types ✅ · check-test-types ✅

**Zero ours-reds on `8cafdcd`.** The code-check surface is fully green; the export-strip regression (the dragon that #85651 kept re-fighting) is dead — both symbols re-exported prod-side and survive the upstream FF.

---
_Gate file stood up by 🌻 Elliott 2026-06-17 ~01:38 PDT, grounded in the `8cafdcd` board-state already captured in `RESOLVED-SHA.md`. Board FF-ready; merge is figs's call._
