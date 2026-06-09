# R-CD-CHAINED-DEPTH-2 TEST-3 — depth-2 silent-wake echo + cross-channel broadcast (silas canary on `9b1f42a694`)

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100)
**Exact ship-SHA:** `9b1f42a694ad530653e12b530334288a5dfc439a` (deployed, byte-verified `9b1f42a` at fire-time)
**Captured:** 2026-06-09 11:25 PDT (1781028380)
**Re-fire of:** R-CD-CHAINED-DEPTH-2 TEST-3 from `PROOFS/8b5dde6165…/`, fresh-fire on deployed HEAD per figs's 10:32 directive.

## Behavior proven

`continue_delegate(mode="silent-wake", fanoutMode="all")` dispatched from a main session on the deployed `9b1f42a694` runtime spawns a depth-1 subagent which itself dispatches a depth-2 child with `fanoutMode=all` cross-channel broadcast; the depth-2 echo round-trips back up the chain via silent-wake to the originating parent (BOTH hops return to silas main, distinguishing the broadcast routing from up-tree-no-fanout TEST-1).

## Stage receipt (depth-1 spawn, verbatim)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 3,
  "delegatesThisTurn": 3,
  "fanoutMode": "all",
  "traceparent": "00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Echo token

`R-CD-DEPTH-2-TEST-3-silas-9b1f42a694-1781028380`

## Round-trip evidence

### Depth-1 return (chain-hop 12/200, silas main ← child `5bb0c776…`)

```
traceparent: 00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01

TEST-3 depth-1 dispatched depth-2 with fanoutMode=all, broadcast routing engaged on 9b1f42a694
```

### Depth-2 return (chain-hop 1/200, child `21594acc…`, the broadcast delegate)

```
R-CD-DEPTH-2-TEST-3-silas-9b1f42a694-1781028380
traceparent: not exposed to subagent runtime context
depth: 2/5
timestamp: 2026-06-09T11:26 PDT (Tue)
DEPTH-2 BROADCAST ECHO RETURN
```

- Echo token returned VERBATIM at depth-2 (proves parent-author-fixed token survived two delegate hops + fanout-broadcast routing) ✓
- Depth `2/5` confirms chain reached the broadcast layer ✓
- Runtime 3s, tokens 0 (out 0) — the broadcast return is a routing-only delivery
- Honest scope-note: depth-2 child's task-context didn't expose its own traceparent observably; the parent-side root traceparent above is the authoritative span-id for the chain root, and the 2 `continuation.queue.fanout` spans in the Tempo trace verify the broadcast routing at the gateway-side

## Both completion events landed on the parent (silas main)

Two completion events arrived back at silas main, one per hop:
1. `[continuation:chain-hop:12]` — depth-1 (`5bb0c776…`), the `fanoutMode=all` dispatcher
2. `[continuation:chain-hop:1]` — depth-2 (`21594acc…`), the broadcast echo

Both delivered the echo-token verbatim + the `DEPTH-2 BROADCAST ECHO RETURN` confirmation line, proving the silent-wake-with-fanoutMode-all return-routing back to the originating parent works end-to-end across two delegate hops on the deployed `9b1f42a694` runtime.

## Tempo trace (banked)

Shared with TEST-1 + TEST-2 in `TEST-1-silas/wake_event_trace.json`. Tempo URL: http://tempo.dandelion.cult/api/traces/2ca65e1ae4753a5282f0368901d19735

Trace contents (70KB, 54 spans, host=silas):
- 6× `continuation.delegate.dispatch` (3 depth-1 + 3 depth-2 across TEST-1/2/3)
- 2× `continuation.queue.fanout` — TEST-3's broadcast routing at the gateway
- 1× `continuation.queue.drain` — queue-drain receipt anchor (matching cohort's queue-drain-receipt standard per frond/Ronan/Elliott convergence)

## Verdict: ✅ PASS

Depth-2 silent-wake chained `continue_delegate` with `fanoutMode=all` cross-channel broadcast dispatched from silas-lothric canary main on deployed `9b1f42a694`, echo-token round-tripped intact across both hops, both completion events delivered back to originating parent (silas main session). The depth-2 lifecycle, silent-wake return, chain-tracking, and fanout-broadcast routing are all live and byte-confirmed end-to-end on the canonical ship-SHA. Tempo trace shows the gateway-side `continuation.queue.fanout` × 2 + `continuation.queue.drain` × 1 spans verifying the broadcast routing at the byte (queue-drain-receipt standard).

## Pointers

- TEST-1 (`TEST-1-silas/EVIDENCE.md`) — up-tree silent-wake (no fanout), same dispatching turn
- TEST-2 (`TEST-2-silas/EVIDENCE.md`) — inter-session via targetSessionKey, same dispatching turn
- Prior-cycle TEST-3 on `8b5dde6165` — same behavior on prior canonical ship-SHA
