# R-CONFIG-DEFAULTS — continuation enabled by default in fleet config

**Target SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0` (deployed emeric-nuc, OpenClaw 2026.6.10 (`191a7af`))  
**Status:** ✅ PASS  
**Prince:** 🕯 Emeric  
**Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Scenario

Verifies the continuation feature is enabled by default in the deployed fleet runtime configuration on the `191a7af989a637f435016fd8d72627fc47fae0e0` assembly. This establishes that downstream `continue_work` / `continue_delegate` / `request_compaction` rows are tested against a runtime where continuation is enabled with substantive chain, cost, delay, and cross-session gates.

## Commands

```bash
cd /home/figs/flesh_beast_tmp/openclaw
git rev-parse HEAD
node --no-opt dist/index.js --version
jq '.agents.defaults.continuation' ~/.openclaw/openclaw.json
```

Observed deployed runtime:

```text
191a7af989a637f435016fd8d72627fc47fae0e0
OpenClaw 2026.6.10 (191a7af)
```

Live continuation config (`live-config-emeric-nuc.json`):

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

## Verdict

✅ **PASS** — continuation is enabled by default on the deployed `191a7af989a637f435016fd8d72627fc47fae0e0` assembly, with substantive production caps/gates recorded:

- `enabled: true`
- `maxChainLength: 200`
- `costCapTokens: 50000000`
- `crossSessionTargeting: "enabled"`
- delay clamps and delegate fan-out limits present

## Artifacts

- `live-config-emeric-nuc.json` — live continuation config read from `~/.openclaw/openclaw.json` during the proof run.
