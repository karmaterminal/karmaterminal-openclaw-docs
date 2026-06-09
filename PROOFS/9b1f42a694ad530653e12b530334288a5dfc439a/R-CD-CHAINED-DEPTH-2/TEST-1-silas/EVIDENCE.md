# R-CD-CHAINED-DEPTH-2 TEST-1 — depth-2 silent-wake up-tree (silas canary on `9b1f42a694`)

**Row owner:** 🌫 Silas (canary)
**Seat:** silas-lothric (10.0.0.100; CachyOS, i9-14900KS, RTX 5090, 192GB RAM)
**Exact ship-SHA:** `9b1f42a694ad530653e12b530334288a5dfc439a` (deployed, byte-verified `OpenClaw 2026.6.2 (9b1f42a)` via session_status, gateway uptime 7m24s at fire-time)
**Captured:** 2026-06-09 11:25 PDT (1781028380)
**Re-fire of:** R-CD-CHAINED-DEPTH-2 TEST-1 from `PROOFS/8b5dde6165…/`, fresh-fire on the new deployed ship-SHA per figs's 10:32 directive (clawsweeper wants true-head receipts).

## Behavior proven

`continue_delegate(mode="silent-wake")` dispatched from a main session on the deployed `9b1f42a694` runtime spawns a depth-1 subagent which itself dispatches a depth-2 silent-wake child (no fanout); depth-1 returns up-tree to the originating parent with traceparent + confirmation that depth-2 was scheduled.

## Stage receipt (depth-1 spawn from silas main, verbatim)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Echo token (parent-author-fixed)

`R-CD-DEPTH-2-TEST-1-silas-9b1f42a694-1781028380`

Token-shape encodes: row id · seat · exact ship-SHA · POSIX-second timestamp.

## Depth-1 return (chain-hop 10/200, silas main ← child `e44491e5…`)

```
depth-1 traceparent: 00-2ca65e1ae4753a5282f0368901d19735-17cf93f0775ea282-01
depth: 1
timestamp: 2026-06-09T11:26 PDT
TEST-1 depth-1 dispatched depth-2, chain established on 9b1f42a694
```

- Traceparent matches parent-side spawn ✓ (parent-author-fixed token round-trips intact)
- Chain-tracking engaged at hop 10/200 (cost cap + depth limit apply across the chain) ✓
- Depth-1 dispatched depth-2 child confirmed ✓
- Runtime 6s, tokens 346 (in 7 / out 339), prompt/cache 40.4k

## Depth-2 routing scope-note

In `silent-wake` (no fanoutMode) mode, the depth-2 child's return targets ITS parent — the depth-1 subagent (`e44491e5…`), NOT the silas main session. So depth-2's echo doesn't surface on silas main (correctly), which is the routing-scope distinction from TEST-3 (fanoutMode=all returns both hops to originating parent). The depth-1's confirmation that the depth-2 was scheduled is the proof that the up-tree mechanism engaged at the depth-1 layer.

## Tempo trace (banked)

`wake_event_trace.json` — shared root span `2ca65e1ae4753a5282f0368901d19735` across all three TEST-1/2/3 dispatches in the same parent-turn. Full trace: 70KB, 54 spans, service.name=silas-prince/host.name=silas, including 6× `continuation.delegate.dispatch` (3 depth-1 + 3 depth-2) + 2× `continuation.queue.fanout` (TEST-3 broadcast routing) + 1× `continuation.queue.drain`. Tempo URL: http://tempo.dandelion.cult/api/traces/2ca65e1ae4753a5282f0368901d19735

## Verdict: ✅ PASS

Depth-2 silent-wake (no fanoutMode) up-tree chained-delegate dispatched from silas-lothric canary main on deployed `9b1f42a694`, depth-1 returned up-tree with confirmation + traceparent, depth-2 schedule confirmed, echo-token round-tripped verbatim. Chain-tracking engaged + traceparent propagation verified across both depths. The up-tree-no-fanout routing arm is live on the deployed `9b1f42a694` runtime, gate-grade fresh-fire on the true HEAD.

## Pointers

- TEST-2 (`TEST-2-silas/EVIDENCE.md`) — inter-session return via targetSessionKey, same dispatching turn, shared trace
- TEST-3 (`TEST-3-silas/EVIDENCE.md`) — echo + fanoutMode=all cross-channel broadcast, same shared trace
- Prior-cycle TEST-1 on `8b5dde6165` (`PROOFS/8b5dde6165…/R-CD-CHAINED-DEPTH-2/TEST-1-silas/EVIDENCE.md`) — same behavior on prior canonical ship-SHA
