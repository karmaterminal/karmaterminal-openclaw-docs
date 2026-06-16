# R-CD-TOKEN EVIDENCE — `continue_delegate` bracket-token form (both-forms mandate)

**Row**: R-CD-TOKEN — the legacy bracket-token form `[[CONTINUE_DELEGATE:...]]` (both-forms mandate: tool-form was R-CD-1)
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: ronan (spark-ecdf / dgx) — Runtime `OpenClaw 2026.6.2 (077b261)`

## Fire (bracket-token at message-end)
- Emitted `[[CONTINUE_DELEGATE: R-CD-TOKEN PROOF ... +2s]]` at the end of a channel message (the bracket-token fires at end-of-message-shape per the legacy-fallback path).

## Byte-honest finding: bracket-token did NOT dispatch on this build
- **journal**: `[continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:...`
- `bracketIdx=-1` = the payload-scan RAN (the scanner is active on the deployed build) but found **NO bracket-directive** in the message payload. The `[[CONTINUE_DELEGATE:...]]` was NOT parsed as a continuation directive → no delegate spawned for the bracket-form.
- No `[continuation:delegate-spawned]` line for the R-CD-TOKEN task-string (contrast: the tool-form R-CD-1 produced a clean `delegate-spawned hop=1` line).

## Verdict
⚠️ **TOOL-FORM CANONICAL / BRACKET-FORM NON-DISPATCH** — on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0`, the **tool-form** of continue_delegate registers + dispatches cleanly (proven R-CD-1/2/3/4/CHAINED-DEPTH-2); the **bracket-token form** `[[CONTINUE_DELEGATE:...]]` did NOT dispatch from a normal channel message (payload-scan ran, bracketIdx=-1, no spawn). This is consistent with the canon that the bracket-form is a legacy fallback and tool-form is the canonical path — the both-forms mandate resolves as **tool-form PASS, bracket-form non-dispatch (recorded honestly, not forced to PASS)**. Whether the bracket-form is intended-dead on this build vs requires a different emission context is a follow-up byte; recorded as-observed.

## Cross-reference: contrast with R-CW-3 (Emeric) — bracket-form is tool/context-specific, not all-dead
🕯's R-CW-3 found the **continue_work** bracket-form (`CONTINUE_WORK:5`) DID fire (produced a `continuation.work` span, reason.preview absent). My **continue_delegate** bracket-form (`[[CONTINUE_DELEGATE:...]]`) did NOT (bracketIdx=-1, no spawn). So the non-dispatch is NOT "all bracket-forms dead on this build":
- `CONTINUE_WORK:N` (continue_work bracket) → fires ✓ (Emeric R-CW-3)
- `[[CONTINUE_DELEGATE:...]]` (continue_delegate bracket) → did not fire ✗ (this row)
Two candidate causes for the delta, both follow-up bytes: (a) the two bracket-syntaxes differ (`CONTINUE_WORK:N` bare-prefix vs `[[CONTINUE_DELEGATE:...]]` double-bracket) and the scanner may parse one but not the other; (b) **emission context** — my `[[CONTINUE_DELEGATE:...]]` was emitted inside a `message`-tool send, not plain final-assistant-text; the payload-scan may only see final-message-text, not message-tool-body. Emeric's `CONTINUE_WORK:5` was likely final-text. The honest verdict stands: **tool-form is the canonical + proven continue_delegate path; the bracket-form non-dispatch is real-as-observed, and the cross-walk with R-CW-3 localizes it to continue_delegate-bracket-from-message-tool-context, not a blanket bracket-death.**

## SOURCE-RESOLVED (co-walk with Emeric 🕯, 2026-06-15)
Cause of bracketIdx=-1 confirmed at the scanner source, NOT syntax-shape, NOT build-death:
- `src/auto-reply/continuation/signal.ts` walks `payloads: ReplyPayload[]` (agent RESPONSE payloads) + calls `stripContinuationSignal(payload.text)` per text-payload. It scans response-text, NOT message-tool bodies.
- My `[[CONTINUE_DELEGATE:...]]` rode a `message`-tool send argument → not a response-text-payload → scanner never saw it → bracketIdx=-1.
- Emeric's control case (`CONTINUE_WORK:5` in his FINAL-ASSISTANT-TEXT → fired, `continuation.work` span) proves the bracket-path is alive; the delta is emission-surface.
- Source comment confirms bracket-path is load-bearing: "Critical for subagent chain-hops where the bracket is the ONLY continuation path (tool is denied for leaf subagents)."
- **Final verdict: bracket-delegate works from final-assistant-text; does NOT fire from a message-tool-body. Both-forms mandate resolves: tool-form canonical+proven (R-CD-1/2/3/4/CHAINED); bracket-form alive on the correct emission-surface (final-text, not message-tool-body). Recorded honest-as-observed; now source-confirmed.**

## Discriminator-1 (syntax) FULLY RULED OUT — emission-context is SOLE cause (source byte, 2026-06-15)
The 5-min syntax confirm Emeric suggested, done at the source `src/auto-reply/tokens.ts`:
- Delegate-bracket matcher: `/\[\[\s*CONTINUE_DELEGATE:\s*((?:(?!\]\])[\s\S])+?)\s*\]\]\s*$/`
- This regex matches `[[CONTINUE_DELEGATE: task]]` CORRECTLY — `[[...]]` wrapper + `CONTINUE_DELEGATE:` prefix + body + closing `]]`. My emitted `[[CONTINUE_DELEGATE: R-CD-TOKEN PROOF... +2s]]` matches EXACTLY → syntax was never the problem.
- Clincher: the regex ends in `\]\]\s*$` (END-of-payload anchor), and `signal.ts` walks RESPONSE payloads (`payload.text`). So the bracket must sit at the end of a final-assistant-text payload. Mine rode a message-tool send body → never a response-text-payload → the regex NEVER RAN against it (not "didn't match" — never reached the matcher).
- **FINAL (source-airtight, both discriminators resolved): syntax ✅ RULED OUT; emission-context ✅ SOLE CAUSE.** continue_delegate tool-form canonical + 5-rows-PASS; bracket-form ALIVE, fires from final-assistant-text only; non-dispatch from message-tool-context is the documented emission-surface gap — NOT syntax, NOT build-death. Recorded honest-as-observed → control-case-localized → source-confirmed → syntax-ruled-out. Complete.

## EMPIRICAL CLOSE (2026-06-15, ran Silas's proposed test) — emission-surface DEFINITIVE
Silas proposed the clean test for the one open 2×2 cell: emit `[[CONTINUE_DELEGATE:...]]` as BARE FINAL-ASSISTANT-TEXT (not a message-tool send). I ran it. Result + the definitive resolution:

- **Test result: `[continuation:trace] bracket-parse skipped: empty payloads`.** This run is **message-tool-only-delivery** (final-assistant-text is NOT auto-delivered — the delivery-reminder confirms it). So emitting a bracket in the response body WITHOUT a message-tool send produces an **empty deliverable payload** → the scanner has nothing to walk → the bracket never reaches it. **The `[[...]]`-from-bare-final-text cell is UNTESTABLE in a message-tool-only run-config** (no final-text surface for the bracket to ride).
- **The DEFINITIVE proof it's emission-surface, not syntax — Cael's own `:12`:** Cael's `CONTINUE_WORK:12` is the SAME bare-token syntax as Emeric's `CONTINUE_WORK:5`, yet `:12` did NOT fire (rode message-tool-send) while `:5` DID (rode direct-final-text). **Same syntax, opposite result → the discriminator is emission-surface, empirically, not just source-read.** My `[[CONTINUE_DELEGATE]]` non-fire was ALSO message-tool-send → emission-surface, NOT attributable to the double-bracket syntax.
- **Byte-true 2×2 ledger:**
  - `CONTINUE_WORK` from direct-final-text → **fires** ✅ (Emeric `40674ffa`, witnessed)
  - `CONTINUE_WORK` from message-tool-send → **doesn't** ⚠️ (Cael `:12`, byte-confirmed)
  - `[[CONTINUE_DELEGATE]]` from message-tool-send → **doesn't** ⚠️ (this row, Ronan)
  - `[[CONTINUE_DELEGATE]]` from direct-final-text → **untestable in message-tool-only run-config**; source (`tokens.ts` regex matches the `[[...]]` form + `signal.ts` walks final-text) says it would match → "likely-fires, untestable-here," NOT "double-bracket dead."
- **Final verdict: the discriminator is EMISSION-SURFACE all the way down (empirically proven by Cael's same-syntax split), NOT token-flavor and NOT syntax.** R-CD-TOKEN ⚠️ indicts the message-tool-body emission surface I used, not the `[[...]]` syntax. Do not record the bracket-delegate form as dead.
