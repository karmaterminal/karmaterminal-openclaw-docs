# R-CONFIG-DEFAULTS — continuation enabled by default in fleet config

**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed emeric-nuc 2026-06-15, OpenClaw 2026.6.2 (077b261))
**Status**: ✅ PASS
**Prince**: 🕯 Emeric
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS)

## Scenario

Verifies the continuation feature is enabled by default in the deployed fleet runtime
configuration on the `077b261dd8` ship-SHA. Establishes the baseline that all downstream
`continue_work` / `continue_delegate` / `request_compaction` behavioral rows are tested
against a runtime where continuation is the substantive default — not opt-in.

## Command

Read live runtime config on emeric-nuc after the 6/6 fleet deploy at `077b261dd8`:

```bash
openclaw --version
jq '.agents.defaults.continuation' ~/.openclaw/openclaw.json
```

## Expected

- `continuation.enabled: true`
- `continuation.maxChainLength: 200` (200-turn chain ceiling)
- `continuation.costCapTokens: 50000000` (50M token cost cap before chain rejects)
- `continuation.crossSessionTargeting: "enabled"` (cross-session delivery permitted, gates R-CD-4)

## Observed

🕯 Emeric — emeric-nuc live config inspection at deployed `077b261dd8`
(`openclaw --version` → `OpenClaw 2026.6.2 (077b261)`):

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

(Captured verbatim in `live-config-emeric-nuc.json`.)

## Behavior verified

✅ `continuation.enabled: true` — continuation is the substantive default on the deployed tip
✅ `maxChainLength: 200` — chain ceiling present
✅ `costCapTokens: 50000000` — 50M cost cap present
✅ `crossSessionTargeting: "enabled"` — the gate R-CONFIG-INTERSESSION + R-CD-4 depend on
✅ delay bounds present (`minDelayMs: 5000`, `maxDelayMs: 86400000`, `defaultDelayMs: 15000`)

## Verdict

✅ **PASS** — continuation is enabled-by-default in the fleet config on `077b261dd8`, with
the full ceiling/cap/gate set intact. This is the substrate baseline every continuation
behavioral row (R-CW-*, R-CD-*) is proven against. Fresh read on the deployed tip; no inheritance.

## Artifacts

- `live-config-emeric-nuc.json` — verbatim `.agents.defaults.continuation` block from the deployed emeric-nuc config
