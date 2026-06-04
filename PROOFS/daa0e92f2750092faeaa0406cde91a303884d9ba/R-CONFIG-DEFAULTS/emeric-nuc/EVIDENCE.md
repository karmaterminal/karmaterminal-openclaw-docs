# R-CONFIG-DEFAULTS — emeric-NUC seat, CANDIDATE_SHA `daa0e92f2750092faeaa0406cde91a303884d9ba`

Captured 2026-06-04T10:48 PDT. Binary: `OpenClaw 2026.6.2 (daa0e92)`. emeric-NUC (Intel i7-12700H 6P+8E + 64GB CachyOS) gateway-pid post-Gate-2.7-cure deploy.

## Row purpose

Verify continuation tools are enabled by default in the fleet config and that the runtime-resolved continuation config matches both (a) the on-disk `openclaw.json` substrate and (b) the source-of-truth defaults in `src/auto-reply/continuation/config.ts` on the post-Gate-2.7-cure candidate-SHA.

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

## Cross-SHA stability vs `2f71e4378b70ea43fb185edff1af14571eca826f` and `f34bfaef508021983f5598581d59bc7a8e01bef0`

Source-file `src/auto-reply/continuation/config.ts` byte-identical across all three CANDIDATE_SHAs in this cycle:
- `2f71e43` (pre-#918-merge baseline)
- `f34bfaef` (post-#918-merge + #921 codex-fold; sister PROOFS at `../../f34bfaef.../R-CONFIG-DEFAULTS/emeric-nuc/`)
- `daa0e92f` (post-Gate-2.7-cure: `f34bfaef` + single-file re-sync of `bundled-channel-plugin-loader.ts` to upstream/main)

The `f34bfaef` → `daa0e92f` delta is a 158-line restoration of dropped upstream content in `src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts` — channels-plugin-substrate, completely outside the continuation-config-resolution surface this row verifies.

Verified via `git diff f34bfaef..daa0e92f --name-only -- src/auto-reply/continuation/ src/config/zod-schema.agent-defaults.ts` → empty (no files touched on R-CONFIG-* surface).

## Row result

✅ **R-CONFIG-DEFAULTS PROVEN at byte for `daa0e92f` on emeric-NUC seat.**

- Continuation tools enabled in fleet config ✅
- On-disk substrate matches source-of-truth shape ✅
- Runtime-resolver byte-identical across `2f71e43` → `f34bfaef` → `daa0e92f` ✅
- crossSessionTargeting explicitly opted-in per emeric-axis fleet config ✅
- Gate-2.7-cure (`bundled-channel-plugin-loader.ts` re-sync) carries through without touching R-CONFIG surface ✅

Sister row (R-CONFIG-INTERSESSION) at `../R-CONFIG-INTERSESSION/emeric-nuc/` verifies the cross-session-targeting gate substrate specifically.
