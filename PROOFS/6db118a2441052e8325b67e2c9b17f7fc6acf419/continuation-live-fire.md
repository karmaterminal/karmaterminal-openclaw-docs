# Continuation live-fire — settled SHA `6db118a2`

## Driver

silas-seat openclaw session at `OpenClaw 2026.5.12-beta.1 (6db118a)` issued the live-fire chain at 2026-05-12 around 19:28 UTC. Per silas's surface at Discord msg `1503841221`:

```
openclaw --version → OpenClaw 2026.5.12-beta.1 (6db118a)
gateway-restart etime → 00:00 (fresh restart)
```

The model invoked:

```
continue_delegate(
  task="trace-validate: spawn a subagent that fires its OWN continue_delegate to produce a depth-3 trace tree (root → child → grandchild). subagent should fire `continue_delegate(task=\"trace-validate-leaf\")` then return.",
  mode="normal"
)
```

with **no explicit traceparent parameter**.

## Tool-surface return

The `continue_delegate` tool call returned with chain-tracking metadata. Silas captured:

- **trace_id**: `e50d3a8bb49f81bf71692041361009e7`
- **root span (silas-seat agent's openclaw.run)**: `2ecbd3d18e7d5596`
- **serialized traceparent**: `00-e50d3a8bb49f81bf71692041361009e7-2ecbd3d18e7d5596-01`

The traceparent is derived from the active continuation tracer registry by `formatActiveContinuationTraceparent()` (exported from `extensions/diagnostics-otel/src/continuation-tracer-adapter.ts`, wired at the tool entry point `src/agents/tools/continue-delegate-tool.ts:196`).

## Depth-3 chain confirmation

Per silas's follow-up at `1503841461`:

```
root: silas-seat main continue_delegate
      trace_id e50d3a8bb49f81bf71692041361009e7, span 2ecbd3d18e7d5596
child: subagent returned 'leaf-fired-from-child'
       traceparent 00-e50d3a8bb49f81bf71692041361009e7-40ee9c1cc605bcc4-01
       (same trace_id, child span 40ee9c1cc605bcc4)
leaf:  scheduled silent by child (depth 2→3)
       fires after child's response completes
```

The child subagent received its parent context through the gateway's `subagent-spawn` traceparent forwarding (`src/agents/subagent-spawn.ts:156` accepts the parameter; lines 1184 and 1295 forward it to the gateway). When the child invoked its own `continue_delegate`, it derived parent context from its now-active openclaw runtime span via the same `formatActiveContinuationTraceparent()` path. The result is auto-pickup across the spawn boundary without the caller knowing or passing anything explicit.

## Tempo verification

See `multi-span-tempo-evidence.md` for full Tempo-query results. Summary:

- 24 spans total in trace `e50d3a8bb49f81bf71692041361009e7`
- 3 `openclaw.run` + 2 `continuation.delegate.dispatch` form the depth-3 chain backbone
- Parent-edge topology: RUN-1 → DISPATCH-1 → RUN-2 → DISPATCH-2 → RUN-3
- All non-root spans have populated `parentSpanId` resolving within the same trace

## Architectural shape proven

The trace shape demonstrates the continuation feature's load-bearing observability claim: **continuation delegates participate as named children of the calling agent's trace tree**, regardless of which delegate-spawn boundary they cross (process, RPC, async-dispatch, post-compaction). The maintainer reviewing PR #79925 can rely on the OTel infrastructure to surface continuation chains as first-class spans rather than orphan trees.

## Cross-validation (independent prior)

A prior live-fire on lane-cumulative `ac17e0d7` (from ronan-seat, run `25756923360`) produced Tempo trace `8fe88c8abccd5a0d908f2747687f5e88` with 38 spans across 4 generations. Ronan's byte-walk at `1503827917` confirmed:

```
ROOT openclaw.harness.run ff0d2ff835f3a100
 ↳ openclaw.run (trigger=user) bdf3988a322f4dcf parented to root
  ↳ continuation.delegate.dispatch 1dab44a27a4bf210
    ↳ child openclaw.run c53726536e42a30b (trigger=manual)
     ↳ context.assembled + model.call + tool.execution + dispatch
      ↳ child openclaw.run (trigger=manual)
       ↳ ... 4 generations deep
```

Two independent live-fires on two distinct binaries (`ac17e0d7` and `6db118a2`) both produce stitched multi-span trees. The cure shipped in `6db118a2` is architecturally identical to the cure validated at byte on `ac17e0d7` — the squash-and-rebase preserves the architectural shape.
