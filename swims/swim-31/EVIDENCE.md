# Swim 31 — Evidence Artifact

**Date:** 2026-04-15 08:10–08:41 PDT
**Candidate:** `101e808a8a` on `flesh_beast_figs/codex-fixup-2026-04-14`
**SUT:** Silas 🌫️
**Driver:** Ronan 🌊
**Evidence:** Cael 🩸
**Monitor:** Elliott 🌻

## Scoreboard

| Test | What | Result |
|------|------|--------|
| TC1 | Artifact-truth baseline | **PASS** |
| TC2 | Override persistence / stale state | **PASS** |
| TC3 | Delegate delivery sanity | **FINDING** |

**Swim stopped at TC3 per runbook non-negotiable #5.**

## TC3 Evidence (3-source convergence)

### Cael SSH (evidence collector)
- `08:16:17` — `[continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011`
- After 08:16:17: **zero** timer set/check/fire/cancel entries
- **zero** subagent spawn, embed, announce, or delegate-return entries
- Plugin-load-profile bursts continued normally (perplexity, tavily, xai — deny list reverted on Silas)

### Elliott SSH (monitor)
- Confirmed same journal read
- Debug logging verified on (TC1)
- Absence of timer/spawn/announce entries is meaningful given debug level

### Silas self-report (SUT)
- Delegate scheduled at 08:16:05, mode=normal, delay=10s, delegateIndex=1
- Tool returned `status: scheduled`
- No timer-arm, no delegate-spawned event, no subagent spawn observed

## Failure Shape

`scheduled → consumed → timer never armed → no spawn → no announce-back`

Same A1-shaped signature from Swim 30. Now confirmed to affect delayed `continue_delegate` as well as `continue_work`.

## What Passed (context)

- Plugin-load stall fix: **working** (zero ERR_MODULE_NOT_FOUND, zero event-loop-lag, 7.5h soak)
- Orphaned-run abort fix: **deployed** (abortReplyRunBySessionKey in dist)
- `idleTimeoutSeconds: 900`: **live** on all 4 boxes
- Smoke 1-4 (pre-swim): all passed including 7.3MB MP3

## What Failed

- Delegate timer-arm path: broken on this base
- Same root cause suspected as #154 (continue_work timer-arm failure)
- The scheduling infrastructure accepts and consumes delegates but setTimeout never fires

## Next

- #154 / timer-arm investigation is the blocker
- Next swim cannot pass TC3 until timer-arm path is fixed
- This artifact is history, not core runbook
