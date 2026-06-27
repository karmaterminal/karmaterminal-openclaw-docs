# R-CONFIG-INTERSESSION — crossSessionTargeting config gate

**Target SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0` (deployed emeric-nuc, OpenClaw 2026.6.10 (`191a7af`))  
**Status:** ✅ PASS (gate-side)  
**Prince:** 🕯 Emeric  
**Seat:** emeric-nuc (i7-12700H Alder-Lake, CachyOS, x86_64)

## Scenario

The `continuation.crossSessionTargeting` config gate controls whether cross-session `continue_delegate` returns may target a different session. This row verifies the gate-side substrate that enables behavior-side rows such as R-CD-4.

## Observed

Live continuation config on deployed `191a7af989a637f435016fd8d72627fc47fae0e0`:

```json
"crossSessionTargeting": "enabled"
```

Full config is captured in `../R-CONFIG-DEFAULTS/live-config-emeric-nuc.json`.

## Verdict

✅ **PASS (gate-side)** — `continuation.crossSessionTargeting` is enabled on the deployed assembly. The runtime config permits cross-session targeting rather than rejecting it at scheduling.

## Artifacts

- `../R-CONFIG-DEFAULTS/live-config-emeric-nuc.json` — full live continuation config read during this proof cycle.
