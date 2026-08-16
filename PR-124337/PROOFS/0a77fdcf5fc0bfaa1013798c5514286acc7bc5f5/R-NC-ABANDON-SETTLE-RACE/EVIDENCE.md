# R-NC-ABANDON-SETTLE-RACE

**State:** pass (unit-via-existing-settle-owner). No new race harness.

## Contract

Abandonment and failure share the existing single-settle owner. A second settle
is a no-op after the first commit. Adopt, guillotine, supersede, and
already-settled paths must not double-write.

## Production coupling

[production-hunk.patch](../receipts/production-hunk.patch) (`+10 / -5`):

- `releaseUnadopted` → `settleUnadopted(state, settle)`
- still gated on phase, still disarms the stall timer, still
  `settleOnce(...).catch(() => undefined)`
- `onCancelled` → `releaseClaim({ recordAttempt: false })`
- `onAbandoned` → `applyFailureDisposition(claim, new Error("turn-abandoned"))`

One settlement callback owner; no new retry mode.

## Existing controls (channels shard GREEN)

From [03-channels-shard-green.txt](../receipts/03-channels-shard-green.txt)
and the 32-test reapply receipt:

| Control | What it proves |
| --- | --- |
| `complete-at-adoption: adoption tombstones; settle is not required` | Adopt already settled; later settle is unnecessary |
| `supersede tombstones the superseded claim (never re-dispatches)` | Guillotine / supersede is a single terminal write |
| `throws IngressAdoptionLostError when onAdopted races supersede` | Late adopt cannot take a superseded claim |
| `lets callers await an abandoned claim release` | Abandon settlement is awaitable and once |
| `queued deferral -> admission completes the claim exactly once` | Second adopt is a no-op for the claim |

## Microsoft Teams aged-threshold sibling

Independent review found
`extensions/msteams/src/monitor-handler/message-handler.ingress-lifecycle.test.ts`
aged a row two days (24h floor met) and still expected pending `attempts: 8`
then `9`. That is the same defective contract.

Corrected name on `a01d78a4`:
`retry-accounts abandonment, honors backoff, and dead-letters at the aged attempt ceiling`.

**Raw receipt in this corpus:** [08-full-suite.txt](../receipts/08-full-suite.txt)
records the implementation-head run **before** that retarget. The old
assertion `preserves abandon retry accounting, backoff, threshold, and restart
behavior` FAILs because `listPending` is `[]` where pending `attempts: 8` was
required — i.e. the patch already terminalized the aged row.

**Attested on product head `0a77fdcf` / `output.md`, but not present as a
separate staged command log:**

| Combination | Attested result |
| --- | --- |
| Exact-base drain + **old** assertion | GREEN (4 passed) |
| Patch + **old** assertion | RED (this is what `08` contains) |
| Exact-base drain + **new** assertion | RED (`pending attempts: 8`, intended) |
| Patch + **new** assertion (`a01d78a4`) | GREEN (4 passed) |

This row's **unit** pass is the shared `settleOnce` owner plus the channels
shard. The sibling correction is cited from `08` + the product-head attestation;
this publication does not invent the three missing dedicated logs.

Feishu and Mattermost copies stay pending because they never meet the 24h age
floor; comments on those tests record that expectation.

## Not claimed

A dedicated concurrent-settle stress harness. Isolated Gateway/state-dir smoke.
Fleet heal.
