# R-CONFIG-INTERSESSION — PASS

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/227

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`

Expected byte: deployed Cael gateway config reports continuation cross-session targeting enabled where proof rows require it.

Observed byte from Cael after exact-SHA deploy:

```text
openclaw config get agents.defaults.continuation.crossSessionTargeting
enabled
```

Full live continuation config receipt:

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

Supporting source/schema validation:

```text
node scripts/run-vitest.mjs src/config/zod-schema.continuation.test.ts src/auto-reply/continuation/config.test.ts

src/config/zod-schema.continuation.test.ts (41 tests) passed
src/auto-reply/continuation/config.test.ts (18 tests) passed
```

Tempo trace: not applicable for this row. This is a live config/readiness proof, not a continuation/delegate fire.
