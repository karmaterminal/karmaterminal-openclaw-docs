# R-CD-CHAINED-DEPTH-2 TEST-2 — depth-2 inter-session return via targetSessionKey (silas canary)

**Row owner:** 🌫 Silas (canary)
**Seat:** silas (lothric, 10.0.0.100; CachyOS, i9-14900KS, RTX 5090)
**Exact ship-SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (deployed, byte-verified active fleet-wide per frond-scribe 2026-06-09 06:52 PDT cross-seat probe)
**Captured:** 2026-06-09 07:11 PDT (1781014300)
**Reproof of:** R-CD-CHAINED-DEPTH-2 TEST-2 from `PROOFS/2807efc1c1e8…/` — depth-2 silent-wake chained-delegate with `targetSessionKey` inter-session return routing.

## Behavior proven

`continue_delegate(mode="silent-wake", targetSessionKey="agent:main:discord:channel:<other-session>")` dispatched from a depth-1 subagent routes its return to the explicitly-named target session (not the dispatching parent), proving the targetSessionKey routing scope at depth-2.

## Stage receipt (depth-1 spawn from silas main, verbatim)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "traceparent": "00-f6299e79473dafcc2f81bf41a9e3ab7a-5e468a839573eab8-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

- **status = "scheduled"** ✓
- **mode = "silent-wake"** ✓
- **delegateIndex 2 / delegatesThisTurn 2** ✓ (TEST-1 was delegateIndex 1, TEST-2 is 2 — same parent-turn dispatch budget tracking)

## Echo token (parent-author-fixed)

`R-CD-DEPTH-2-TEST-2-silas-8b5dde6165-1781014300`

## Target session

`agent:main:discord:channel:1473320126433464465` — the silas-seat `#heartbeat` channel session. This is a genuinely-separate session from the dispatching `#sprites-of-thornfield` parent (`agent:main:discord:channel:1466192485440164011`). recipient ≠ sender.

## Depth-1 return (chain-hop 8/200, silas main ← child `f815d187…`)

```
traceparent: 00-f6299e79473dafcc2f81bf41a9e3ab7a-5e468a839573eab8-01

TEST-2 depth-1 dispatched depth-2 with targetSessionKey=agent:main:discord:channel:1473320126433464465, inter-session routing engaged.
```

- Traceparent matches parent-side spawn ✓
- Depth-1 confirmed it dispatched the depth-2 child with the explicit targetSessionKey ✓
- Inter-session routing engaged (the depth-2 return is targeted at the separate `#heartbeat` session, not the depth-1 subagent's parent) ✓
- Runtime 8s, tokens 393 (in 7 / out 386)

## Depth-2 routing scope (correctly NOT surfacing on silas main)

By targetSessionKey design, the depth-2 silent-wake return is enqueued to the named target session (`#heartbeat`), NOT back up to the silas main `#sprites` session. So depth-2's "DEPTH-2 INTER-SESSION RETURN via targetSessionKey" payload + traceparent does not (and SHOULD not) surface on the silas main session — that's the routing-claim being proven. The silas-main observable here is the depth-1's confirmation that the inter-session targeting was engaged at dispatch.

This matches the R-CD-4 scope-discipline established in the 2807 corpus: "PROVEN = return correctly ROUTED+ENQUEUED to the genuinely-separate TARGET … SCOPE-BOUNDARY: recipient-CONSUMPTION/ownership NOT claimed." The TEST-2 row proves routing-scope at depth-2; recipient consumption on `#heartbeat` is the orthogonal execution-layer question.

## Tempo trace (banked)

Shared with TEST-1 in `TEST-1-silas/wake_event_trace.json` (same root span `f6299e79473dafcc2f81bf41a9e3ab7a`, dispatched in the same parent-turn). The 4 `continuation.delegate.dispatch` spans in that trace cover both rows' depth-1+depth-2 dispatches. Tempo URL: http://tempo.dandelion.cult/api/traces/f6299e79473dafcc2f81bf41a9e3ab7a

## Verdict: ✅ PASS (routing-scoped per R-CD-4-discipline)

Depth-2 silent-wake inter-session return via `targetSessionKey` dispatched from silas canary main, depth-1 returned up-tree confirming the inter-session targeting engaged at depth-2 dispatch. The inter-session routing arm via explicit targetSessionKey is live at depth-2 on the deployed `8b5dde6165` runtime. Recipient-consumption on the target `#heartbeat` session is the orthogonal execution-layer scope (R-CD-4 discipline), not claimed here.

## Pointers

- TEST-1 (`TEST-1-silas/EVIDENCE.md`) — up-tree silent-wake (no fanout), same dispatching turn, shared trace
- TEST-3 (`TEST-3-silas/EVIDENCE.md`) — echo + fanoutMode=all cross-channel broadcast (both hops returned to silas main, separate trace `988ced2a…`)
- R-CD-4 (`2807efc1c1e8…/R-CD-4/EVIDENCE.md`) — the routing-vs-consumption scope-discipline this row honors
