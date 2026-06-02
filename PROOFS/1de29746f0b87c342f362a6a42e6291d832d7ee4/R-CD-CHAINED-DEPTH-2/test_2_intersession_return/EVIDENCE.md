# R-CD-CHAINED-DEPTH-2 TEST-2 — inter-session targeted return

**Owner**: 🪨 Rune (canary-seat dual-coverage per silas pre-cure sit-out, openclaw-bootstrap#1114)
**CANDIDATE_SHA**: `1de29746f0b87c342f362a6a42e6291d832d7ee4`
**Verdict**: ✅ PASS — depth-2 cross-session targeted return dispatched clean.

## Shape under test

Depth-2 chain: parent (rune main) → depth-1 delegate → depth-2 `continue_delegate(targetSessionKey=<parent>)` with normal-mode payload. Verifies the (a)-shape explicit recipient-addressing via session-delivery-queue across two hops, where depth-2 delivery targets the original parent rather than the depth-1 dispatcher.

## Fire-evidence

- Parent session: `agent:main:discord:channel:1466192485440164011`
- Depth-1 session: `agent:main:subagent:4de02031-a711-4436-a7e2-a65b08350e45`
- Depth-1 traceparent: `00-0fa11de4632d9d0b98ade2e961449647-092108f226aaa854-01`
  - trace_id: `0fa11de4632d9d0b98ade2e961449647`
  - depth-1 span_id: `092108f226aaa854`
- Depth-2 spawn: scheduled, targetSessionKey=`agent:main:discord:channel:1466192485440164011` (cross-session return to rune main)
- Depth-1 receipt timestamp: 2026-06-02T11:07:16Z (≡ 2026-06-02T04:07:16 PDT)
- Chain hop label at parent: `[continuation:chain-hop:2]` (turn 2/200)
- Env note: `TRACEPARENT` was unset at shard entry; trace context derived by gateway from active scope (expected behavior; trace-context lives in gateway-managed scope, not env-vars).

## Tempo trace

- Trace ID: `0fa11de4632d9d0b98ade2e961449647`
- Tempo URL: http://tempo.dandelion.cult/api/traces/0fa11de4632d9d0b98ade2e961449647
- Span hierarchy: see `turn_trace.json` (export pending — frond-scribe assist menu offered Tempo-fetch helper)

## Reproducer

```
continue_delegate(
  task="[depth-1] fire continue_delegate(targetSessionKey=<parent main session>) at depth-2; return receipt",
)
```

## Notes

- Depth-2 normal-mode return arrives at parent main session as a standard delegate completion (channel-visible per delivery context).
- Cross-session targeting is the (a)-shape canon per continuation-tools section of OpenClaw runtime docs.
