# R-CW-6 — chain-depth-boundary reject (`maxChainLength`)

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** elliott-prince · **Owner:** 🌻 Elliott
**Verdict:** ⚠️ HONEST-LIMIT
**Fired:** 2026-06-09 (byte-walked LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~12min post-deploy-restart)

## Behavior under test
The continuation budget guard must REFUSE to spawn a hop once the allocated chain-depth reaches `maxChainLength` (the runaway-chain cap). The reject prevents unbounded self-continuation chains.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface (post-reorg path, byte-confirmed live): `src/auto-reply/continuation/scheduler.ts:27`. The cap-check is the shared budget helper `checkContinuationBudget`:

```ts
export function checkContinuationBudget(params: {
  chainState: ChainState;
  config: ContinuationRuntimeConfig;
  sessionKey: string;
}): "chain-capped" | "cost-capped" | null {
  const { chainState, config, sessionKey } = params;
  const allocatedChainHop = chainState.currentChainCount;

  if (allocatedChainHop >= config.maxChainLength) {        // <-- R-CW-6 boundary
    log.info(
      `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
    );
    return "chain-capped";
  }
  // ... cost-cap check follows ...
  return null;
}
```

The guard logic is live + correct on the deployed binary: when `currentChainCount >= maxChainLength`, it returns `"chain-capped"` and refuses the hop.

## Honest limit (why ⚠️, not ✅)
`maxChainLength` is a protected runtime-config value (default 200). Inducing the boundary LIVE would require driving an actual 200-hop continuation chain on the deployed gateway, which is not practically firable inside a single proof-session (cost-cap + time + the chain-tracking itself would intervene). So:

- **The reject-logic is byte-attestable as live** (`scheduler.ts:27`, compiled into the deployed dist) ✓
- **The live-induction of the boundary is blocked** by the protected-config + practical-fire limit
- **The guard refusing IS the proof** — the cap exists, is correct, and is wired into the deployed dispatch path
- Consistent with the protected-config boundary 🪨 rune named on the parallel rune-rog-ally row; **#973 tracks the testability-gap** (a way to induce/assert the cap without a full 200-hop live chain)

## Evidence summary
- Cap-check present + correct on deployed reorg'd tree (`scheduler.ts:27`) ✓
- Compiled into deployed dist (continuation scheduler bundled) ✓
- Live-boundary-induction honest-limited (protected-config; the guard's existence + correctness is the attestable proof) ⚠️
- Matches rune-rog-ally R-CW-6 verdict (consistent HONEST-LIMIT across seats; #973)
