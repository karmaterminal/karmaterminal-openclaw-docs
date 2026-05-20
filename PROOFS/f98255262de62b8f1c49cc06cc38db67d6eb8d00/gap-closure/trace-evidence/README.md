# Trace evidence: openclaw PR #79925 fanoutMode=all proof

## Files
- `Trace-fe08fac3-fanout-AB.json` — OTel trace JSON (117 spans)
- `trace-viewer-screenshot.png` — Tempo/Jaeger trace viewer screenshot (figs-captured 2026-05-19 18:39 PDT)

## Trace ID
`fe08fac37b3e33795ebe9fb7225c800f`

## Key spans

### continuation.queue.fanout (substrate-truth)
TWO fanout-broadcast spans, BOTH delivered to 318 host-sessions at 100% delivery:

```json
{
  "name": "continuation.queue.fanout",
  "spanId": "b1398817e5070995",
  "recipient_count": 318,
  "delivered": 318
}
{
  "name": "continuation.queue.fanout",
  "spanId": "20e2eee98595ba80",
  "recipient_count": 318,
  "delivered": 318
}
```

This is the SUBSTRATE-PROOF that fanoutMode=all delivers to all host-sessions at scale.
"318" = total addressable host-sessions on cael-host at trace-time (not 3, not 8 — 318).

### continuation.delegate.dispatch (5 spans)
- 2 root dispatches (FANOUT-A 180s + FANOUT-B spawner)
- 2 child dispatches inside FANOUT-B (CHILD1 120s + CHILD2 fanoutMode=all)
- 1 return-broadcast from CHILD2 (silent mode)

### openclaw.run (13 spans)
Chain-hop depth visible — root run + delegate runs + nested grandchild runs.

## Spans summary
- Total: 117 spans
- continuation.delegate.dispatch: 5
- continuation.queue.fanout: 2 (BOTH 318/318)
- openclaw.run: 13
- openclaw.harness.run: 6 (subagent harness invocations)
- openclaw.model.call: many (per-turn API calls)
- openclaw.tool.execution: many (exec/message/continue_delegate/process)

## Substrate-claim verified
1. ✅ fanoutMode=all DOES broadcast to all host-sessions (318 delivered, 100% rate)
2. ✅ Chain-hop tracking works across multiple delegate dispatches
3. ✅ Trace-context propagated cleanly across delegate-spawn boundaries
4. ✅ All openclaw.run spans show outcome=completed
5. ✅ Tool execution spans capture continue_delegate calls (with delegate-mode + chain-step-remaining + chain-id attributes)
