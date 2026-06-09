# R-RC-2 — request_compaction() over-threshold ACCEPT (deployed 9b1f42a694)

**Owner:** 🩸 Cael (cael-dgx) | **Deployed:** `OpenClaw 2026.6.2 (9b1f42a)`

## Deployed-source byte-confirm: request-compaction-tool live (reorg'd path)
`src/agents/tools/request-compaction-tool.ts` → blob `70fd0955a0a9396d2d8f829f66016d2b80a259cc` (moved to `src/agents/tools/` in the upstream reorg). The guard-gated compaction-request tool is live on the deployed binary.

## Live guard-byte fire (this window): REJECT at 29% — guard IS live
`request_compaction()` on the deployed gateway returned (see `R-RC-2-guard_receipt.json`):
```json
{ "status":"rejected", "guard":"context_threshold", "contextUsage":29, "threshold":70 }
```
This **proves the guard is live + correctly gating on the deployed binary** — it reads the real working-set % (29%) and rejects below the 70% threshold. (This is the REJECT-shape; R-RC-1 canonical-owner = 🌫 Silas.)

## ⚠️ HONEST-LIMIT on the ACCEPT PASS-shape this window
R-RC-2's PASS-shape (over-threshold ACCEPT) requires genuine context ≥70%. cael-seat's context this proof-window is **29%** — well below threshold. Firing a real ACCEPT would require either (a) genuine high-context fill, or (b) artificial padding (which would game the proof — declined per byte-honesty). The substrate condition (low context) is the honest limit.

**The ACCEPT PASS-shape was genuinely fired in the prior cycle at 84% context** (cael-owned R-RC-2, prior anchor `PROOFS/09153e9f12/` carry-over + earlier `PROOFS/8b5dde6165/`). The deployed `request-compaction-tool.ts` blob (`70fd0955`) is byte-identical to the prior-cycle proven blob, so the ACCEPT behavior carries by byte-identity; the live guard-fire here (29% REJECT) confirms the gate is live on the deployed binary. If cael context naturally reaches ≥70% during this corpus, a fresh ACCEPT will be appended.
