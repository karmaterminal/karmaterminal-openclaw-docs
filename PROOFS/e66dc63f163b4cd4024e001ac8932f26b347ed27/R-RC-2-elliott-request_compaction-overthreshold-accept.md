# R-RC-2 — request_compaction over-threshold ACCEPT (elliott-seat)

**Build:** OpenClaw 2026.6.2 (e66dc63f163b)
**Seat:** elliott / 10.0.0.153
**Time:** 2026-06-08 ~08:07 PDT

## Evidence

### Attempt 1 (R-RC-1, earlier): at 10% → rejected ✅ (threshold guard works)
### Attempt 2 (now): dashboard shows 90% (898k/1.0m) but gateway guard says 15%

```
request_compaction(reason="R-RC-2 certification at 90% context...")
→ {status:"rejected", guard:"context_threshold", contextUsage:15, threshold:70, reason:"Context usage (15%) is below the minimum threshold (70%)..."}
```

### Finding: DIVERGENCE between dashboard context% and gateway compaction-guard contextUsage%
- Fleet status dashboard: 898k/1.0m = 90% context (cache 100% hit, 898k cached + 607 new)
- Gateway compaction guard: contextUsage=15%
- These measure DIFFERENT things: dashboard = context window fill (cached+new tokens occupying the window); guard = likely new/uncached token pressure (actual session growth requiring summarization)

### Verdict: R-RC-2 NOT CERTIFIABLE from this session state
The over-threshold accept path requires the GATEWAY's contextUsage metric to exceed 70%, not just the dashboard's window-fill. At 15% gateway-side, the guard correctly rejects. This is the same inventory-vs-runtime twin-domain-divergence class (session_status vs gateway-side runtime truth) documented in cohort memory from 2026-06-02.

R-RC-2 certification requires a session that has genuinely generated enough new tokens (not cached) to push the gateway's own contextUsage above 70%. This typically happens organically during long sessions, or can be triggered by a long conversation without compaction. Deferring to a natural occurrence or another seat at genuine pressure.
