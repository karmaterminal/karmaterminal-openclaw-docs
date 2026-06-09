# R-CW-1 / R-CW-2 / R-CW-3 — continue_work() wake + chain-counter + reason-field (LIVE on deployed 9b1f42a694)

**Owner:** 🩸 Cael (cael-dgx)
**Deployed binary:** `OpenClaw 2026.6.2 (9b1f42a)` — source HEAD `9b1f42a694ad530653e12b530334288a5dfc439a`
**Gateway restart (deploy landing):** 2026-06-09 11:14:52 PDT
**Fire timestamp:** 2026-06-09 ~11:15 PDT (18:15Z)
**Fire type:** LIVE — gate-grade-fresh on the deployed reorg'd tree (figs (b)-path ask; NOT carry-over)

## Deployed continuation-primitive byte-confirm (reorg'd tree)
- `src/agents/command/attempt-execution.ts` → blob `f7b4723fbe7ea4bcbcf73de42ef806ab4618c18d` (moved here in upstream reorg)
- `src/auto-reply/tokens.ts` → blob `e5de316c59f937787198b6ab893f91326470644a` (continuation bracket-parse)
- `src/agents/tools/request-compaction-tool.ts` → blob `70fd0955a0a9396d2d8f829f66016d2b80a259cc`
- `src/agents/tools/continue-delegate-tool.ts` → blob `df28d2320b16324c982c1c31fe3fd33e70231c6a`
- `src/auto-reply/continuation/scheduler.ts` → blob `d048ed37fbf02ccd078d7d4785b8606da61ae72c`

## R-CW-1: continue_work() wake fired
Tool call `continue_work(delaySeconds=0, reason=<R-CW-3 reason-string>)` on the deployed gateway returned:
```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "note": "Requested 0s, clamped to 5s by continuation config.",
  "traceparent": "00-cce0fa55575943c98be504803d057c12-06031a71d20f9eba-01"
}
```
- **status=scheduled** → the continuation registered on the deployed binary ✓
- **delaySeconds clamped 0→5** → live `continuation.minDelayMs` config enforced (5000ms) ✓ — runtime config behavior, not mock

## R-CW-2: chain-counter / traceparent
- **Trace ID:** `cce0fa55575943c98be504803d057c12`
- **Parent span:** `06031a71d20f9eba`
- Tempo: `http://tempo.dandelion.cult/api/traces/cce0fa55575943c98be504803d057c12`
- Span-hierarchy JSON + journal wake-receipt captured on the wake-turn (the scheduled continuation fires next turn) → see `R-CW-1-wake_trace.json` (this dir).

## R-CW-3: reason-field captured in OTel span
The `reason` string passed to `continue_work` is carried into the continuation span attributes. Reason-string fired:
> "R-CW-1/2/3 PROOF FIRE on deployed 9b1f42a694: continue_work() live-fire to generate wake-event + chain-counter + reason-field-in-OTel-span evidence for the gate-grade proof corpus... This reason-string is itself the R-CW-3 reason-field captured in the continuation span."

Verification: the span at Trace ID `cce0fa55575943c98be504803d057c12` carries this reason text in its attributes (captured in `R-CW-1-wake_trace.json`).

## STATUS: fire registered; wake-turn evidence (Tempo span-tree JSON + journal receipt) appended on the scheduled wake.

## WAKE-TURN EVIDENCE CAPTURED (deployed binary)
- **Tempo span-tree:** `R-CW-1-wake_trace.json` — live `continuation.work` span, service `cael-prince`, host `cael`/arm64, STATUS_CODE_OK.
  - `chain.id: e82c675e-a850-4a31-9159-10e3e8c91eaf`, `chain.step.remaining: 176`, `delay.ms: 5000`, `reason.preview` = the R-CW-3 reason text ✓
- **Journal:** `R-CW-1-wake_journal.txt` — `[continuation:work-wake] hop=24/200`, `[continuation:work-hedge-fired]`, `[continuation:work-drive-skipped reason=requests-in-flight]` (wake fires live; drive-skips correctly while the current turn has requests in flight).
- **VERDICT R-CW-1/2/3: ✅** wake fired + chain-counter (chain.id) + reason-field-in-span, all live on deployed 9b1f42a694.

## CLEAN WAKE→DRIVE COMPLETION (the full cycle, deployed binary)
The R-CW-1 continue_work continuation **drove a clean turn** on the deployed `9b1f42a694`: the gateway emitted `[continuation:wake] Turn 24/200. Chain started 2026-06-09T11:26:06.253Z. Accumulated tokens: 28024. The agent elected to continue working. Reason: "R-CW-1/2/3 PROOF FIRE on deployed 9b1f42a694…"` — i.e. the scheduled continuation **actually drove a new agent turn** (not merely registered + drive-skipped). This closes the full continue_work primitive cycle on the deployed binary: **fire (scheduled) → `continuation.work` span (Tempo `cce0fa55`) → journal work-wake (hop=24/200) → clean DRIVE (Turn 24/200, the reason-string carried into the drive)**. The reason-field round-trips end-to-end (the R-CW-3 reason-string appears in the drive-event). Gate-grade R-CW-1/2/3/4 wake→drive: ✅ full cycle live on deployed 9b1f42a694.
