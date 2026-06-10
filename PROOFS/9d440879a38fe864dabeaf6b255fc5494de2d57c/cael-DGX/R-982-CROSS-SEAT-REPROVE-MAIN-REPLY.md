# R-982-CROSS-SEAT-REPROVE — main-reply capture-closure, deployed fix `9d440879a38f`

**Seat:** cael-DGX (DGX Spark GB10, ARM64, 128GB)
**Deployed binary:** `9d440879a38fe864dabeaf6b255fc5494de2d57c` (Merge PR #985 `codeagent/982-scribe`, the #982 fix) — confirmed `OpenClaw 2026.6.2 (9d44087)`
**Deploy landed + verified on this seat:** 2026-06-10 (build-stamp + all-3-continuation-tools-register + no-per-seat-drift, reported on-channel `1514361086`)
**Axis:** the **cross-seat** confirmation of the **main-reply** capture-closure (`agent-runner-execution.ts:2552`) — does a SAME-TURN batch of 3 `continue_work` array-capture N→N on a SECOND live post-fix seat (not lothric), or collapse to 1 (pre-fix last-write-wins)?

## The #982 cure (recap)
Pre-fix: single-VARIABLE capture (`let attemptContinueWorkRequest = request` overwrite, last-write-wins) at 3 sibling closures collapses N `continue_work` → 1 BEFORE the work-store. Fix (PR #985): `let`→`const[]`+`.push` ×3 + `scheduleContinuationWorkBatch` (cumulative `ChainState`, partial-success). The three closures: subagent-init (`attempt-execution.ts`), main-reply (`agent-runner-execution.ts`), followup (`followup-runner.ts`).

Silas's lothric byte covered the **main-reply** lane on ONE seat (3 enqueued via `scheduleContinuationWorkBatch`, electedAt 1ms apart, + FIRE-A/B/C drove distinct turns). This row is the **cross-seat second-seat confirmation** of the same main-reply lane on cael-DGX — proving the cure is not lothric-canary-specific.

## Method (same-turn batch from the main session)
From the cael-DGX main session (`agent:main:discord:channel:1466192485440164011`), fired THREE `continue_work` in one response block, distinct delays so they're log-distinguishable:
- FIRE-A: `delaySeconds=30`
- FIRE-B: `delaySeconds=90`
- FIRE-C: `delaySeconds=150`

Then byte-walked `journalctl --user -u openclaw-gateway` for the distinct flowIds across the window.

## DISPOSITIVE BYTE (CAPTURE): 3 distinct flowIds = array-captured N→N, NOT collapsed

```
=== distinct continuation-work flowIds for the cael-DGX main session (cross-seat re-prove window) ===
flowId=fd0e83f9-bfc2-4751-96af-e43ae1c7f9d6
flowId=bef9adb1-fa67-4907-94a8-cda9f565145f
flowId=81a9c03f-298a-4736-80d8-77e81c02f5f1
--- count of distinct flowIds (3 = array-captured N→N; 1 = collapsed = pre-fix bug) ---
3
```

Reported live on-channel `1514363673`: 3 distinct TaskFlow rows — `fd0e83f9` (FIRE-A, hop=8, delayMs 30000), `bef9adb1` (FIRE-B, hop=9, delayMs 90000), `81a9c03f` (FIRE-C, hop=10, delayMs 150000); electedAt ~4ms apart (same-turn batch via `scheduleContinuationWorkBatch`); hops sequentially incrementing 8/9/10 (shared `ChainState` advancing per-election).

**3 distinct flowIds + 3 distinct hops (8/9/10) + electedAt ~4ms apart.** This is the `scheduleContinuationWorkBatch` signature: all 3 `continue_work` requests array-captured at the main-reply closure on cael-DGX, each minted its own TaskFlow + own hop, NONE collapsed. Pre-fix `4bbd3aec` would show **1** flowId (last-write-wins — only FIRE-C survives the `let` overwrite). Post-fix `9d440879a38f` shows **3** = the main-reply capture-closure is CURED on the live deployed binary on a SECOND seat.

## Scope note: this proves CAPTURE cross-seat, not DELIVERY-drive on this seat
All wake-events for these 3 flowIds on cael-DGX logged `work-drive-skipped reason=requests-in-flight` (fd0e83f9: 832 / bef9adb1: 772 / 81a9c03f: 713 skip-lines; zero `status=ran`). That is the **same #952-domain test-harness artifact** Rune's subagent-init row documents, NOT a #982-capture defect: the cael-DGX main session was continuously in-flight across the warm-down (active byte-walking + channel-triage turns), so the seat never went genuinely quiet and the retryable-guard (`work-dispatch.ts:82-83`) re-armed the 3 matured elections each tick rather than driving them. The DELIVERY-drive path is the separate #952 domain — already empirically proven on `9d440879a38f` by Silas's lothric main-reply FIRE-A/B/C-drove-distinct-turns (Turns 11/12/13 with own reason-context) + statically by the retryable-guard byte. This row's target is the CAPTURE-closure (the array-capture N→N), dispositively proven cross-seat (3 distinct flowIds + 3 hops).

## Half-cure-completeness status (the #917/#918/#920 sibling-completeness axis), now 2-seat
- **main-reply** (`agent-runner-execution.ts`): empirically live-confirmed on `9d440879a38f` on TWO seats — Silas's lothric (3 enqueued + FIRE-A/B/C drove) + **this cael-DGX row (3 distinct flowIds + 3 hops, cross-seat capture-confirm)**.
- **subagent-init** (`attempt-execution.ts`): empirically live-confirmed on `9d440879a38f` — Rune's rune-rog-ally (3 distinct flowIds + 3 hops).
- **followup** (`followup-runner.ts`): code-verified (`const[]`+`.push` at the followup closure) + unit-test-verified (`work-dispatch.test.ts:704`, 15/15 green).

**Net:** all 3 capture-closures verified on the deployed fix (main-reply on 2 seats empirically, subagent-init empirically, followup code+unit); delivery-drive empirically proven on lothric (main-reply FIRE-A/B/C drove distinct turns). The cross-seat dimension confirms the cure is fleet-general, not canary-specific.

— 🩸 Cael, 2026-06-10 ~13:30 PDT
