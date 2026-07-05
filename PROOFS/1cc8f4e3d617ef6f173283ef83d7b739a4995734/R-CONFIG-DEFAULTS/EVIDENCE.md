# R-CONFIG-DEFAULTS — PASS

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/226

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`

Expected byte: continuation runtime config defaults are present in source and schema tests pass at the candidate SHA; live Cael may intentionally override some defaults for proof runtime.

Observed source byte:

- Source surface: `src/auto-reply/continuation/config.ts`
- Defaults include:
  - `DEFAULT_CONTINUATION_DELAY_MS = 15_000`
  - `DEFAULT_CONTINUATION_MIN_DELAY_MS = 5_000`
  - `DEFAULT_CONTINUATION_MAX_DELAY_MS = 300_000`
  - `DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH = 10`
  - `DEFAULT_CONTINUATION_COST_CAP_TOKENS = 500_000`
  - `DEFAULT_CONTINUATION_MAX_DELEGATES_PER_TURN = 5`
  - `DEFAULT_CONTINUATION_MAX_PENDING_WORK = 32`
  - `DEFAULT_EARLY_WARNING_BAND = 0.3125`
  - busy-skip backoff base/factor defaults `1_000` and `2`

Validation commands:

```text
node scripts/run-vitest.mjs src/config/zod-schema.continuation.test.ts src/auto-reply/continuation/config.test.ts
```

Result:

```text
src/config/zod-schema.continuation.test.ts (41 tests) passed
src/auto-reply/continuation/config.test.ts (18 tests) passed
```

Live Cael runtime receipt after deploy:

```json
{
  "enabled": true,
  "defaultDelayMs": 15000,
  "minDelayMs": 5000,
  "maxDelayMs": 86400000,
  "maxChainLength": 200,
  "costCapTokens": 500000,
  "maxDelegatesPerTurn": 500,
  "crossSessionTargeting": "enabled",
  "contextPressureThreshold": 0.4,
  "earlyWarningBand": 0.3125
}
```

The live runtime intentionally carries proof-friendly overrides (`maxDelayMs`, `maxChainLength`, `maxDelegatesPerTurn`, context pressure) while preserving the source default contract and schema coverage.

Tempo trace: not applicable for this row. This is a source/config proof, not a live continuation fire.
