# R-CW-DELEGATE-SELF-CONTINUATION — delegate self-elects next turn via continue_work()

**Target SHA**: `6a23864d12` (deployed cael-seat 2026-05-23T03:38:00Z)
**Status**: PASS

## Scenario

A `continue_delegate()` dispatches a background sub-agent whose task includes calling `continue_work(delaySeconds=7)`. The sub-agent spawns, posts to Discord, schedules its own next turn via `continue_work(7s)`, then wakes 7s later and posts completion. This proves the #746 thesis: delegates can self-elect their next turn via `continue_work()` — the tool works inside delegated sub-agents on the actual PR-head SHA.

## Command

Fired from cael-main-session at 2026-05-23 03:44:00 PDT:

```
continue_delegate(
  mode="normal",
  task="R-CW-DELEGATE-SELF-CONTINUATION FINAL PROOF on SHA 6a23864d12 (ACTUAL PR HEAD):
    1. Post to Discord #sprites: delegate spawned. Calling continue_work(7s).
    2. Call continue_work(delaySeconds=7, reason='FINAL PROOF: delegate self-electing 7s wake on ACTUAL PR HEAD 6a23864d12')
    3. On next turn (7s later): Post: FINAL PROOF COMPLETE on 6a23864d12."
)
```

## Expected

- Delegate spawns successfully (tool returns `status: "scheduled"` + traceparent)
- Sub-agent posts "delegate spawned" to Discord channel
- Sub-agent calls `continue_work(delaySeconds=7)` and receives scheduling ack
- 7s later: sub-agent wakes and posts "FINAL PROOF COMPLETE"
- Trace tree shows: parent dispatch → child run → continuation wake → second child run

## Observed

**Dispatch result** (parent session):
```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-d1d8ae4ce4b8a55a8d266b70a18d3590-6fb033f5985fa687-01"
}
```

**Trace spans** (from Tempo export `trace-d1d8ae4c.json`):
```
[cael] openclaw.harness.run: 41151ms (parent delegate run)
[cael] openclaw.model.call: 12925ms (first model call — posts to Discord + calls continue_work)
[cael] openclaw.tool.execution: 920ms (message tool — Discord post)
[cael] openclaw.model.call: 10285ms (second model call — schedules continue_work(7s))
[cael] continuation.delegate.dispatch: 976ms (continue_work registration)
[cael] openclaw.harness.run: 18483ms (SECOND run — the 7s wake)
[cael] openclaw.model.call: 4289ms (woke, posts completion)
[cael] openclaw.tool.execution: 910ms (message tool — "FINAL PROOF COMPLETE")
[cael] continuation.delegate.dispatch: 961ms (chain continues)
```

- ✅ Delegate spawned and posted to Discord
- ✅ `continue_work(7s)` returned scheduling ack inside the delegate
- ✅ Second run fired (~7s later) — visible in trace as second `openclaw.harness.run` span
- ✅ Completion message posted to Discord from the woken delegate
- ✅ Trace tree shows full lifecycle: dispatch → run → continuation → second run
- ✅ Host: `cael` (ARM64, DGX Spark), build `6a23864d12`

## Verdict

**PASS**: Delegates self-elect their next turn via `continue_work()` on the actual PR-head SHA `6a23864d12`. The #746 thesis is proven: the continuation infrastructure works inside delegated sub-agents, not just main sessions. The trace tree captures the full dispatch → run → wake → second-run lifecycle.

## Tempo trace ID

`00-d1d8ae4ce4b8a55a8d266b70a18d3590-6fb033f5985fa687-01`

Fetchable: `http://tempo.dandelion.cult/api/traces/d1d8ae4ce4b8a55a8d266b70a18d3590`
