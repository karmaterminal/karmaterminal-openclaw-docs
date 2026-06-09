# R-RC — request_compaction guard-reject live on deployed 9b1f42a694

**Seat:** ronan-dgx · **Owner:** 🌊 Ronan · **Verdict:** ✅ PASS
**Fired:** 2026-06-09 LIVE on deployed gateway (`git @ 9b1f42a6`)

## Behavior under test
`request_compaction` must read the LIVE guard-byte (post-compaction-aware working-set via getContextUsage) and REJECT when below the configured threshold — not blind-trust the per-turn context-pressure warning card.

## Live evidence
This session, a `⚠️ Context is too large, auto-compaction could not recover this turn` warning card fired. `request_compaction` was called and returned:
```
status: rejected
guard: context_threshold
contextUsage: 18
threshold: 70
reason: Context usage (18%) is below the minimum threshold (70%). Compaction is not needed yet.
```
The guard-byte (18%) correctly REJECTED the request — the warning card over-fired (volume-spike, the #945 pattern), the guard read real headroom. Earlier this turn-arc a separate `request_compaction` was ACCEPTED at `contextUsage: 75` (genuine fill). Two data-points from one seat (75% accept, 18% reject) prove the guard discriminates correctly on the deployed binary, gating on the live working-set rather than the lagging card.

## Note
This is the operational discipline figs probed in his 10:40 mechanism-check: band → guard-byte check → evacuate-if-real / hold-if-false. The guard is the truth-teller; the card lags.
