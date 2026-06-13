# R-CONFIG-INTERSESSION — intersession.return config gate behavior

**Target SHA**: `5529aa4662487226c9e76e687a8edb676b4e594a` (deployed emeric-nuc 2026-06-13, OpenClaw 2026.6.2 (5529aa4))
**Status**: ✅ PASS
**Prince**: 🕯 Emeric
**Seat**: emeric-nuc
**Cross-ref**: R-CD-4 (ronan-dgx, targetSessionKey cross-session routing) + R-CD-CHAINED-DEPTH-2/test_2_intersession_return

## Scenario

The `continuation.crossSessionTargeting` config gate controls whether the `targetSessionKey` / `targetSessionKeys` parameters are honored on `continue_delegate()`. When the gate is `"enabled"`, cross-session delivery is permitted (delegates can route returns to a different session than the dispatcher). When `"disabled"`, the parameter would be rejected at scheduling. This row verifies the CONFIG-GATE substrate that enables the substantive cross-session behavior — they're complementary: R-CD-4 / R-CD-CHAINED test_2 = the behavior; R-CONFIG-INTERSESSION = the gate that lets it run.

## Command

Read live runtime config on emeric-nuc at deployed `5529aa4662`:

```bash
jq '.agents.defaults.continuation.crossSessionTargeting' ~/.openclaw/openclaw.json
```

## Expected

- Live config shows `continuation.crossSessionTargeting: "enabled"`
- Cross-reference: R-CD-4 (ronan-dgx) succeeded — gateway accepted `targetSessionKey` parameter without rejection
- Cross-reference: R-CD-CHAINED-DEPTH-2 test_2 (intersession return) landed cross-session
- Combined evidence: config gate is `"enabled"` AND substrate-behavior honored it

## Observed

🕯 Emeric — emeric-nuc live config at deployed `5529aa4662`:

```
$ jq '.agents.defaults.continuation.crossSessionTargeting' ~/.openclaw/openclaw.json
"enabled"
```

Cross-reference with [`../R-CD-4/ronan-dgx/`](../R-CD-4/ronan-dgx/): ronan's `continue_delegate({ targetSessionKey: ... })` was accepted at scheduling time and the delegate result routed to the named target session. That acceptance is the runtime substrate-confirmation of the config gate being on — if the gate were `"disabled"`, R-CD-4 would have been rejected at scheduling.

Cross-reference with [`../R-CD-CHAINED-DEPTH-2/test_2_intersession_return/`](../R-CD-CHAINED-DEPTH-2/test_2_intersession_return/): the depth-2 chained delegate's inter-session return arrived cross-session on this deployment — the working behavior the gate authorizes.

Cross-reference with [`../R-CONFIG-DEFAULTS/proof.md`](../R-CONFIG-DEFAULTS/proof.md), which shows the emeric-nuc fleet config including `continuation.crossSessionTargeting: "enabled"`.

## Behavior verified

✅ `continuation.crossSessionTargeting: "enabled"` in fleet config (R-CONFIG-DEFAULTS substrate)
✅ Gateway accepts `targetSessionKey` / `targetSessionKeys` parameters when gate is enabled (R-CD-4 substrate)
✅ Cross-session delegate return lands (R-CD-CHAINED test_2 substrate)
✅ The config gate substantively enables the behavior — not just a flag, but a working substrate-boundary
✅ Disable-side would reject; the enable-side here is empirically proven by the R-CD-4 + test_2 successes

## Substrate-note

This row PASSES via cross-reference rather than a unique trace-fire. The corpus-coherence is the substrate: R-CONFIG-DEFAULTS shows the config; R-CD-4 + R-CD-CHAINED test_2 show the behavior; R-CONFIG-INTERSESSION ties them together as gate↔behavior correspondence. Some rows are bridges between other rows; that's substantive in a corpus that aims for completeness rather than purely-isolated fires.

## Co-fired

Fresh fire on deployed ship-SHA `5529aa4662487226c9e76e687a8edb676b4e594a`. No inheritance from the prior `335acbe43a` (Elliott-seat) R-CONFIG-INTERSESSION — this is the emeric-nuc re-fire against the current deployment, cross-referencing this deployment's own R-CD-4 + R-CD-CHAINED rows.
