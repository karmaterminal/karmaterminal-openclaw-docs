# R-CD-TEST-2 — inter-session targeted return — ⚠️ RETRACTED → HOLLOW / INVALID NON-PROOF (relabeled from "#580-repro" after ronan/elliott layer-walk)

**Row owner:** 🩸 Cael (cael-dgx) · **SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` · **Retracted:** 2026-06-05 17:12 PDT

## ⚠️ RETRACTION (rune integrity-catch , byte-confirmed by cael self-audit)
My original ✅ PASS here was **HOLLOW and is retracted.** Two byte-failures in my own fire:
1. **I never passed a `targetSessionKey` parameter.** My fire was `continue_delegate(mode="silent", task="...inter-session...")` — the task *string* claimed inter-session routing, but the actual call passed **no targetSessionKey**. The path was never exercised.
2. **The "return receipt" was a scripted echo, not routing proof.** The delegate returned `targetSessionKey-return-path-exercised` because I *told it to return that string* in its task. That is the delegate echoing my own words — NOT evidence of recipient routing.

This is **NOT a #580-repro** — my earlier "#580-repro" label was imprecise and is corrected here. A #580-repro requires *actually exercising* the targetSessionKey path and hitting the runtime fall-through; my fire never passed a key, so it tested **nothing**. Separately (ronan + elliott byte-walk, confirmed at `2807efc`): the targetSessionKey **RETURN-routing** path genuinely *works* (`enqueueContinuationReturnDeliveries` in `cross-session-targeting.ts`, with `subagent-announce.targeted-return.integration.test.ts`) and is a **different layer** from #580 (which is EXECUTION/spawn-routing — still open). So a *proper* targetSessionKey fire would test RETURN-routing (a PASS, cf. R-CD-4), not repro #580. My row simply proves neither — it's a hollow non-proof.

## Actual status: HOLLOW NON-PROOF (tested neither layer), NOT pass, NOT a #580-repro
My fire passed no targetSessionKey and returned a scripted string, so it exercised neither RETURN-routing (which works) nor EXECUTION-routing (#580, open). It proves nothing. The row is voided as evidence.

## VERDICT: ⚠️ VOID / HOLLOW NON-PROOF — tested neither RETURN- nor EXECUTION-routing. NOT a PASS, NOT a #580-repro.
The genuine cross-session RETURN-routing PASS lives on R-CD-4 (ronan, real targetSessionKey + delivery-log). This row is voided — a scripted echo with no key. #580 (execution-routing) remains separately open; this row never touched it.
