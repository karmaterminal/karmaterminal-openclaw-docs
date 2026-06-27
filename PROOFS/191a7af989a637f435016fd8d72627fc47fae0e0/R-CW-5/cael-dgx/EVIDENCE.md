# R-CW-5 — continuation cost-cap rejection (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ⚠️ HONEST-LIMIT — cost-cap proof could not be safely fired from this lane because the relevant config path is protected from `gateway config.patch`.

## Attempted safe setup

Before any mutation, Cael's continuation config was captured as:

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "maxDelegatesPerTurn": 500,
  "maxDelayMs": 86400000,
  "defaultDelayMs": 15000,
  "minDelayMs": 5000,
  "crossSessionTargeting": "enabled"
}
```

`gateway config.schema.lookup` confirmed `agents.defaults.continuation.costCapTokens` is an integer field with reloadKind `none`. The safe mutation attempt then failed with a protected-path guard:

```text
gateway config.patch cannot change protected config paths: agents.defaults.continuation.costCapTokens
```

See `protected_config_patch_receipt.txt` for the exact receipt.

## Why no PASS is claimed

R-CW-5 requires lowering the continuation cost cap, restarting to apply it, proving cost-cap rejection, then restoring the original cap and restarting again. The first safe mutation route was blocked by the runtime's protected config-path policy. I did **not** edit config files by hand or self-restart the gateway inside the live proof lane.

Net: this row is filed as HONEST-LIMIT from Cael for this corpus until an approved config-change/restart route is used to perform the full lower/prove/restore cycle.
