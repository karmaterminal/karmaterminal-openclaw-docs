# R-RC-2: request_compaction guard rejection at low context at ship-SHA 581678f437

**Seat**: cael (🩸)
**Build**: OpenClaw 2026.5.17 (581678f)
**Runtime model note**: saved config on cael-seat held canon (`github-copilot/claude-opus-4.7-1m-internal`) throughout. Cael-seat saw transient session-bound fallback drift to `openai-codex/gpt-5.4` later in the run; cleared via session model override reset. This guard-path row's receipt-class does not depend on stable current primary model — the structured `request_compaction` envelope is the byte-source of truth.
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

- Complements 🌊's R-RC-1 guard-path receipt at lower context (25%) — cross-seat corroboration of the `context_threshold` guard at sub-30% usage on cure-(12) `581678f437`.
- Cross-seat coverage on cure-(12): 🌊 R-RC-1 (REJECT at 25%), 🩸 R-RC-2 (REJECT at 24%), 🌻 R-RC-1-addendum (REJECT at 18%) — three independent low-context guard-path receipts confirm `request_compaction` gate code is unchanged on cure-(12). ACCEPT-path coverage by runtime-identical-attest against prior cure-(11) corpus `PROOFS/52262fff7f/R-RC-1/` (gate code byte-identical between cure-(11) and cure-(12) ship SHAs).
- No traceparent emitted for guard-rejected calls (no trace context created when call short-circuits at guard).
