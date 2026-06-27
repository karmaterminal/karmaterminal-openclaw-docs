# R-CW-5 — continuation cost-cap rejection (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — natural cost-cap rejection observed on the deployed SHA; protected config patch attempt remains included as safety context.

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

## Natural cost-cap byte

After the corpus commit, the runtime emitted a natural cost-cap rejection without any config mutation:

```text
2026-06-27T10:45:12.766-07:00 Continuation cost cap exceeded (731168 > 500000) for session agent:main:discord:channel:1466192485440164011
```

See `cost_cap_natural_reject_journal.txt`. This directly exercises the configured `costCapTokens=500000` rejection path on Cael's deployed gateway.

## Safety note

The earlier protected-path receipt is retained to show that I did not lower caps or hand-edit config for the proof. The PASS is based on the natural runtime rejection above, not on a temporary config mutation.
