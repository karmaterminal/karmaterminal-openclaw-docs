# cure-(2) ronan-seat proof rows — SHA 46733c4

Initialized: 2026-05-16 16:58 PDT
Ronan-seat: `OpenClaw 2026.5.17 (46733c4)` verified at byte pre-fire
Dispatcher session: 🌊 main

## R-CD-1 — continue_delegate basic (silent-wake, 3s)
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Delegate proof:

## R-CD-2 — continue_delegate silent 10s
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Delegate proof:

## R-CD-3 — continue_delegate silent-wake 5s
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Delegate proof:

## R-CD-4 — continue_delegate silent 15s
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Delegate proof:

## R-CD-CHAINED-DEPTH-2 Chain-1 — depth-2 chain (silent-wake → silent)
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Depth-1 proof:
Depth-2 proof:

## R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 chain (silent → silent)
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Depth-1 proof:
Depth-2 proof:

## R-CD-CHAINED-DEPTH-2 Chain-3 — depth-2 chain (silent-wake → silent)
Scheduled trace: `00-bb3f5ba51fb2666f62d0c98c46cd4677-fab8cebf93691367-01`
Depth-1 proof:
Depth-2 proof:

## Proof receipts (appended by delegates)
R-CD-1: fired delegate woke at 2026-05-16T16:58:14-07:00 on SHA 46733c4 with trace (unavailable in subagent context)
R-CD-2: silent-delegate woke at 2026-05-16T23:58:17Z on SHA 46733c4 with trace unset after delaySeconds=10
R-CD-3: silent-wake-delegate woke at 2026-05-16T16:58:14-07:00 on SHA 46733c4 with trace (none-visible-in-subagent-ctx); will wake dispatcher

R-CD-CHAINED-DEPTH-2 Chain-1 depth-1: woke at 2026-05-16T16:58:20-07:00 SHA 46733c4 trace (subagent e4dc57d5-1d17-4ebe-a19b-3e8503c0c36c); firing depth-2 nested delegate
Chain-1 depth-2: woke at 2026-05-16T16:58:33-07:00 SHA 46733c4 trace agent:main:subagent:0f1e74d7-ab9f-4e20-bd67-e6e8b4319115; chain-depth-2 OK

R-CD-4-REFIRE: silent-wake-delegate woke at 2026-05-16T17:00:16-07:00 SHA 46733c4 trace unset

Chain-2-REFIRE depth-1: woke at 2026-05-16T17:00:19-07:00 SHA 46733c4 trace unset; firing depth-2 nested
Chain-3-REFIRE depth-1: woke at 2026-05-16T17:00:21-07:00 SHA 46733c4 trace (none-injected); firing depth-2 then waking dispatcher
Chain-2-REFIRE depth-2: woke at 2026-05-17T00:00:00Z SHA unknown trace unknown; chain-depth-2-OK
Chain-3-REFIRE depth-2: woke at 2026-05-17T00:00:38Z SHA 46733c4fb9 trace none-provided; CHAIN-3-COMPLETE