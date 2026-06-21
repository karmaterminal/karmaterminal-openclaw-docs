# R-CONFIG-INTERSESSION — continuation config + chain-state persists across session boundaries (deployed token-fixed ship SHA)

**Owner:** 🕯 Emeric · **Seat:** emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS** — continuation chain-state persists to the session entry + reloads across drains/session boundaries, and config resolution prefers the active runtime snapshot; byte-verified in source + behaviorally green (14/14) on the deployed token-fixed head.

## What this proves
On the deployed token-fixed ship SHA `c814979`, continuation state survives across session/turn boundaries via two mechanisms:
1. **Chain-state persistence** (`state.ts` `persistContinuationChainState`): writes `continuationChainCount / continuationChainStartedAt / continuationChainTokens / continuationChainId` onto the **session entry** — so chain hop-count, cost-accumulation, and correlation-id survive across drains and reloads. `loadContinuationChainState` reads them back on the next turn/session.
2. **Config runtime-snapshot persistence** (`config.ts:140` `resolveContinuationRuntimeConfig` "prefers the active runtime snapshot"): config resolved once persists as the active snapshot across subsequent resolutions, so live-config changes propagate consistently across sessions rather than re-reading stale per-call.

This is the cross-session-persistence surface (lamp-axis cure-authoring row).

## The persistence byte (source, `state.ts` on c814979 — verbatim in `state-persistence-c814979.txt`)
- `:182-184` — `params.sessionEntry.continuationChainCount/StartedAt/Tokens = params.count/startedAt/tokens` (state written to the persisted session entry)
- `:194` — `params.sessionEntry.continuationChainId = params.chainId` (correlation survives across drains; `loadContinuationChainState` reads it)

## Behavioral byte (state.test.ts + config.test.ts, deployed c814979)
- `loadContinuationChainState`: ✅ "reads chain fields directly when all three are present" · ✅ "folds turnTokens into accumulatedChainTokens" · ✅ "defaults chainStartedAt to now when field is missing" · ✅ "treats missing count/tokens as zero (no undefined leak)"
- continuation timer state: ✅ "tracks timer refs with retain/release semantics" (cross-turn timer correlation)
- config: ✅ "prefers the active runtime snapshot when resolving live config" · ✅ "uses active runtime snapshot defaults when continuation config was unset"
- **state.test.ts: 14/14 passed** on the deployed token-fixed head (see `state-test-c814979.txt`).

## Files
- `state-persistence-c814979.txt` — `persistContinuationChainState` + chain-field load/persist logic, verbatim from c814979 source
- `state-test-c814979.txt` — the 14/14 green run on the deployed head

## Note
Cross-session-persistence is a state-management row (no continuation-tool fire) — no Tempo trace per the runbook's "EACH continuation-tool fire" scope. Behavioral + source byte on the deployed token-fixed ship SHA `c814979`.
