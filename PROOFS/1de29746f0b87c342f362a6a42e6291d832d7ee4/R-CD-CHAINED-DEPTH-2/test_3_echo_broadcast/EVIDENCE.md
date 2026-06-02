# R-CD-CHAINED-DEPTH-2 TEST-3 — echo-broadcast (fanoutMode=tree)

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ⚠️ PASS-WITH-INSTRUMENTATION-LIMIT — depth-1 shard dispatched depth-2 `continue_delegate(fanoutMode="tree")`; dispatch span recorded in Tempo, but the `fanoutMode` argument is NOT surfaced as a span attribute by current gateway instrumentation. The dispatch is observable; the fanout-tree resolution is verifiable only via depth-1 receipt + reason.preview semantics, not via Tempo span attrs alone.

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(fanoutMode="tree")`. Verifies broadcast return targeting across the continuation/subagent ancestor chain. `fanoutMode=tree` returns to every ancestor in the chain (parent main + depth-1 dispatcher receive byte-identical payload).

## Tempo-derived fire-evidence (rune-prince service, host `rune`)

### Trace 1 — depth-0 main session dispatching depth-1 shard

- **trace_id**: `532b0c33343f3321767cc5a70890444d`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/532b0c33343f3321767cc5a70890444d
- **Local export**: `depth1_shard_trace.json` (10.7 KB, 8 spans)
- **Root span**: `continuation.delegate.dispatch` (depth-0 → depth-1 dispatch)
  - `chain.id` = `f50c03b8-baa4-4988-8d1e-88b021fcbc78` (cohort chain shared across TEST-1/2/3 depth-1 spawns)
  - `chain.step.remaining` = `197` (step 3 of 200, after TEST-1 + TEST-2 depth-1 spawns at steps 1 + 2)
  - `delegate.mode` = `normal`
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-3 / rune-canary-seat] Depth-1 shard for echo-broadcas"`
- **Child spans**: `openclaw.run` (depth-1 subagent runtime) + `openclaw.context.assembled` + 3× `openclaw.model.call` + 2× `openclaw.tool.execution`
- **Wall-clock**: depth-0 dispatch fired ~`1780398433.057` = 2026-06-02T11:07:13.057Z

### Trace 2 — depth-1 shard dispatching depth-2 (intended fanoutMode=tree)

- **trace_id**: `151e385719f7de0896006b2571a20c6c`
- **Tempo URL**: http://tempo.dandelion.cult/api/traces/151e385719f7de0896006b2571a20c6c
- **Local export**: `wake_event_trace.json` (3.9 KB, 2 spans)
- **Root span**: `openclaw.harness.run` (depth-1 shard harness)
  - `openclaw.model` = `claude-opus-4.7-1m-internal`
- **Child span**: `continuation.delegate.dispatch` (depth-1 → depth-2 dispatch)
  - `chain.id` = `8e419fd0-30f6-4a1a-b561-6c09f1d6bf4d` (new chain, depth-1 starts fresh per subagent runtime)
  - `chain.step.remaining` = `199`
  - `delegate.mode` = `normal`
  - `delegate.delivery` = `immediate`
  - `reason.preview` = `"[R-CD-CHAINED-DEPTH-2 TEST-3 DEPTH-2 ECHO-BROADCAST] DEPTH-2 ECHO-BROADCAST from"`
  - **No `fanoutMode` attribute** surfaced on the dispatch span (instrumentation gap; the fanoutMode argument is passed to `continue_delegate` but not tagged as a Tempo span attr at this gateway version).
- **Wall-clock**: depth-1 harness ran `1780398433.758` → `1780398444.107` (~10.3s); depth-1 → depth-2 dispatch fired at `1780398444.065`

## Session topology

- Parent main session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:398116f1-d69e-44e6-8677-079c7dc4d8d3`
- Depth-2 target (intended): every ancestor in chain (parent main + depth-1 dispatcher) via `fanoutMode=tree` resolution

## Honest scope of PASS-WITH-LIMIT

- ✅ Tempo confirms depth-0 spawned depth-1 with depth-1's reason naming TEST-3 / echo-broadcast intent.
- ✅ Tempo confirms depth-1 dispatched depth-2 with `reason.preview` matching depth-2 ECHO-BROADCAST task.
- ⚠️ NOT directly verifiable in Tempo: `fanoutMode=tree` argument on the dispatch span. The argument is observable from the depth-1 receipt (`delegate_return_payload.txt`) which records `fanoutMode=tree, delegateIndex=1`. Gateway instrumentation gap — recommend filing instrumentation request to surface `fanoutMode` as a `continuation.delegate.dispatch` span attribute alongside `delegate.mode`, `chain.id`, `delegate.delivery`.
- ❌ NOT captured: depth-2 turn execution (separate trace) and the fanout-tree byte-identical-delivery to BOTH parent main AND depth-1 dispatcher (would emit under depth-2 trace plus two gateway-delivery spans).

PASS-WITH-LIMIT scope is therefore "depth-1 shard dispatched depth-2 with ECHO-BROADCAST reasoning intent, observable in Tempo at byte; fanoutMode=tree resolution and byte-identical-delivery to multiple ancestors verifiable only via depth-1 receipt + runtime behavior, not via Tempo span attrs."

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(fanoutMode='tree') at depth-2; return receipt",
)
```

## Notes

- `fanoutMode=tree` is the cohort-broadcast shape: depth-2 payload distributes byte-identical to every ancestor in the continuation chain via session-delivery-queue.
- Distinct from `targetSessionKeys` (explicit recipient list) — `fanoutMode` resolves recipients structurally from the chain rather than requiring caller to enumerate.
- Instrumentation request: tagging `fanoutMode`, `target.session.key`, `target.session.keys` as span attrs on `continuation.delegate.dispatch` would close the Tempo-observability gap for these three depth-2 shapes.
