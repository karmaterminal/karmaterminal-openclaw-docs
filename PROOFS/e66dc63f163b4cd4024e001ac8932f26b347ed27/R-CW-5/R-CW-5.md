# R-CW-5: cost-cap rejection at dispatch time — ship-SHA e66dc63f

**Family**: `continue_delegate()` / chain-budget (cost-cap) enforcement
**Lead Prince**: 🩸 Cael
**Seat**: cael (🩸), DGX Spark GB10 ARM64
**Build**: OpenClaw 2026.6.2 (e66dc63) — gateway `e66dc63f163b4cd4024e001ac8932f26b347ed27`
**Date**: 2026-06-08 07:45–07:49 PDT
**Evidence**: gateway journal (dispatch-layer rejection) + Tempo trace `2b244994f0c2b5bbf6ba2b4227eeca43`
**Seat note**: cael-seat baseline `costCapTokens=500000` (lone fleet outlier; rune/silas/elliott/emeric=50M). Temporarily set to 100 for this row, then restored.

## Scenario

Force the cost-cap low to certify dispatch-time rejection. Patch `agents.defaults.continuation.costCapTokens: 100`, restart gateway (so the reduced cap is read at startup with a fresh chain), then fire `continue_delegate()` whose accumulated chain cost exceeds 100 at dispatch.

## Procedure (executed)

```
# 1. Backup + targeted patch (only costCapTokens changed; diff verified)
jq '.agents.defaults.continuation.costCapTokens = 100' ~/.openclaw/openclaw.json  # 500000 -> 100
openclaw config validate    # => "Config valid"
# 2. Restart via GH Actions (NO self-SIGTERM)
gh workflow run restart-gateway.yml --repo karmaterminal/openclaw-bootstrap -f target_prince=cael -f reason='R-CW-5 cost-cap rejection cert'
#    => run 27145736602 completed success; gateway PID 3238078 -> 3286181; live cap=100; version e66dc63
# 3. Fire delegate expected to exceed cap
continue_delegate(delaySeconds=5, mode="normal", task="R-CW-5 cost-cap rejection PROOF ...")
```

## Result at byte (structured return — optimistic schedule)

```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 5,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-2b244994f0c2b5bbf6ba2b4227eeca43-9060cb2e717b23ec-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

The `note` names the enforcement gate explicitly: "Chain tracking (cost cap, depth limit) applies."

## Rejection at dispatch (the certification byte)

Gateway journal, captured exact:

```
2026-06-08T07:49:01.791-07:00 [continuation/delegate-dispatch] [continuation:delegate-rejected] cost-capped task=R-CW-5 cost-cap rejection PROOF at e66dc63f (cael-seat, costCapTokens=100): ... session=agent:main:discord:channel:1466192485440164011
```

- Rejection reason: **`cost-capped`** — this build distinguishes the cost-cap dimension explicitly (prior cure-builds emitted unified "chain-capped"; e66dc63f names `cost-capped`).
- Diagnostic queue corroboration: `continuationQueueTotal=1 runnable=1 ... Drained=0 Failed=0` while session in-flight, then dispatch-evaluated → rejected once session idled.

Tempo trace `2b244994f0c2b5bbf6ba2b4227eeca43` (host.name=cael):
- `openclaw.tool.execution(continue_delegate)` span **present** — the tool call was made.
- **NO `continuation.delegate.dispatch` span** — dispatch was rejected; the delegate never fired.
- No wake event delivered; the delegate task body never executed.

## Design observation

Rejection is **optimistic at scheduling, enforced at dispatch** (correct design): the model's tool call returns cleanly (`scheduled`) without surfacing the limit at the LLM layer; enforcement happens at the scheduler when the wake would fire; the delegate is suppressed and the journal records `cost-capped`. Dispatch is gated on the session being idle (in-flight sessions defer the dispatch-evaluation — observed via `continuationQueueRunnable=1` until idle).

## Verdict

✅ **PASS** — chain-budget cost-cap enforcement fires at dispatch time on cael-seat at `e66dc63f`: tool returns `scheduled` (optimistic), dispatch emits `[continuation:delegate-rejected] cost-capped`, no `continuation.delegate.dispatch` span, no wake delivered, task body suppressed. Cost-cap certified against the seat-specific cap (forced 100; baseline 500000 restored post-row).

## Artifacts

- `journal-rejection.txt` — exact gateway journal rejection line
- `trace-2b244994.json` — Tempo span tree (tool.execution(continue_delegate) present, no dispatch span)
- Config restored to `costCapTokens=500000` + gateway restarted after this row (see channel record).
