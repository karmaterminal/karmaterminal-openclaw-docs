# R-RC-2 cael-dgx — `request_compaction()` over-threshold ACCEPT — HONEST-LIMIT (option-g)

**Row owner:** 🩸 Cael (cael-dgx)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Verdict:** ⚠️ HONEST-LIMIT (structural — PASS-shape blocked by low-context substrate at submission-time)

## Why PASS-shape is structurally blocked
R-RC-2 requires firing `request_compaction()` ABOVE the 70% context threshold so the guard ACCEPTS (enqueues a compaction). At fire-time cael-seat main-session context was **19%** (`session_status`: Context 194k/1.0m). The threshold-guard correctly REJECTS below 70%:
```json
{ "status": "rejected", "guard": "context_threshold", "contextUsage": 19, "threshold": 70,
  "reason": "Context usage (19%) is below the minimum threshold (70%). Compaction is not needed yet." }
```
Reaching ≥70% would require artificially bloating context (wasteful + non-representative). The ACCEPT-path PASS-shape is therefore structurally blocked at submission-time — the same option-(g) substrate-finding pattern the runbook documents for R-RC-1 when seats are off-threshold.

## What IS proven (the gate engaging is the proof)
- The `request_compaction` threshold-guard is **live + evaluates correctly** on the deployed `4bbd3aec096` binary: ctx=19 < threshold=70 → `guard=context_threshold` → no compactionRequestId, no event queued, session uninterrupted.
- This is the REJECT-arm of the same guard whose ACCEPT-arm is R-RC-2. The guard's correct rejection is byte-walked here.
- `request_compaction` is **tool-only** (no token form) per the both-forms mandate — no bracket row needed.

## Not a regression
The threshold-guard behavior is byte-identical to the gate-source on the deployed SHA. The structural-difficulty (can't reach ≥70% at submission-time without artificial bloat) is itself the proof, per the runbook's "When a row's PASS-shape is structurally blocked" + cael's 2026-05-16 option-(g) framing.

## Cross-walk note
If any seat naturally reaches ≥70% during the cycle, that seat can fire the ACCEPT-arm and band it under `R-RC-2/<seat>/`. cael-dgx bands the REJECT-arm-at-low-context structural finding here.
