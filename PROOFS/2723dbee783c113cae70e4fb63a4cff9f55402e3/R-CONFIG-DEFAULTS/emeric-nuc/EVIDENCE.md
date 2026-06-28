# R-CONFIG-DEFAULTS — continuation config defaults applied on bootstrap (🕯 emeric-nuc)

Seat: 🕯 Emeric / `emeric-nuc` (Intel NUC i7-12700H, 64GB, CachyOS x86_64)  
Capture/deployed SHA: `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
Date: 2026-06-27 21:22 PDT  
Disposition: ✅ **PASS**

## What this row proves

`R-CONFIG-DEFAULTS` proves that continuation runtime defaults are present at the deployed SHA and are pinned by tests. The continuation config is resolved from `agents.defaults.continuation`; unset or invalid keys fall through to hardcoded defaults via `resolveContinuationRuntimeConfig`.

This is a config/source row, not a timing or compaction-adjacent runtime proof row. Emeric is in the #1118 compaction-counter quarantine bucket for new timing/continuation-sensitive live rows; this row does not depend on the compaction counter or rotation timing.

## Deployed build identity

`build-info.json` from the running install:

```json
{
  "version": "2026.6.10",
  "commit": "2723dbee783c113cae70e4fb63a4cff9f55402e3",
  "builtAt": "2026-06-28T03:18:27.531Z"
}
```

## Default constants — byte-confirmed on deployed SHA

Captured in `config-defaults-source.txt` from `src/auto-reply/continuation/config.ts`:

```ts
const DEFAULT_CONTINUATION_DELAY_MS = 15_000;
const DEFAULT_CONTINUATION_MIN_DELAY_MS = 5_000;
const DEFAULT_CONTINUATION_MAX_DELAY_MS = 300_000;
const DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH = 10;
const DEFAULT_CONTINUATION_COST_CAP_TOKENS = 500_000;
const DEFAULT_CONTINUATION_MAX_DELEGATES_PER_TURN = 5;
const DEFAULT_CONTINUATION_MAX_PENDING_WORK = 32;
const DEFAULT_EARLY_WARNING_BAND = 0.3125;
const DEFAULT_BUSY_SKIP_BACKOFF_BASE_MS = 1_000;
const DEFAULT_BUSY_SKIP_BACKOFF_FACTOR = 2;
```

The resolver applies the defaults through clamp/resolve helpers:

- `enabled`: `continuation?.enabled === true` (default false unless explicitly enabled)
- `defaultDelayMs`: `15_000`
- `minDelayMs`: `5_000`
- `maxDelayMs`: `300_000`
- `maxChainLength`: `10`
- `costCapTokens`: `500_000`
- `maxDelegatesPerTurn`: `5`
- `maxPendingWork`: `32`
- `earlyWarningBand`: `0.3125`
- `crossSessionTargeting`: enabled only on explicit `"enabled"`, otherwise disabled
- `busySkipBackoff`: `{ baseMs: 1_000, ceilingMs: maxDelayMs, factor: 2 }`
- `orphanReapStaleCutoffMs`: unset unless a positive finite override is configured

## Test pin

Narrow test command run on emeric-nuc:

```bash
pnpm exec vitest run src/auto-reply/continuation/config.test.ts --pool=forks --maxWorkers=1 --no-fileParallelism --reporter=verbose
```

Result from `config-test-defaults-pin.log`:

```text
Test Files  1 passed (1)
Tests       18 passed (18)
```

The passing test set includes defaults when continuation is not configured, configured-value clamping, invalid `maxPendingWork` fallback, invalid `contextPressureThreshold` rejection, invalid `earlyWarningBand` fallback, busy-skip backoff defaults, orphan-reap cutoff default/override, live runtime-snapshot preference, and `clampDelayMs` behavior including the explicit-zero immediate sentinel.

## Effective running config — honest override note

`effective-running-continuation-config.json` captures emeric-nuc's fleet-tuned runtime config:

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

The live fleet config intentionally overrides high-ceiling proof-work values (`maxChainLength`, `costCapTokens`, `maxDelayMs`, `maxDelegatesPerTurn`, `contextPressureThreshold`, and `crossSessionTargeting`). It leaves `defaultDelayMs=15000` and `minDelayMs=5000`, matching the source defaults. The absent-key behavior itself is pinned by the resolver source and config test suite above.

## Verdict

✅ **PASS** — at deployed SHA `2723dbee783c113cae70e4fb63a4cff9f55402e3`, continuation runtime defaults are byte-present in source, applied by `resolveContinuationRuntimeConfig`, and pinned by `config.test.ts` (`18/18` passing). The running build-info commit matches the deployed SHA. Live fleet config overrides are documented separately and do not invalidate the default resolver behavior.
