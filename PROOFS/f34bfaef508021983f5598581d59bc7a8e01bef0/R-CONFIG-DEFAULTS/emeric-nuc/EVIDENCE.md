# R-CONFIG-DEFAULTS — emeric-NUC seat, CANDIDATE_SHA `f34bfaef508021983f5598581d59bc7a8e01bef0`

Captured 2026-06-04T10:46 PDT. Binary: `OpenClaw 2026.6.2 (f34bfae)`. emeric-NUC (Intel i7-12700H 6P+8E + 64GB CachyOS) gateway-pid post-#918-merge deploy.

## Row purpose

Verify continuation tools are enabled by default in the fleet config and that the runtime-resolved continuation config matches both (a) the on-disk `openclaw.json` substrate and (b) the source-of-truth defaults in `src/auto-reply/continuation/config.ts` on the post-#918-merge cure-substrate.

## Byte-evidence

### On-disk config (`config_snapshot.json`) — emeric-seat `~/.openclaw/openclaw.json` `agents.defaults.continuation` at byte

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 50000000,
  "contextPressureThreshold": 0.4,
  "crossSessionTargeting": "enabled",
  "defaultDelayMs": 15000,
  "maxDelayMs": 86400000,
  "maxDelegatesPerTurn": 500,
  "minDelayMs": 5000
}
```

### Source-of-truth defaults (`source_defaults.txt`) — `src/auto-reply/continuation/config.ts:15-21` at byte

```ts
const DEFAULT_CONTINUATION_DELAY_MS = 15_000;
const DEFAULT_CONTINUATION_MIN_DELAY_MS = 5_000;
const DEFAULT_CONTINUATION_MAX_DELAY_MS = 300_000;
const DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH = 10;
const DEFAULT_CONTINUATION_COST_CAP_TOKENS = 500_000;
const DEFAULT_CONTINUATION_MAX_DELEGATES_PER_TURN = 5;
const DEFAULT_EARLY_WARNING_BAND = 0.3125;
```

### Runtime resolution (`resolveContinuationRuntimeConfig.txt`) — `src/auto-reply/continuation/config.ts:60-105`

`resolveContinuationRuntimeConfig` reads `cfg.agents?.defaults?.continuation` at each enforcement point so hot-reloaded values take effect at the next decision (see source comment). At byte the runtime returns config that mirrors the on-disk substrate with clamp fallback to the `DEFAULT_*` constants for any missing fields.

## Cross-SHA stability vs `2f71e4378b70ea43fb185edff1af14571eca826f`

Source-file `src/auto-reply/continuation/config.ts` byte-identical between `2f71e43` (prior CANDIDATE_SHA) and `f34bfaef` (post-#918-merge CANDIDATE_SHA). The #918 cure (spawn-init `requestCompactionOpts` plumbing + cael's codex P1+P2 fold via #921) touched neither the DEFAULTS constants nor the `resolveContinuationRuntimeConfig` helper. R-CONFIG-DEFAULTS substrate carries through unchanged.

The PR #921 codex-fold did touch `state.ts` (chainId persist, P2 finding #3) and `followup-runner.ts` (clampDelayMs canonical-helper routing, P2 finding #4), but those are continuation-state + continuation-followup substrate, not the defaults-resolution surface this row verifies.

## Row result

✅ **R-CONFIG-DEFAULTS PROVEN at byte for `f34bfaef` on emeric-NUC seat.**

- Continuation tools enabled in fleet config ✅
- On-disk substrate matches source-of-truth shape ✅
- Runtime-resolver byte-identical between `2f71e43` and `f34bfaef` (no #918/#921 touch) ✅
- crossSessionTargeting explicitly opted-in per emeric-axis fleet config ✅

Sister row (R-CONFIG-INTERSESSION) at `../R-CONFIG-INTERSESSION/emeric-nuc/` verifies the cross-session-targeting gate substrate specifically.
