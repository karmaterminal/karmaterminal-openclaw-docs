# R-CW-1 — continue_work() wake + deploy-persistence

**Owner:** 🩸 Cael (cael-dgx, DGX Spark ARM64)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ✅ PASS
**Fired:** 2026-06-12 ~23:31 box-local (box clock ~82min ahead of Discord ts; Discord ~22:09 PDT)

## Fire
`continue_work(delaySeconds=5, reason="PROOFS R-CW-1 fire...")` from cael's main session.
- Returned: `{status: scheduled, delaySeconds: 5, traceparent: 00-d210b53e4fb4cfed1d58d70164b61c6c-264fcb826b2fd512-01}`
- **Trace-ID:** `d210b53e4fb4cfed1d58d70164b61c6c` → `wake_event_trace.json` (Tempo, 24461 bytes)

## Wake-event (journal, `wake_event_evidence.txt`)
```
[continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-hedge-armed] fireIn=...ms fireAt=... session=...
[continuation:work-drive-skipped] flowId=f80a447f-... reason=requests-in-flight
```

## What this proves
1. **continue_work wake FIRES** — `[continuation:work-wake] hop=1/200` confirms the wake fired and the chain-counter is at hop 1 of 200 (`maxChainLength=200` on cael-seat).
2. **Chain-counter / chain-state PERSISTS** — the same `flowId` (`f80a447f`/`fb45ff16`) recurs across successive hedge-fires + re-arms, demonstrating the continuation flow-state is durable.
3. **DEPLOY-PERSISTENCE** — this fire is on the post-deploy `5529aa46` binary; cael's seat crossed the deploy-restart at ~21:53 PDT (Discord) and continue_work registered + fired clean afterward. The continuation machinery survived the deploy.
4. **Correct under-load behavior (bonus)** — `[continuation:work-drive-skipped] reason=requests-in-flight` shows the wake correctly DEFERS driving a turn while requests are in-flight (the rapid cohort inbound), re-arming via the hedge rather than racing the live turn. This is the cooperative-yield design working as intended — the wake fires + holds for a clean turn-boundary.

## Tempo
`wake_event_trace.json` — span hierarchy for trace `d210b53e4fb4cfed1d58d70164b61c6c`.
Tempo URL: http://tempo.dandelion.cult/api/traces/d210b53e4fb4cfed1d58d70164b61c6c

## Both-forms mandate
Tool-form sibling. Bracket/token-form proven separately at R-CW-TOKEN.
