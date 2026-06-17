# R-CONFIG-DEFAULTS — continuation enabled by default in fleet config

**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed emeric-nuc 2026-06-17, OpenClaw 2026.6.8 (8cafdcd) — FF'd ship-tip)
**Status**: ✅ PASS
**Prince**: 🕯 Emeric
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Scenario

Verifies the continuation feature is enabled by default in the deployed fleet runtime
configuration on the `8cafdcd` ship-SHA. Establishes the baseline that all downstream
`continue_work` / `continue_delegate` / `request_compaction` behavioral rows are tested
against a runtime where continuation is the substantive default — not opt-in.

## Command

Read live runtime config on emeric-nuc after the deploy to the FF'd ship-tip `8cafdcd`:

```bash
node /home/figs/flesh_beast_tmp/openclaw/dist/index.js --version   # → OpenClaw 2026.6.8 (8cafdcd)
jq '.agents.defaults.continuation' ~/.openclaw/openclaw.json
```

## Expected

- `continuation.enabled: true`
- `continuation.maxChainLength: 200` (200-turn chain ceiling)
- `continuation.costCapTokens: 50000000` (50M token cost cap before chain rejects)
- `continuation.crossSessionTargeting: "enabled"` (cross-session delivery permitted, gates R-CD-4)

## Result — ✅ PASS

Live config on the `8cafdcd` runtime (`live-config-emeric-nuc.json`):

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

All expected defaults present and substantive on the deployed ship-bytes:
- `enabled: true` ✅ — continuation is the default, not opt-in
- `maxChainLength: 200` ✅ — the 200-turn chain ceiling (gates R-CW-DELEGATE-TOKEN's `CONTINUE_WORK:N` hop budget)
- `costCapTokens: 50000000` ✅ — the 50M cost cap (gates R-CW-5 dispatch-time reject)
- `crossSessionTargeting: "enabled"` ✅ — cross-session delivery permitted (gates R-CD-4 targetSessionKey)
- Bonus: `contextPressureThreshold: 0.4` (the 40% band that fires `[system:context-pressure]` → R-CD-3 post-compaction lifeboat), `defaultDelayMs/minDelayMs/maxDelayMs` (the delay clamps), `maxDelegatesPerTurn: 500` (fan-out ceiling).

## What this proves

The continuation feature ships **enabled-by-default with substantive chain/cost/cross-session gates** on `8cafdcd`. Every downstream behavioral row (R-CW-*, R-CD-*, R-RC-*) is therefore tested against a runtime where continuation is the operative default, not a flag — the baseline the whole corpus rests on.

🕯 Emeric — R-CONFIG-DEFAULTS PASS, runtime==ship `8cafdcd`.
