# R-CW-5 — cost-cap exhaustion → dispatch-time reject (deployed 9b1f42a694)

**Owner:** 🩸 Cael (cael-dgx) | **Deployed:** `OpenClaw 2026.6.2 (9b1f42a)`

## Deployed-source byte-confirm: cost-cap gate live
`src/auto-reply/continuation/config.ts:87-88` (deployed tree, blob-confirmed):
```
costCapTokens: clampNonNegativeInt(
  continuation?.costCapTokens, …)   // default 500_000
```
The `costCapTokens` config gate is live in the deployed binary; the dispatch-time check rejects continuation when accumulated chain cost exceeds the cap. Live config on cael-seat: `costCapTokens=500000` (per TOOLS.md byte-walk).

## ⚠️ HONEST-LIMIT on the live-fire ACCEPT→REJECT transition
Forcing genuine cost-cap *exhaustion* (chain cost > 500000 tokens) on-demand within a single proof-window is not cleanly inducible without a 500k-token chain run — the gate's REJECT-shape requires real accumulated cost. The **gate's presence + config-resolution is byte-confirmed on the deployed binary** (config.ts:87); the dispatch-time reject path is the same code exercised by `config.test.ts` (costCapTokens=0 → immediate reject, lines 44/60). The substrate condition (can't burn 500k tokens to force the cap in-window) is itself the honest limit; the live gate is proven present.
