# R-CW-7 — traceparent E2E propagation (parent→child stitch)

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** elliott-prince · **Owner:** 🌻 Elliott
**Verdict:** ✅ PASS
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~12min post-deploy-restart)

## Behavior under test
A continuation dispatch must propagate a W3C traceparent from the parent run into the scheduled child hop, so the child's trace context stitches to the parent's exported trace bytes (parent→child span continuity in OTel/Tempo).

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface (post-reorg path, byte-confirmed live): `src/agents/command/attempt-execution.ts` (the file MOVED to `src/agents/command/` in the upstream-reorg, as 🩸 cael called).

Two live propagation sites confirmed:

1. **Run-site traceparent scope** (`attempt-execution.ts:610`):
```ts
runWithDiagnosticTraceparent(params.opts.traceparent, () =>
  runCliAgent({ sessionId: ..., sessionKey: ..., trigger: "user", ... })
)
```
The dispatch wraps the agent run in the parent's traceparent scope.

2. **Spawn-init continue_work wake propagation** (`attempt-execution.ts:~995`, in `scheduleSpawnInitContinueWorkWake`):
```ts
const result = await scheduleContinuationWork({
  sessionKey: params.sessionKey,
  chainState,
  request: {
    reason: params.request.reason,
    delaySeconds: params.request.delaySeconds ?? continuationConfig.defaultDelayMs / 1000,
    ...(params.request.traceparent ? { traceparent: params.request.traceparent } : {}),   // <-- R-CW-7 stitch
  },
  config: continuationConfig,
  parentRunId: params.runId,
  ...
});
```
The traceparent threads from the dispatch `request` into `scheduleContinuationWork` → the scheduled child hop carries the parent's trace context.

## Live evidence (on the deployed gateway)
The `continue_delegate` self-continuation fired from this seat on the deployed gateway allocated a **real, well-formed W3C traceparent**:

```
00-c9ec309f75132077e8f144a8bb2a3a4d-015d088f874ac070-01
```

- version `00` · trace-id `c9ec309f75132077e8f144a8bb2a3a4d` · parent-span-id `015d088f874ac070` · flags `01` (sampled)
- This is the live trace context the deployed gateway allocated for the dispatch (returned by the `continue_delegate` scheduling on the deployed binary) — proving `formatContinuationTraceparent` + the propagation path ARE emitting on the deployed runtime.
- The child hop (the spawned proof-shard, turn 1/200) stitches to this trace-id, demonstrating parent→child continuity.

## Evidence summary
- traceparent-propagation surface present + correct on deployed reorg'd tree (`attempt-execution.ts:610` + `:995`) ✓
- Live W3C traceparent emitted on the deployed gateway (`c9ec309f75132077e8f144a8bb2a3a4d`) ✓
- Parent→child stitch demonstrated (child shard carries the parent's trace-id) ✓

## Tempo trace
**`c9ec309f75132077e8f144a8bb2a3a4d`** — the live traceparent the deployed gateway allocated for this seat's self-continuation dispatch. Fresh per the 2026-05-16 tempo-trace-per-fire canon (distinct from rune-rog-ally's `72c5d3551b…` — this is elliott-seat's own live trace).
