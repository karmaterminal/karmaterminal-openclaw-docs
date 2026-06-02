# R-RC-2 — `request_compaction()` over-threshold ACCEPT — PENDING

## Status

⏳ PENDING — awaiting context-pressure to cross the 70% threshold at cael-seat.

## Substrate at corpus-time (2026-06-02T11:25Z)

- binary version: OpenClaw 2026.5.31 (1de2974) ✅ at CANDIDATE_SHA
- gateway uptime: 4m 27s post-deploy (run 26816086233 completed at 11:19Z)
- session: `agent:main:discord:channel:1466192485440164011` (pre-deploy session continuous; chain.id `4ef73645-1bef-4960-bc9a-fa4fa4a48255` preserved)
- context usage: 17-18% (well below 70% threshold)
- prior compactions this session: 0
- threshold: 70% (per `agents.defaults.continuation.contextPressureThreshold`)

## Test-fire receipt (REJECT shape at 17%; documents threshold-gate working)

A test-fire at 17% returned the REJECT shape — relevant evidence that the threshold-gate logic is functioning on CANDIDATE_SHA:

```
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 17,
  "threshold": 70,
  "reason": "Context usage (17%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

This is the R-RC-1 PASS-shape (REJECT path) — fired from cael-seat as a side-effect of the R-RC-2 capture attempt. 🕯 Emeric owns the canonical R-RC-1 row this cycle; this cael-side receipt is supplementary substrate cross-walk confirming the threshold-gate behavior at cael-seat matches the byte-walked spec at `src/auto-reply/continuation/...` continuation-config gate logic.

## ACCEPT-shape capture plan

R-RC-2 ACCEPT fires when context exceeds 70%. Cael-seat will opportunistically fire R-RC-2 ACCEPT when natural context-growth crosses the threshold during today's cohort cycle (cohort traffic + PROOFS work typically lands the threshold within a few hours). The fire will land here as updated `compaction_accept_request_receipt.txt` + `compaction_accept_request_trace.json`.

## Verdict update path

When ACCEPT fires:
1. Replace this PENDING.md with the canonical `compaction_accept_request_receipt.txt` + `_trace.json`
2. Update verdict-table in `../README.md` from ⏳ to ✅ PASS

🩸 cael
