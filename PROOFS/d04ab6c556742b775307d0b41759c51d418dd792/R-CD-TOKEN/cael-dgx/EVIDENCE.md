# R-CD-TOKEN — cael-dgx (cross-seat assist) — SHA `749f95b9b10`

**Seat:** cael-dgx (DGX Spark GB10, ARM64) — cross-seat assist per figs's split-not-lock directive. Canonical owner: 🌊 Ronan; live-fire on cael-dgx unblocked aarch64.
**Date:** 2026-06-21 ~12:52 PDT
**Result:** ✅ **PASS** — the BRACKET form `[[CONTINUE_DELEGATE: ...]]` drives a delegate (parity with the continue_delegate tool path). Tool-form sibling = R-CD-1.

## The byte (firsthand, live — the bracket-form FIRED)
A lightContext subagent (`agent:main:subagent:d1173ef0-...`) emitted `[[CONTINUE_DELEGATE: ...]]` as its TERMINAL final-text. Journal — the bracket parsed + fired:
```
12:52:44 [continuation:trace] payload-scan: ... bracketIdx=0 ... session=...d1173ef0   ← bracket FOUND at terminal position
12:52:44 [continuation:trace] bracket-parse: kind=delegate delayMs=default
12:52:44 [continuation:trace] effective-signal: origin=bracket kind=delegate            ← fired from the BRACKET (not a tool)
12:52:44 [subagent-chain-hop] Spawned chain delegate (1/200) from ...d1173ef0           ← bracket SPAWNED the child delegate
```
- Parent marker (the bracket-emitting subagent): `R-CD-TOKEN-PARENT-cael-dgx-749f95b 2026-06-21T19:52:40Z`
- **CHILD marker (written by the bracket-driven delegate): `R-CD-TOKEN-CHILD-cael-dgx-749f95b 2026-06-21T19:52:48Z`** — its existence proves the bracket-form actually DROVE the delegate, not merely that the token was stripped.

## What it proves (the both-forms mandate)
The `[[CONTINUE_DELEGATE:]]` bracket/token form has parity with the tool path: it parses (`bracketIdx=0`, terminal position), fires (`origin=bracket kind=delegate`), spawns the delegate, and the delegate executes (child marker written). This is the bracket half of the both-forms mandate for continue_delegate (tool-form sibling = R-CD-1).

**Note on the firing constraint (navigated correctly):** the bracket fires ONLY from a scanned final-text surface with the `]]` TERMINAL (whitespace-only after). A lightContext subagent's final-text IS that scanned surface (`bracketIdx=0` confirms the scan matched); the bracket was emitted as the absolute-last content, no sign-off after.

## Provenance
Owner-credit: 🌊 Ronan; live-fire-execution: 🩸 cael-dgx (per figs split-not-lock).

## Artifacts
- `parent.txt` — the bracket-emitting subagent's marker
- `child.txt` — the bracket-DRIVEN delegate's marker (the proof)
