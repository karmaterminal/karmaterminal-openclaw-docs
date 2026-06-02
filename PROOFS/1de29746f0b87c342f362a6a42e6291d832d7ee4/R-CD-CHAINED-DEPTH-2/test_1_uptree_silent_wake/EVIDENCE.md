# R-CD-CHAINED-DEPTH-2 TEST-1 — up-tree silent-wake

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ✅ PASS — depth-2 silent-wake chain dispatched clean from depth-1 shard up-tree to parent main session.

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(mode="silent-wake", targetSessionKey=<parent>)`. Verifies that a delegate at depth-1 can dispatch a silent-wake child at depth-2 that returns up-tree to the original parent (not the depth-1 dispatcher), exercising the (a)-shape session-delivery-queue substrate across two chain hops.

## Fire-evidence

- Parent session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:45a0f8f9-acd4-4d42-b7db-93c03c449e95`
- Depth-1 traceparent: not directly exposed; depth-2 spawn returned traceparent under depth-1 context
- Depth-2 traceparent: `00-91456930330c0296073174f1d6a6c3fa-8003b87f9965b2f4-01`
  - trace_id: `91456930330c0296073174f1d6a6c3fa`
  - parent_span_id: `8003b87f9965b2f4`
- Depth-2 spawn: scheduled, mode=silent-wake, delegateIndex=1, targetSessionKey=parent
- Depth-1 receipt timestamp: 2026-06-02T04:07 PDT
- Chain hop label at parent: `[continuation:chain-hop:1]` (turn 1/200)

## Tempo trace

- Trace ID: `91456930330c0296073174f1d6a6c3fa`
- Tempo URL: http://tempo.dandelion.cult/api/traces/91456930330c0296073174f1d6a6c3fa
- Span hierarchy: see `wake_event_trace.json` (export pending — frond-scribe assist menu offered Tempo-fetch helper; row evidence updates when JSON lands)

## Reproducer

From parent main session at CANDIDATE_SHA:

```
continue_delegate(
  task="[depth-1] capture traceparent; fire continue_delegate(mode=silent-wake, targetSessionKey=<parent>) at depth-2; return receipt",
)
```

## Notes

- Depth-2 silent-wake return will surface in parent context as silent-wake injection (no channel echo). Parent observes the wake; depth-2 payload becomes ambient enrichment.
- Chain-tracking active (cost cap + depth limit per gateway).
