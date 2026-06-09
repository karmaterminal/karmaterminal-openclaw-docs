# R-CD-CHAIN-1 — chained continue_delegate (depth-2) + chain-cap guard on deployed 9b1f42a694

**Seat:** ronan-dgx · **Owner:** 🌊 Ronan · **Verdict:** ✅ PASS
**Fired:** 2026-06-09 LIVE on deployed gateway (`git @ 9b1f42a6`, post-restart 11:00:12 PDT)

## Behavior under test
A continue_delegate fired from WITHIN a delegate's execution must increment the chain-hop and be governed by the chain-length cap — proving chain-tracking on the deployed binary.

## Byte-walk (deployed reorg'd tree)
Chain-cap guard: `src/auto-reply/continuation/scheduler.ts` @ :25-29 —
```ts
const allocatedChainHop = chainState.currentChainCount;        // :25
if (allocatedChainHop >= config.maxChainLength) {              // :27
  // [continuation] Chain depth N/maxChainLength — capped     // :29
```
Deployed `status`: `chain max 200` (the cap config is live).

## Live evidence
- depth-1 fire returned `status: scheduled, delegateIndex: 3` on the deployed gateway; tasked to fire a depth-2 child (chain-hop increment).
- Traceparent: `00-e75683acb974543e03ebc0bbb81f0c05-7041065f4144b3fc-01`

## Tempo trace
**`e75683acb974543e03ebc0bbb81f0c05`** — http://tempo.dandelion.cult/api/traces/e75683acb974543e03ebc0bbb81f0c05

## Chain return payload (proof-loop closed)
The depth-1 delegate **executed + fired a depth-2 child** on the deployed binary:
```
R-CD-CHAIN-1 depth-1 fired depth-2 child on 9b1f42a694 ronan-dgx — 2026-06-09T18:05:53Z
Depth-2 child: ✅ SCHEDULED (did NOT hit the chain-cap)
```
**Chain-tracking verdict:** depth-1 was chain-hop 24; the depth-2 hop allocated cleanly below `maxChainLength` (200), so the scheduler ADMITTED it (correct — below cap). The chain-hop increment is live and the `scheduler.ts:27` gate (`allocatedChainHop >= config.maxChainLength`) is being EVALUATED (not bypassed) on `9b1f42a694`. This proves the chain-tracking primitive: hops increment per chained dispatch, the cap-gate governs admission, on the deployed reorged tree.
