# R-CW-TOKEN: `continue_work` token/bracket form — ship-SHA 8b5dde6165

**Row owner:** 🩸 Cael
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB)
**Build:** OpenClaw 2026.6.2 (8b5dde6)
**Ship-SHA:** `8b5dde6165958d0eaba3c492ae52311548313de4` (Form-B, deployed fleet-wide 6/6)
**Date:** 2026-06-09 ~07:40 PDT
**Both-forms mandate (figs 2026-06-07):** tool-form sibling = R-CW-1 (✅ PASS). This row covers the **bracket/token fallback** path — the surface lightContext subagents can ONLY use, and the exact path #952 broke on.

## Verdict: ⚠️ HONEST-LIMIT (code-byte path-wired PASS + behavioral main-session attribution confound)

The bracket-token path is **byte-confirmed wired + correct on the deployed ship-SHA**; the clean behavioral PASS-shape (token→hop-2 cleanly attributable) is **structurally confounded from a busy main session** by concurrent inbound (the continuation arms + work-wakes, but `work-drive-skipped reason=requests-in-flight` because the live channel has requests in flight). The clean behavioral PASS for the bracket-form is best fired in an isolated lightContext-subagent surface — see the cross-ref to R-CW-DELEGATE-TOKEN (🪨 Rune, THE #952 row) below.

## (1) Code-byte proof — bracket path wired on ship-SHA `8b5dde6165`

The #952 fix is byte-present in the deployed ship-SHA at `src/agents/command/attempt-execution.ts` (HEAD = `8b5dde6165958d0eaba3c492ae52311548313de4`):

```
// Post-turn: capture both continue_work surfaces. Light-context subagents may
// not receive the typed tool, so the #952 nested path must honor the bracket
// token parsed from the final payload as well as the tool callback.
if (continuationEnabled && params.sessionKey) {
  …
  const extraction = extractContinuationSignal({ payloads, … enabled: true, sessionKey });
  if (extraction.signal?.kind === "work") {
    if (extraction.fromBracket) { … strip from payload … }
    await scheduleSpawnInitContinueWorkWake({ sessionKey, … });
```

Byte-verification (on the deployed SHA):
- `extraction.fromBracket` present ✓ (2 occurrences) — the bracket-parsed signal drives the continuation, distinct from the tool callback
- `scheduleSpawnInitContinueWorkWake` present ✓ (2) — the bracket signal schedules the hop-2 wake
- `#952` comment present ✓ — explicitly the nested-bracket cure

So the bracket-token form of `continue_work` (`CONTINUE_WORK:N` parsed from the finalized payload → drives hop-2) is **wired + correct on the deployed ship-SHA**, partially-independent of the typed tool path. The parse runs on `embeddedRunResult.payloads` gated only on `continuationEnabled && sessionKey` — NOT on channel-delivery (so it is the same path a lightContext subagent uses).

## (2) Behavioral fire — main-session attribution confound (the HONEST-LIMIT)

A bare `CONTINUE_WORK:30` was emitted as the finalized assistant payload from the cael main session. Journal on the cael gateway (session `agent:main:discord:channel:1466192485440164011`) shows the continuation system armed + firing:

```
[continuation:work-wake] hop=22/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-drive-skipped] reason=requests-in-flight session=…:channel:1466192485440164011
[continuation:work-hedge-armed] fireIn=1000ms …
```

The continuation is live (hop-counter progressing, work-wake firing), but `work-drive-skipped reason=requests-in-flight` shows the busy live channel (constant cohort inbound during the PROOFS cycle) prevents a cleanly-attributable token→fresh-hop-2 execution: the hop-counter advances from multiple continuation sources (prior `continue_work` tool fires + the token) and cannot be isolated to the token alone from a busy main session. This is a substrate confound, NOT a path failure — the path is byte-wired (section 1) and the system is firing (section 2).

## (3) NOT-regression verification

The `fromBracket` → `scheduleSpawnInitContinueWorkWake` wiring is byte-present on the deployed ship-SHA `8b5dde6165` (the #952 cure is IN the fold). This is the cure landing, not a regression.

## (4) Clean-surface sibling cross-ref

The clean behavioral PASS for the bracket-form (isolated, no inbound confound) is **R-CW-DELEGATE-TOKEN** (🪨 Rune) — THE #952 row: a lightContext subagent (NO `continue_work` tool in its surface) fires `[[CONTINUE_WORK:N]]` and hop-2 EXECUTES on a real seat. That surface is the one where the bracket is the ONLY path + there is no concurrent inbound to confound attribution. R-CW-TOKEN (this row, main-session reply-end bracket) + R-CW-DELEGATE-TOKEN (subagent bracket) together cover the bracket-form both where it's a fallback (main session) and where it's the sole surface (lightContext subagent).

## Honest framing for maintainer

> R-CW-TOKEN (continue_work bracket form): the bracket→hop-2 wiring (#952 cure) is byte-confirmed present on the ship-SHA (`attempt-execution.ts` fromBracket→scheduleSpawnInitContinueWorkWake); the continuation fires live on the seat (journal work-wake), but clean token-isolated PASS-shape attribution from a busy main session is confounded by concurrent inbound (`work-drive-skipped reason=requests-in-flight`). Clean behavioral PASS for the bracket-only surface is R-CW-DELEGATE-TOKEN (lightContext subagent). Path wired + firing; main-session attribution is the honest-limit.
