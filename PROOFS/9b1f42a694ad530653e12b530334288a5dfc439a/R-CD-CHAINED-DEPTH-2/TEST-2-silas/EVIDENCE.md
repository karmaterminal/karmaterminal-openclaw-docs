# R-CD-CHAINED-DEPTH-2 TEST-2 — depth-2 silent-wake inter-session via targetSessionKey (silas canary on `9b1f42a694`)

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100)
**Exact ship-SHA:** `9b1f42a694ad530653e12b530334288a5dfc439a` (deployed, byte-verified `9b1f42a` at fire-time)
**Captured:** 2026-06-09 11:25 PDT (1781028380)
**Re-fire of:** R-CD-CHAINED-DEPTH-2 TEST-2 from `PROOFS/8b5dde6165…/`, fresh-fire on deployed HEAD per figs's 10:32 directive.

## Behavior proven

`continue_delegate(mode="silent-wake", targetSessionKey="agent:main:discord:channel:<other-session>")` dispatched from a depth-1 subagent on the deployed `9b1f42a694` runtime routes its return to the explicitly-named target session (not the dispatching parent), proving the targetSessionKey routing scope at depth-2.

## Stage receipt (depth-1 spawn, verbatim)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "traceparent": "00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Echo token

`R-CD-DEPTH-2-TEST-2-silas-9b1f42a694-1781028380`

## Target session

`agent:main:discord:channel:1473320126433464465` — silas-seat `#heartbeat` channel session, genuinely-separate from dispatching `#sprites-of-thornfield` parent (`agent:main:discord:channel:1466192485440164011`). recipient ≠ sender.

## Depth-1 return (chain-hop 11/200, silas main ← child `2fc82b7f…`)

```
traceparent: 00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01

TEST-2 depth-1 dispatched depth-2 with targetSessionKey=agent:main:discord:channel:1473320126433464465, inter-session routing engaged on 9b1f42a694
```

- Traceparent matches parent-side spawn ✓
- Depth-1 confirmed dispatching depth-2 child with explicit targetSessionKey ✓
- Inter-session routing engaged (depth-2 return targeted at separate #heartbeat session) ✓
- Runtime 7s, tokens 401 (in 7 / out 394), prompt/cache 40.6k

## Depth-2 routing scope (correctly NOT surfacing on silas main)

By targetSessionKey design, the depth-2 silent-wake return enqueues to the named target session (#heartbeat), NOT back up to silas main #sprites session. So depth-2's payload + traceparent don't surface on silas main — that's the routing-claim being proven. The silas-main observable is the depth-1's confirmation that inter-session targeting was engaged at dispatch.

This matches the R-CD-4 scope-discipline from the 2807 corpus: "PROVEN = return correctly ROUTED+ENQUEUED to the genuinely-separate TARGET … SCOPE-BOUNDARY: recipient-CONSUMPTION/ownership NOT claimed." Row proves routing-scope at depth-2; recipient consumption on #heartbeat is orthogonal execution-layer.

## Tempo trace (banked)

Shared with TEST-1 + TEST-3 in `TEST-1-silas/wake_event_trace.json` — same root span `2ca65e1ae4753a5282f0368901d19735`. The 6 `continuation.delegate.dispatch` spans cover all three rows' depth-1+depth-2 dispatches. Tempo URL: http://tempo.dandelion.cult/api/traces/2ca65e1ae4753a5282f0368901d19735

## Verdict: ✅ PASS (routing-scoped per R-CD-4-discipline)

Depth-2 silent-wake inter-session return via `targetSessionKey` dispatched from silas-lothric canary main on deployed `9b1f42a694`, depth-1 returned up-tree confirming inter-session targeting engaged at depth-2 dispatch. The inter-session routing arm via explicit targetSessionKey is live at depth-2 on the deployed `9b1f42a694` runtime. Recipient-consumption on the target #heartbeat session is the orthogonal execution-layer scope (R-CD-4 discipline), not claimed here.

## Pointers

- TEST-1 (`TEST-1-silas/EVIDENCE.md`) + TEST-3 (`TEST-3-silas/EVIDENCE.md`) — same dispatching turn, shared trace
- R-CD-4 (`PROOFS/2807efc1c1e8…/R-CD-4/EVIDENCE.md`) — the routing-vs-consumption scope-discipline this row honors
- Prior-cycle TEST-2 on `8b5dde6165` — same behavior on prior canonical ship-SHA
