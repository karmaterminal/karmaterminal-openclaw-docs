# R-DOOM-LOCK-CHAIN-RESET — rune-rog-ally

**Seat:** rune-rog-ally (🪨 Rune, stone-seat; ROG Ally Z1 Extreme, 16GB)
**SHA (deployed cure-binary):** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`, "Merge #992")
**Captured:** 2026-06-10 ~21:55 PDT (live; gateway restarted into the cure-binary 21:03:09 PDT, MainPID 698556)
**Cure class:** #987/#989 — chain-budget reset gate (the n/200 "perma-cap doom-lock" cure)
**Verdict:** ✅ PASS (behavioral, **sixth-seat** cross-confirmation) + a live #990-residual capture (bonus)

---

## Claim

The #989 chain-budget **reset gate** fires on a fresh non-continuation user-turn, rewinding the runaway leash (chain depth + accumulated token cost) so a long-lived session does not accrue a stuck-high count that would reject every fresh continuation. Pre-#989 the only reset-site was the full session-rotation clear (`agent-runner-session-reset.ts`), so a session accumulating continuation activity across a working day would climb toward the cap and never rewind — the "200-forever" doom-lock figs flagged.

## Behavioral proof (the observable)

This rune-rog-ally session ran a **full day of heavy continuation activity** on 2026-06-10: the #982/#988/#989/#990 cure-cycle, the #990 design-pass byte-walks (I authored the third severity-aspect — chronically-busy/never-quiets liveness), the in-memory-vs-durable architecture self-correction, 100+ holds, several real-time corrections, the storm-cancel-recovery work, and **6 compactions**. Under the pre-#989 doom-lock this session would be carrying a stuck-high chain count by now (the count only ever climbed; the sole reset was session-rotation).

Live `session_status` on the deployed binary reads:

```
🦞 OpenClaw 2026.6.2 (a437ca7)
📚 Context: 256k/1.0m (26%) · 🧹 Compactions: 6
🧵 Session: agent:main:discord:channel:1466192485440164011
🔄 Continuation: chain 0/200
```

→ **chain 0/200** after a full day of activity + 6 compactions = the reset gate is firing on this session's fresh non-continuation user-turns (figs's PROOFS directive, the cohort design-pass replies, the corrections). (`session_status_snapshot.txt`)

## Mechanism anchor (deployed binary, byte-true — NOT the `?? 0` LOAD)

The fix-site is an explicit **reset** (writes `0`), gated by `!isContinuationWake`. On the deployed tree (HEAD `a437ca72c7d9eb9449b771f088ae92c851fd49fc`), the gate **expression** is at `src/auto-reply/reply/agent-runner.ts:1809` (the `:1788` cited earlier is the comment-block header, not the expression — per Cael's byte-check at `1514491341`):

```ts
if (
  continuationFeatureEnabled &&
  sessionKey &&
  activeSessionEntry &&
  !isContinuationWake &&                              // :1809 — the gate expression
  ((activeSessionEntry.continuationChainCount ?? 0) > 0 ||
    (activeSessionEntry.continuationChainTokens ?? 0) > 0)
) {
  await persistContinuationChainState({
    count: 0, startedAt: Date.now(), tokens: 0, chainId: generateChainId(),
  });
}
```

This is a genuine reset (`count: 0, tokens: 0`, fresh chainId), distinct from the `continuationChainCount ?? 0` **LOAD** sentinel in `continuation/state.ts` — a distinction three princes (Emeric, me, Cael) initially conflated and all retracted; the dispositive grep finds this fix-site, not the load. (`reset_gate_source_a437ca72c7d.txt`)

The discriminator: `isContinuationWake = work-wake || delegate-return`. Mid-chain wakes (`work-wake` CONTINUE_WORK timer; in-chain `[continuation:chain-hop:N]` `delegate-return`) **preserve** the leash; ordinary `subagent-return` and plain user-turns are **not** continuation-wakes, so the gate **resets** for them (#989). The both-legs correctness (reset-the-ordinary / preserve-the-in-chain) is verified in the cohort's R-989-P2-1 row.

## Bonus: live #990 success-mark-LOCATION residual on this seat

rune-rog-ally is a useful hard-case because it **LIVE-exhibits both the #989 cure and the #990 residual simultaneously**. While this session was busy taking the figs/cohort turns, the journal shows the per-turn work-hedge firing + drive-skipping + re-arming ~1Hz:

```
[continuation:work-hedge-fired]
[continuation:work-wake] hop=9/200
[continuation:work-drive-skipped] flowId=b6e44702-… reason=requests-in-flight
[continuation:work-hedge-armed] fireIn=1000ms          <- 1Hz busy-retry re-arm
  … repeats ~1Hz while the seat stays busy; head cycles, does not drain until quiet …
