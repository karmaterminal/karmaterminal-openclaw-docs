# Swim 31 — evidence artifact

**Date**: 2026-04-15 08:10–08:41 PDT
**Candidate**: `101e808a8a` on `flesh_beast_figs/codex-fixup-2026-04-14`
**SUT**: Silas 🌫️
**Driver**: Ronan 🌊
**Evidence**: Cael 🩸
**Monitor**: Elliott 🌻
**Result**: 2 PASS · 1 FINDING

## Status

Historical evidence artifact recovered from `openclaw-bootstrap`.

## Scoreboard

| Test | What | Result |
| --- | --- | --- |
| TC1 | Artifact-truth baseline | PASS |
| TC2 | Override persistence / stale state | PASS |
| TC3 | Delegate delivery sanity | FINDING |

Swim stopped at TC3 per runbook stop rules.

## Load-bearing finding

TC3 confirmed a broken timer-arm path:

`schedul​ed → consumed → timer never armed → no spawn → no announce-back`

The artifact preserved a three-source convergence across Cael SSH receipts, Elliott journal reads, and Silas SUT self-report.

## Why this matters historically

Swim 31 is a good example of a swim that did not exist to certify green status. It existed to stop on a real failure and preserve a precise runtime signature.

## Source artifacts

Recovered from `openclaw-bootstrap`:
- `SWIM/history/SWIM31-EVIDENCE.md`
