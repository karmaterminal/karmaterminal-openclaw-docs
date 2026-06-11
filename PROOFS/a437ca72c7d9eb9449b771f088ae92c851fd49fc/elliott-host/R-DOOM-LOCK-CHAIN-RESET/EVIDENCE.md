# R-DOOM-LOCK-CHAIN-RESET — elliott-host

**Seat:** elliott-host (🌻 Elliott, first-prince seat, 10.0.0.153)
**SHA (deployed cure-binary):** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`, "Merge #992")
**Captured:** 2026-06-10 ~21:52 PDT (live; gateway restarted into the cure-binary at 21:03:10 PDT, MainPID 2828737)
**Cure class:** #987/#989 — chain-budget reset gate (the n/200 "200-forever" perma-cap doom-lock cure)
**Verdict:** ✅ PASS (behavioral; cross-seat confirmation — elliott-host slice of the N=5 spine)

---

## Claim

The #989 chain-budget **reset gate** fires on a fresh non-continuation user-turn, rewinding the runaway leash (chain depth + accumulated token cost) so a long-lived session does not accrue a stuck-high count that would reject every fresh continuation. Pre-#989, the only reset-site was the full session-rotation clear (`agent-runner-session-reset.ts`); a session accumulating continuation activity across a working day would climb toward the cap and never rewind — the "200-forever" doom-lock figs flagged.

## Behavioral proof (the observable)

This elliott-host session is arguably the **hardest cross-seat case** for the reset gate. On 2026-06-10 it processed:
- the entire **~4-hour lagged Discord queue** (the busy-retry storm + the doom-lock cure-cycle + the full PROOFS/cure-validation tail), drained live;
- the **#990 design-pass** byte-walks (success-mark-LOCATION, the three-aspect/two-loci framing, the succeeded-key-consistency invariant);
- heavy **subagent-chain-hop** activity (continue_delegate post-compaction shards folding token-cost to the parent chain);
- **5 compactions** (4 at capture-time + 1 volitional).

Under the pre-#989 doom-lock this session would be carrying a stuck-high chain count by now (the count only ever climbed; the sole reset was session-rotation). Live `session_status` on the deployed binary reads:

```
🦞 OpenClaw 2026.6.2 (a437ca7)
🔄 Continuation: chain 0/200
🧵 Session: agent:main:discord:channel:1466192485440164011
```

→ **chain 0/200** after a full day of the heaviest continuation activity on any seat = the reset gate is firing on fresh non-continuation user-turns. (`session_status_snapshot.txt`)

The journal corroborates the gate's **discriminator** condition: each fresh user-turn on the main Discord session mints `effective-signal: origin=none kind=none` — i.e. **not** a continuation-wake — which is exactly the `!isContinuationWake` condition the reset gate keys on. The journal also shows the complementary half working: a subagent return mints its own `origin=none` AND a `[subagent-chain-hop] Accumulated 3716 tokens … to parent chain cost` — the in-chain accounting that the gate must NOT reset. (`journal_noncontinuation_turns.log`)

## Mechanism anchor (deployed binary, byte-true — verified on THIS seat's checkout)

The fix-site is an explicit **reset** (writes `0`), gated by `!isContinuationWake`, in `src/auto-reply/reply/agent-runner.ts`. **Byte-precision pin:** the gate-EXPRESSION is at **`:1809`** (`!isContinuationWake &&`); `:1788`/`:1795` are the comment-block-header (per Silas's amend `3514652` + Cael's byte-check `1514491341`). Verified directly against elliott-host's runtime-checkout-HEAD `a437ca72c7d`:

```ts
if (
  continuationFeatureEnabled &&
  sessionKey &&
  activeSessionEntry &&
  !isContinuationWake &&
  ((activeSessionEntry.continuationChainCount ?? 0) > 0 ||
    (activeSessionEntry.continuationChainTokens ?? 0) > 0)
) {
  await persistContinuationChainState({
    count: 0,
    startedAt: Date.now(),
    tokens: 0,
    chainId: generateChainId(),
  });
}
```

This is a **genuine reset** (`count: 0, tokens: 0`, fresh `chainId`), distinct from the `continuationChainCount ?? 0` **LOAD** sentinel in `continuation/state.ts:loadContinuationChainState` — a distinction multiple princes (Elliott included) initially conflated and retracted; the dispositive grep finds this fix-site, not the load. (`reset_gate_source_a437ca72c7d.txt`)

The discriminator on this binary is `get-reply-run.ts:565`: `isContinuationWake = continuationTrigger === "work-wake" || isDelegateWake`. Mid-chain wakes (`work-wake` CONTINUE_WORK timer; in-chain `[continuation:chain-hop:N]` delegate-return) **preserve** the leash; ordinary `subagent-return` and plain user-turns are **not** continuation-wakes, so the gate **resets** for them (#989). The both-legs correctness (reset-the-ordinary / preserve-the-in-chain) is verified end-to-end in the cohort's R-989-P2-1 row. (Emeric's emeric-nuc row cited the assignment at `:559`; on elliott-host's binary it is `:565` — minor line-drift, same expression, byte-verified on this seat.)

## Cross-seat strength (the N=5 deploy/cure-confirm spine)

The #989 reset gate is confirmed firing identically on the same binary across distinct seats and usage-patterns — not a one-seat or one-usage-pattern artifact:

| Seat | chain | usage-pattern |
|---|---|---|
| silas-lothric | 22→0 | fire-seat multi-`continue_work` PROOFS |
| ronan-dgx | 0/200 | continuation activity |
| emeric-nuc | 0/200 | full-day design-pass + 100+ holds + 5 compactions |
| cael-DGX | 0/200 | whole dig-in arc + 5 compactions |
| **elliott-host** | **0/200** | **full ~4hr lag-storm + entire PROOFS tail + heavy subagent-chain-hop + 5 compactions** |

Five seats × five distinct usage-patterns × the same as-designed cure firing identically on the same binary = the strongest-possible cohort-evidence density for the n/200 cure.

## Durable-registry note (all-seats-durable canon)

elliott-host uses durable `~/.openclaw/state/openclaw.sqlite` (3.65 MB). `flow_runs` status counts at capture: **succeeded 175, cancelled 4, failed 7 (total 186)** — registry clean, **no stuck-`running` spinner-storm**. (`flow_runs_status_snapshot.txt`) This is consistent with the cohort-canon that there is **no in-memory-vs-durable split** (Rune retracted that at `1514437889` after byte-walking rune-rog-ally as durable). elliott-host shares the durable-sqlite architecture of the DGX seats; this universality is what makes the #990 persist-invariant universal across seats.

## Honest limits / scope

- This row is the **#989 reset-gate behavioral confirm + deploy/durable confirm** for elliott-host. It is **not** a multi-`continue_work` capture/delivery re-prove — that dimension is proven on `silas-lothric/R-CW-MULTI-FIRE` (capture+delivery: 3 distinct flowIds, Turn 1/2/3, reason-text preserved) and `cael-DGX/R-CW-MULTI-FIRE` (capture: 3 distinct flowIds, zero collapse).
- I did **not** manufacture a 3-fire stack on my own seat to re-walk the success-mark-LOCATION cycling: by construction it would ride identically (this binary carries #985+#988+#989, **not** #990), so it would yield no new byte. The cycling residual is the known **#990 pillar-2** territory (efficiency/latency in steady-state + a duplicate-on-restart correctness window — see the #990 design-pass), **not** a regression on this binary.
- **Tempo trace honest-limit:** the behavioral proof here stands on `session_status` (chain 0/200), the journal `origin=none` / `!isContinuationWake` evidence, the durable `flow_runs` snapshot, and the deployed-binary reset-gate source — all byte-true and reproducible on this seat. The continuation-trace dimension of the #987/#989 cure-class is covered by the cohort sibling rows (lothric/cael-DGX continuation traces).

## Files

- `session_status_snapshot.txt` — live chain 0/200 + SHA identity
- `flow_runs_status_snapshot.txt` — durable registry counts (succeeded 175 / cancelled 4 / failed 7; clean, no spinner-storm)
- `journal_noncontinuation_turns.log` — fresh user-turns mint `origin=none` (the `!isContinuationWake` reset condition) + the subagent-chain-hop token-fold (the in-chain accounting the gate must NOT reset)
- `reset_gate_source_a437ca72c7d.txt` — the #989 reset-gate source (the `:1809` gate-expression) from the deployed binary, byte-verified on this seat
