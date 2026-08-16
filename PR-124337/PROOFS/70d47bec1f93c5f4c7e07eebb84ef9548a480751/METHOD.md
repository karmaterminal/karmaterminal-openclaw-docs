# Method

## Objective

Rebind the PR #124337 sidecar from obsolete head `0a77fdcf` to corrected head
`70d47bec` with **fresh** focused receipts. Pre-P1 staged logs do not contain
mixed-fan-in closure and are not copied forward.

## CHARACTERIZES vs coupling

| Layer | What it is |
| --- | --- |
| Fossil `c17a5c73` | CHARACTERIZES unbounded genuine `onAbandoned` on exact base |
| M1 `401dc7a1` | Genuine abandon enters `applyFailureDisposition` |
| P1 `70d47bec` | Fan-in cancel fallback is still cancellation (`runIngressCancelCompat` + ALS); `bindIngressLifecycleToReplyOptions` forwards `onCancelled` |
| Reverse/reapply | Production-only three-file swap to `5626a79` bytes then back to `70d47bec` bytes |

## Worktrees (disposable)

```text
<product-worktree-base>  5626a79cc836d95d236debd720a34fc2dcdcc685
<product-worktree-head>  70d47bec1f93c5f4c7e07eebb84ef9548a480751
```

Product `git ls-tree` at head: no root `output.md` / `proof-handoff.json`.

## Reproducer

Sanctioned runner only.

```bash
# 1. Exact base + unchanged fossil (overlaid test file) → RED
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts
# receipt 01  EXIT=1

# 2. Corrected head fossil → GREEN
# receipt 02  EXIT=0   (5 passed)

# 3. Mixed capable + bind-stripped legacy fan-in cancel
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.cancellation.test.ts
# receipt 03  EXIT=0   (2 passed)

# 4. MS Teams aged ceiling on head
node scripts/run-vitest.mjs run --config test/vitest/vitest.extension-msteams.config.ts --maxWorkers=1 \
  extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts
# receipt 04  EXIT=0   (4 passed)

# 5. Drain settle/adopt/supersede controls
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.test.ts
# receipt 05  EXIT=0   (27 passed)

# 6. Exact-base drain + retargeted MS Teams test overlay → RED
# receipt 06  EXIT=1   (pending attempts: 8)

# 7–8. Targeted shards on head
node scripts/run-vitest.mjs run --config test/vitest/vitest.plugin-sdk.config.ts --maxWorkers=1
# receipt 07  EXIT=0   (77 / 765)
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1
# receipt 11  EXIT=0   (103 / 1130)

# 9. Patch-only reverse of corrected M1+P1 production bytes on the head tree
#    (tests stay at 70d47bec; three production files become 5626a79 hashes)
# receipt 08 fossil RED EXIT=1
# receipt 09 mixed-cancel RED EXIT=1  (legacy attempts: 1)

# 10. Reapply 70d47bec production hashes
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts \
  src/channels/message/ingress-drain.cancellation.test.ts \
  src/channels/message/ingress-drain.test.ts
# receipt 10  EXIT=0   (34 passed)
```

## Eight genuine abandonment transitions

Unchanged fossil policy: `maxAttempts: 8`, `deadLetterMinAgeMs: 0`.

| Pass | After genuine `onAbandoned` |
| ---: | --- |
| 0–6 | pending; attempts increment; `lastError=turn-abandoned` |
| 7 | terminal `retry-limit-exceeded`; payload retained |

On exact base the eighth pass leaves `listFailed=[]`.

## Mixed fan-in cancel (P1)

`fanInChannelIngressLifecycles([capable, bind-stripped-legacy]).cancel()`
eight times: both rows stay `attempts: 0` and `listFailed=[]`. Then genuine
`onAbandoned` on a poison head still dead-letters and unblocks the follower.

Without P1 (reverse): capable cancel stays budget-free via `onCancelled`;
legacy fallback charges `attempts: 1` on the first pass (receipt 09).

## Docs-repo validation

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

Do not edit the continuation board. Classify the known manifest-schema red.
