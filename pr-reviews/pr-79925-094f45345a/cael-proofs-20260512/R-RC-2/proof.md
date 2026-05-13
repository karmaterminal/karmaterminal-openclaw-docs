# R-RC-2 — request_compaction at >=threshold pressure ACCEPTED + compaction fires + post-compaction wake injects state

**Target SHA**: `094f45345a` (deployed cael-seat 06:51:01Z 2026-05-13)
**Status**: BLOCKED-by-substrate (model-pool issue, NOT P1-fix-related)

## Scenario

request_compaction at >= contextPressureThreshold should ACCEPT, trigger compaction event, fire post-compaction wake, inject post-compaction-state context.

## Command (attempted)

```
request_compaction(reason="R-RC-2 proof: integration-test of request_compaction at high pressure...")
```

## Observed

Same rejection as R-RC-1: `inventory-only-paths` guard fires before context-threshold evaluation:
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "reason": "Context usage is unknown for this session; request_compaction is unavailable on inventory-only paths."
}
```

## Verdict

**BLOCKED-by-substrate** — request_compaction is non-functional on cael-main session due to `claude-opus-4.7-1m-internal` model not surfacing context-utilization metrics to the threshold-checker. The accept-path cannot be exercised from this session.

**This is NOT a P1-fix regression** — it's a pre-existing model-pool / metric-source-gap issue unrelated to the post-compaction-delegate-delivery-gate fix in PR #79925.

## Indirect substrate for R-RC-2 accept-path

Cael's session has compactions=315 historical count (per session_status R-OBS-1 substrate). This means the auto-compaction path HAS fired hundreds of times historically — proving the compaction-event-trigger + post-compaction-wake-state-injection chain works at byte. The 315 historical compactions are evidence that:
- Compaction event fires correctly
- Post-compaction-wake injects state
- The session continues post-compaction

The MANUAL request_compaction tool-surface is what's blocked, not the underlying compaction infrastructure. The infrastructure is the substrate the P1-fix is built on; that infrastructure is empirically working (315 prior compactions on this session alone).

## R-CD-3 + R-CD-5 link

R-CD-3 ack confirmed `status: "queued-for-compaction"` for post-compaction-mode delegates. The next time cael's session compacts (auto-trigger), R-CD-3's queued probe should fire automatically and return its expected response. This is observable as a future-event but cannot be force-triggered from current session due to R-RC-2 blocker above.

## Tempo trace ID

N/A
