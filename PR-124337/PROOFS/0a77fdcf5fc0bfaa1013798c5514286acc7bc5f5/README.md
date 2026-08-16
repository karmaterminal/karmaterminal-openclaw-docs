# PR #124337 non-continuation proof corpus — `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5`

Exact-head unit causal closure for
[openclaw/openclaw#124337](https://github.com/openclaw/openclaw/pull/124337)
(`fix(ingress): bound pre-adoption abandonment with the existing retry budget`).

Bound fork issue: [karmaterminal/openclaw#1255](https://github.com/karmaterminal/openclaw/issues/1255)
(child of [#1254](https://github.com/karmaterminal/openclaw/issues/1254)). Independent of
upstream PR #121204.

**Verdict: unit-closed. Fleet not healed. Isolated Gateway/state-directory smoke
and any future treatment-composite runtime remain pending.** Discord delivery is
not required for this corpus.

## Identity

| Item | Exact value |
| --- | --- |
| Product head | `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5` |
| Product base | `5626a79cc836d95d236debd720a34fc2dcdcc685` |
| Fossil | `codeagent/silas-abandonment-red-fossil@c17a5c73a9bf9807d15b33bfa6bfb4aad5116398` |
| Implementation | `401dc7a1f5c3445b4ff85de6ac0574f91da2fde9` |
| Review / MS Teams sibling | `a01d78a4b33c155c948eeca283f179ef06fa7e7e` |
| Future runtime composite | **pending** |

This directory is a PR-scoped sidecar. It does **not** repoint
`PROOFS/INDEX.json` or any continuation corpus.

## Claim boundary

- Authoritative for the deterministic ingress-queue lifecycle contract
  (`onAbandoned` consumes `maxAttempts` / `deadLetterMinAgeMs`; cancellation
  stays budget-free; one settlement owner).
- Fossil evidence **CHARACTERIZES** the born-broken upstream contract. It does
  not by itself prove the intervention. Coupling is the base RED → patch GREEN
  → patch-only revert RED → reapply GREEN walk on the unchanged fossil.
- Does **not** claim a fleet cure, live Discord loop stop, or a deployed
  treatment composite.

## Rows

| Row | Unit contract | State |
| --- | --- | --- |
| [R-NC-ABANDON-BUDGET](R-NC-ABANDON-BUDGET/EVIDENCE.md) | 8 abandon transitions then `retry-limit-exceeded` / `turn-abandoned` | pass (unit) |
| [R-NC-ABANDON-LANE-PROGRESS](R-NC-ABANDON-LANE-PROGRESS/EVIDENCE.md) | same-lane follower blocked on base; progresses only after head terminalizes | pass (unit) |
| [R-NC-ABANDON-CANCEL](R-NC-ABANDON-CANCEL/EVIDENCE.md) | `onCancelled` remains budget-free and retryable | pass (unit) |
| [R-NC-ABANDON-SETTLE-RACE](R-NC-ABANDON-SETTLE-RACE/EVIDENCE.md) | adopt / guillotine / supersede / already-settled share one owner; MS Teams aged sibling retargeted | pass (unit) |

## Causal walk (unchanged fossil)

| Step | Receipt | Result |
| --- | --- | --- |
| Exact base RED | [receipts/01-base-red-5626a79.txt](receipts/01-base-red-5626a79.txt) | 1 failed / 4 passed; `listFailed` empty |
| Patch GREEN | [receipts/02-patched-green-fossil.txt](receipts/02-patched-green-fossil.txt) | 5 passed |
| Channels owner shard | [receipts/03-channels-shard-green.txt](receipts/03-channels-shard-green.txt) | 103 files / 1129 tests GREEN |
| Patch-only revert RED | [receipts/04-patch-only-revert-red.txt](receipts/04-patch-only-revert-red.txt) | fossil RED + retargeted drain expectation RED |
| Reapply GREEN | [receipts/05-reapply-green.txt](receipts/05-reapply-green.txt) | 32 passed |
| Fossil surface | [receipts/06-fossil-equivalence.txt](receipts/06-fossil-equivalence.txt) | assertion/input bodies identical to `c17a5c73` |
| Negative controls | [receipts/07-negative-control-shards.txt](receipts/07-negative-control-shards.txt) | condensed staged summary: discord 2775, line 528, plugin-sdk 765, auto-reply 3795 |
| Full suite | [receipts/08-full-suite.txt](receipts/08-full-suite.txt) | 539 shards / 15 failed; classified in `RESOLVED-SHA.md` |

## Honest limits

1. Isolated Gateway + disposable state-directory smoke is **explicitly pending**
   before any treatment-composite deployment.
2. Full suite was not rerun after the MS Teams test-only retarget
   (`a01d78a4`).
3. Fixture identifiers in receipts (`guild/channel/silas`, `source-message-head`,
   `activity-abandon`) are synthetic test constants, not live IDs.
4. Host worktree paths were substituted in published receipts; original SHA-256
   values are in `SHA256SUMS`.
5. Staged `07` was already a condensed shard summary (no command/`EXIT=`).
   Dedicated post-retarget MS Teams logs were not in the staged set; `08`
   carries the pre-retarget sibling FAIL.

## Navigation

- `METHOD.md` — reproducer commands and CHARACTERIZES vs coupling
- `RESOLVED-SHA.md` — pins, hashes, full-suite classification
- `proofs-manifest.json` — machine-readable rollup
- `receipts/` — immutable command/exit logs
