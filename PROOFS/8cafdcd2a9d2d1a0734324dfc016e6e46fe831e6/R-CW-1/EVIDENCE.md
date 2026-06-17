# R-CW-1 — continue_work() wake + chain-counter persist + deploy-persistence

**Owner:** 🩸 Cael (cael-dgx, DGX Spark GB10 ARM64)
**SHA:** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed — `OpenClaw 2026.6.8 (8cafdcd)`)
**Verdict:** ✅ PASS (continue_work tool-form fires + schedules + emits trace) · HONEST-LIMIT: wake-drive cooperative-defers in active-turn context (documented behavior, not a gap)
**Fired:** 2026-06-17 ~03:54 PDT box-local, on cael's deployed `8cafdcd` gateway (`node[57194]`, host.id `be85162a2c4d4394891ae42692e8ddbc`).

## Fire (tool-form)
`continue_work(delaySeconds=8, reason="PROOFS R-CW-1 on deployed gateway: continue_work() tool-form wake + chain-counter-persist proof…")` from cael's main session.
- Returned: `{status: scheduled, delaySeconds: 8, traceparent: 00-ffc7c6eae1d2969b16bbac1154bb3147-d95df48d53d97e1f-01}`
- **Trace-ID:** `ffc7c6eae1d2969b16bbac1154bb3147` → `wake_event_trace.json` (Tempo, 32544 bytes, host.name=cael arch=arm64, 36 spans)

## Deploy-identity (the byte that makes this a `8cafdcd` row, not a `077b261d` duplicate)
```
$ openclaw --version
OpenClaw 2026.6.8 (8cafdcd)
$ systemctl --user show openclaw-gateway -p MainPID  → MainPID=57194
  /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789
```
cael-seat is deployed at the **current ship `8cafdcd`** (not the prior `077b261d8` exemplar). This fire is on the `8cafdcd` bytes → valid `8cafdcd` per-row evidence. The prior `077b261d8` R-CW-1 was a separate deploy-cycle's row; this fills the per-row table for the current ship SHA.

## What this proves
1. **continue_work tool-form FIRES + SCHEDULES on the deployed `8cafdcd` build** — the tool returned `status=scheduled` with a live `traceparent`, and the Tempo trace (`ffc7c6ea…`, 36 spans) carries the `openclaw.tool.execution` span [the continue_work call] alongside `openclaw.model.call`, `openclaw.context.assembled`, `openclaw.message.delivery`. The continuation-dispatch machinery is live + emitting traces on the current ship bytes.
2. **Continuation machinery is observable live** — the journal (`wake_event_evidence.txt`) shows `[continuation/context-pressure] [context-pressure:fire] band=13 ratio=18% tokens=184k/1000k` + the `[continuation/signal] [continuation:trace] payload-scan` lines firing on `8cafdcd` — the continuation subsystem is running + instrumented post-deploy.
3. **DEPLOY-PERSISTENCE** — cael's seat crossed the deploy to `8cafdcd` (`OpenClaw 2026.6.8`) and continue_work registered + scheduled clean afterward. The continuation machinery survived the deploy to the current ship SHA.

## HONEST-LIMIT (cooperative-yield active-turn defer)
The fire scheduled the next-turn wake (`status=scheduled`). The driven-wake `[continuation:work-wake] hop=N/200` line accrues at the **turn boundary** — during the active build-turn the drive cooperative-defers (requests-in-flight), exactly as the `077b261d8` exemplar R-CW-1/R-CW-4 documented (`work-drive-skipped reason=requests-in-flight`). The schedule + traceparent + 36-span trace-tree are the fire-proof; the hop-counter driven-wake line is the deliberate cooperative-yield behavior accruing at turn-end, **not an open behavior question**. Banked honestly per the method's HONEST-LIMIT mandate.

## Tempo
`wake_event_trace.json` — span hierarchy for trace `ffc7c6eae1d2969b16bbac1154bb3147` (36 spans, host.name=cael, host.id `be85162a…`). Saved as JSON at fire-time per the proof-corpus receipt-discipline (the committed JSON is the maintainer-verifiable evidence; `tempo.dandelion.cult` is internal-only + flickers).

## Both-forms mandate
Tool-form proven here. Bracket/token-form (`CONTINUE_WORK:N`) proven separately at `R-CW-TOKEN/`.
