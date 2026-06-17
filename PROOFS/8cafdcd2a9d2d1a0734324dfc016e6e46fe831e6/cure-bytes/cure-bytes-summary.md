# Cure-bytes — `8cafdcd` carries the #85651 re-export fix forward through the upstream FF (zero product-strip)

The "cure" certified on the FF'd ship-tip `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` is the **prod-side re-export of the two #85651 symbols** that the upstream-strip kept removing — and the proof that the FF-merge against upstream/main **preserved** them rather than re-stripping. Byte-confirmed on the actual deployed source tree (HEAD `8cafdcd2a9d`), not echoed.

## The two re-exported symbols — byte-confirmed live on the deployed tree

**`STALE_UNENDED_SUBAGENT_RUN_MS`** — `src/agents/subagent-run-liveness.ts:10`
```
export const STALE_UNENDED_SUBAGENT_RUN_MS = 2 * 60 * 60 * 1_000;
```

**`isCoreToolResultMediaTrustedName`** — `src/agents/embedded-agent-subscribe.tools.ts:464`
```
export function isCoreToolResultMediaTrustedName(toolName?: string): boolean {
```

Both resolved via `grep` on the deployed `8cafdcd` checkout (HEAD `8cafdcd2a9d` == runtime build string `(8cafdcd)`). The `export` keyword is present on both — prod-side, not test-only.

## Why this is the load-bearing cure-byte for `8cafdcd`

PR #85651 repeatedly hit an **export-strip regression**: the assembly re-exported these two symbols prod-side (needed by the continuation/subagent-liveness machinery), but rebasing/merging against an advancing upstream/main kept stripping them back to non-exported (or test-only) — re-reddening `check-prod-types` / `check-test-types`. The `10a0427` tip was the "prod-re-export-both" fix; `8cafdcd` is the **FF-merge that reconciled that fix against current upstream/main** (`18aa3276`).

The cure-byte here is: **the FF did NOT re-strip them.** `8cafdcd` (the merge of `10a0427` + upstream `18aa3276`) keeps both `export`s live → `check-prod-types` ✅ + `check-test-types` ✅ on the merged tip. The dragon (#85651's recurring export-strip) is dead at this SHA — the re-export survives the upstream reconciliation.

## Conclusion

Zero product-strip on `8cafdcd`: the two #85651 re-exports are prod-side `export`s on the deployed tree, byte-confirmed, and the upstream FF preserved them. This is the source-half cure-byte that pairs with the green code-check surface in `gates/gate-board-state.md` — the feature's prod symbols are intact on the shipped bytes.

---
_Cure-bytes file stood up by 🌻 Elliott 2026-06-17 ~01:38 PDT, byte-confirmed via `grep` on the deployed `8cafdcd` source tree (HEAD `8cafdcd2a9d`) — the line-numbers + `export` keywords resolved at the source, not carried from a summary._
