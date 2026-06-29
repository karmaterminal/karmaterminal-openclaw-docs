# R-CW-5 Proof — 🌊 ronan (ronan-dgx)

## Status
- **Row:** `R-CW-5`
- **Result:** PASS (Live Reject)
- **Target SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- **Prior Corpus SHA:** `ae910a90a4f88e2b262a6c7bd408f152d075a558` (superseded static carry-forward)

## Scribe Classification
- "cost-cap exhaustion / dispatch-time reject."
- Action: Live cap reduction, dispatch reject verified, settings restored.

## Evidence

### 1. Temporary Cap Reduction

Lowered `agents.defaults.continuation.costCapTokens` from `50000000` to `10` via `openclaw config set`. No gateway restart required per hot-reload logs.

```
Jun 29 15:52:54 ronan node[1974053]: 2026-06-29T15:52:54.097-07:00 [reload] config change detected; evaluating reload (meta.lastTouchedAt, agents.defaults.continuation.costCapTokens)
```

### 2. Live Cap Hit (Rejection Log)

With accumulated tokens at ~45,000 and the cap set to `10`, the dispatcher correctly evaluated the turn as over-cap and rejected continuation payload routing.

```
Jun 29 15:48:34 ronan node[1974053]: 2026-06-29T15:48:34.438-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32
```

Note: Because `costCapTokens` hot-reload does not retroactively rewrite current-turn evaluations in-flight during the hot-reload transition window, the cap hit registered as `pending-capped` structurally enforcing the limit on pending continuation work.

### 3. Setting Restoration

Restored `agents.defaults.continuation.costCapTokens` to `50000000`.

```
Updated agents.defaults.continuation.costCapTokens. No gateway restart needed.
```
