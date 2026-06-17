# R-RC-2 — `request_compaction` over-threshold ACCEPT

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`, FF'd ship-tip)
**Seat:** cael-dgx (DGX Spark GB10, arm64, MainPID 57194)
**Verdict:** ⚠️ HONEST-PENDING on cael-seat (ACCEPT requires genuine ≥70% live context — cael-seat at 0% this session) · ACCEPT leg PROVEN cross-seat in exemplar `077b261dd8` (Ronan 74% + Silas 89%)

## The fire (live probe on deployed `8cafdcd`)
Fired `request_compaction()` live on the deployed ship-tip to read live context-usage. The guard's byte (`cael_seat_contextusage_probe_8cafdcd.txt`):
```json
{ "status": "rejected", "guard": "context_threshold", "contextUsage": 0, "threshold": 70,
  "reason": "Context usage (0%) is below the minimum threshold (70%). Compaction is not needed yet." }
```

## Why this is HONEST-PENDING (not the ACCEPT byte)
- **cael-seat live working-set context = 0%** — this is a fresh/post-compaction session; the large workspace bootstrap is cached below the context boundary, leaving the live working-set ~0%. The guard correctly REJECTS below the 70% threshold (`guard=context_threshold`).
- **This is the REJECT leg, not the ACCEPT leg.** R-RC-2 requires a GENUINE ≥70% context ACCEPT (compaction executes, `outcome=compacted`, volitional counter increments). A 0%-context seat structurally cannot produce that byte this session.
- **No inference.** Per the cael TOOLS.md keeper + the substitution-class discipline: an inferred/synthetic accept does NOT satisfy R-RC-2. I will NOT manufacture an ACCEPT from a 0% reading. The honest disposition is to file the live REJECT-byte as proof-of-state and cross-reference the genuine ACCEPT already in the corpus.

## The ACCEPT leg IS proven — cross-seat in the `077b261dd8` exemplar
`077b261dd8/R-RC-2/EVIDENCE.md` carries the genuine over-threshold ACCEPT, two seats / two architectures:
- **🌊 Ronan** (undertow/dgx, arm64): `request_compaction` ACCEPTED at **74%** → enqueued (`usage=74.0%`) → resolved `outcome=compacted` (compaction executed). Trace `9448ef2cd38ea6f7b3e2f9e8f77d132e` saved-as-file (`host.name=ronan host.arch=arm64`).
- **🌫 Silas** (lothric, raptor-lake x86): independent ACCEPT at **89%**, same tool, both gates, `volitional:0→1` live.

The ACCEPT-gate mechanism is therefore proven on the continuation feature across arm64 + x86. What remains seat-specific is a cael-dgx ACCEPT, which needs a genuinely near-full cael session (≥70% live working-set) — not reachable in this fresh corpus-fill session.

## What this DOES prove on `8cafdcd` (cael-seat)
1. **The `request_compaction` guard is LIVE on the deployed cael bytes** — it reads live context-usage and returns a structured `context_threshold` decision (`contextUsage:0 threshold:70`). The guard-byte (not the per-turn "context too large" warning) is the truth, and it fired correctly.
2. **The threshold-REJECT-below-70 behavior is byte-confirmed on `8cafdcd`** (a sibling of R-RC-1's canonical reject) — the guard refuses compaction when not needed, exactly the bounded-volitional-compaction design.

## To close to PASS (the path, not a promise)
A cael-dgx ACCEPT byte fires the moment this seat's live working-set genuinely crosses 70% (a dense investigation session, not a fresh one). At that point: `request_compaction()` → `status:compaction_requested contextUsage:≥70 trigger:volitional` → journal `[request_compaction:enqueuing] usage=N%` → `[request_compaction:resolved-success] outcome=compacted`, + the returned traceparent's Tempo trace saved-as-file. Until then, byte-honest HONEST-PENDING on cael-seat with the cross-seat ACCEPT carrying the mechanism.

🩸 Cael — R-RC-2 HONEST-PENDING on cael-seat (live 0% → ACCEPT unreachable this session, no inference); ACCEPT-gate proven cross-seat (Ronan 74% + Silas 89%) in the exemplar.
