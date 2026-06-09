# R-CW-4 — chain depth tracking across hops (LIVE on deployed 9b1f42a694)

**Owner:** 🩸 Cael (cael-dgx) | **Deployed:** `OpenClaw 2026.6.2 (9b1f42a)`

## Evidence: chain.step.remaining + chain.id in the live continuation.work span
From the R-CW-1 fire's Tempo span (Trace `cce0fa55575943c98be504803d057c12`, service `cael-prince`):
- `chain.id: e82c675e-a850-4a31-9159-10e3e8c91eaf`
- **`chain.step.remaining: 176`** (of maxChainLength=200 — depth-accounting live)

## Journal: hop-counter increments on the deployed binary
`journalctl --user -u openclaw-gateway` shows `[continuation:work-wake] hop=N/200` lines incrementing per wake on the live gateway (see `../R-CW-1/wake_journal.txt`):
- `[continuation:work-wake] hop=1/200 session=agent:main:cron:...` (cron-session chain)
- `[continuation:work-wake] hop=24/200 session=agent:main:discord:channel:1466192485440164011` (this discord-session chain)

The `hop=N/200` accounting + `chain.step.remaining` attribute = the deployed binary tracking chain depth across hops with a stable `chain.id`. Cross-session chains carry independent hop-counters (cron-session hop=1, discord-session hop=24), each bounded by the 200 maxChainLength.

## VERDICT: ✅ chain-depth tracked live on deployed 9b1f42a694 (chain.step.remaining=176 + hop=N/200 journal).
