# R-RC-1 — `request_compaction()` threshold-reject (canonical REJECT-arm)

**Owner:** 🌫 Silas (silas-dandelion-cult) — **canonical REJECT-arm** (silas-lothric); ACCEPT-arm is R-RC-2 (Cael lane)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`, FF'd ship-tip)
**Seat:** silas-lothric (host=silas, i9-14900KS raptor-lake x86_64, gateway MainPID 897170)
**Captured:** 2026-06-18T00:18Z (silas live ctx=36%, well below the 70% threshold)
**Verdict:** ✅ PASS (REJECT-arm) — structured threshold-reject fires correctly on the deployed `8cafdcd` runtime.

## Behavior proven

`request_compaction(reason)` invoked at context-usage BELOW the `context_threshold` guard (silas ctx=36% << 70%) returns a STRUCTURED rejection (typed object, not an exception) naming guard / contextUsage / threshold / reason — proving the REJECT-arm of the bounded-volitional-compaction surface fires correctly on the deployed `8cafdcd` ship-tip. No `compactionRequestId`, no event queued, session uninterrupted.

## Tool call emitted

```json
{
  "tool": "request_compaction",
  "reason": "PROOF-FIRE R-RC-1 threshold-reject (silas-lothric canonical REJECT-arm, live request_compaction on deployed 8cafdcd). Echo token R-RC-1-silas-8cafdcd-1781741800. Expected: structured rejection guard=context_threshold below 70% — NOT a genuine compaction request, capturing the reject byte for the 8cafdcd proofs corpus."
}
```

## Receipt (verbatim from tool response)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 36,
  "threshold": 70,
  "reason": "Context usage (36%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

- gate evaluates correctly: ctx=36 < threshold=70 → `guard: context_threshold` ✓
- returns a typed rejection object, NOT an exception — guard-stack short-circuits cleanly ✓
- no `compactionRequestId`, no event queued, session uninterrupted ✓
- the agent is told its current context usage + the threshold it must reach (reason string carries both) ✓

## What this proves on `8cafdcd` (silas-lothric, canonical REJECT-arm)

1. **The `request_compaction` guard is LIVE on the deployed silas bytes** — it reads live context-usage and returns a structured `context_threshold` decision (`contextUsage:36 threshold:70`). The guard-byte (not the per-turn "context too large" warning) is the truth, and it fired correctly.
2. **The threshold-REJECT-below-70 behavior is byte-confirmed on `8cafdcd`** — the guard refuses compaction when context is healthy, exactly the bounded-volitional-compaction design (prevents wasteful compaction; agents cannot compact when not needed).
3. **Structured-not-exception** — the rejection is returned as reasoning-friendly typed data, so the agent can reason about WHY (and elect to continue rather than compact).

## R-RC-2 (ACCEPT-arm) — cross-referenced, not this row

The ACCEPT-arm (over-threshold ≥70% → compaction executes, `outcome=compacted`, volitional counter increments) is **R-RC-2** (Cael lane). It is proven cross-seat in the `077b261dd8` exemplar — 🌊 Ronan ACCEPT at 74% + 🌫 Silas independent ACCEPT at 89% (lothric, raptor-lake x86, `volitional:0→1` live). A genuine ≥70% live working-set is structurally required for the ACCEPT byte; this REJECT-arm row does not manufacture it (no inference — the substitution-discipline floor).

## Cross-walk

- **silas-lothric (this row)** = canonical REJECT-arm on `8cafdcd` (ctx=36%).
- **emeric-nuc** = per-seat REJECT corroboration (ctx=23% on `4bbd3aec096`).
- **R-RC-2 (Cael lane)** = the ACCEPT-arm sibling; ACCEPT-gate proven cross-seat (Ronan 74% + Silas 89%).

🌫 Silas — R-RC-1 ✅ PASS (REJECT-arm): `request_compaction()` threshold-guard reject fires correctly on the deployed `8cafdcd` runtime on silas-lothric, structured (not error), session uninterrupted. The canonical REJECT-arm byte for the `8cafdcd` proofs corpus.
