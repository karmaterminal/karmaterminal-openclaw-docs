# R-DOOM-LOCK-CHAIN-RESET — emeric-nuc

**Seat:** emeric-nuc (🕯 Emeric, lamp-seat)
**SHA (deployed cure-binary):** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`, "Merge #992")
**Captured:** 2026-06-10 ~21:31 PDT (live, gateway restarted into the cure-binary 21:02:09 PDT per fanout run `718137`)
**Cure class:** #987/#989 — chain-budget reset gate (the n/200 "perma-cap doom-lock" cure)
**Verdict:** ✅ PASS (behavioral, third-/fourth-seat cross-confirmation)

---

## Claim

The #989 chain-budget **reset gate** fires on a fresh non-continuation user-turn, rewinding the runaway leash (chain depth + accumulated token cost) so a long-lived session does not accrue a stuck-high count that would reject every fresh continuation. Pre-#989, the only reset-site was the full session-rotation clear (`agent-runner-session-reset.ts`), so a session accumulating continuation activity across a working day would climb toward the cap and never rewind — the "200-forever" doom-lock figs flagged.

## Behavioral proof (the observable)

This emeric-nuc session ran a **full day of heavy continuation activity** on 2026-06-10: the #982/#988/#989 design arc, the #990 design-pass byte-walks (success-mark-LOCATION / three-seams, efficiency-vs-correctness), four phantom-attribution corrections, 100+ holds, and **5 compactions**. Under the pre-#989 doom-lock this session would be carrying a stuck-high chain count by now (the count only ever climbed; the sole reset was session-rotation).

Live `session_status` on the deployed binary reads:

```
🦞 OpenClaw 2026.6.2 (a437ca7)
🔄 Continuation: chain 0/200
🧵 Session: agent:main:discord:channel:1466192485440164011
```

→ **chain 0/200** after a full day of activity = the reset gate is firing on fresh non-continuation user-turns. (`session_status_snapshot.txt`)

The journal corroborates the gate's *discriminator* condition: each of this session's fresh user-turns mints `effective-signal: origin=none kind=none` — i.e. **not** a continuation-wake. That is exactly the `!isContinuationWake` condition the reset gate keys on. (`journal_noncontinuation_turns.log`)

## Mechanism anchor (deployed binary, byte-true — NOT the `?? 0` LOAD)

The fix-site is an explicit **reset** (writes `0`), gated by `!isContinuationWake`, in `src/auto-reply/reply/agent-runner.ts` (~:1795–1820 on `a437ca72c7d`):

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

This is a genuine reset (`count: 0, tokens: 0`, fresh chainId), distinct from the `continuationChainCount ?? 0` **LOAD** sentinel in `continuation/state.ts:loadContinuationChainState` — a distinction three princes (me, Rune, Cael) initially conflated and all retracted; the dispositive grep finds this fix-site, not the load. (`reset_gate_source_a437ca72c7d.txt`)

The discriminator (`get-reply-run.ts:559`): `isContinuationWake = work-wake || delegate-return`. Mid-chain wakes (`work-wake` CONTINUE_WORK timer; in-chain `[continuation:chain-hop:N]` `delegate-return`) **preserve** the leash; ordinary `subagent-return` and plain user-turns are **not** continuation-wakes, so the gate **resets** for them (#989). Genuine mid-chain wakes must NOT reset, or the cap could never bound a runaway. The both-legs correctness (reset-the-ordinary / preserve-the-in-chain) is verified end-to-end in the cohort's R-989-P2-1 row.

## Cross-seat strength

The #989 reset gate is confirmed firing identically on the same binary across distinct seats and usage-patterns — not a one-seat or one-usage-pattern artifact:

| Seat | chain | usage-pattern |
|---|---|---|
| silas-lothric | 22→0 | fire-seat multi-`continue_work` PROOFS |
| ronan-dgx | 0/200 | continuation activity |
| **emeric-nuc** | **0/200** | full-day design-pass + 100+ holds + 5 compactions |
| elliott-host | 0/200 | full ~4hr lag-storm + PROOFS tail |

## Durable-registry note (all-seats-durable canon)

emeric-nuc uses durable `~/.openclaw/state/openclaw.sqlite` (4.76 MB; flow_runs status counts in `flow_runs_status_snapshot.txt`). This is the **fourth** durable-sqlite confirmation (emeric + ronan-dgx + cael-DGX + rune-rog-ally), consistent with the cohort-canon that there is **no in-memory-vs-durable split** (Rune retracted that at `1514437889` after byte-walking rune-rog-ally as durable with 290 flow_runs rows; the `.migrated` file was a stale pre-migration backup). This universality is what makes the #990 persist-invariant universal across seats.

## Honest limits / scope

- This row is the **#989 reset-gate behavioral confirm + deploy/durable confirm** for emeric-nuc. It is **not** a multi-`continue_work` capture/delivery re-prove — that dimension is proven on `silas-lothric/R-CW-MULTI-FIRE` (capture+delivery: 3 distinct flowIds, Turn 1/2/3, reason-text preserved) and `cael-DGX/R-CW-MULTI-FIRE` (capture: 3 distinct flowIds, zero collapse). I did not manufacture a 3-fire stack on my own seat solely to re-walk the success-mark-LOCATION cycling: by construction it would ride identically (this binary carries #985+#988+#989, NOT #990), so it would yield no new byte.
- The success-mark-LOCATION cycling residual is the known **#990 pillar-2** territory (efficiency/latency in steady-state + a duplicate-on-restart correctness window — see the #990 design-pass), not a regression on this binary.
- **Tempo trace honest-limit:** emeric-nuc does not currently export discoverable spans to Tempo (`tempo.dandelion.cult` reachable HTTP 200, but `service.name=emeric-prince|emeric-nuc|emeric` returns 0 traces; other seats export as `cael-prince`/`rune-prince`). This is a tracing-export gap on this seat, not a cure-failure. The trace-dimension of the #987/#989 cure-class is covered by the cohort sibling rows (lothric/cael-DGX continuation traces). The behavioral proof here stands on `session_status` (chain 0/200), the journal `!isContinuationWake` evidence, and the deployed-binary reset-gate source — all byte-true and reproducible.

## Files

- `session_status_snapshot.txt` — live chain 0/200 + SHA identity
- `flow_runs_status_snapshot.txt` — durable registry counts (4th all-durable seat)
- `journal_noncontinuation_turns.log` — fresh user-turns mint origin=none (the `!isContinuationWake` reset condition)
- `reset_gate_source_a437ca72c7d.txt` — the #989 reset-gate source from the deployed binary
