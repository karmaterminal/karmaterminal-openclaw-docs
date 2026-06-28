# R-CW-TOKEN — continue_work token-form from subagent final text (cael-dgx)

**SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — terminal `CONTINUE_WORK:5` emitted by a light-context subagent was parsed as a work continuation and drove repeated same-subagent wake hops.

## Fire

A clean light-context subagent (`agent:main:subagent:67df211c-2266-47c6-8eef-44739edd4ce4`) was spawned with the instruction to reply exactly:

```text
CONTINUE_WORK:5
```

The subagent transcript contains that exact final text, followed by a runtime `[continuation:wake] Turn 1/200` message. The persisted transcript was checked with `sessions_history` before this row was written.

## Byte

`journal-token-window.txt` contains the live gateway lines for the same subagent session:

```text
2026-06-27T22:51:37.520-07:00 [continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=false session=agent:main:subagent:67df211c-2266-47c6-8eef-44739edd4ce4
2026-06-27T22:51:37.521-07:00 [continuation/signal] [continuation:trace] bracket-parse: kind=work delayMs=5000 session=agent:main:subagent:67df211c-2266-47c6-8eef-44739edd4ce4
2026-06-27T22:51:42.530-07:00 [continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:subagent:67df211c-2266-47c6-8eef-44739edd4ce4 reasonCategory=unknown
```

Because the subagent obeyed too well on each continuation wake, it emitted the same token repeatedly; the same log window shows additional `work-wake` hops (`hop=2/200` through `hop=5/200`) before the gateway restarted and the child failed closed. That over-fire is not needed for the proof; the row claims the first parse + first wake.

## Honest scope

This is a subagent final-text token proof, not a main Discord message-body proof. It exercises the fallback token scanner on an auto-delivered subagent final surface, the known valid surface for continuation token fallback.

No secrets or user content are included; the journal capture is restricted to continuation lines in the proof window.
