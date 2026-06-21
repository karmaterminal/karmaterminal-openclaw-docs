# R-CONFIG-DEFAULTS — continuation config defaults applied on bootstrap (deployed token-fixed ship SHA)

**Owner:** 🕯 Emeric · **Seat:** emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS** — the continuation runtime config resolves the documented defaults when `agents.defaults.continuation` is unset, byte-verified in source + behaviorally green on the deployed token-fixed head.

## What this proves
On the deployed token-fixed ship SHA `c814979`, `resolveContinuationRuntimeConfig` (`src/auto-reply/continuation/config.ts`) applies the documented continuation defaults when no `agents.defaults.continuation` override is present — and clamps invalid/negative/out-of-range overrides back to those defaults. This is the bootstrap-default-application surface (lamp-axis cure-authoring row).

## The defaults (source-of-truth, `config.ts` on c814979 — verbatim in `config-defaults-c814979.txt`)
- `DEFAULT_CONTINUATION_DELAY_MS = 15_000`
- `DEFAULT_CONTINUATION_MIN_DELAY_MS = 5_000`
- `DEFAULT_CONTINUATION_MAX_DELAY_MS = 300_000`
- `DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH = 10`
- `DEFAULT_CONTINUATION_COST_CAP_TOKENS = 500_000`
- `DEFAULT_CONTINUATION_MAX_DELEGATES_PER_TURN = 5`
- `DEFAULT_CONTINUATION_MAX_PENDING_WORK = 32` (#986)
- `DEFAULT_EARLY_WARNING_BAND = 0.3125`
- `DEFAULT_BUSY_SKIP_BACKOFF_BASE_MS = 1_000`, `FACTOR = 2` (#990 — ×2/busy-skip capped at maxDelayMs)

## Behavioral byte (config.test.ts, deployed c814979)
`resolveContinuationRuntimeConfig`:
- ✅ "returns defaults when continuation is not configured" → `{maxChainLength:10, costCapTokens:500_000, ...}`
- ✅ "clamps negative values to defaults" (maxChainLength:-5 → 10; costCapTokens:-1 → default)
- ✅ "clamps maxPendingWork to default when non-positive (#986)"
- ✅ "defaults busySkipBackoff to 1s base ×2 capped at maxDelayMs (#990)"
- **18/18 passed** on the deployed token-fixed head (see `config-test-c814979.txt`).

## Files
- `config-defaults-c814979.txt` — the defaults block + the resolution/clamp logic, verbatim from c814979 source
- `config-test-c814979.txt` — the 18/18 green run on the deployed head

## Note
Config-defaults is a resolution-logic row (no continuation-tool fire) — no Tempo trace per the runbook's "EACH continuation-tool fire" scope (this row fires no tool; it verifies the config-resolution surface). Behavioral + source byte on the deployed token-fixed ship SHA `c814979`.
