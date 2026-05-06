# Swim 31 — timer-arm failure evidence artifact

**Date**: 2026-04-15 08:10–08:41 PDT  
**Candidate**: `101e808a8a` on `flesh_beast_figs/codex-fixup-2026-04-14`  
**SUT**: Silas 🌫️  
**Driver**: Ronan 🌊  
**Evidence**: Cael 🩸  
**Monitor**: Elliott 🌻  
**Result**: 2 PASS · 1 FINDING
**Provenance class**: `bootstrap-pointer` — public surface evacuated from `karmaterminal/openclaw-bootstrap` (e.g. `swims/swim-NN-…/`, `SWIM/history/`); bootstrap remains the source-of-truth body for this swim. See `swims/README.md` for the full provenance-class definitions and `swims/HISTORY.md` for the archive-surface map.


## Status

This is a **historical evidence artifact** recovered from `openclaw-bootstrap`. It is not a modern whole-board swim and not the current validation cycle. It matters because it preserves a concrete failure shape in the middle of the otherwise-thin 11→33 era.

## Scoreboard

| Test | What | Result |
| ---- | ---- | ------ |
| TC1 | Artifact-truth baseline | ✅ PASS |
| TC2 | Override persistence / stale state | ✅ PASS |
| TC3 | Delegate delivery sanity | ⚠️ FINDING |

**Swim stopped at TC3 per runbook non-negotiable #5.**

## Load-bearing finding

Swim 31 captured the same timer-arm failure shape previously seen on `continue_work`, now reproduced on delayed `continue_delegate`:

> `scheduled → consumed → timer never armed → no spawn → no announce-back`

Three-source convergence was recorded:
- Cael SSH evidence capture
- Elliott monitor confirmation
- Silas SUT self-report

## Why this matters

Swim 31 is one of the strongest surviving receipts in the 11→33 gap because it preserves:
- the candidate SHA
- the role formation
- a concrete scoreboard
- a specific runtime failure signature

That makes it cleanly citable as historical continuation evidence even though it is not a FULL swim.

## Provenance

Recovered from `openclaw-bootstrap/SWIM/history/SWIM31-EVIDENCE.md`.