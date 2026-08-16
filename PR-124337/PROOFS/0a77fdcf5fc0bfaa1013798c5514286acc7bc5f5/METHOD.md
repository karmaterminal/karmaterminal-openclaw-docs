# Method

## Objective

Publish the exact-head non-continuation proof corpus for
[openclaw/openclaw#124337](https://github.com/openclaw/openclaw/pull/124337)
so reviewers can cite unit causal closure without opening the private fork.

This is **not** a continuation / k6 row cycle. Do not fold these rows into
`PROOFS/INDEX.json`.

## CHARACTERIZES vs intervention coupling

| Layer | What it is | What it is not |
| --- | --- | --- |
| Fossil `c17a5c73` | CHARACTERIZES the unbounded pre-adoption abandonment contract on real production queue+drain over a temporary SQLite state directory, using Discord's exact policy (`maxAttempts: 8`, `deadLetterMinAgeMs: 0`) and an injected clock past the 180s cap | Not a proof that any particular patch is correct |
| Causal graph edges | Remain `CHARACTERIZES` | Never `PROVES` |
| Intervention `401dc7a1` | Couples `onAbandoned` to existing `applyFailureDisposition(..., Error("turn-abandoned"))` | Not a new retry mode, schema, or channel branch |
| Revert/reapply walk | Proves coupling: exact base RED, patch GREEN, patch-only revert RED (byte-identical fossil failure), reapply GREEN | Not a fleet or live-channel cure |

An earlier upstream-owned test
(`keeps retry-accounted abandonment pending beyond the failure threshold`,
added by `06600e2ca09`) documented the unbounded shape. The implementation
retargets that assertion rather than deleting retry accounting.

## Reproducer (product tree; no fleet mutation)

All commands were recorded on the implementation worktree against exact base
`5626a79` and the patched drain. Sanctioned runner only — never raw `vitest`.

```bash
# 1. Exact upstream base + unchanged fossil → RED
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts
# expected: 1 failed / 4 passed; listFailed empty after 8 abandonments
# receipt: receipts/01-base-red-5626a79.txt  EXIT=1

# 2. Patch + unchanged fossil → GREEN
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts
# expected: 5 passed
# receipt: receipts/02-patched-green-fossil.txt  EXIT=0

# 3. Channels owner shard
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1
# expected: 103 files / 1129 tests
# receipt: receipts/03-channels-shard-green.txt  EXIT=0

# 4. Patch-only revert → RED restored
# receipt: receipts/04-patch-only-revert-red.txt  EXIT=1  (2 failed / 30 passed)

# 5. Reapply
node scripts/run-vitest.mjs run --config test/vitest/vitest.channels.config.ts --maxWorkers=1 \
  src/channels/message/ingress-drain.abandonment-retry-budget.test.ts \
  src/channels/message/ingress-drain.test.ts
# expected: 32 passed
# receipt: receipts/05-reapply-green.txt  EXIT=0

# 6. MS Teams aged-ceiling sibling (review commit)
node scripts/run-vitest.mjs run --config test/vitest/vitest.extension-msteams.config.ts --maxWorkers=1 \
  extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts
# expected on patch: 4 passed
# expected on exact-base drain + new assertion: 1 failed (pending attempts: 8)

# 7. Sanctioned full suite (already received; do not treat as fleet-heal)
node --import tsx scripts/test-projects.mts
# receipt: receipts/08-full-suite.txt
# tally: 539 shards / 15 failed — classified in RESOLVED-SHA.md
```

## Eight abandonment transitions

Policy under test is Discord/LINE/Zalo (`maxAttempts: 8`, `deadLetterMinAgeMs: 0`).
The primary fossil walks `onAbandoned` eight times with the clock advanced past
`DEFAULT_INGRESS_RETRY_MAX_MS` each pass.

| Pass | Claim-time `attempts` | After `onAbandoned` |
| ---: | ---: | --- |
| 0 | 0 | pending, attempts=1, `lastError=turn-abandoned` |
| 1 | 1 | pending, attempts=2 |
| 2 | 2 | pending, attempts=3 |
| 3 | 3 | pending, attempts=4 |
| 4 | 4 | pending, attempts=5 |
| 5 | 5 | pending, attempts=6 |
| 6 | 6 | pending, attempts=7 |
| 7 | 7 | **terminal** `reason=retry-limit-exceeded`, `message=turn-abandoned`, `attempts=7`, payload retained, `listClaims=[]` |

Recorded `abandonedAttempts` on the GREEN walk: `[0, 1, 2, 3, 4, 5, 6, 7]`.
`queue.fail` does not increment; the retained count is the claim-time budget
already consumed, matching the `onFailed` path.

On exact base the eighth pass does **not** write a failed row (`listFailed=[]`).

## Lane progress

Same fixture enqueues a follower on the same lane. On base the poison head
remains pending, so the follower is never adopted. On the patch, after the
eighth abandon the next `drainOnce` adopts `source-message-follower`.

## Cancellation

`onCancelled` stays `releaseClaim({ recordAttempt: false })`. The fossil seeds
a row at the attempt ceiling and cancels three times: pending retry facts stay
frozen and `listFailed` stays empty.

## Single settlement

No new race harness. `releaseUnadopted` was renamed to `settleUnadopted` and
still wraps `settleOnce` (phase / guillotine / stall-timer / non-propagating
catch unchanged). Existing drain tests cover adopt-complete-without-settle,
supersede tombstone, `onAdopted` racing supersede, and awaitable abandon
release. Microsoft Teams' two-day-old row now requires the aged ceiling; Feishu
and Mattermost copies remain pending because they never meet the 24h floor.

## Pending isolated smoke

Before a treatment composite is deployed, run the four rows against an isolated
Gateway process and a disposable state directory on exact head `0a77fdcf`.
That smoke is out of this publication. Discord delivery is not required.

## Receipt handling

Staged originals lived in a transient session receipts directory. Published
files keep commands, assertion diffs, and `EXIT=` lines. Only host-private
absolute paths are substituted (see `SHA256SUMS`). Do not treat the published
bytes as a second original; the original staged hashes are recorded.

## Docs-repo validation (this publication)

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

These validators target the continuation board under `PROOFS/`. This sidecar
must not change that board. Classify any pre-existing manifest-schema red
against current `origin/main`; do not "fix" it in this lane.
