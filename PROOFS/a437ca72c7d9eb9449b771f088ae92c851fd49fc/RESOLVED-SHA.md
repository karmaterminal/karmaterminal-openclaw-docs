# RESOLVED-SHA — `a437ca72c7d9eb9449b771f088ae92c851fd49fc`

**Short:** `a437ca7`
**Binary stamp:** `OpenClaw 2026.6.2 (a437ca7)`
**Tip:** `a437ca72c7d Merge pull request #992 from karmaterminal/codeagent/989-p2-reset-gate`
**Repo:** `karmaterminal/openclaw`
**Deploy:** cohort-wide fanout 2026-06-10 ~21:00–21:03 PDT (canary 🌫 silas/lothric first → fanout to the other 5 seats; every deploy green)

## What this SHA is

The **complete doom-lock cure assembly** — the continuation-lifecycle cure-stack landed as one deployable binary. The merge-chain at the tip:

| Merge | PR | What it cures |
|---|---|---|
| `a437ca72c7d` | #992 | #989-P2-1: ordinary subagent-returns hit the chain-budget reset-gate (the `n/200`-hole closer — ordinary `subagent-return` → reset; in-chain `delegate-return` → preserve+cap) |
| `602e20b89b9` | #991 | #988-P2-2 cap-notice symmetry across all 3 spawn lanes (never-silent) + #988-P2-3 config-docs baseline |
| `43ed057d291` | #989-P2-1 | (the cure commit inside #992) `reset chain budget for ordinary subagent-returns` |

Built on the prior cure-layers carried into this assembly:
- **#982 / #985** — multi-`continue_work` silent-loss cure (array-capture N→N at the 3 sibling closures: subagent-init, main-reply, followup; `let`→`const[]`+`.push` + `scheduleContinuationWorkBatch`)
- **#986 / #988** — flood-cap (`maxPendingWork`) + drain-superseded fold
- **#987 / #989** — chain-budget reset for the `n/200` doom-lock (the `!isContinuationWake` reset-gate at `agent-runner.ts:1788` fires on fresh non-continuation user-turns)

## Known residual (NOT a regression — rides post-deploy)

**#990 pillar-2 — success-mark-LOCATION.** `a437ca7` carries #985+#988+#989 but NOT #990. The multi-fire-cycling residual (a head-of-line `requests-in-flight` drive-skip-and-rearm while the seat is busy) is the same class on this binary as on the prior `9d44087`. Per cohort byte (🌊 Ronan, 🕯 Emeric):
- **steady-state**: the residual is an EFFICIENCY/LATENCY cost (the cycling-delay before each head's success-mark lands) — the fires all DELIVER IN SEQUENCE, none lost (proven: lothric R-CW-MULTI-FIRE 3/3 drained-in-sequence)
- **restart-gap**: a SECOND aspect IS correctness — a fire delivered (`ran`) but caught by a restart before `succeeded` persists is still `running` → re-consumed on reboot → re-delivered = DUPLICATE. The #990 mark-earlier fork moves `ran→succeeded` terminal BEFORE the restart-window so the read-guard gates it out.
- **one fix, two wins**: the mark-earlier fork is a latency-win (steady-state) AND a correctness-win (restart-gap duplicate). Worth-doing, but NOT an urgent correctness-blocker for the no-loss/no-starvation axis.

## Gate verdicts

| Gate | Status | Evidence |
|---|---|---|
| Deploy (cohort-wide, every-deploy-green) | ✅ | canary lothric → fanout 5 seats; all on `a437ca7` |
| #989 doom-lock cure live (cross-seat) | ✅ | chain-reset confirmed on ≥4 seats (see README cross-seat table) |
| #982/#985 multi-fire CAPTURE (cross-seat) | ✅ | lothric + cael-DGX: 3 distinct flowIds, array-captured N→N |
| #982/#985 multi-fire DELIVERY (3/3 in sequence) | ✅ | lothric: Turn 1/2/3, reason-text preserved, 2/3 drained + 1 cycling |
| #988 flood-cap | ✅ (negative — not triggered by 3-fire stack) | no cap-notice; 3 fires wrote clean durable rows |

See `README.md` for the per-row verdict table + per-seat cross-walk status.
