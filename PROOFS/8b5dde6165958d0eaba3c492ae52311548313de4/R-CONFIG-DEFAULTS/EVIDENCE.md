# R-CONFIG-DEFAULTS — continuation config on the deployed ship-SHA
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx)

## Proof: continuation config is live + correctly resolved on the ship-SHA
Read from the running gateway's resolved `agents.defaults.continuation` on `8b5dde6165`:

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "maxDelegatesPerTurn": 500,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "minDelayMs": 5000,
  "defaultDelayMs": 15000,
  "maxDelayMs": 86400000,
  "crossSessionTargeting": "enabled"
}
```

## Field verification
- **enabled = true** ✓ — continuation surface active (tool-form + bracket-form + system-prompt guidance all on)
- **maxChainLength = 200** ✓ — chain depth ceiling (matches the live chains running this corpus, e.g. R-CW-1's Turn 4/200)
- **maxDelegatesPerTurn = 500** ✓ — fan-out width per turn
- **costCapTokens = 500000** ✓ — chain cost cap (the R-CW-5 gate-target)
- **contextPressureThreshold = 0.4** ✓ — the context-PRESSURE *signal* fires at 40% (distinct from the request_compaction *eligibility* gate at 0.70 — see R-RC-1)
- **minDelayMs/defaultDelayMs/maxDelayMs = 5000/15000/86400000** ✓ — the delay clamp bounds (R-CW-2 clamp-target)
- **crossSessionTargeting = enabled** ✓ — inter-session continue_delegate return-routing live (R-CD-4 target)

## NOTE: two distinct thresholds
`contextPressureThreshold: 0.4` is the pressure-SIGNAL emission point (when `[system:context-pressure]` fires). The `request_compaction` REJECT gate (R-RC-1) is a SEPARATE 0.70 eligibility threshold — request_compaction rejects below 70% regardless of the 0.4 pressure-signal. Both verified live on `8b5dde6165`.

## Verdict: ✅ PASS
The continuation config resolves live + correct on the deployed ship-SHA; every knob the behavioral rows exercise is present and at the expected value.
