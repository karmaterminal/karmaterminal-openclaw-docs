# R-CW-DELEGATE-TOKEN — EVIDENCE (rune-rog-ally)

**Row:** R-CW-DELEGATE-TOKEN — subagent TOKEN-form self-continuation (#952)
**Verdict:** ✅ **PASS** (with form-correction — see below)
**Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8` (deployed fleet 6/6; the token-fix `4be30e6f0`/`4be...` wired through the scheduler is present)
**Seat:** rune-rog-ally (gateway pid 1795422, HEAD == c8149791797)
**Marker:** R-CW-DELEGATE-TOKEN-BARE-1782032000
**Trace:** `33180bc4d9e649ee9aeeb1e7062c8889`

## What this row proves

A subagent emitting the **bare `CONTINUE_WORK` token** as the last characters of its
response self-continues into a second turn (hop-2) on the token-fixed head — routed
through the SAME durable `scheduleSubagentSelfContinuationWork` scheduler the tool form
uses (`subagent-announce.ts:1098 if (kind === "work")` → the scheduler). This was the
`:977` DECLINE on the pre-token-fix head `93ace21341` (the token-inversion).

## FORM-CORRECTION (load-bearing byte)

The token-form self-continuation is the **bare** token `CONTINUE_WORK`, NOT the bracket
`[[CONTINUE_WORK]]`. Byte-walk on `c8149791797`:
- NO `BRACKET_CONTINUE_WORK_PATTERN` exists in `subagent-announce.ts`.
- `stripContinuationSignal` (`tokens.ts:539`) parses only `/\bCONTINUE_WORK(?::(\d+))?\s*$/`
  — the bare token at end-of-text. The `[[`/`]]` break the `\b`/`\s*$` match.
- The `:1098` comment is explicit: *"A subagent's **bare** CONTINUE_WORK token is a
  same-session self-continuation"*.

**First fire used the bracket `[[CONTINUE_WORK]]` → parsed as `kind=none` / `bracketIdx=-1`
(journal-confirmed) → did NOT drive.** Re-fired with the bare token → DROVE. So a token-row
that uses `[[CONTINUE_WORK]]` will register as a false-fail; the correct form is bare
`CONTINUE_WORK`.

## Evidence

### 1. hop-1 / hop-2 files (the dispositive behavioral byte)
```
hop1: TOKENBARE-HOP1 R-CW-DELEGATE-TOKEN-BARE-1782032000
hop2: TOKENBARE-HOP2-DROVE R-CW-DELEGATE-TOKEN-BARE-1782032000   <- hop-2 DROVE
```
hop-2 file existence == the bare-token self-continuation drove the second turn.

### 2. journald (the work-dispatch GREEN path)
```
01:56:24 [continuation:work-hedge-armed] fireIn=8000ms  session=...continuation-0fb3222a...
01:56:24 [continuation:work-wake] hop=1/200             session=...continuation-0fb3222a...
01:56:32 [continuation:work-hedge-fired]                session=...continuation-0fb3222a...
```
The bare token armed the work-continuation (`work-hedge-armed`) → `work-wake hop=1/200`
→ `work-hedge-fired` (the hop-2 turn fired). This is the `:1098 kind === "work"` →
`scheduleSubagentSelfContinuationWork` path (NOT the `:977` decline).

### 3. Tempo trace `33180bc4d9e649ee9aeeb1e7062c8889`
Spans: `openclaw.continuation`, `continuation.delegate.dispatch` (45 spans / 10 unique).
Full trace JSON: `tokenbare_trace.json`.

## The token-inversion arc (resolved)

- Surfaced: TOKEN-form-from-child DECLINED on the deployed `93ace21` (`:977`,
  `scheduleSubagentSelfContinuationWork` count=0) while TOOL-form `continue_work()` drives.
- Resolved: the token-fix wires the subagent CONTINUE_WORK token through the work
  scheduler (#952); present on the absorb-2 tip `c8149791797` (scheduler count=2,
  `:1098 if (kind === "work")` HANDLES it).
- Shipped: figs chose (B) — Frond deployed the fleet 6/6 on `c8149791797`.
- Verified GREEN (this row): bare `CONTINUE_WORK` from a subagent drives hop-2 on
  `c8149791797`. Cross-confirmed by Silas's #1044 byte-walk (TOKEN-form un-shipped on
  `93ace21`, the wiring on drift-2) and the deployed-fleet ancestry (`93ace21` is an
  ancestor of `c8149791797`).

## Files
- `rune-tokenbare-hop1.txt`, `rune-tokenbare-hop2.txt` — the hop markers
- `journald_drove.txt` — the work-dispatch journald window
- `tokenbare_trace.json` — the Tempo trace
