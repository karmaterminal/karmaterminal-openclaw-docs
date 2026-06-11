# R-DOOM-LOCK-CHAIN-RESET — #989 chain-budget reset, cross-seat confirm on `a437ca7` (cael-DGX, hard-case: 5 compactions)

**Deployed SHA:** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`, Merge #992)
**Seat:** cael-DGX (DGX Spark GB10, ARM64, 128GB)
**Gateway PID:** 3034382 · **ActiveEnterTimestamp:** 2026-06-10 21:02:00 PDT
**Registry:** durable-sqlite (`~/.openclaw/state/openclaw.sqlite`)
**Axis:** the **#987/#989 chain-budget reset gate** (`!isContinuationWake` at `agent-runner.ts:1809`, reset-section comment from `:1788`) firing on cael-DGX under a hard usage-pattern. Sibling to `emeric-nuc/R-DOOM-LOCK-CHAIN-RESET.md` + the cross-seat table in `silas-lothric/R-DOOM-LOCK-CHAIN-RESET.md`.

## The cure (recap)

Pre-#989: the continuation chain-counter (`n/200`) had no reset on a fresh non-continuation user-turn — it climbed monotonically across a session's continuation activity until it hit the `200` cap ("doom-lock" / the `n/200`-forever bug). Post-#989: a fresh non-`[continuation:wake]` user-turn flips `!isContinuationWake` → the chain resets (`count:0`, fresh `chainId`). Continuation wakes (CONTINUE_WORK timer / delegate returns) set `isContinuationWake` and do NOT reset (so the runaway-leash stays intact within a chain).

## DISPOSITIVE BYTE: chain 0/200 after a hard continuation-heavy session

`session_status` on cael-DGX, 2026-06-10 ~21:25 PDT (this session):

```
📚 Context: 303k/1.0m (30%) · 🧹 Compactions: 5
🔄 Continuation: chain 0/200
```

**Why this is a hard case for the cure** (a distinct usage-pattern from the other seats' confirms): this cael-DGX main session ran the *entire dig-in-PROOFS arc + the ~multi-hour lag-storm tail* — heavy continuation activity (multiple `continue_work` PROOFS-fires that advanced the chain to hop 11→14, the whole crossover-lag triage, **5 compactions**). Pre-#989, a session with this much continuation activity would carry a stuck-high count by now. Observing **chain 0/200** = the `!isContinuationWake` reset-gate firing on this session's fresh non-continuation user-turns (figs's directives + cohort messages were external user-turns → each reset the chain), exactly as designed.

## Corroborating byte: the chain advanced (not stuck-zero), then reset

The reset is not "the counter never moved" — the chain DID advance on continuation-wakes, then reset on fresh user-turns. Journal `[continuation:work-wake]` hop progression during the PROOFS-fire window (the 3 R-CW-MULTI-FIRE fires + an earlier fire cycling):

```
journalctl --user -u openclaw-gateway --since '20:55' | grep -oE 'continuation:work-wake\] hop=[0-9]+/200'
… continuation:work-wake] hop=11/200
… continuation:work-wake] hop=12/200
… continuation:work-wake] hop=13/200
… continuation:work-wake] hop=14/200   (cycling — the #990 head-of-line residual)
```

So the chain reached hop 11–14 from the PROOFS-fire continuation-wakes, and the CURRENT `chain 0/200` reflects a subsequent fresh-user-turn reset. The counter moves on continuation-wakes AND resets on fresh user-turns = the discriminator working both ways (advance-within-chain preserved; reset-on-external-turn fires).

## Honest scope

- The reset is observable via `session_status` (`chain 0/200`) — there is **no dedicated `[continuation:chain-reset]` journal log-line** on this binary; the reset happens silently at the gate (`agent-runner.ts:1809`). So this row's dispositive byte is the session_status reading + the mechanism-anchor + the absence-of-stuck-high-count under heavy usage, NOT a reset-event log-line.
- This is a **chain-reset confirm** (the #989 cure), NOT a multi-fire or P2-1 row (those are `cael-DGX/R-CW-MULTI-FIRE.md` + the pending `R-989-P2-1`).
- Mechanism-anchor verified at byte on the deployed tree: `grep -n isContinuationWake src/auto-reply/reply/agent-runner.ts` → `:1809  !isContinuationWake &&` (the gate), `:1788` (the `Continuation chain-break reset (#987, #989)` comment).

## Cross-seat strength (this row's contribution)

cael-DGX is the **5th seat** confirming #989 chain-reset on `a437ca7`, and a distinct usage-pattern (5 compactions + a full dig-in-PROOFS arc + multi-fire chain-advance-then-reset):

| Seat | chain | usage-pattern |
|---|---|---|
| silas-lothric | 22→0 | fire-seat multi-`continue_work` |
| ronan-dgx | 0/200 | continuation activity (full-day) |
| emeric-nuc | 0/200 | design-pass + 100+ holds + 5 compactions |
| elliott-host | 0/200 | ~4hr lag-storm tail + 4 compactions |
| **cael-DGX** | **0/200** | **dig-in-PROOFS arc + multi-fire chain-advance-to-hop-14 + 5 compactions** |

5 seats × 5 distinct usage-patterns × same as-designed reset = not a one-seat-or-usage artifact.

## Provenance

- Byte-gathered on cael-DGX in session `agent:main:discord:channel:1466192485440164011`, 2026-06-10 ~21:25 PDT
- session_status receipt + journal hop-progression byte
- Honors figs dig-in directive `1514486488...` (behavioral test-case + the byte; the #989 cure verifies PR #992 = cael's re-route decision, codeagent-worker's code + 🌊/🪨 review)
- Sibling rows: `silas-lothric/R-DOOM-LOCK-CHAIN-RESET.md` (chain 22→0→1→2→3) + `emeric-nuc/R-DOOM-LOCK-CHAIN-RESET.md` (chain 0/200 mechanism-anchor)
- Filed by Cael 🩸 / cael-DGX / `a437ca72c7d9eb9449b771f088ae92c851fd49fc`

🩸 Cael / 2026-06-10 21:31 PDT
