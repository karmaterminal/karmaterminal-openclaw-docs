# R-CONFIG-DEFAULTS — continuation enabled by default in fleet config

**Target SHA**: `5529aa4662487226c9e76e687a8edb676b4e594a` (deployed emeric-nuc 2026-06-13, OpenClaw 2026.6.2 (5529aa4))
**Status**: ✅ PASS
**Prince**: 🕯 Emeric
**Seat**: emeric-nuc (i7-12700H, CachyOS)

## Scenario

Verifies that the continuation feature is enabled by default in the deployed fleet runtime configuration on the `5529aa4662` ship-SHA. Establishes the baseline that all downstream `continue_work` / `continue_delegate` / `request_compaction` behavioral rows are tested against a runtime where continuation is the substantive default — not opt-in.

## Command

Read live runtime config on emeric-nuc after fleet deploy at `5529aa4662`:

```bash
openclaw --version
jq '.agents.defaults.continuation' ~/.openclaw/openclaw.json
```

## Expected

- `continuation.enabled: true`
- `continuation.maxChainLength: 200` (200-turn ceiling for chain continuations)
- `continuation.costCapTokens: 50000000` (50M token cost cap before chain rejects)
- `continuation.crossSessionTargeting: "enabled"` (cross-session delivery permitted, gated by config)

## Observed

🕯 Emeric — emeric-nuc live config inspection at deployed `5529aa4662`:

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

Verbatim from `jq '.agents.defaults.continuation' ~/.openclaw/openclaw.json` on emeric-nuc at `5529aa4`. The config block is nested at `agents.defaults.continuation.*` (per-agent defaults), not top-level — `enabled: true` confirms continuation is the substantive default for the main-session prince.

## Behavior verified

✅ Continuation feature is on by default in fleet runtime config (`enabled: true`)
✅ Chain length ceiling is configured (200)
✅ Cost cap is configured (50M tokens)
✅ Cross-session targeting is enabled
✅ Context-pressure threshold configured (0.4) — the band that fires `[system:context-pressure]` for compaction-handoff staging
✅ Baseline for all behavioral rows: continuation is the substantive default — not opt-in

## Substrate-truth

emeric-nuc at byte: `OpenClaw 2026.6.2 (5529aa4)`. This seat's main-session prince ran a live `continue_work` chain this same session (Turn 1/200, chain-counter lit) — R-CW-1 / the 4-prince continuation cross-walk (`3be6479`) folds the emeric-seat `continue_work`→`continuation.work` Tempo trace (`91af2e0d`) as one of the four. The config gate here is the substrate that those live fires ran against: continuation on, chain ceiling 200, cost cap 50M, cross-session enabled.

## Co-fired

Fresh fire on deployed ship-SHA `5529aa4662487226c9e76e687a8edb676b4e594a`. No inheritance from the prior `335acbe43a` (Elliott-seat) R-CONFIG-DEFAULTS — this is the emeric-nuc re-fire against the current deployment.
