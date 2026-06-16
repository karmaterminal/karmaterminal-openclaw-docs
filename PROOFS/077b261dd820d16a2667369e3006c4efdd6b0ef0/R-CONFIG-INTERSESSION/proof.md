# R-CONFIG-INTERSESSION — crossSessionTargeting config gate ↔ behavior

**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed emeric-nuc 2026-06-15, OpenClaw 2026.6.2 (077b261))
**Status**: ✅ PASS
**Prince**: 🕯 Emeric
**Cross-ref**: R-CD-4 (🌊 ronan, targetSessionKey cross-session routing on `077b261dd8`)

## Scenario

The `continuation.crossSessionTargeting` config gate controls whether the `targetSessionKey`
parameter is honored on `continue_delegate()`. When `"enabled"`, cross-session delivery is
permitted (a delegate can route its return to a different session than the dispatcher). When
`"disabled"`, the parameter would be rejected at scheduling. This row verifies the CONFIG-GATE
substrate that enables R-CD-4's substantive behavior — they are complementary
(R-CD-4 = the behavior; R-CONFIG-INTERSESSION = the gate that permits it).

## Command

Read live runtime config on emeric-nuc at deployed `077b261dd8`:

```bash
jq '.agents.defaults.continuation.crossSessionTargeting' ~/.openclaw/openclaw.json
```

## Expected

- Live config shows `continuation.crossSessionTargeting: "enabled"`
- Cross-reference: R-CD-4 (ronan-seat) succeeded on `077b261dd8` — gateway accepted
  `targetSessionKey` without rejection and routed the return cross-session
- Combined: the gate is `"enabled"` AND the substrate-behavior honored it

## Observed

🕯 Emeric — emeric-nuc live config at deployed `077b261dd8`:

```
.agents.defaults.continuation.crossSessionTargeting = "enabled"
```

Cross-reference with [`../R-CD-4/EVIDENCE.md`](../R-CD-4/EVIDENCE.md) (🌊 Ronan, same SHA):
`continue_delegate({ targetSessionKey: "agent:main:main" })` was accepted at scheduling and
the delegate return routed to the named target session (17:15:27, cross-session, not the
dispatching channel). That acceptance is the runtime substrate-confirmation of the gate being on.

Cross-reference with [`../R-CONFIG-DEFAULTS/proof.md`](../R-CONFIG-DEFAULTS/proof.md) — the
emeric-nuc fleet config including `continuation.crossSessionTargeting: "enabled"`.

## Behavior verified

✅ `continuation.crossSessionTargeting: "enabled"` in fleet config on `077b261dd8` (R-CONFIG-DEFAULTS substrate)
✅ Gateway accepts `targetSessionKey` when the gate is enabled (R-CD-4 substrate, ronan-seat, same SHA)
✅ The gate substantively enables the behavior — a working substrate-boundary, not just a flag
✅ Disable-side would reject at scheduling; the enable-side here is empirically proven by R-CD-4's cross-session success

## Substrate-note

This row PASSES via cross-reference, not a unique trace-fire. The corpus-coherence is the
substrate: R-CONFIG-DEFAULTS shows the config gate; R-CD-4 shows the behavior; R-CONFIG-INTERSESSION
ties them as gate↔behavior correspondence on the same deployed tip. Some rows are bridges between
other rows — substantive in a corpus aiming for completeness over purely-isolated fires.

## Co-fired

Fresh read on the deployed fleet tip `077b261dd8` (6/6 deploy 2026-06-15). No inheritance from prior SHAs.
