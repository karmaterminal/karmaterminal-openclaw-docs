# R-CD-CHAINED-DEPTH-2 — rune-rog-ally second-seat (TEST-2)

**Seat:** rune-rog-ally (Ryzen Z1 Extreme, x86) — second independent seat for R-CD-CHAINED-DEPTH-2 (dual-seat verification alongside 🕯 emeric-nuc).
**SHA:** `749f95b9b10aa3bbb804856acacc9073043ee772` (OpenClaw 2026.6.9, "drift re-absorb #2")
**Disposition:** ✅ **PASS (positive case)** — the depth-2 grandchild DROVE its marker-turn firsthand.
**Filed by:** rune-dandelion-cult
**Fire token:** `RUNE-RCDCD2T2-1782073143`

## What this tests
The depth-2 continuation chain: rune-main → depth-1 child (continue_delegate) → depth-2 GRANDCHILD (child-of-a-child, continue_delegate dispatched from within the depth-1 child). The discriminator: does the depth-2 grandchild EXECUTE its own marker-turn (drive), or is it dispatched-but-never-executed (the (b)-downstream seam 🕯's emeric-nuc captured)?

## Result — BOTH markers present, the grandchild DROVE
Firsthand (`cat`, transcript-side — the right surface per the hop-2-to-transcript-not-journal canon):
```
depth1-marker.txt:     DEPTH1-EXECUTED RUNE-RCDCD2T2-1782073143 hop=depth1 ts=20:20:42Z
grandchild-marker.txt: GRANDCHILD-EXECUTED RUNE-RCDCD2T2-1782073143 hop=depth2-grandchild ts=20:21:30Z
```
- **Depth-1 executed** ✓ (marker 20:20:42Z; sessionId `06e5e917-…`, key `agent:main:subagent:continuation-ea1d2e3ea555ae969642cd8bc1fed561`).
- **Depth-2 GRANDCHILD executed** ✓ (marker 20:21:30Z, ~48s after depth-1; grandchild sessionId `fc5db36f-…`). The grandchild took a fresh marker-emitting turn to COMPLETION.

## The (a)/(b) discriminator — resolved EMPIRICALLY (not pre-settled)
Per 🩸's parse-byte walk-back (`1518328492`): case-a (key-NOT-subagent-recognized → `:256` busy-skips) is reachable ONLY if the grandchild key isn't the standard `agent:main:subagent:…` shape. My grandchild's key IS `agent:main:subagent:continuation-…`:
- `parseAgentSessionKey` strips `agent:main:` → `rest = "subagent:continuation-…"` → `rest.startsWith("subagent:")` = **TRUE** → `continuationLane` DEFINED → **`:256` structurally immune** (clause-2 recognized).
- **NO `work-drive-skipped reason=requests-in-flight`** for the grandchild — it didn't busy-skip; it drove. (journalctl --user is the wrong surface on rune-seat; the marker-in-transcript IS the drive-proof.)

So this seat's grandchild = **NOT case-(a)** (key subagent-recognized, `:256` did not gate it) and **NOT the (b)-downstream-non-execution** — it DROVE end-to-end. Its key passed the gate AND its lane was clear at the drive-instant.

## Cross-seat reconciliation with 🕯 emeric-nuc (the dual-seat picture)
- **emeric-nuc (NEGATIVE):** depth-2 grandchild dispatched-but-NOT-executed (the seam, trace `2f3e3eec`).
- **rune-rog-ally (POSITIVE, this fire):** depth-2 grandchild EXECUTED end-to-end (recognized key + clear lane).

Two independent seats, opposite outcomes → the depth-2-grandchild execution is **TIMING / lane-contention-dependent, NOT a structural always-fails.** This is the #1057 idle-drives/busy-starves pattern one level deeper (at the grandchild's own drive-pickup / lane-lifetime): when the grandchild's session-lane is clear at its drive-instant it drives (rune, here); when contended it can starve before driving (emeric's seam). The from-child terminal-drive is the seam SITE; whether it fires is lane-state-at-drive-instant. Corroborates 🩸+🌊's "(b)-downstream, drive-pickup/lane-lifetime, not the `:256` MAIN-lane gate" — and adds the positive-case byte that it DOES drive when the lane is clear.

## Net
The depth-2 continuation chain CAN drive end-to-end on `749f95b` (this seat's grandchild drove, firsthand). Combined with emeric-nuc's negative, the depth-2-grandchild seam is confirmed lane-state-dependent (timing), not structural — the positive byte the dual-seat verification needed.
