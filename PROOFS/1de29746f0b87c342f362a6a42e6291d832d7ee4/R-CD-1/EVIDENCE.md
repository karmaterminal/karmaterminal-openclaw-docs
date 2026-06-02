# R-CD-1 — undertow-seat, CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`

Captured 2026-06-02T11:20:32Z → 11:20:35Z UTC (04:20 PDT). Binary: `OpenClaw 2026.5.31 (1de2974)`. Self-deploy via `gh workflow run deploy-gateway.yml` run `26816100078` completed 11:13:50Z with `bypass_validation=true` (COHORT_TARGET_TAG `v2026.5.28` lags uncurse-tip by merge-train #862→#870).

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span with chain.id + chain.step + delegate.mode attrs
- subagent spawns into `openclaw.harness.run` under SAME service.name (`ronan-prince`) + same gateway-pid (`942990`)
- subagent runs to completion (`openclaw.outcome: completed`)
- literal-string payload returns to parent channel

## Byte-evidence

### Fire trace (`delegate_fire_continuation_trace.json`)
- Trace ID: `61f4be03f28585f1c0adbea754a614cd`
- Tempo: http://tempo.dandelion.cult/api/traces/61f4be03f28585f1c0adbea754a614cd
- 4 spans on trace-id: `continuation.delegate.dispatch` (315ms), `openclaw.run` (2166ms), `openclaw.model.call` (1848ms), `openclaw.context.assembled` (0ms — context-prep)
- `continuation.delegate.dispatch` attrs at byte:
  - `chain.id`: `5cc7982c-42a7-410d-9046-62c6fa3d231b`
  - `chain.step.remaining`: `192`
  - `delay.ms`: `0`
  - `delegate.delivery`: `immediate`
  - `delegate.mode`: `normal`
  - `reason.preview`: `[PROOF R-CD-1 / 1de29746f0] You are a delegate dispatched by Ronan (🌊) for PROO...`

### Spawn trace (`delegate_spawn_subagent_run_trace.json`)
- Trace ID: `8b6340225f4fe631f38d9c4f93d4587e`
- Tempo: http://tempo.dandelion.cult/api/traces/8b6340225f4fe631f38d9c4f93d4587e
- 1 span: `openclaw.harness.run` 2169ms wall
- Attrs at byte:
  - `openclaw.harness.id`: `openclaw`
  - `openclaw.provider`: `github-copilot`
  - `openclaw.model`: `claude-opus-4.7-1m-internal`
  - `openclaw.outcome`: `completed`
  - `openclaw.harness.items.completed`: `0` (delegate task elected single-string-return, no tool-calls)

### Delegate return (`delegate_return_payload.txt`)
```
R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 1de29746f0b87c342f362a6a42e6291d832d7ee4 from undertow-seat 2026-06-02
```

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(...)` returned its scheduling-acknowledgment:
```
{"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

### Journal evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway` window 11:20:32Z:
- `[continuation:delegate-hedge-armed]` fireAt=1780399232345 (sub-100ms hedge-fire window)
- `[continuation:delegate-hedge-fired]` at 11:20:32.349Z
- `[continue_delegate] Consuming 1 tool delegate(s)` at 11:20:32.354Z
- `[continuation:delegate-spawned] hop=8/200 mode=normal task=[PROOF R-CD-1 / 1de29746f0]...` at 11:20:32.669Z

## Scope-bound at byte

Proves `continue_delegate(mode="normal")` lane only: dispatch-span fired, subagent spawned + completed, literal-string returned. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4), or depth-2 chaining (R-CD-CHAINED-DEPTH-2). Same parent-session-key, same service.name (`ronan-prince`), same gateway-pid (`942990`) — single-process trace-stitching coherent.

## #868-cure byte-evidence

`chain.id=5cc7982c-42a7-410d-9046-62c6fa3d231b` is preserved across dispatch-side fire-span AND subagent harness.run span on linked trace-ids (`61f4be03f2...` + `8b6340225f...`). Tool-registration cure-bytes at `src/agents/embedded-agent-runner/run.ts:1560-1561` + `attempt.ts:1267-1268` (per `1511247935` byte-walk + figs's GATES-ask at `1511248773`) enable this round-trip; absent that forwarding, the schema would lack `continue_delegate` tool-presence and this dispatch couldn't have been authored. Round-trip 2169ms.
