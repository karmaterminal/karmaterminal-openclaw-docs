# R-RC-2 — request_compaction ACCEPT-path (>70% ctx) — ✅ PASS

**Row owner:** 🪨 rune (self-fired on rune-seat — the held-physical row, finally takeable because rune reached >70% ctx)
**Seat:** rune (ROG Ally Z1 Extreme RC71L), host=rune
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (`openclaw --version` = `OpenClaw 2026.6.2 (2807efc)`)
**Verified:** 2026-06-05 ~16:57 PDT (per figs directive: BOTH reject AND accept paths = complete behavioral proof)

## Behavior proven
`request_compaction` is **ACCEPTED** when context usage is **≥70%** — the volitional-compaction accept-path of the context-threshold guard fires as designed. This is the complementary half to R-RC-1 (REJECT at <70%): together they prove the full gate behavior — rejects below threshold, accepts at/above it.

## Why this row was "held-physical" until now
R-RC-2 genuinely could not be faked: it requires a **live seat actually above 70% context on a main turn** — not an allocation/owner gap, a real substrate-state requirement. No deployed seat was >70% on a main turn earlier (cael ~56%, silas ~37%, all REJECT-side → R-RC-1). rune reached **80% ctx** (800k/1.0m) after a long main-session day, crossing the threshold, making the accept-path live-capturable for the first time.

## Receipt (request_compaction tool return, on-SHA, host=rune)
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mq1m28hj-YvoHAA",
  "trigger": "volitional",
  "contextUsage": 80,
  "traceparent": "00-dea80c410aa9fdbaf5615e0d8a0054bc-35b4b0c8b3e7acbf-01"
}
```
- **`contextUsage: 80`** — above the 70% threshold ✓
- **`status: compaction_requested`** — ACCEPTED (not rejected) ✓ — contrast R-RC-1 where <70% → rejected by context_threshold guard
- **`trigger: volitional`** — the elective/accept path (vs forced) ✓
- Real fire, real state: rune was genuinely at 80% (forced-compaction territory), elected the seam volitionally + captured the accept as the proof. Paired post-compaction lifeboat staged (same traceparent) — the fire served both the proof AND rune's continuity.

## Gate guard (on-SHA source)
The accept/reject decision is the context-threshold guard in the request_compaction handler: reject when `contextUsage < threshold` (R-RC-1, 37%<70%), accept (enqueue compaction) when `contextUsage >= threshold` (R-RC-2, 80%≥70%). Both arms now byte-proven on `2807efc`.

**Status: ✅ PASS — R-RC-2 accept-path captured at 80% ctx, host=rune. The held-physical row is no longer held. With R-RC-1 (reject), the compaction-threshold gate is now FULLY proven both directions (figs's BOTH-paths directive satisfied).**
