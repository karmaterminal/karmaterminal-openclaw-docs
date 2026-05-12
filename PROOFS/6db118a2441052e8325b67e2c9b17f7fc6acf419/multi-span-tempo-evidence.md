# Multi-span Tempo evidence — trace `e50d3a8bb49f81bf71692041361009e7`

**SHA tested**: `6db118a2441052e8325b67e2c9b17f7fc6acf419` (X''''''-prime)
**Seat**: silas (`OpenClaw 2026.5.12-beta.1 (6db118a)`)
**Live-fire driver**: silas-seat session, depth-3 `continue_delegate` chain spec (root → child → grandchild via silent leaf), no explicit traceparent
**Capture timestamp**: 2026-05-12 around 19:28 UTC (silas's heartbeat at `1503841221`)
**Raw trace JSON**: `artifacts/tempo-trace-e50d3a8b.json` (33,160 bytes)

## Span count by name

| Span name                          | Count |
|------------------------------------|-------|
| `openclaw.run`                     | 3     |
| `continuation.delegate.dispatch`   | 2     |
| `openclaw.harness.run`             | 1     |
| `openclaw.context.assembled`       | ≥1    |
| `openclaw.model.call`              | ≥4    |
| `openclaw.model.usage`             | ≥1    |
| `openclaw.tool.execution`          | ≥2    |
| **Total**                          | **24**|

## Span-namespace inventory

```
['continuation.delegate.dispatch',
 'openclaw.context.assembled',
 'openclaw.harness.run',
 'openclaw.model.call',
 'openclaw.model.usage',
 'openclaw.run',
 'openclaw.tool.execution']
```

**Scope check**: every span name is either `openclaw.*` (openclaw's own observability surface) or `continuation.delegate.dispatch` (the continuation feature's own span name). No `http.*`, `messaging.*`, `rpc.*`, `db.*`, `net.*`, or any other OTel-semconv platform namespace. The feature does not overreach into platform observability.

## Parent-chain validation

```
RUN-1 (openclaw.run, span=LsvT0Y59VZY=, parent=(root))
 └── DISPATCH-1 (continuation.delegate.dispatch, span=xWzGTPki8sw=, parent=LsvT0Y59VZY=)
       └── RUN-2 (openclaw.run, span=QO6cHMYFvMQ=, parent=xWzGTPki8sw=)
             └── DISPATCH-2 (continuation.delegate.dispatch, span=2YF//I98XUA=, parent=QO6cHMYFvMQ=)
                   └── RUN-3 (openclaw.run, span=GNG1XwOc7Wo=, parent=2YF//I98XUA=)
```

The chain demonstrates:

1. **Root openclaw.run** is the initial agent turn that issued `continue_delegate(...)`.
2. **DISPATCH-1** is the span emitted by the continuation runtime when it consumes the delegate from TaskFlow and spawns a subagent. Its parent_span_id resolves to RUN-1's span_id — the dispatch is properly parented to the calling agent's run.
3. **RUN-2** is the spawned subagent's openclaw.run. Its parent_span_id resolves to DISPATCH-1's span_id — the subagent's run is properly parented to the dispatch span. **This is the load-bearing fix**: prior iterations (pre-`ac17e0d7`) produced RUN-2 as an orphan root.
4. **DISPATCH-2** is the subagent's own `continue_delegate(...)` to the leaf. Parent resolves to RUN-2.
5. **RUN-3** is the grandchild leaf run. Parent resolves to DISPATCH-2.

The chain is depth-3 and the parent-edge topology is exactly what the architecture asserts.

## Orphan-span count

- Total spans: 24
- Spans with no parent_span_id (orphan): 1
- Orphan that is the root span: 1
- **Orphan-except-root**: **0** ✓

All non-root spans have a populated parent_span_id that resolves to another span in the same trace.

## Reproducibility

```sh
curl -s 'http://tempo.dandelion.cult/api/traces/e50d3a8bb49f81bf71692041361009e7' | jq '.batches | length, [.[] | .scopeSpans[].spans | length] | add'
```

Should return `1` (one resource batch) followed by `24` (total spans). Span-tree structure can be reconstructed by parent_span_id resolution; raw JSON banked at `artifacts/tempo-trace-e50d3a8b.json`.
