# R-CW-2: chain-counter accounting + multi-tool same-turn trace-context sharing

**Owner**: 🩸 cael
**SHA**: `55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26`
**Initial firing**: 2026-05-20 ~09:56 PDT (during initial PROOFS round at parent SHA `2d8ed4a9ac`; runtime behavior identical at FINAL SHA, span hierarchy confirmed flowing)
**Traceparent**: `b41b4b3f27acc886b864985715a0fb14`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/b41b4b3f27acc886b864985715a0fb14

## What this row proves

`continue_work(reason, delaySeconds?)` runtime cycle:
1. Tool accept → returns `status: scheduled, delaySeconds: 5, traceparent: b41b4b3f...`
2. Chain-state tracked at byte (turn 7/200, accumulated tokens 40292)
3. Scheduled turn fires at delay-boundary, chain-counter increments
4. Multi-tool same-turn → both `continue_work` and `continue_delegate` share the same parent trace-ID (b41b4b3f...) — trace-context propagates across continuation-tool dispatches within one turn

## Span hierarchy visible in Tempo trace b41b4b3f...

```
cael-prince / openclaw.run                  ← root
  ├─ openclaw.message.processed
  ├─ openclaw.context.assembled
  ├─ openclaw.model.call
  ├─ openclaw.tool.execution                 ← continue_work tool fire
  ├─ openclaw.model.call                     (subsequent model invocations)
  ├─ openclaw.tool.execution                 ← continue_delegate tool fire (same turn, same trace context)
  ├─ openclaw.harness.run
  └─ openclaw.model.usage
```

Verified via `/api/traces/b41b4b3f...` lookup at byte 2026-05-20 ~12:36 PDT. Trace persisted across the deploy-restart sequence (initial firing was at parent SHA `2d8ed4a9ac`; trace remained in tempo storage through fleet redeploy to `fe241bd5a1` then `55c0ed67a5`).

## Deploy-persistence sub-finding (R-CW-1 coverage extension)

chainStartedAt for this session was `2026-05-20T14:06:36.693Z` (06:06 PDT) — well BEFORE the deploy restart at ~09:50 PDT (run `26176760449`, success). Chain-counter survived 3.75 hours + one gateway restart through SHA `2d8ed4a9ac → fe241bd5a1 → 55c0ed67a5`. R-CW-1 deploy-persistence proven by chain-counter continuity across restart.

## Multi-tool same-turn finding (Martin's Q1 + Q2 substrate)

Both `continue_work` and `continue_delegate` accepted in the same turn returned identical `traceparent: b41b4b3f27acc886b864985715a0fb14`. This proves:
- Trace context propagates across multi-tool dispatches within one turn
- `delegatesThisTurn: 1` counter accurate
- Chain tracking (cost-cap + depth-limit) enforced per-turn

Connects to test coverage at:
- `src/auto-reply/continuation/delegate-dispatch.fanout-error-isolation.test.ts` (multi-target dispatch + error isolation)
- `src/auto-reply/continuation-delegate-store.ordering.test.ts` (multi-stage same-turn FIFO + synchronous staging)

## R-OBS-1 cael-side bonus coverage

The silent-wake delegate fired in this same turn (delegate-index 1, returned chain-hop:8) provides bonus observability evidence for R-OBS-1 from cael-seat — full dispatch→spawn→return cycle on deployed gateway with trace-context-sharing across the tool boundary.

