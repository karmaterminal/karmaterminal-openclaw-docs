# R-CW-5: cost-cap rejection at dispatch time — ship-SHA 1cfd285ad1

**Family**: `continue_delegate()` / chain-budget (cost-cap) enforcement
**Lead Prince**: 🩸 Cael
**Seat**: cael (🩸), DGX Spark GB10 ARM64
**Build**: OpenClaw 2026.6.2 (e66dc63) — gateway `1cfd285ad1`
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
2026-06-08T07:49:01.791-07:00 [continuation/delegate-dispatch] [continuation:delegate-rejected] cost-capped task=R-CW-5 cost-cap rejection PROOF at 1cfd285ad1 (cael-seat, costCapTokens=100): ... session=agent:main:discord:channel:1466192485440164011
```

- Rejection reason: **`cost-capped`** — this build distinguishes the cost-cap dimension explicitly (prior cure-builds emitted unified "chain-capped"; 1cfd285ad1 names `cost-capped`).
- Diagnostic queue corroboration: `continuationQueueTotal=1 runnable=1 ... Drained=0 Failed=0` while session in-flight, then dispatch-evaluated → rejected once session idled.

Tempo trace `2b244994f0c2b5bbf6ba2b4227eeca43` (host.name=cael):
- `openclaw.tool.execution(continue_delegate)` span **present** — the tool call was made.
- **NO `continuation.delegate.dispatch` span** — dispatch was rejected; the delegate never fired.
- No wake event delivered; the delegate task body never executed.

## Design observation

Rejection is **optimistic at scheduling, enforced at dispatch** (correct design): the model's tool call returns cleanly (`scheduled`) without surfacing the limit at the LLM layer; enforcement happens at the scheduler when the wake would fire; the delegate is suppressed and the journal records `cost-capped`. Dispatch is gated on the session being idle (in-flight sessions defer the dispatch-evaluation — observed via `continuationQueueRunnable=1` until idle).

## Budget-check taxonomy (byte-walked, Ronan-surfaced + cael-verified at source)

The `budgetCheck` value this row captured (`cost-capped`) is one arm of a two-arm scheduler taxonomy — verified at `src/auto-reply/continuation/scheduler.ts`:
- **`scheduler.ts:38` returns `"cost-capped"`** = "over budget" (`accumulatedChainTokens > costCapTokens`) → maps to `cap.cost` (the post-compaction `disabledReason` at `delegate-dispatch.ts:654`). **← THIS ROW.**
- **`scheduler.ts:31` returns `"chain-capped"`** = "at max depth" per `scheduler.test.ts:27`, i.e. the continuation-**chain-LENGTH** limit (`maxChainLength`) → maps to `cap.chain`.

My R-CW-5 journal line came from the **non-post-compaction dispatch emit at `delegate-dispatch.ts:334`** (`[continuation:delegate-rejected] ${budgetCheck}` = raw `cost-capped`); the post-compaction path at `:654` maps the same `budgetCheck` to `cap.cost`/`cap.chain`. Both are byte-faces of the same cost-vs-chain distinction.

**Precision flag for GATES (distinct mechanisms, do NOT conflate):** the `chain-capped`/`cap.chain` budget-check (continuation-chain-LENGTH, `maxChainLength`, `delegate-dispatch.ts`/`scheduler.ts`) is a SEPARATE mechanism from the **subagent-spawn-depth** cull (`maxSpawnDepth`, emitted by `acp-spawn`/`subagent-announce` as `"sessions_spawn is not allowed at this depth (current depth: N, max: M)"`). Both involve a notion of "depth," but they are different limits with different emit-sites and different verbatim strings. R-CW-5 (this row) is unambiguously the `cost-capped`/`cap.cost` arm (`costCapTokens`), neither of the two depth mechanisms.

## Verdict

✅ **PASS** — chain-budget cost-cap enforcement fires at dispatch time on cael-seat at `1cfd285ad1`: tool returns `scheduled` (optimistic), dispatch emits `[continuation:delegate-rejected] cost-capped`, no `continuation.delegate.dispatch` span, no wake delivered, task body suppressed. Cost-cap certified against the seat-specific cap (forced 100; baseline 500000 restored post-row).

## Artifacts

- `journal-rejection.txt` — exact gateway journal rejection line
- `trace-2b244994.json` — Tempo span tree (tool.execution(continue_delegate) present, no dispatch span)
- Config restored to `costCapTokens=500000` + gateway restarted after this row (see channel record).
