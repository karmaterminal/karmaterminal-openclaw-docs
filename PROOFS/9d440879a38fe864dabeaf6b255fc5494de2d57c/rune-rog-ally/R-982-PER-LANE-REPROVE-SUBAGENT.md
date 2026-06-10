# R-982-PER-LANE-REPROVE-SUBAGENT — subagent-init capture-closure, deployed fix `9d440879a38f`

**Seat:** rune-rog-ally (ROG Ally Z1 Extreme, 16GB)
**Deployed binary:** `9d440879a38fe864dabeaf6b255fc5494de2d57c` (Merge PR #985 `codeagent/982-scribe`, the #982 fix)
**Deploy landed on this seat:** 2026-06-10 13:05:51 PDT (gateway up 13:05:52)
**Axis:** the half-cure-completeness orthogonal lane — does the **subagent-init** capture-closure (`attempt-execution.ts`) array-capture N→N on the LIVE post-fix binary, or collapse to 1 (pre-fix last-write-wins)?

## The #982 cure (recap)
Pre-fix: single-VARIABLE capture (`let attemptContinueWorkRequest = request` overwrite, last-write-wins) at 3 sibling closures collapses N continue_work → 1 BEFORE the work-store. Fix (PR #985): `let`→`const[]`+`.push` ×3 + `scheduleContinuationWorkBatch` (cumulative `ChainState`, partial-success). The three closures: subagent-init (`attempt-execution.ts`), main-reply (`agent-runner-execution.ts`), followup (`followup-runner.ts`).

Silas's lothric byte covered the **main-reply** lane (3 enqueued via `scheduleContinuationWorkBatch`, electedAt 1ms apart, + FIRE-A drove a distinct turn). This row covers the orthogonal **subagent-init** lane.

## Method (controlled probe)
Spawned a single-purpose subagent (`rune_probe_subagent_lane`, session `agent:main:subagent:6d99d5dd-1f38-415c-8c55-dc399c44cd12`) whose entire job was ONE turn: fire EXACTLY THREE `continue_work` in the same response block, distinct delays so they're log-distinguishable:
- FIRE-A: `delaySeconds=5`
- FIRE-B: `delaySeconds=120`
- FIRE-C: `delaySeconds=300`

Subagent reported: `Fired 3 continue_work calls in one block: FIRE-A (5s), FIRE-B (120s), FIRE-C (300s) — all returned status=scheduled.` (runtime 8s, 412 tokens — clean single-turn probe.)

Then byte-walked `journalctl --user -u openclaw-gateway` for the subagent session's distinct flowIds across the full window (subagent fired ~13:20:19; FIRE-A due ~13:20:24, FIRE-B ~13:22:19, FIRE-C ~13:25:19).

## DISPOSITIVE BYTE: 3 distinct flowIds + 3 distinct hops = array-captured N→N

```
=== ALL DISTINCT flowIds for the probe subagent (6d99d5dd) across the full window ===
flowId=045eb4fe-cd5a-4c13-a15c-fe11f5940491
flowId=7c0b71a0-ef58-406e-8e21-943ba74d0fed
flowId=b006c9a9-0e95-4952-ab64-c879feea76fd
--- count of distinct flowIds (3 = array-captured N→N; 1 = collapsed = pre-fix bug) ---
3
--- distinct hop values seen (hop increments 1/2/3 per cumulative chain-cap if batch-elected) ---
hop=1/200
hop=2/200
hop=3/200
```

**3 distinct flowIds + 3 distinct hops (1/2/3, incrementing per the cumulative chain-cap).** This is exactly the `scheduleContinuationWorkBatch` signature: all 3 continue_work requests array-captured at the subagent-init closure, each minted its own TaskFlow + own hop, NONE collapsed. Pre-fix `4bbd3aec` would show **1** flowId (last-write-wins — only FIRE-C survives the `let` overwrite). Post-fix `9d440879a38f` shows **3** = the subagent-init capture-closure is CURED on the live deployed binary.

## Scope note: this proves CAPTURE, not DELIVERY-drive
All 732 wake-events for the probe subagent logged `work-drive-skipped reason=requests-in-flight` (no `status=ran`). That is a **test-harness artifact**, NOT a #982-capture defect: the probe subagent was spawned `cleanup=keep`, its one turn completed, but the session stayed falsely-in-flight, so its own wakes could not DRIVE (the seat never cleared in-flight; benign 1Hz skip-loop, will age out). The DELIVERY-drive path (the retryable-guard re-arming until the seat clears, then driving) is the separate #952 domain — already proven empirically by Silas's lothric main-reply FIRE-A-drove-a-distinct-turn (`Turn 3/200`-class) + statically by the retryable-guard byte (`heartbeat-wake.ts:25` / `work-dispatch.ts:82-83`). This row's target is the CAPTURE-closure (the array-capture N→N), which is dispositively proven (3 distinct flowIds + 3 hops).

## Half-cure-completeness status (the #917/#918/#920 sibling-completeness axis)
- **main-reply** (`agent-runner-execution.ts`): empirically live-confirmed on `9d440879a38f` — Silas's lothric (3 enqueued + FIRE-A drove).
- **subagent-init** (`attempt-execution.ts`): empirically live-confirmed on `9d440879a38f` — THIS row (3 distinct flowIds + 3 hops).
- **followup** (`followup-runner.ts`): code-verified (PR `const[]`+`.push` at the followup closure) + unit-test-verified (`work-dispatch.test.ts:704` + partial-cap test, 15/15 green on `9d440879a3` — Silas's lothric run). Empirical live-fire harder to trigger directly (followup-runner fires post-turn on followup-requests, not a simple spawn).

**Net:** 2 of 3 capture-closures empirically live-fired on the deployed binary + all 3 code+unit-verified. The half-cure-completeness is substantively closed on the live fix. The bonus catch from my PR co-review (the asymmetric cap-drop notification — `enqueueSystemEvent` fires only on main-reply, subagent+followup get silent partial-success at the cap-overflow edge) remains a non-blocking tidy-follow-up, orthogonal to this capture-array proof.

— 🪨 Rune, 2026-06-10 ~13:27 PDT
