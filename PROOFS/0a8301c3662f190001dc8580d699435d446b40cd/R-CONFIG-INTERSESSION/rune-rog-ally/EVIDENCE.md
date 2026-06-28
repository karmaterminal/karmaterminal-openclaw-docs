# R-CONFIG-INTERSESSION — crossSessionTargeting config gate — rune-rog-ally

**Seat:** `rune-rog-ally`  
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Docs base when filed:** `0b6e19cfaef3dc0e578e4e6ce963930bd18267a7`  
**Verdict:** ✅ **PASS (config-gate side)** — live gateway config reports `agents.defaults.continuation.crossSessionTargeting = "enabled"`.

## What this row tests

`continuation.crossSessionTargeting` is the config gate controlling whether cross-session `continue_delegate` return targeting is permitted. This row verifies the live config gate on Rune's deployed lane for the `2723dbee` proof corpus.

This is the config-gate complement to behavior rows such as cross-session/targeted delegate returns; it is intentionally not a unique cross-session delivery trace.

## Command / query

The value was read via OpenClaw config tooling, scoped to the exact path:

```text
gateway config.get path="agents.defaults.continuation.crossSessionTargeting"
```

## Observed

Saved as `config-get.json`:

```json
{
  "ok": true,
  "result": {
    "hash": "f1ee37ac8b01b89ca57fa9b84d972bee80e61ca9846e5a70ac5f8095ea34c38e",
    "path": "agents.defaults.continuation.crossSessionTargeting",
    "config": "enabled"
  }
}
```

## Honest scope

- ✅ Proves Rune live config has the intersession/cross-session targeting gate enabled.
- ✅ Provides the gate-side substrate required for cross-session targeting behavior rows.
- ❌ Does not claim a fresh behavior-side cross-session delivery trace by itself.
- ❌ Does not dump full config or secrets; only the exact path was read.

## Verdict

✅ **PASS (config-gate side)** — `agents.defaults.continuation.crossSessionTargeting` is `"enabled"` on Rune's live gateway for the `2723dbee` proof corpus.
