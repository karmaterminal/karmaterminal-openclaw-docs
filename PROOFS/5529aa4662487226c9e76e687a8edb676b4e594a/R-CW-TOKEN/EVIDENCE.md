# R-CW-TOKEN — bracket/token form of continue_work (#952-class both-forms-mandate)

**Owner:** 🩸 Cael (cael-dgx, DGX Spark ARM64)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ✅ PASS
**Tool-form sibling:** R-CW-1 (both-forms mandate satisfied)

## What R-CW-TOKEN proves
A bare `CONTINUE_WORK:N` at the end of the model's final reply text DRIVES the continuation
(hop-2 fires from the PARSED response-token) — not merely that the token is stripped. This is the
bracket/token surface, which takes a partially independent code path from the typed tool
(`tokens.ts:parseContinuationSignal` vs `runOutcome.continueWorkRequest`). It is the surface
lightContext subagents can ONLY use (no tool in their surface), and the path #952 broke on.

## Evidence (bracket_parse_evidence.txt)
Emitted `CONTINUE_WORK:2` at the end of the final-assistant-reply-text on cael's main session:
```
[continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=true
[continuation:trace] bracket-parse: kind=work delayMs=2000
[continuation:trace] effective-signal: origin=bracket kind=work
[continuation:work-dispatch] [continuation:work-wake] hop=1/200
```
- **`bracketIdx=0`** — token DETECTED at index 0 of the reply payload.
- **`bracket-parse: kind=work delayMs=2000`** — parsed as a work-continuation; the `:2` resolved to delayMs=2000.
- **`effective-signal: origin=bracket kind=work`** — the continuation was DRIVEN by the **bracket** (origin=bracket), distinct from the tool-form. This is the load-bearing line: hop-2 drove from the parsed token, not the typed tool.
- **`work-wake hop=1/200`** — the wake fired.

## Finding (parse-surface clarification — worth banking for the both-forms mandate)
The bracket-form is parsed from the **model's final-assistant-reply-text**, NOT from `message`-tool
send payloads. Control test: the same `CONTINUE_WORK:3` token emitted via a `message`-tool send to
#heartbeat produced `bracketIdx=-1` / `effective-signal: origin=none kind=none` — NOT parsed.
Re-emitted in the final-assistant-text → `bracketIdx=0` / `origin=bracket` → parsed + drove.
So a valid R-CW-TOKEN proof MUST place the token in the final reply text, not a tool payload.

## Both-forms mandate
✅ Tool-form (R-CW-1) + ✅ bracket-form (this row) both fire + drive on 5529aa46. Parity confirmed.
