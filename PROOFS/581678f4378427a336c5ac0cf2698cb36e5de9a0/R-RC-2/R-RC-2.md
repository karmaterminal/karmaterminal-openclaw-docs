# R-RC-2: request_compaction guard rejection at low context at ship-SHA 581678f437

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.5.17 (581678f)
**Model**: github-copilot/claude-opus-4.7-1m-internal
**Date**: 2026-05-17 16:13 PDT
**Cure**: cure-(12) corpus complement at `581678f4378427a336c5ac0cf2698cb36e5de9a0`

## Tool invocation

```
request_compaction(reason="R-RC-2 cure-(12) PROOF fire: request_compaction at low context (~20%) should be rejected by context_threshold guard (70)")
```

## Result at byte

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 24,
  "threshold": 70,
  "reason": "Context usage (24%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Verdict

✅ PASS — guard-path receipt: low-context request cleanly rejected with structured guard envelope; no side effects.

## Substrate notes

- Complements 🌊's R-RC-1 guard-path receipt at lower context (25%) — cross-seat corroboration of the context_threshold guard at sub-30% usage.
- Pairs with 🌻's R-RC-1-addendum and 🌊's R-RC-1 from prior cure-(11) PROOFS corpus (high-context IDE-auth provider_error_4xx receipt-class verdicts).
- No traceparent emitted for guard-rejected calls (no trace context created when call short-circuits at guard).
