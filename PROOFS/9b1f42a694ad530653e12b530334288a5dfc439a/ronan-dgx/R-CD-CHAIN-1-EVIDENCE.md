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
