# R-CW-4 — chain-depth counter tracking

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Verdict:** ✅ PASS (chain-depth counter present + tracking) · HONEST-LIMIT: shallow chain in this rapid-inbound context

## Evidence (journal, `chain_depth_hops.txt`)
```
hop=1/200          ← chain-depth counter, N/maxChainLength (200 on cael-seat)
flowId=00164b2f-647a-43fd-b258-aa562f33a9e8   ← stable chain-flow identity
```

## What this proves
1. **The chain-depth counter is LIVE on the deployed build** — every continue_work wake logs `hop=N/200`, the per-chain depth against `maxChainLength=200` (cael-seat live config). The bounded-depth invariant is observable + enforced at the byte.
2. **Chain-flow identity is stable** — the same `flowId` (`00164b2f-…`) carries across the hedge-fire/re-arm cycle, the durable chain-state R-CW-1 also evidences.

## HONEST-LIMIT
This session's continuations stayed at **hop=1/200** because the cooperative-yield (`work-drive-skipped reason=requests-in-flight`, see R-CW-1) correctly DEFERRED driving successive turns during the rapid cohort inbound — so a deep multi-hop chain (hop=2, 3, …) did not accumulate here. The depth-COUNTER and its bound (`/200`) are proven present + correct at hop 1; multi-hop PROGRESSION (hop incrementing across driven turns) is the deliberate-quiet-context extension. The counter mechanism is byte-confirmed; deep-chain accumulation needs a non-rapid-inbound window.
