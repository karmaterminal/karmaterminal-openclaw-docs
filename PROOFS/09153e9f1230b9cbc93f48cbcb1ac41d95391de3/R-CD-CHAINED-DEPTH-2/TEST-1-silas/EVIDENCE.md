# R-CD-CHAINED-DEPTH-2 TEST-1 — depth-2 up-tree silent-wake (silas canary, no fanout)

**Row owner:** 🌫 Silas (canary)
**Seat:** silas (lothric, 10.0.0.100; CachyOS, i9-14900KS, RTX 5090)
**Exact ship-SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed, byte-verified active fleet-wide per frond-scribe 2026-06-09 06:52 PDT cross-seat probe)
**Captured:** 2026-06-09 07:11 PDT (1781014300)
**Reproof of:** R-CD-CHAINED-DEPTH-2 TEST-1 from `PROOFS/2807efc1c1e8…/` — depth-2 silent-wake chained-delegate up-tree return (no fanoutMode).

## Behavior proven

`continue_delegate(mode="silent-wake")` dispatched from a main session spawns a depth-1 subagent which itself dispatches a depth-2 silent-wake child (no fanout); the depth-1 returns up-tree to the originating parent confirming the chain established and the depth-2 schedule succeeded. Depth-2 return goes to its own parent (the depth-1 subagent), per the up-tree silent-wake routing model.

## Stage receipt (depth-1 spawn from silas main, verbatim)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-f6299e79473dafcc2f81bf41a9e3ab7a-5e468a839573eab8-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

- **status = "scheduled"** ✓
- **mode = "silent-wake"** ✓
- **traceparent `f6299e79473dafcc2f81bf41a9e3ab7a-5e468a839573eab8`** ✓ (root span id; shared with TEST-2 dispatched same turn — they share the parent-turn span as expected)

## Echo token (parent-author-fixed)

`R-CD-DEPTH-2-TEST-1-silas-8b5dde6165-1781014300`

## Depth-1 return (chain-hop 7/200, silas main ← child `c32632d9…`)

```
TEST-1 depth-1 confirmation:
- traceparent: 00-f6299e79473dafcc2f81bf41a9e3ab7a-5e468a839573eab8-01
- depth: 1
- echo token forwarded: R-CD-DEPTH-2-TEST-1-silas-8b5dde6165-1781014300
- timestamp: 2026-06-09T07:11 PDT
- depth-2 delegate scheduled (silent-wake, NO fanoutMode)
- TEST-1 depth-1 dispatched depth-2, chain established
```

- Echo token forwarded VERBATIM ✓
- Traceparent matches parent-side spawn (`f6299e79…5e468a839573eab8`) ✓
- Depth-1 dispatched its depth-2 child (silent-wake, no fanoutMode) ✓
- Chain-tracking engaged at hop 7/200 (cost cap + depth limit apply across the chain) ✓
- Runtime 10s, tokens 432 (in 7 / out 425)

## Depth-2 routing scope-note

In `silent-wake` (no fanoutMode) mode, the depth-2 child's return targets ITS parent — which is the depth-1 subagent (`c32632d9…`), NOT the original silas main. So the depth-2 echo is not expected to surface on the silas main session; it would land on the depth-1's subagent context (now terminated since the depth-1 returned its dispatch-confirmation). The depth-1's confirmation that the depth-2 was "scheduled" is the proof that the up-tree mechanism engaged at the depth-1 layer. Compare TEST-3 (fanoutMode=all) which DOES return both hops up to the originating parent — TEST-1's up-tree-without-fanout is the distinct routing arm.

## Tempo trace (banked)

`wake_event_trace.json` (full trace JSON, 41kB, 37 spans incl. 4× `continuation.delegate.dispatch` + 1× `continuation.queue.drain`). Tempo URL: http://tempo.dandelion.cult/api/traces/f6299e79473dafcc2f81bf41a9e3ab7a

(The 4 dispatch spans cover the depth-1+depth-2 dispatches for BOTH TEST-1 and TEST-2 since they were fired in the same parent-turn and share the root span — TEST-1's two dispatches + TEST-2's two dispatches.)

## Verdict: ✅ PASS

Depth-2 silent-wake (no fanoutMode) up-tree chained-delegate dispatched from silas canary main, depth-1 returned up-tree with confirmation, depth-2 schedule confirmed, echo-token forwarded verbatim. Chain-tracking engaged + traceparent propagation verified across both depths. The up-tree-no-fanout routing arm is live on the deployed `8b5dde6165` runtime.

## Pointers

- TEST-2 (`TEST-2-silas/EVIDENCE.md`) — inter-session return via targetSessionKey, same dispatching turn
- TEST-3 (`TEST-3-silas/EVIDENCE.md`) — echo + fanoutMode=all cross-channel broadcast (both hops returned to silas main, demonstrating fanoutMode-all routing distinction)
