# R-CW-5A at `293c977f62`: **missing**

Offline source/harness contract check for R-CW-5; cannot establish live cap exhaustion.

- Candidate verdict: None
- Review: not-fired-yet
- Summary: seeded missing; awaiting a reviewed receipt

- Not fired in this corpus (static validator or construct-only/scaffold; see README).

Runtime and candidate `293c977f629f872a643fb94892603310b887293b` on emeric's isolated gateway `:18797` (state `~/proof-gw/comp-293c977f`, own OpenAI sign-in), docs harness `dcc6330c40` (matrix) / `313a70c625` (refire). Nothing is transposed from the live composite.

## Static validator run (2026-10-29T03:53:07Z)

- Result: construct-only (static boundary variant; by design never a fresh R-CW-5/6 cap receipt)
- The static boundary variant always emits construct-only by design (it validates the same committed source/harness material as R-CW-5/6 and must never pass as a fresh cap receipt). It cannot PASS under the current harness, so it needs a method decision (remove from required, or accept construct-only).
- Artifacts: `static-validator-20261029T035307Z/` (k6.log, static-corpus-row-summary.json)
