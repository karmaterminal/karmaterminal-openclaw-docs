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