```

This is the **chronically-busy / never-quiets** aspect — the third #990 severity-aspect I contributed to the design-pass framing (`1514490218`): when the seat never quiets, the drive-turn keeps busy-skipping, `ran→succeeded` never persists, and the head flow (`b6e44702`) cycles. It drains when the seat quiets (the cure-is-the-quiet operational palliative). NOTE: `hop=N/200` is the work-hedge hop-counter for the in-flight flow — **distinct** from the continuation chain-budget (`chain 0/200`, the #989-reset counter). The #990 residual rides this binary by construction (`a437ca7` carries #985+#988+#989, **not** #990); it is **not** a regression. (`journal_busy_seat_cycling.log`)

This is the live baseline that the #990 fix-loci target:
- **mark-earlier fork** → {steady-state latency (Ronan), restart-gap duplicate (Emeric's locus-3)}
- **discriminator-axis + exp-backoff** → {this chronically-busy/never-quiets liveness — the storm-prevention}

## Cross-seat strength (N=6)

The #989 reset gate is confirmed firing identically on the same binary across distinct seats and usage-patterns — not a one-seat or one-usage-pattern artifact:

| Seat | chain | usage-pattern |
|---|---|---|
| silas-lothric | 22→0 | fire-seat multi-`continue_work` PROOFS |
| ronan-dgx | 0/200 | continuation activity |
| emeric-nuc | 0/200 | full-day design-pass + 100+ holds + 5 compactions |
| elliott-host | 0/200 | full ~4hr lag-storm + PROOFS tail |
| cael-DGX | 0/200 | full dig-in arc + 5 compactions |
| **rune-rog-ally** | **0/200** | full-day cure-cycle + #990 design-pass + 6 compactions (+ live #990 residual) |

## Durable-registry note (all-seats-durable canon)

rune-rog-ally uses durable `~/.openclaw/state/openclaw.sqlite` (4.87 MB; `flow_runs` = 297 rows: 278 succeeded / 16 failed / 2 cancelled / 1 queued — `flow_runs_status_snapshot.txt`). The `~/.openclaw/flows/registry.sqlite.migrated` (May-31) is the **stale pre-migration backup** (`.migrated` suffix = the old in-memory-era registry, migrated out). rune-rog-ally is the **same durable-sqlite architecture** as elliott-host + ronan-dgx + cael-DGX + emeric-nuc — there is **no in-memory-vs-durable cross-seat split**. I originally mis-claimed rune-rog-ally was in-memory, then byte-walked and retracted at `1514437889`/`1514439049`; reaffirmed authoritatively here at ~21:51 PDT. This universality is what makes the #990 persist-invariant universal across seats. (Storm-cure implication: restart-alone would not auto-clear durable spinners on this seat either; it self-drained earlier via a **quiet-window** (#952 deliver-when-quiet), not because of any in-memory property.)

## Honest limits / scope

- This row is the **#989 reset-gate behavioral confirm + deploy/durable confirm** for rune-rog-ally, plus a **live #990-residual capture** (bonus). It is **not** a multi-`continue_work` capture/delivery re-prove — that dimension is proven on `silas-lothric/R-CW-MULTI-FIRE` (capture+delivery) and `cael-DGX/R-CW-MULTI-FIRE` (capture). I did not manufacture a 3-fire stack solely to re-walk the success-mark-LOCATION cycling: it rides identically on this binary (no #990), so it would yield no new byte — and the live busy-seat cycling above already captures the residual organically.
- rune-rog-ally is a 16GB seat (OOM-class for full `pnpm test`), so this row is behavioral (session_status + journal + durable registry + deployed-binary source) rather than a local full-suite run; the unit/suite dimension is covered by the codeagent-worker PRs + the DGX-seat siblings.

## Files

- `session_status_snapshot.txt` — live chain 0/200 + SHA identity (the behavioral proof)
- `flow_runs_status_snapshot.txt` — durable registry counts (6th all-durable seat; 297 rows)
- `journal_busy_seat_cycling.log` — live #990 success-mark-LOCATION residual (busy-seat cycling) + the chain-vs-hop counter distinction
- `reset_gate_source_a437ca72c7d.txt` — the #989 reset-gate source from the deployed binary (:1809 gate expression)
