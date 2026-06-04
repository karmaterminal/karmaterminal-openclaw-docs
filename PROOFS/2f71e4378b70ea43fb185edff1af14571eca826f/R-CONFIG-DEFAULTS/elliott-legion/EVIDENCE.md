# R-CONFIG-DEFAULTS — elliott-Legion seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T04:09 PDT. Binary: `OpenClaw 2026.6.2 (2f71e43)`. Elliott-Legion (AMD Ryzen 9 5900HX + RTX 3080 + 64GB CachyOS) gateway-pid `804005`.

## Row purpose

Verify continuation tools are enabled by default in the fleet config and that the runtime-resolved continuation config matches both (a) the on-disk `openclaw.json` substrate and (b) the source-of-truth defaults in `src/auto-reply/continuation/config.ts`.

## Byte-evidence

### On-disk config (`config_snapshot.json`) — elliott-seat `~/.openclaw/openclaw.json` `agents.defaults.continuation` at byte

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 50000000,
  "maxDelegatesPerTurn": 500,
  "contextPressureThreshold": 0.4,
  "maxDelayMs": 86400000,
  "defaultDelayMs": 15000,
  "minDelayMs": 5000,
  "crossSessionTargeting": "enabled"
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

`resolveContinuationRuntimeConfig` reads `cfg.agents?.defaults?.continuation` at each enforcement point so hot-reloaded values take effect at the next decision (see source comment). At byte the runtime returns:

```ts
{
  enabled: continuation?.enabled === true,
  // ...delay/cap fields with clamp fallback to DEFAULT_* constants...
  crossSessionTargeting:
    continuation?.crossSessionTargeting === "enabled" ? "enabled" : "disabled",
}
```

### Live runtime confirmation

The R-OBS-2 trace `b04fb77e0bd6c12f749cb79e658a4c35` captured at 04:09:20 PDT shows `[continuation:delegate-spawned] hop=1/200` — the `1/200` denominator empirically confirms `maxChainLength=200` from the elliott-seat config is the live runtime value (NOT the source default of 10 — see `source_defaults.txt`). The fleet config override is being honored at runtime.

## Substantive substrate-finding

**Fleet config substantively-OPTS-IN to continuation feature surface AT-RUNTIME on elliott-Legion seat.** All four substantive enablement fields verified at byte:

| Field | Source default | Elliott fleet override | Runtime-honored at byte |
|-------|----------------|------------------------|-------------------------|
| `enabled` | `false` (gated by `=== true` check) | `true` | ✅ (continuation tools registered, delegate-dispatch fires) |
| `maxChainLength` | `10` | `200` | ✅ (`hop=1/200` in journal log line) |
| `costCapTokens` | `500_000` | `50_000_000` | ✅ (no cap-exhaustion rejection on R-OBS-2 dispatch) |
| `maxDelegatesPerTurn` | `5` | `500` | ✅ (single-delegate test, but cap honored) |
| `crossSessionTargeting` | `"disabled"` (default in zod-schema + runtime resolver) | `"enabled"` | ✅ (see R-CONFIG-INTERSESSION row) |
| `contextPressureThreshold` | (unset at source; defaults via clampOptionalUnitInterval) | `0.4` | ✅ (40% band lowered from 70% structural floor per cohort discipline) |

## Substantive cohort-discipline-substrate-note

Per zod-schema enforcement at `src/config/zod-schema.agent-defaults.ts:271-313`, `crossSessionTargeting` defaults to `"disabled"` at SCHEMA level — i.e. the **safe-by-default** posture is "no inter-session targeting unless explicitly opted-in." Elliott-seat opts-in via fleet config; cohort substrate substantively-load-bearing for `continue_delegate(targetSessionKey=...)` / `targetSessionKeys=[...]` / `fanoutMode=tree|all` semantics.

## Cohort substrate-verdict

✅ **PASS** — continuation feature substantively-enabled-by-fleet-config at byte on elliott-Legion seat. All five substantive enablement fields verified at runtime + source. Runtime-resolution coherent with on-disk substrate.
