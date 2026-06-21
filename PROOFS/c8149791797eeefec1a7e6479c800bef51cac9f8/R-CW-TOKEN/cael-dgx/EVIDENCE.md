# R-CW-TOKEN — cael-dgx — bare CONTINUE_WORK token-form work-self-continuation DRIVES hop-2

**Ship-SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8` (deployed, GATE-4-locked). Gateway pid 2377327, `OpenClaw 2026.6.9 (c814979)`.
**Seat:** cael-dgx (DGX Spark, ARM64). **Captured:** 2026-06-21 ~03:12 PDT.
**Fired via:** a **lightContext subagent** (session `agent:main:subagent:4e239a66-…`) — its OWN session key, which has 0 queued continuation-work flows, so it BYPASSES cael-dgx's #552-saturated MAIN-session pending-cap (`agent:main:discord:channel:1466…` = 32/32). The per-session cap (`queuedPendingWorkCount(work.sessionKey)`, `work-dispatch.ts:563`) is keyed per-owner; a subagent's key is distinct → not capped.

## What R-CW-TOKEN proves

The **BARE** `CONTINUE_WORK` token (NOT `[[CONTINUE_WORK]]` bracket — there is no `BRACKET_CONTINUE_WORK_PATTERN`; `stripContinuationSignal` parses `/\bCONTINUE_WORK(?::(\d+))?\s*$/` bare-only at end-of-text) at the END of a subagent's reply DRIVES its hop-2 self-continuation, via `subagent-announce.ts:1098 (kind==="work") → :1110 scheduleSubagentSelfContinuationWork` (the #952 `4be54a458e` wiring, present on `c814979`; was the `:977` decline on the superseded `93ace21`).

## Byte-evidence (VERIFIED in the journal — not inferred)

`journald_bare_token_drove.log` (the subagent's session key throughout):
```
03:12:24  bracket-parse: kind=work delayMs=default          ← bare CONTINUE_WORK parsed as WORK
03:12:24  effective-signal: origin=bracket kind=work        ← the work-self-continuation signal
03:12:24  work-hedge-armed fireIn=14999ms                   ← SCHEDULED (NOT pending-capped — subagent key under cap)
03:12:39  work-hedge-fired                                  ← the hedge fired
03:12:39  work-wake hop=1/200                               ← the continuation DROVE (hop-2 turn taken)
```

`hop1.txt` = `TOKENBARE-HOP1 1782036741` (written on hop-1, before emitting the bare token)
`hop2.txt` = `TOKENBARE-HOP2-DROVE 1782036763` (written on hop-2 — **the driven turn**, ~22s after hop-1)

## Result

✅ **PASS.** The bare `CONTINUE_WORK` token from a subagent on the deployed `c814979` head parsed as kind=work → scheduled (cap-bypassed via the subagent's own session key) → fired → DROVE hop-2 (hop2.txt written on the driven turn). Both-forms mandate (work-token half): the BARE token drives, confirmed live. (Tool-form sibling = R-CW-1, MAIN-session, #552-cap-blocked → HONEST-LIMIT.)

**NB on the cap-bypass:** this row fires from a subagent because cael-dgx's MAIN session is #552-saturated (32/32). A MAIN-session bare-token would route through the non-scanned message_tool body anyway (per cael TOOLS.md), so the lightContext-subagent's scanned final-text is the canonical surface for this proof regardless of the cap.
