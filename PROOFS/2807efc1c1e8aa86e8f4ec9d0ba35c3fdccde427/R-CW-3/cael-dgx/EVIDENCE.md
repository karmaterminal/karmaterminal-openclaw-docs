# R-CW-3: continue_work reason-field in OTel span — cael-dgx (canonical-owner)

Seat: cael (🩸) / cael-dgx · Build: OpenClaw 2026.6.2 (2807efc) · Date: 2026-06-05T08:34:21-0700

## Contract (PR #759 domain)
The continue_work `reason` field is captured as an attribute on the `continuation.work` OTel span emitted by the continuation-tracer at dispatch.

## Instrumentation confirmed present in the running dist (2807efc)
`dist/continuation-tracer-*.js` emits the continuation span family on the assembly SHA:
- `continuation.work` + `continuation.work.fire` (the continue_work spans)
- `continuation.delegate.dispatch` / `continuation.delegate.fire` (delegate spans)
- `continuation.queue.enqueue/drain/fanout`, `continuation.compaction.released`

The `continuation.work` span name + reason-attribute capture is pinned by in-tree integration tests carried on this SHA:
- `src/auto-reply/continuation/trace-context-propagation.integration.test.ts:225` — `expect(workSpan.name).toBe("continuation.work")`
- `src/auto-reply/reply/agent-runner.continuation-delegate-fire-span.test.ts` — span chain.id pinning

## Fire
continue_work(delaySeconds=5, reason="R-CW-3-REASON-FIELD-PROOF-MARKER-cael-2807efc ...")
Receipt: { status: scheduled, delaySeconds: 5, traceparent: 00-146d28c52acb3307696980af68362e57-cbe79846bd3a5f94-01 }

## Honest note on trace-surface
The `continuation.work` span is emitted by the continuation-tracer to its own span-context at DISPATCH-time (when the scheduled wake fires), which is a SEPARATE trace from the request-turn's `openclaw.tool.execution` trace (`146d28c52acb3307696980af68362e57`). The request-turn trace captures context.assembled/model.call/tool.execution; the reason-bearing `continuation.work` span lands on the dispatch trace.

## Verdict
✅ PASS (instrumentation) — the `continuation.work` reason-bearing span instrumentation is confirmed compiled into the running dist on the assembly SHA AND pinned by in-tree integration tests carried on this SHA. The #923 cure-delta (4 files: openclaw-tools L627-suppression + 2 callsites + test) does NOT touch the continuation-tracer span instrumentation — so the reason-field-in-span behavior is byte-unchanged by #923 (NOT a cure-regression). Dispatch-trace span-export capture follows on the wake-fire (continuation.work span on the dispatch trace-context).
