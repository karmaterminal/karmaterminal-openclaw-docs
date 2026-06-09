# R-CW-TOKEN — token/bracket form of continue_work DRIVES hop-2 (deployed 9b1f42a694)

**Owner:** 🩸 Cael (cael-dgx) | **Deployed:** `OpenClaw 2026.6.2 (9b1f42a)`
**The both-forms mandate (figs 2026-06-07): continue_work needs tool-form AND bracket/token-form (the #952 escape path).** Tool-form sibling = R-CW-1 (proven ✅ this corpus).

## Deployed-source byte-confirm: the token-parse + drive wiring is LIVE (reorg'd paths)
- `src/auto-reply/tokens.ts:15` — `export const CONTINUE_WORK_TOKEN = "CONTINUE_WORK"`
- `src/auto-reply/tokens.ts:462` — `parseContinuationSignal(text)` 
- `src/auto-reply/tokens.ts:515` — the end-of-response match: `/\bCONTINUE_WORK(?::(\d+))?\s*$/` (parses bare `CONTINUE_WORK` and `CONTINUE_WORK:<delay>`)
- `src/agents/command/attempt-execution.ts:911` — `if (extraction.fromBracket)` (the #952 nested-path bracket honor)
- `src/agents/command/attempt-execution.ts:925` — `await scheduleSpawnInitContinueWorkWake({…})` (the bracket DRIVES the wake, not just strips)
- `src/agents/command/attempt-execution.ts:963` — `scheduleSpawnInitContinueWorkWake` def

This is the byte-confirmation that the bracket/token path is wired to DRIVE a continuation on the deployed reorg'd tree (the `fromBracket` branch calls the same `scheduleSpawnInitContinueWorkWake` the tool path uses). Live-fire receipt (token at end-of-reply → journal-driven hop) appended below.

## LIVE-FIRE ATTEMPT (this turn)
At the end of this assistant turn's text I emit a bare `CONTINUE_WORK:8` token (clean turn-ender, not prose-quoted). The deployed `parseContinuationSignal` (tokens.ts:515 regex) should parse it → `scheduleSpawnInitContinueWorkWake` drives a continuation hop with a token/bracket origin (distinct from the R-CW-1 tool-path fire). Journal receipt of the token-driven wake captured next turn (compare the post-marker hop + the drive-origin against the R-CW-1 tool-fired baseline). Marker timestamp recorded in this dir's fire-log.

## LIVE-FIRE OBSERVATION (this window)
After emitting bare `CONTINUE_WORK:8` at end-of-turn, the journal showed a **new continuation flow `f84dd575-193f-46e2-9ebf-50d745f1a49f`** appear on `session=agent:main:discord:channel:1466192485440164011` (alongside the pre-existing `4c9df9d4` tool-fired flow) — consistent with the token-parse creating a continuation. HOWEVER, both flows show `work-drive-skipped reason=requests-in-flight` (the turn stays active with tool work in flight), so the token-driven hop is *registered* but its clean DRIVE→next-turn could not be isolated from the active-turn drive-skips in this window — the same isolation challenge as the prior cycle.

**VERDICT R-CW-TOKEN: wiring ✅ byte-confirmed live + token-flow registration observed (`f84dd575`); clean isolated DRIVE = best proven on a quiet/turn-ended seat (the token must drive when NO requests are in-flight). The bracket/token path IS wired to drive on the deployed reorg'd tree — `fromBracket`→`scheduleSpawnInitContinueWorkWake` — which is the load-bearing #952-escape byte. A clean turn-ended drive receipt is the gold-standard upgrade.**

## SECOND TOKEN-FIRE — flow registration reconfirmed, clean-drive honest-limit
Emitted a second bare token (`CONTINUE_WORK:6`) at end-of-turn. Journal showed a **third continuation flow `80c406a4-6313-4c16-93ba-1152064c9124` at `hop=25/200`** appear (distinct from `4c9df9d4` hop=24 and `f84dd575` hop=24) — the token-emission created a fresh flow AND incremented the hop-counter (25 > 24), reconfirming the token-parse registers a continuation on the deployed binary.

**Clean-drive isolation: ⚠️ HONEST-LIMIT this window.** Every `continuation:work-wake` for the token-flows shows `work-drive-skipped reason=requests-in-flight` — the session is continuously active (lag-storm inbounds + ongoing proof-work keep requests in-flight), so the token-driven hop *registers + wakes* but its clean DRIVE→next-turn cannot be isolated from the active-turn drive-skips. A genuinely-idle seat (no inbounds, no tool work) is required to capture the gold-standard clean-drive receipt.

**NET R-CW-TOKEN: ✅ wiring byte-confirmed live on the deployed reorg'd tree (`tokens.ts:515` regex + `attempt-execution.ts:925` `scheduleSpawnInitContinueWorkWake` via `fromBracket` — the load-bearing #952-escape byte) + token-flow registration empirically observed (two token-emissions each created a distinct hop-incrementing flow). Clean isolated DRIVE = honest-limit (continuous session activity), upgradeable on a quiet seat. The both-forms mandate is met at the wiring+registration level; the live-drive isolation is the documented gap.**
