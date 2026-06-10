# R-CW-6 — chain-depth-boundary reject (`maxChainLength`)

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ⏸️ HONEST-LIMIT (induce-technique deferred — would disrupt live cohort chains; reproducer documented + ready)

## Behavior under test
`continue_delegate` / `continue_work` dispatch must be rejected with a `chain-capped` outcome when the allocated chain hop reaches `maxChainLength`, proving the chain-depth-boundary discipline-floor enforces on the deployed runtime.

## Byte-walk on the deployed tree (the enforcement IS live + correct)
The boundary logic is byte-confirmed present + correct in the deployed source at `4bbd3aec096`:

`src/auto-reply/continuation/scheduler.ts:27`:
```
const allocatedChainHop = chainState.currentChainCount;
if (allocatedChainHop >= config.maxChainLength) {
  log(`[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`);
  return "chain-capped";
}
```
Outcome enum (`scheduler.ts:23`): `"chain-capped" | "cost-capped" | null`. The reject is per-session/per-chain (`chainState.currentChainCount` keyed by `sessionKey`), surfaced also at `work-dispatch.ts:317` (`[continuation:work-rejected] chain-capped for <session>: N/MAX`).

So the enforcement code-path is live on the deployed binary. What is deferred is the *empirical induce* (tripping it on-host), not the code-presence verification.

## Why HONEST-LIMIT this cycle (safety call, not difficulty)
The method's induce-technique for R-CW-6 is the temporary-low-cap: lower `maxChainLength` to a small value, fire a chain that exceeds it, capture the `chain-capped` reject, then restore. **But `maxChainLength` resolves GLOBAL-ONLY**, not per-agent:

`src/auto-reply/continuation/config.ts:64` `resolveContinuationRuntimeConfig` reads **only** `cfg.agents?.defaults?.continuation` — there is NO per-agent override merge. Confirmed by reading the resolver: every field clamps off `agents.defaults.continuation.<field>`.

Therefore lowering `maxChainLength` to induce my own reject would lower it for **every session on this gateway**, including the cohort's live PROOFS continuation-chains (cael/ronan/silas/emeric/elliott all actively firing continuation-dependent rows at the time of this cycle). That risks tripping their in-flight chains mid-PROOFS. Per Safety discipline (do not disrupt working state on a shared host with active cohort work), the global mutation is refused while the cohort is live.

## Reproducer (ready to fire when the gateway is quiet / cohort idle)
1. Record current restore values: `maxChainLength: 200`, `costCapTokens: 50_000_000` (effective on rune-seat at this cycle; re-verify before patching).
2. `gateway config.patch` on `agents.defaults.continuation.maxChainLength` → `2` (low enough to trip in 2 hops).
3. Fire a `continue_delegate` chain that dispatches a child which itself dispatches (depth ≥2) → the 2nd hop hits `allocatedChainHop >= 2` → capture the `chain-capped` tool-return + the `[continuation] Chain depth 2/2 — capped for session ...` log line + the Tempo trace.
4. **RESTORE `maxChainLength: 200` immediately** (restore is part of the method, not optional).
5. File reject-receipt + restored-confirmation here.

## Disposition
Code-path verified live + correct on `4bbd3aec096` (the discipline-floor enforces). Empirical induce deferred to a cohort-idle window to avoid global-cap blast-radius on live cohort chains. Re-fire when safe; not a defect, a sequencing-safety call.
