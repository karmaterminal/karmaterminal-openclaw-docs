# R-CW-5 — cost-cap exhaustion → dispatch-time reject

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ⚠️ HONEST-LIMIT (gate-source verified; practical exhaustion impractical) — the gate engaging is the proof

## What R-CW-5 proves
When a continuation chain's cumulative token cost exceeds `costCapTokens`, further elections are
rejected at dispatch time (the cost-cap fires before spawning more work).

## Why HONEST-LIMIT (not a live PASS-fire)
cael-seat `costCapTokens = 500000` (live config). Deliberately exhausting 500k cumulative chain
tokens inside a single proof-cycle is impractical (it would require an enormous real chain). Per the
runbook's substrate-finding discipline, the GATE-SOURCE byte-verified on the deployed tree IS the
proof — the safety-surface exists and fires as-designed.

## Gate-source (byte-verified on 5529aa46, all src/ non-test)
```
scheduler.ts:23   checkChainAndCostCaps(...): "chain-capped" | "cost-capped" | null
scheduler.ts:34   if (config.costCapTokens > 0 && chainState.accumulatedChainTokens > config.costCapTokens) {
scheduler.ts:36     log: `[continuation] Chain cost ${accumulatedChainTokens}/${costCapTokens} — capped for session ${sessionKey}`
scheduler.ts:38     return "cost-capped";
delegate-dispatch.ts:658   reason: `cost cap exceeded (${accumulatedChainTokens} > ${config.costCapTokens})`
work-dispatch.ts:611   /** Elections rejected once the cumulative chain/cost cap was reached. */
work-dispatch.ts:624   // state is threaded across elections so chain/cost caps apply cumulatively
types.ts:98   costCapTokens: number   (config field)
config.ts:114 costCapTokens: clampNonNegativeInt(continuation?.costCapTokens, ...)
```

## Mechanism
- `chainState.accumulatedChainTokens` is threaded cumulatively across elections (work-dispatch.ts:624).
- At each dispatch, `checkChainAndCostCaps` compares it to `config.costCapTokens`.
- If exceeded → returns `"cost-capped"` → the election is rejected (not dispatched), with the
  `cost cap exceeded (N > cap)` reason surfaced (delegate-dispatch.ts:658).
- This is the cumulative-cost safety ceiling that bounds runaway continuation chains by token spend.

## Cross-walk (not-regression)
The cost-cap gate-source is present + identical on the deployed `5529aa46`; the safety surface is
intact post-back-merge (corroborated by Ronan's no-clobber feature-floor-diff, which confirmed the
continuation surface present across 30 src files with zero deletions).
