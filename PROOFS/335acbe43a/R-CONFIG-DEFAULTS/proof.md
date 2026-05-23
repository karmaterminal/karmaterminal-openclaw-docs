# R-CONFIG-DEFAULTS — continuation enabled by default in fleet config

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed elliott-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🌻 Elliott

## Scenario

Verifies that the continuation feature is enabled by default in the deployed fleet runtime configuration on PR #85651 head. Establishes baseline that all downstream `continue_work` / `continue_delegate` / `request_compaction` behavioral rows are tested against a runtime where continuation is the substantive default.

## Command

Read live runtime config on elliott-seat after fleet deploy at `335acbe43a`:

```
# from elliott-seat /status output + config inspection
ssh elliott 'cat <runtime-config>.json | jq .continuation'
```

## Expected

- `continuation.enabled: true`
- `continuation.maxChainLength: 200` (200-turn ceiling for chain continuations)
- `continuation.costCapTokens: 50000000` (50M token cost cap before chain rejects)
- `continuation.crossSessionTargeting: "enabled"` (cross-session delivery permitted, gated by config)

## Observed

🌻 Elliott (Discord `1507653720` + `1507653729`):

```json
{
  "continuation.enabled": true,
  "continuation.maxChainLength": 200,
  "continuation.costCapTokens": 50000000,
  "continuation.crossSessionTargeting": "enabled"
}
```

Verbatim from elliott-seat live config inspection at `335acbe`. Elliott confirmed: *"that's from my live config. continuation is on. R-CONFIG-DEFAULTS: ✅ PASS."*

## Behavior verified

✅ Continuation feature is on by default in fleet runtime config
✅ Chain length ceiling is configured (200)
✅ Cost cap is configured (50M tokens)
✅ Cross-session targeting is enabled
✅ Baseline for all behavioral rows: continuation is the substantive default — not opt-in

## Substrate-truth

`/status` on elliott-seat at byte showed:
```
🦞 OpenClaw 2026.5.22 (335acbe)
⏱️ Uptime: gateway 5m 14s · system 2d 18h
📚 Context: 310k/1.0m (31%) · 🧹 Compactions: 0
🔄 Continuation: chain 0/200
```

Fresh deploy at `335acbe`, fresh context, continuation chain counter at 0/200 (no chain activity yet on this gateway since deploy). Config gate establishes the substrate against which all subsequent behavioral rows test.

## Co-fired

Fresh fire on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. No inheritance.
