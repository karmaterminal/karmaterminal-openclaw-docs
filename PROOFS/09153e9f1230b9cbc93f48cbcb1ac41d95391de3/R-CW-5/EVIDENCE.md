# R-CW-5 — continue_work cost-cap gate (exists + enforced, boundary-correct)
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx)

## Proof: the continuation cost-cap gate is wired + enforced with exact boundary semantics on the ship-SHA
Byte-confirmed on `8b5dde6165` that the `costCapTokens` gate exists, enforces the configured cap, and has exact (`>` not `>=`) boundary semantics:

- **gate wired** (`src/agents/subagent-announce.chain-guard.ts`, test-pinned in `subagent-announce.chain-guard.test.ts`):
  - `:294` — "**rejects** continuation when accumulated tokens **exceed** costCapTokens by one" ✓
  - `:276` — "**allows** continuation when accumulated tokens **equal** costCapTokens exactly (`>` not `>=`)" ✓
  - `:92` — default `costCapTokens ?? 500_000`
- **live config**: `agents.defaults.continuation.costCapTokens = 500000` (the value the gate enforces on this seat)
- **gate input**: the chain's accumulated-token counter — observed live on this seat's chain (8011 → 16003 → 21635 → 25171 across the continuation:wake headers); the gate compares this running total against the cap.

## Capture method (per figs `1512615687`, carried from 2807 R-CW-5)
The REJECT-fire is capturable by temporarily LOWERING `costCapTokens` to trip in 2-3 dispatches, capturing the reject, then restoring — NOT by accumulating real cost to 500k (that was the prior methodological oversight). The gate-existence + boundary-semantics are byte-proven above; the live-trip is a separate config-window capture.

## Verdict: ✅ PASS (gate exists + enforced + boundary-correct, byte-identical vs presentation-head → NOT a regression)
The cost-cap gate is wired, enforced at the configured 500k cap, with exact `>`-not-`>=` boundary semantics, on the deployed `8b5dde6165`. Byte-disjoint from the Form-B run.ts change (the cap lives in chain-guard, unaffected by the timeout-compaction failover edit) — so it is not a regression. The live REJECT-trip is capturable via the lower-the-cap method in a stable window.
