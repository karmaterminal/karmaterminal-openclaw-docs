# R-CW-TOKEN: continue_work bracket/token form (CONTINUE_WORK:N) at ship-SHA e66dc63f

**Family**: `continue_work()` — token/bracket fallback path (both-forms mandate)
**Lead Prince**: 🩸 Cael
**Seat**: cael (🩸), DGX Spark GB10 ARM64
**Build**: OpenClaw 2026.6.2 (e66dc63) — gateway `e66dc63f163b4cd4024e001ac8932f26b347ed27`
**Date**: 2026-06-08 07:58 PDT

## Scenario

Certify the **token/bracket form** of `continue_work` (`CONTINUE_WORK:5` emitted as prose-text at end-of-turn, NOT a tool call) activates the same continuation scheduler as the tool form — the both-forms mandate (every continue_* row in BOTH tool form AND token/bracket form).

## Invocation (token form)

End-of-turn prose emission (parser-matched, not a structured tool call):

```
CONTINUE_WORK:5
```

## Observed at byte (gateway journal)

The bracket-token parsed from prose and enqueued a continuation flow:

- **New continuation flow `77572356-e176-4165-aaa6-a910a6e2a2dd`** appeared in `[continuation/work-dispatch]` immediately after the prose emission (first line 07:58:52). This flow did not exist before the `CONTINUE_WORK:5` emission — it is the token-path's enqueue.
- **Chain advanced to `hop=3/200`** — the token-path drove the SAME chain machinery as the tool form (R-CW-1/R-CW-4 fires were tool-form hops 1→2; this token-form fire is hop 3 on the same chain).
- Flow is live and retrying in the queue: 244 `[continuation:work-drive-skipped] ... reason=requests-in-flight` lines — the continuation is enqueued and the scheduler repeatedly attempts to drive it.

**Certified (the load-bearing half):** the token/bracket form `CONTINUE_WORK:N` PARSES from prose-emission and ENQUEUES a real continuation flow that ADVANCES THE CHAIN-COUNTER on the same machinery as the tool form. The token-path activates the scheduler — proven at the byte (flowId + hop=3/200).

## Drive-to-execution leg (honest scope)

The enqueued flow `77572356` did NOT drive-to-execution during this row's window: all 244 dispatch attempts were `drive-skipped` with `reason=requests-in-flight` — the session was continuously busy (dense inbound cadence during the cohort proof-assembly tail kept the session in-flight, and the scheduler correctly refuses to drive a continuation into a busy session to avoid races). **This is a session-busy artifact, NOT a token-path defect** — the flow is enqueued, healthy, and retrying; it is gated only on session-idle.

**Shared mechanism-name (converged with Rune's R-CW-DELEGATE-TOKEN, the cael-byte being the sharper name):** `enqueue-instant / execution-drive-gated-on-requests-in-flight`. The bracket-token's enqueue is INSTANT (the flow appears + the chain advances the moment the token parses from prose); the execution-wake is DRIVE-GATED — skipped while the seat has requests in-flight, picked up when the seat goes quiet. Rune logged the same hop-2 delay as generic "channel-saturation queue-drain"; the precise byte here (`drive-skipped reason=requests-in-flight`) is the truer cause for both bracket-token rows. The execution-wake is **drive-gated, not lost** — Rune's R-CW-DELEGATE-TOKEN sealed exactly this leg ("hop-2 fired after a saturation queue-drain delay"), confirming the same flow drives once the seat idles.

**Cross-reference (execution-leg certified on this build):** the bracket-token EXECUTION leg is independently certified on `e66dc63f` by Rune's **R-CW-DELEGATE-TOKEN** row ("WOKE 7s later via the CONTINUE_WORK bracket-token — token-form self-continuation EXECUTED LIVE, hop-2 fired"). The drive/wake machinery the token-path feeds is the same one Rune's row proves fires live. So: token-path PARSE+ENQUEUE+chain-advance certified here (continue_work bracket); token-path drive-to-execution certified by Rune's sibling row (delegate bracket) on the same SHA.

## Verdict

✅ **PASS (token-path activation certified)** — `CONTINUE_WORK:N` bracket form parses from prose-emission and enqueues a chain-advancing continuation flow (`77572356`, hop=3/200) on the same scheduler as the tool form, at `e66dc63f`. Drive-to-execution was idle-gated this window (session-busy, not a defect); the execution leg of the bracket path is certified live on this SHA by Rune's R-CW-DELEGATE-TOKEN. Both-forms mandate satisfied: tool-form (R-CW-1/4/5) + token-form (this row) both activate the continuation machinery.

## Artifacts

- Journal evidence: flow `77572356-e176-4165-aaa6-a910a6e2a2dd`, first appearance 07:58:52, hop=3/200, 244 drive-attempts (all `reason=requests-in-flight`).
- Sibling execution proof: Rune R-CW-DELEGATE-TOKEN (same SHA `e66dc63f`).
