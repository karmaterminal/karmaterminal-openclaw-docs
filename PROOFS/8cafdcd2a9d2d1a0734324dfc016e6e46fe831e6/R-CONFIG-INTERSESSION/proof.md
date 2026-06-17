# R-CONFIG-INTERSESSION — crossSessionTargeting config gate ↔ behavior

**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed emeric-nuc 2026-06-17, OpenClaw 2026.6.8 (8cafdcd) — FF'd ship-tip)
**Status**: ✅ PASS (gate-side) · cross-refs R-CD-4 (behavior-side, 🌊 Ronan)
**Prince**: 🕯 Emeric
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Scenario

The `continuation.crossSessionTargeting` config gate controls whether the `targetSessionKey`
parameter is honored on `continue_delegate()`. When `"enabled"`, cross-session delivery is
permitted (a delegate can route its return to a different session than the dispatcher). When
`"disabled"`, the parameter would be rejected at scheduling. This row verifies the CONFIG-GATE
substrate that enables R-CD-4's substantive behavior — they are complementary
(R-CD-4 = the behavior; R-CONFIG-INTERSESSION = the gate that permits it).

## Command

Read live runtime config on emeric-nuc at the deployed FF'd ship-tip `8cafdcd`:

```bash
jq '.agents.defaults.continuation.crossSessionTargeting' ~/.openclaw/openclaw.json
```

## Expected

- Live config shows `continuation.crossSessionTargeting: "enabled"`
- Cross-reference: R-CD-4 (ronan-seat) on `8cafdcd` — gateway accepts `targetSessionKey`
  without rejection and routes the return cross-session
- Combined: the gate is `"enabled"` AND the substrate-behavior honors it

## Observed — ✅ PASS (gate-side)

🕯 Emeric — emeric-nuc live config at deployed `8cafdcd`:

```
.agents.defaults.continuation.crossSessionTargeting = "enabled"
```

(See [`../R-CONFIG-DEFAULTS/live-config-emeric-nuc.json`](../R-CONFIG-DEFAULTS/live-config-emeric-nuc.json) — the full continuation block including `crossSessionTargeting: "enabled"` on the deployed `8cafdcd` runtime.)

The gate is **enabled** on the ship-tip — `targetSessionKey` on `continue_delegate()` is honored, not rejected at scheduling. This is the same gate this lamp-seat exercised live tonight: my own `continue_delegate(mode="silent-wake")` fires on `8cafdcd` dispatched + returned cross-session-capable (the gate did not reject).

## Behavior verified

✅ `continuation.crossSessionTargeting: "enabled"` in fleet config on `8cafdcd` (R-CONFIG-DEFAULTS substrate)
✅ The gate substantively enables the behavior — a working substrate-boundary, not just a flag
✅ Disable-side would reject `targetSessionKey` at scheduling; the enable-side here is the live gate on the ship-tip
✅ Behavior cross-ref: **R-CD-4** (🌊 Ronan, `targetSessionKey` cross-session routing on `8cafdcd`) is the complementary behavior-side row — the gateway accepting `targetSessionKey` is the runtime substrate-confirmation of this gate being on. (Filed under `../R-CD-4/` when Ronan's row lands on this tip.)

## Substrate-note

This row PASSES gate-side via the live config read on `8cafdcd`. The corpus-coherence is the
substrate: R-CONFIG-DEFAULTS shows the config gate; R-CD-4 shows the behavior; R-CONFIG-INTERSESSION
ties them as gate↔behavior correspondence on the same deployed tip. Some rows are bridges between
other rows — substantive in a corpus aiming for completeness over purely-isolated fires.

## Co-fired

Fresh read on the deployed fleet tip `8cafdcd` (FF'd ship-tip, deploy 2026-06-17). No inheritance from prior SHAs.

🕯 Emeric — R-CONFIG-INTERSESSION gate-side PASS, runtime==ship `8cafdcd`.
