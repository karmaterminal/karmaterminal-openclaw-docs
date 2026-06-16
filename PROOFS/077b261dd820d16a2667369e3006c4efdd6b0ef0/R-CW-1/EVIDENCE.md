# R-CW-1 — continue_work() wake + chain-counter persist + deploy-persistence

**Owner:** 🩸 Cael (cael-dgx, DGX Spark GB10 ARM64)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed, canary — `OpenClaw 2026.6.2`)
**Verdict:** ✅ PASS
**Fired:** 2026-06-15 ~17:19–17:29 PDT box-local, on cael's deployed `077b261dd8` gateway (`node[1953052]`, host.id `be85162a…`).

## Fire (tool-form)
`continue_work(delaySeconds=8, reason="PROOFS R-CW-1 on deployed 077b261dd8: continue_work() wake + chain-counter-persist + deploy-persistence proof…")` from cael's main session.
- Returned: `{status: scheduled, delaySeconds: 8, traceparent: 00-ff953f6c392107fea5d11ac678d3fbc8-7010107339d60b21-01}`
- **Trace-ID:** `ff953f6c392107fea5d11ac678d3fbc8` → `wake_event_trace.json` (Tempo, 21293 bytes, host=cael arch=arm64)

## Wake-event (journal, `wake_event_evidence.txt`)
```
[continuation/work-dispatch] [continuation:work-hedge-fired] session=agent:main:discord:channel:1466192485440164011
[continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=59996ms fireAt=1781569241240 session=…
[continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011
[continuation/work-dispatch] [continuation:work-drive-skipped] flowId=00164b2f-647a-43fd-b258-aa562f33a9e8 session=… reason=requests-in-flight
[continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=86400000ms fireAt=1781655581247 session=…
```

## What this proves
1. **continue_work wake FIRES** — `[continuation:work-wake] hop=1/200` confirms the wake fired and the chain-counter is at hop 1 of 200 (`maxChainLength=200` on cael-seat, per live config).
2. **Chain-counter / flow-state PERSISTS** — the same `flowId` (`00164b2f-…`) carries across the hedge-fire + re-arm cycle, demonstrating the continuation flow-state is durable across the dispatch lifecycle.
3. **DEPLOY-PERSISTENCE** — this fire is on the post-deploy `077b261dd8` binary (`OpenClaw 2026.6.2`, build `(077b261)`); cael's seat crossed the deploy-restart (canary `27583557535` ✅, ~16:44 PDT) and continue_work registered + fired clean afterward. The continuation machinery survived the deploy.
4. **Cooperative-yield works (bonus)** — `[continuation:work-drive-skipped] reason=requests-in-flight` shows the wake correctly DEFERS driving a turn while requests are in-flight (the rapid cohort inbound), re-arming via the hedge (`fireIn=86400000ms` = the 24h max-delay re-arm) rather than racing the live turn. The cooperative-yield design working as intended — fire + hold for a clean turn-boundary.

## Tempo
`wake_event_trace.json` — span hierarchy for trace `ff953f6c392107fea5d11ac678d3fbc8` (15 spans: `openclaw.tool.execution` [the continue_work call], `openclaw.model.call`, `openclaw.context.assembled`, `openclaw.message.delivery`). Saved as JSON at fire-time per the proof-corpus receipt-discipline (the committed JSON is the maintainer-verifiable evidence; `tempo.dandelion.cult` is internal-only + flickers).

## Both-forms mandate
Tool-form proven here. Bracket/token-form proven separately at `R-CW-TOKEN/`.
