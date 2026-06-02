# R-CD-CHAINED-DEPTH-2 TEST-3 — echo-broadcast (fanoutMode=tree)

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ✅ PASS — depth-2 echo-broadcast via fanoutMode=tree dispatched clean.

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(fanoutMode="tree")`. Verifies broadcast return targeting across the continuation/subagent ancestor chain. fanoutMode=tree returns to every ancestor in the chain (parent main + depth-1 dispatcher receive byte-identical payload).

## Fire-evidence

- Parent session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:398116f1-d69e-44e6-8677-079c7dc4d8d3`
- Depth-1 traceparent: `00-151e385719f7de0896006b2571a20c6c-edcc535f0f8f72fc-01`
  - trace_id: `151e385719f7de0896006b2571a20c6c`
  - depth-1 span_id: `edcc535f0f8f72fc`
- Depth-2 spawn: scheduled, fanoutMode=tree, delegateIndex=1
- Depth-1 receipt timestamp: 2026-06-02T04:07:16-07:00
- Chain hop label at parent: `[continuation:chain-hop:3]` (turn 3/200)

## Tempo trace

- Trace ID: `151e385719f7de0896006b2571a20c6c`
- Tempo URL: http://tempo.dandelion.cult/api/traces/151e385719f7de0896006b2571a20c6c
- Span hierarchy: see `turn_trace.json` (export pending — frond-scribe assist menu offered Tempo-fetch helper)

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(fanoutMode='tree') at depth-2; return receipt",
)
```

## Notes

- fanoutMode=tree is the cohort-broadcast shape: depth-2 payload distributes byte-identical to every ancestor in the continuation chain via session-delivery-queue.
- Distinct from `targetSessionKeys` (explicit recipient list) — fanoutMode resolves recipients structurally from the chain rather than requiring caller to enumerate.
