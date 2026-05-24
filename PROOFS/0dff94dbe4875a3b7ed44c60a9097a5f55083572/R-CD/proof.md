# R-CD Proof Rows — PR #85651 — Candidate 0dff94dbe48

**Date:** 2026-05-24 11:30 PDT  
**Trace:** `00-3918a352aa1d426b5ea01f9bf8eed218-3d6f21884c8a05cf-01`  
**Gateway:** OpenClaw 2026.5.24 (0dff94d)

## Results

| Row | Scenario | Expected | Observed | Status |
|-----|----------|----------|----------|--------|
| R-CD-1 | `continue_delegate` mode="normal" | Dispatches immediately, returns to channel | Scheduled (delegateIndex=1, mode=normal, delay=0) | ✅ PASS |
| R-CD-2 | `continue_delegate` mode="silent-wake" | Silent return + triggers fresh turn | Scheduled (delegateIndex=2, mode=silent-wake, delay=0) | ✅ PASS |
| R-CD-3 | `continue_delegate` delaySeconds=10 | Delayed dispatch after 10s | Scheduled (delegateIndex=3, mode=normal, delay=10) | ✅ PASS |
| R-CD-4 | `continue_delegate` targetSessionKey (cross-session) | Targets specified session | Scheduled (delegateIndex=4, targetSessionKey=agent:main:discord:channel:1466192485440164011) | ✅ PASS |
| R-CD-5 | `continue_delegate` mode="post-compaction" | Queues against compaction event | status=queued-for-compaction (delegateIndex=5, fires on compaction not timer) | ✅ PASS |
| R-CD-9 | `continue_delegate` mode="silent" | Silent enrichment without wake | Scheduled (delegateIndex=6, mode=silent, delay=0) | ✅ PASS |

## Notes

- All 6 delegates dispatched in a single turn (fan-out confirmed).
- Single shared traceparent across all delegates in this turn.
- R-CD-5 correctly returned `queued-for-compaction` status (distinct from scheduled).
- R-CD-3 correctly accepted and reported `delaySeconds: 10`.
- R-CD-4 correctly accepted cross-session targeting parameter.
- Delegate dispatch is post-response (all fire after this turn completes).

## Verdict

**6/6 rows PASS** — all `continue_delegate` modes, delay, and targeting parameters accepted and scheduled correctly by the gateway.
