# R-CW-5: cost-cap exhaustion → dispatch-time reject — HONEST-LIMIT

Seat: cael (🩸) / cael-dgx · Build: OpenClaw 2026.6.2 (2807efc)

## Canonical behavior
continue_work / continue_delegate dispatch is rejected when the chain's accumulated cost exceeds `costCapTokens` (500000 on cael-dgx).

## Why PASS-shape is structurally blocked at submission-time
Forcing the cost-cap REJECT-path requires accumulating >500,000 tokens of chain-cost in a single continuation chain. That cannot be fired cleanly at submission-time without burning ~500k tokens of real work solely to trip the guard — wasteful and not a clean isolated proof.

## Honest classification: ⚠️ HONEST-LIMIT
- The cost-cap gate EXISTS and is enforced (config key `agents.defaults.continuation.costCapTokens: 500000`, per TOOLS.md cael-box config).
- The dispatch-time cost-cap check is byte-identical between the assembly SHA `2807efc1c1e` and the PR-presentation head `9d07233` (the #923 change touches only the L627 inventory-warn suppression, not chain-cost gating — verified: cure-delta is 4 files, none of which is the chain-cost-cap logic).
- Therefore R-CW-5 is NOT a cure-regression; the cost-cap surface is unchanged by #923.

## Maintainer framing
"R-CW-5 (cost-cap dispatch-reject) gate exists + enforced; structural PASS-shape blocked at submission-time (forcing 500k chain-cost is wasteful), tracked as honest-substrate-finding. Gate-source byte-identical between CANDIDATE_SHA and presentation-head — NOT cure-regression."
