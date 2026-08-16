# PR #124337 non-continuation proof corpus — `70d47bec1f93c5f4c7e07eebb84ef9548a480751`

Exact-head unit causal closure for
[openclaw/openclaw#124337](https://github.com/openclaw/openclaw/pull/124337)
after ClawSweeper P1 (`fix(ingress): keep mixed fan-in cancel budget-free`).

This root **replaces** the obsolete `0a77fdcf…` sidecar. Pre-P1 receipts are
historical only and are not reused here.

Bound fork issue: [karmaterminal/openclaw#1255](https://github.com/karmaterminal/openclaw/issues/1255).

**Verdict: unit-closed on corrected head `70d47bec`. Fleet not healed.
Isolated Gateway/state-directory smoke remains pending and must use the
current pure continuation assembly tip plus this exact head.** Discord
delivery is not required.

## Identity

| Item | Exact value |
| --- | --- |
| Product head | `70d47bec1f93c5f4c7e07eebb84ef9548a480751` |
| Product base | `5626a79cc836d95d236debd720a34fc2dcdcc685` |
| Fossil | `codeagent/silas-abandonment-red-fossil@c17a5c73a9bf9807d15b33bfa6bfb4aad5116398` |
| M1 implementation | `401dc7a1f5c3445b4ff85de6ac0574f91da2fde9` |
| MS Teams retarget | `a01d78a4b33c155c948eeca283f179ef06fa7e7e` |
| P1 mixed-cancel | `70d47bec1f93c5f4c7e07eebb84ef9548a480751` |
| Obsolete prior head | `0a77fdcf5fc0bfaa1013798c5514286acc7bc5f5` |
| Future runtime composite | **pending** = current pure continuation assembly tip + `70d47bec` |

Product PR tree at this head has **no** root `output.md` / `proof-handoff.json`.

This sidecar does **not** repoint `PROOFS/INDEX.json`.

## Claim boundary

- Authoritative for the deterministic ingress-queue lifecycle after P1:
  genuine `onAbandoned` consumes budget; mixed capable+legacy fan-in cancel
  stays `recordAttempt:false` via cancel-compat ALS; one settlement owner.
- Fossil **CHARACTERIZES** born-broken unbounded abandonment. P1 does not
  change fossil assertions.
- Coupling is the production-only reverse/reapply of the corrected M1+P1
  bytes (`ingress-drain.ts`, `ingress-drain-lifecycle.ts`,
  `channel-ingress-runtime.ts`).
- Does **not** claim a fleet cure or live Discord loop stop.

## Rows

| Row | Unit contract | State |
| --- | --- | --- |
| [R-NC-ABANDON-BUDGET](R-NC-ABANDON-BUDGET/EVIDENCE.md) | 8 genuine abandons then `retry-limit-exceeded` / `turn-abandoned` | pass (unit) |
| [R-NC-ABANDON-LANE-PROGRESS](R-NC-ABANDON-LANE-PROGRESS/EVIDENCE.md) | follower blocked on base; progresses after head terminalizes | pass (unit) |
| [R-NC-ABANDON-CANCEL](R-NC-ABANDON-CANCEL/EVIDENCE.md) | `onCancelled` and mixed fan-in cancel remain budget-free | pass (unit) |
| [R-NC-ABANDON-SETTLE-RACE](R-NC-ABANDON-SETTLE-RACE/EVIDENCE.md) | one `settleOnce` owner; MS Teams aged sibling retarget | pass (unit) |

## Fresh causal walk (this publication)

| Step | Receipt | Result |
| --- | --- | --- |
| Exact base + fossil RED | [01-base-fossil-red.txt](receipts/01-base-fossil-red.txt) | 1 failed / 4 passed; `listFailed` empty. EXIT=1 |
| Head fossil GREEN | [02-head-fossil-green.txt](receipts/02-head-fossil-green.txt) | 5 passed. EXIT=0 |
| Mixed fan-in cancel GREEN | [03-head-mixed-cancel-green.txt](receipts/03-head-mixed-cancel-green.txt) | 2 passed. EXIT=0 |
| MS Teams aged sibling GREEN | [04-head-msteams-green.txt](receipts/04-head-msteams-green.txt) | 4 passed. EXIT=0 |
| Drain settle/adopt/supersede | [05-head-drain-settle-green.txt](receipts/05-head-drain-settle-green.txt) | 27 passed. EXIT=0 |
| Base + retargeted MS Teams RED | [06-base-msteams-retarget-red.txt](receipts/06-base-msteams-retarget-red.txt) | pending `attempts: 8`. EXIT=1 |
| Plugin-sdk shard | [07-head-plugin-sdk.txt](receipts/07-head-plugin-sdk.txt) | 77 files / 765 tests. EXIT=0 |
| Reverse production fossil RED | [08-reverse-fossil-red.txt](receipts/08-reverse-fossil-red.txt) | 1 failed / 4 passed. EXIT=1 |
| Reverse mixed-cancel RED | [09-reverse-mixed-cancel-red.txt](receipts/09-reverse-mixed-cancel-red.txt) | legacy `attempts: 1`. EXIT=1 |
| Reapply GREEN | [10-reapply-green.txt](receipts/10-reapply-green.txt) | 34 passed. EXIT=0 |
| Channels owner | [11-head-channels-owner.txt](receipts/11-head-channels-owner.txt) | 103 files / 1130 tests. EXIT=0 |
| Plugin-sdk fan-in runtime | [12-head-plugin-sdk-runtime.txt](receipts/12-head-plugin-sdk-runtime.txt) | 7 passed. EXIT=0 |

The previous 539-shard `08-full-suite.txt` from `0a77fdcf` is **not** P1
exact-head evidence and is not published under this root.

## Honest limits

1. Isolated Gateway + disposable state-dir smoke is pending. Future live
   composite must be **pure continuation assembly tip** (see
   `PROOFS/INDEX.json` `current_sha` / continuation parent `c8681949`) **plus**
   exact head `70d47bec`. Do not reuse the mixed #121204 composite.
2. `ingress-drain-lifecycle.test.ts` is not in the channels shard include
   list; bind forwarding is covered by plugin-sdk runtime (7) plus the
   production hunk.
3. Host worktree paths and MS Teams `rawActivity` blobs were substituted.
   Original SHA-256 values are in `SHA256SUMS`.
