# R-CD-CHAINED-DEPTH-2 TEST-2 — inter-session targeted return

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ✅ PASS (scoped) — depth-1 shard dispatched depth-2 `continue_delegate(targetSessionKey=<parent main>)` with normal-mode delivery; dispatch span recorded in Tempo with correct mode + cross-session targeting attributes. Depth-2 turn execution and parent-session delivery arrival are not captured in these two traces.

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(targetSessionKey=<parent>)` with normal-mode payload. Verifies the (a)-shape explicit recipient-addressing via session-delivery-queue across two hops, where depth-2 delivery targets the original parent rather than the depth-1 dispatcher.

## Tempo-derived fire-evidence (rune-prince service, host `rune`)

### Trace 1 — depth-0 main session dispatching depth-1 shard

- **trace_id**: `b3aa435b046d790babb2e7396c432365`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/b3aa435b046d790babb2e7396c432365
- **Local export**: `depth1_shard_trace.json` (10.7 KB, 8 spans)
- **Root span**: `continuation.delegate.dispatch` (depth-0 → depth-1 dispatch)
  - `chain.id` = `f50c03b8-baa4-4988-8d1e-88b021fcbc78` (cohort chain shared across TEST-1/2/3 depth-1 spawns)
  - `chain.step.remaining` = `198` (step 2 of 200, after TEST-1 depth-1 spawn at step 1)
  - `delegate.mode` = `normal`
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-2 / rune-canary-seat] Depth-1 shard for inter-session"`
- **Child spans**: `openclaw.run` (depth-1 subagent runtime) + `openclaw.context.assembled` + 3× `openclaw.model.call` + 2× `openclaw.tool.execution`
- **Wall-clock**: depth-0 dispatch fired ~`1780398432.527` = 2026-06-02T11:07:12.527Z

### Trace 2 — depth-1 shard dispatching depth-2 (inter-session targeted return)

- **trace_id**: `0fa11de4632d9d0b98ade2e961449647`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/0fa11de4632d9d0b98ade2e961449647
- **Local export**: `wake_event_trace.json` (3.9 KB, 2 spans)
- **Root span**: `openclaw.harness.run` (depth-1 shard harness)
  - `openclaw.model` = `claude-opus-4.7-1m-internal`
- **Child span**: `continuation.delegate.dispatch` (depth-1 → depth-2 dispatch)
  - `chain.id` = `ce61b797-96af-4d10-9111-a5d1e3e79db8` (new chain, depth-1 starts fresh per subagent runtime)
  - `chain.step.remaining` = `199`
  - `delegate.mode` = `normal`
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-2 depth-2 / inter-session return] DEPTH-2 INTER-SESSI..."`
- **Wall-clock**: depth-1 harness ran `1780398433.317` → `1780398444.117` (~10.8s); depth-1 → depth-2 dispatch fired at `1780398444.138` (post-harness, scheduled as immediate)

## Session topology

- Parent main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:4de02031-a711-4436-a7e2-a65b08350e45`
- Depth-2 target: parent main session (cross-session normal-mode return, channel-visible per delivery context)

## Honest scope of PASS

- ✅ Tempo confirms depth-0 spawned depth-1 with depth-1's reason naming TEST-2 / inter-session-return intent.
- ✅ Tempo confirms depth-1 dispatched depth-2 with `delegate.mode=normal` and `reason.preview` matching depth-2 inter-session-return task.
- ✅ Depth-1 receipt (`delegate_return_payload.txt`) confirms depth-2 spawn targeted parent session (`targetSessionKey=agent:main:discord:channel:1466192485440164011`).
- ❌ NOT independently confirmed in Tempo from these two traces: explicit `target.session.key` attribute on the dispatch span (gateway instrumentation does not surface targetSessionKey as a separate span attr in this run — the targeting is recorded in the dispatch payload, observable via depth-1 receipt + reason.preview semantics).
- ❌ NOT captured: depth-2 turn `openclaw.run` (separate trace) and the cross-session delivery arrival into parent (would emit under depth-2 trace or a gateway-delivery span).

PASS-scope is therefore "depth-1 shard correctly dispatches depth-2 inter-session-targeted-return, observable via dispatch reason + receipt at byte." Strengthening this row would require gateway instrumentation surfacing `target.session.key` as a span attribute OR fetching the depth-2 turn trace and verifying it arrives at parent.

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(targetSessionKey=<parent main session>) at depth-2; return receipt",
)
```

## Notes

- `TRACEPARENT` env-var was unset at depth-1 shard entry; trace context is gateway-managed (lives in active scope, not env-vars). Expected per OpenClaw runtime design.
- Cross-session targeting is the (a)-shape canon per continuation-tools section of OpenClaw runtime docs.
