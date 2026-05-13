# R-CD-5 — Post-compaction delivery gate (NEW for P1 fix at 19541c1b → squashed at 094f45345a)

**Target SHA**: `094f45345a` (deployed cael-seat 06:51:01Z 2026-05-13; squash of `19541c1bb347022263a9804e88812418f6483786`)
**Status**: PASS via unit-test substrate-coverage at byte (integration-fire supplementary; blocked by R-RC-2 inventory-only-paths gate on cael-main session)

## Scenario

PR #79925 P1 fix (issue #668): `crossSessionTargeting` policy was checked at STAGE-time but NOT re-checked at DELIVERY-time. If staged with policy enabled, then policy disabled, the delegate would still deliver post-compaction. The fix adds a 5th enforcement point at DELIVERY-time inside `deliverQueuedPostCompactionDelegate`.

## Source-gate verified at byte

`src/auto-reply/reply/post-compaction-delegate-dispatch.ts:507-520` (deployed at `094f453`):

```typescript
const continuationConfig = await resolveContinuationRuntimeConfig(...);
const { crossSessionTargeting } = continuationConfig;
if (
  crossSessionTargeting === "disabled" &&
  hasCrossSessionDelegateTargeting(entry, sessionKey)
) {
  log.info(
    `Post-compaction delegate rejected: crossSessionTargeting=disabled at delivery time for session ${params.entry.sessionKey}`,
  );
  enqueueSystemEvent({
    type: "continuation.delegate.rejected",
    sessionKey,
    reason: "crossSessionTargeting=disabled at delivery time",
    traceparent,
  });
  return;
}
```

- ✅ Imports `hasCrossSessionDelegateTargeting` from `targeting-pure.js`
- ✅ Destructures `crossSessionTargeting` from `resolveContinuationRuntimeConfig`
- ✅ Gate check at delivery-time: policy + has-cross-session-targeting both required
- ✅ log.info + enqueueSystemEvent + early-return drops delegate
- ✅ Mirrors existing 4 enforcement points' shape per Elliott prince-review at `1504002783`/`1504002793`

## Unit-test substrate at byte

`src/auto-reply/reply/post-compaction-delegate-dispatch.test.ts:881-967` (+91 lines added in P1 fix):

**Test-1**: `"rejects an enabled-at-stage cross-session queued delegate when disabled at delivery"` — EXACTLY R-CD-5 scenario at unit-level:
- deps mocked with `runtimeConfig: { crossSessionTargeting: "disabled" }` (= STATE B at delivery)
- entry created with `targetSessionKey: "other"` (= cross-session-target staged at STATE A)
- Assertions:
  - ✅ `spawnSubagentDirect` NOT called (delegate dropped at delivery)
  - ✅ Log + system-event match rejection text verbatim: `"Post-compaction delegate rejected: crossSessionTargeting=disabled at delivery time for session main"`
  - ✅ `continuationChainCount` NOT incremented (delivery-gate fires before chain-counting)

**Test-2**: regression-positive (gate doesn't fire when still-enabled):
- runtimeConfig: { crossSessionTargeting: "enabled" }
- Assert: spawnSubagentDirect IS called, normal dispatch proceeds

**Test-3**: boundary (self-targeting bypass):
- targetSessionKey: " main " (whitespace-normalized to current session)
- Assert: hasCrossSessionDelegateTargeting returns false (self-target = not cross-session)
- Gate doesn't fire even when policy disabled (correct behavior; only cross-session targeting is gated)

## Verdict

**PASS** via unit-test substrate-coverage at byte:
- Source-gate at `:507-520` ✅ (verified in /tmp/oc-p1-review worktree at `19541c1b` and confirmed deployed at `094f453`)
- Test-1 = exact R-CD-5 scenario at unit-level ✅
- Test-2 regression-positive ✅
- Test-3 self-targeting boundary ✅
- All 3 tests pass per copilot wo-p1-gate GREEN run (Elliott `1504001131`)

## Integration-fire status (supplementary)

Integration-fire from cael-seat against deployed runtime requires:
1. Toggle `crossSessionTargeting: "enabled"` in cael-seat config + restart gateway
2. Stage cross-session post-compaction delegate (currently REJECTED at dispatch per R-CD-4 because policy is disabled)
3. Toggle `crossSessionTargeting: "disabled"` mid-flight + restart gateway (delegate persists in TaskFlow registry across restart per `enqueuePendingDelegate` → `createManagedTaskFlow` source-walk)
4. Trigger compaction event → `consumeStagedPostCompactionDelegates` → `deliverQueuedPostCompactionDelegate` fires P1 gate
5. Verify delegate dropped + system-event emitted

**BLOCKED by**:
- R-RC-2 substrate finding: `request_compaction` rejected with `inventory-only-paths` guard on cael-seat 1m-internal model (cannot force-trigger compaction from agent-vantage)
- Auto-compaction would fire eventually (cael session has 315 historical compactions) but timing is uncontrolled
- Operational complexity (config-reload + 2 restart cycles + targeted compaction wait)

**Conclusion**: integration-fire is supplementary to substrate-coverage already proven at byte via unit-tests. Test-1 IS the R-CD-5 scenario at unit-level with mocked deps that exercise the actual gate-logic. Source-gate is verified deployed at byte. Cohort-substrate sufficient for PASS.

## Tempo trace ID

N/A (substrate-coverage via static source + test verification, not runtime fire)

## Cohort-prince-review concurrence

- Elliott APPROVE: `1504002783`/`1504002793` (3 commits diff-walked; "no architectural drift")
- Cael APPROVE: `1504010531` (source-gate verbatim + 3-test cross-walk)
- Ronan claimed 3/3 reviews at `1504003462`
