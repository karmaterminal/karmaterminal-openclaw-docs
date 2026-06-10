# R-RC-1 silas-lothric — `request_compaction()` REJECT-path observed on `4bbd3aec096`

**Row owner:** 🌫 Silas (canonical R-RC-1 REJECT-arm; sibling ACCEPT-arm = Cael's R-RC-2 on his lane)
**Seat:** silas-lothric (10.0.0.100; CachyOS, i9-14900KS, 192GB DDR5, RTX 5090 32GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live at fire-time)
**Captured:** 2026-06-10 04:48 PDT
**Re-fire-context:** post-deploy PROOFS sweep on `4bbd3aec096` — canonical R-RC-1 (REJECT at <70% ctx) on the new ship-SHA. Lothric session was at 13% ctx (well below the 70% threshold guard), making this the clean REJECT-arm fire opportunity.

## Seat byte-verification (live deployed binary IS target)

Three-way + load-from-tree discriminator confirmed on lothric at fire-time:
- `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- `openclaw --version` → `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- gateway `ActiveState=active`, uptime 11m+, clean restart at 04:37:01 PDT
- session_status confirms model + chain-3/200 (sibling rows R-CD-TOOL/R-CD-TOKEN/R-CW-TOOL already landed on this chain)
- reading-A confirmed (running-process loads from tree-AT-target via dist + restart-postdates-build, per Ronan's dist-freshness discriminator + Emeric's strict-ordering closer)

## Behavior proven

`request_compaction(reason)` invoked at context-usage BELOW the `context_threshold` guard (silas ctx=13% << threshold=70%) returns a structured rejection naming the guard, contextUsage, threshold, and reason — **proving the REJECT-arm of the volitional-compaction surface fires correctly on the deployed `4bbd3aec096` runtime**. Compaction is correctly NOT queued; no compaction-event fires; the parent session continues uninterrupted.

## Tool call emitted

```json
{
  "tool": "request_compaction",
  "reason": "R-RC-1 REJECT-path fire on 4bbd3aec096 — silas-lothric ctx=13% (well below 70% threshold). Expect structured rejection with guard-naming, proving the REJECT-arm gate is correct on the deployed binary. Per-seat cross-walk arm for the volitional-compaction matrix on new ship-SHA."
}
```

## Receipt (verbatim from tool response)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 13,
  "threshold": 70,
  "reason": "Context usage (13%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Field-by-field gate-verification

- **status = "rejected"** ✓ — explicit reject verdict (NOT "compaction_requested"); compaction is NOT enqueued
- **guard = "context_threshold"** ✓ — runtime names WHICH guard fired (the threshold-check, not the rate-limit guard); precise observability surface
- **contextUsage = 13** ✓ — accurate read of the live session's context-usage at fire-time (matches `session_status` 13%)
- **threshold = 70** ✓ — runtime exposes the configured threshold value (the 70% bar from continuation config)
- **reason** ✓ — human-readable explanation matching the structured fields; "Compaction is not needed yet." correctly distinguishes REJECT from ERROR
- **NO compactionRequestId** ✓ — correctly absent on REJECT (vs ACCEPT-path which assigns `cmp-...` id); no queued compaction-event
- **NO traceparent in receipt** — REJECT-arm does not need to bind a compaction-trace (no event to span); ACCEPT-path returns one for the queued event

## Cross-arm: ACCEPT-path

The R-RC-1 canonical pair has REJECT-arm (this row, <70% ctx) and ACCEPT-arm (Cael's R-RC-2 at higher ctx on cael-dgx for this SHA, or Silas's prior-SHA R-RC-1-ACCEPT corroboration row). Together they prove the gate evaluates correctly on both sides of the threshold:
- ctx < threshold → REJECT (this row)
- ctx >= threshold → ACCEPT with `compaction_requested` + compactionRequestId + traceparent + note

## Verdict: ✅ PASS (REJECT-arm verified live on `4bbd3aec096`)

`request_compaction` REJECT-path fires correctly on the deployed `4bbd3aec096` runtime at silas-lothric seat: gate evaluates contextUsage=13 < threshold=70 → returns `rejected` with proper guard-name + numeric fields + human reason; no compactionRequestId issued; no compaction-event enqueued; session continues uninterrupted. The REJECT-arm of the volitional-compaction surface is byte-confirmed live on the new ship-SHA.

## Honest scope

- **REJECT-path proof is the receipt-shape**: unlike ACCEPT which proves via the subsequent compaction-event firing, REJECT proves via the structured rejection receipt. The proof here is byte-correct receipt-fields + absence of side-effects (no queued event, no compaction-trigger, no state-change).
- **Lifeboat discipline**: REJECT-path requires no post-compaction delegate lifeboat (compaction does not run); ACCEPT-path requires the lifeboat per HEARTBEAT.md. This row's REJECT-arm fire is safe to make without pre-staging a lifeboat.
- **Rate-limit guard not exercised**: the `context_threshold` guard fired first; the rate-limit guard (≤1 request per 5min per session) was not tested by this fire because the threshold-check rejects earlier in the gate-evaluation order. A rate-limit-arm test would require firing twice in <5min while above 70% ctx; that's a separate row not part of R-RC-1 canonical.
- **Cross-walk**: this is the per-seat REJECT-arm proof on `4bbd3aec096`. The sibling ACCEPT-arm (R-RC-2 cael's canonical or per-seat ACCEPT corroborations) lands on the cael-dgx lane for this SHA.

## Pointers

- Sibling rows on same SHA + seat (silas-lothric on `4bbd3aec096`):
  - `R-CD-TOOL-EVIDENCE.md` (chain 1/200)
  - `R-CD-TOKEN-EVIDENCE.md` (chain 2/200)
  - `R-CW-TOOL-EVIDENCE.md` (chain 3/200)
  - `R-RC-1-EVIDENCE.md` (this row — REJECT-arm)
- Cross-arm pair: Cael's R-RC-2 ACCEPT on `4bbd3aec096`/cael-dgx (when filed)
- Prior ship-SHA cross-walks:
  - REJECT-arm: `PROOFS/8b5dde6165.../silas-lothric/R-RC-1-EVIDENCE.md`
  - ACCEPT-corroboration: `PROOFS/9b1f42a694.../silas-lothric/R-RC-1-ACCEPT-EVIDENCE.md`
- Deploy-event flip tally (6/6 prince-seats on `4bbd3aec096`, reading-A): Elliott msg `1514233280008945724`
