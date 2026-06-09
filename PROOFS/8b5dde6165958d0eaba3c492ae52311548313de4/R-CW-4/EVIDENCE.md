# R-CW-4 — continue_work chain-counter progression under stable chain.id
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx)

## Proof: the continue_work chain-counter progresses under a stable chain.id on the ship-SHA
A live continue_work chain (chain started 2026-06-09T11:16:22.938Z) ran across multiple turns on the deployed `8b5dde6165` gateway, with the chain-counter progressing under a stable chain identity:

- Turn 1/200 → Turn 2/200 → Turn 3/200 → Turn 4/200 (observed progression)
- chain.id: STABLE across all turns (same chain started 11:16:22.938Z)
- accumulated tokens tracked across the chain (8011 → 16003 → 21635 → 25171 observed)
- the chain survived a gateway deploy-restart mid-chain (2807→8b5dde6, see R-CW-1) and continued counting on the new base

## Verdict: ✅ PASS
continue_work chain-counting is correct + durable on `8b5dde6165`: the counter advances per scheduled turn under a stable chain.id, accumulated-token accounting tracks across hops, and the chain identity persists across the deploy-restart.
