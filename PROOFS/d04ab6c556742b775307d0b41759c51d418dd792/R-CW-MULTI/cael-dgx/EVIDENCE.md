# R-CW-MULTI — cael-dgx: array-capture N→N via per-session-key bypass (ship-SHA 749f95b)

**Seat:** cael-dgx (DGX Spark GB10, ARM64)
**Ship-SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (deployed gateway HEAD, OpenClaw 2026.6.9)
**Row:** R-CW-MULTI — N `continue_work` fired in ONE turn → N distinct continuation flow_runs (array-capture, the `scheduleContinuationWorkBatch` #982 fix; NOT collapsed to 1)
**Verdict:** ✅ PASS — 3 distinct flow_runs from one multi-fire turn, fired via the per-session-key bypass, drain-INDEPENDENT

## The fire (3 continue_work in one fresh-subagent turn)
Fired from a FRESH lightContext subagent (`agent:main:subagent:20b07564...`, own session-key, 0 queued → bypasses the main #552 cap). Scheduled-count: 3/3, zero capped, zero rejected.

## DISPOSITIVE BYTE (from flow_runs DB, not the subagent surface-report)
```
flow_id                               status      goal                                        created_at
6e2b05ee-48d7-48cf-834f-81d8c322ea04  succeeded   R-CW-MULTI-FIRE-A-CAEL-749f95b stagger 1/3  1782065293398  ← drove (+60s)
8f89ffbf-2a15-4e62-b448-f3bf10e4ccb0  succeeded   R-CW-MULTI-FIRE-B-CAEL-749f95b stagger 2/3  1782065293400  ← drove (+120s)
323774c5-7731-432a-940d-bb51308bb77e  queued      R-CW-MULTI-FIRE-C-CAEL-749f95b stagger 3/3  1782065293402  ← releases +180s
```
**3 distinct flow_ids, created microseconds apart (...398/400/402) from ONE turn = array-captured N→N, NOT collapsed to 1.** The `scheduleContinuationWorkBatch` signature on deployed `749f95b` (the #982 fix). Fires A+B already `succeeded` (drove their hop-2); C releases at +180s.

## Trace
`continuation_trace.json` — Tempo trace `319a3ebab6df66be59179fbc86013ad3` (124942 bytes), spans `continuation.work` + `openclaw.continuation`.

## Disposition
Bypass-able mechanism-test, drain-INDEPENDENT. The fresh-child fired 3/3 clean (no cap hit) + array-captured N→N. #552 drain unblocks ZERO rows here.
