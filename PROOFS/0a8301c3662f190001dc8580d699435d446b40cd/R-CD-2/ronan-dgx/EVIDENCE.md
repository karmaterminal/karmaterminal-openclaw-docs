# R-CD-2: `continue_delegate` returns cleanly when dispatching seat is non-channel (scratch session)

**STATUS**: PASS-CANDIDATE
**DATE**: 2026-06-28
**SEAT**: ronan-dgx
**SHA**: `0a8301c3662f190001dc8580d699435d446b40cd`
**PROVENANCE**: manual live run via `run-proof.sh`

## Verdict

The `continue_delegate` tool fires successfully from a non-channel scratch session. The delegate subagent is spawned, executes, and returns its silent-wake payload directly back to the scratch session delivery queue without attempting to route to an origin channel.

## Evidence

- **k6 Harness Execution**:
  - `scenario="R-CD-2"` successfully executed against local gateway `ws://127.0.0.1:4100`
  - Scratch session initialized: `b1ceb324-4fbb-4770-8772-27715bd8fcda`
  - Test nonce: `R-CD-2-1782691689841-84oj9kj6`
  - K6 result: `✓ silent_wake_return_received`

- **Execution Trace (Scratch Session `b1ceb324-...`)**:
  - `17:08:24` [Main] Agent receives system event instructing delegate dispatch.
  - `17:08:29` [Main] Agent calls `continue_delegate` with `mode: "silent-wake"`.
  - `17:08:35` [Subagent] Delegate session spins up, executes the work string.
  - `17:08:42` [Subagent] Delegate completes, queuing the result.
  - `17:08:45` [Main] Silent-wake return payload is received on the scratch session's delivery queue matching the nonce `R-CD-2-1782691689841-84oj9kj6`.

## Guardrail Checks (Emeric/Silas)
- Target SHA `0a8301c3662f190001dc8580d699435d446b40cd` is the upstream openclaw runtime branch under test.
- Target session was explicitly non-channel scratch.
- Token from `openclaw.json` was never echoed or committed.
- This is held as a **candidate-only** pending full suite run and trace-review.