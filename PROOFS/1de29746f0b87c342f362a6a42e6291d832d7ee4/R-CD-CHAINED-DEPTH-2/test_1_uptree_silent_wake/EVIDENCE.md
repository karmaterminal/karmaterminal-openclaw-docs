# R-CD-CHAINED-DEPTH-2 TEST-1 — up-tree silent-wake

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ✅ PASS (scoped) — depth-1 shard dispatched depth-2 `continue_delegate(mode="silent-wake", targetSessionKey=<parent>)`; dispatch span recorded in Tempo with correct mode + targeting attributes. Depth-2 turn execution / parent silent-wake arrival is not captured in these two traces (would emit under separate trace_id at depth-2 spawn time).

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(mode="silent-wake", targetSessionKey=<parent>)`. Verifies that a delegate at depth-1 can dispatch a silent-wake child at depth-2 that targets the original parent (not the depth-1 dispatcher), exercising the (a)-shape session-delivery-queue substrate across two chain hops.

## Tempo-derived fire-evidence (rune-prince service, host `rune`)

Two Tempo traces capture the chain at byte. Both fetched 2026-06-02 ~05:00 PDT and stored alongside this EVIDENCE.md.

### Trace 1 — depth-0 main session dispatching depth-1 shard

- **trace_id**: `cf915ed2383a184fba19f2626a9f2616`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/cf915ed2383a184fba19f2626a9f2616
- **Local export**: `depth1_shard_trace.json` (9.4 KB, 6 spans)
- **Root span**: `continuation.delegate.dispatch` (depth-0 → depth-1 dispatch)
  - `chain.id` = `f50c03b8-baa4-4988-8d1e-88b021fcbc78` (cohort chain shared across TEST-1/2/3 depth-1 spawns)
  - `chain.step.remaining` = `199` (step 1 of 200)
  - `delegate.mode` = `normal`
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-1 / rune-canary-seat] Depth-1 shard for up-tree silen..."`
- **Child spans**: `openclaw.run` (depth-1 subagent runtime) + `openclaw.context.assembled` + 2× `openclaw.model.call` + `openclaw.tool.execution` (depth-1 LLM working)
- **Wall-clock**: depth-0 dispatch fired ~`1780398432.388` (Unix-nanos) = 2026-06-02T11:07:12.388Z

### Trace 2 — depth-1 shard dispatching depth-2 (silent-wake)

- **trace_id**: `91456930330c0296073174f1d6a6c3fa`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/91456930330c0296073174f1d6a6c3fa
- **Local export**: `wake_event_trace.json` (3.9 KB, 2 spans)
- **Root span**: `openclaw.harness.run` (depth-1 shard harness)
  - `openclaw.model` = `claude-opus-4.7-1m-internal`
- **Child span**: `continuation.delegate.dispatch` (depth-1 → depth-2 dispatch)
  - `chain.id` = `b5aaac94-2c01-4598-a612-07485c0fd6e3` (new chain, depth-1 starts fresh per subagent runtime)
  - `chain.step.remaining` = `199`
  - `delegate.mode` = **`silent-wake`** ← test verification
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-1 / depth-2 shard] Return payload to parent session: "`
- **Wall-clock**: depth-1 harness ran `1780398432.866` → `1780398442.863` (~10s); depth-1 → depth-2 dispatch fired at `1780398442.848`

## Session topology

- Parent main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:45a0f8f9-acd4-4d42-b7db-93c03c449e95`
- Depth-2 target: parent main session (silent-wake injection, no channel echo)

## Honest scope of PASS

- ✅ Tempo confirms depth-0 spawned depth-1 with depth-1's reason naming TEST-1 / up-tree silent-wake intent.
- ✅ Tempo confirms depth-1 dispatched depth-2 with `delegate.mode=silent-wake` and `reason.preview` matching depth-2 silent-wake-to-parent task.
- ✅ Depth-1 receipt (`delegate_return_payload.txt`) confirms depth-2 spawn returned traceparent matching the depth-1 trace.
- ❌ NOT confirmed in these two traces: depth-2 turn's `openclaw.run` (separate trace under depth-2 spawn) and the silent-wake injection arrival into parent's context (gateway-internal injection, may emit a `gateway.delivery.inject` span in a third trace — not captured here).

PASS-scope is therefore "depth-1 shard correctly dispatches depth-2 silent-wake targeting parent, observable in Tempo at byte." Full end-to-end "parent context receives depth-2 silent-wake injection" PASS would require a third trace (depth-2 turn) plus a parent-side gateway injection span; not folded in here.

## Reproducer

From parent main session at CANDIDATE_SHA `1de29746f0`:

```
continue_delegate(
  task="[depth-1] capture traceparent; fire continue_delegate(mode=silent-wake, targetSessionKey=<parent>) at depth-2; return receipt",
)
```

## Notes

- Subagent runtime starts a fresh chain when it calls `continue_delegate` (depth-0 chain `f50c03b8-...` ≠ depth-1 chain `b5aaac94-...`). Both have `chain.step.remaining=199` (step 1 of 200) at their respective root.
- Chain-tracking active (cost cap + depth limit per gateway).
