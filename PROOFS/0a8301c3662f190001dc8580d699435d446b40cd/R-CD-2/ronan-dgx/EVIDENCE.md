# R-CD-2: `continue_delegate` returns cleanly when dispatching seat is non-channel (scratch session)

**STATUS**: HONEST-LIMIT / CANDIDATE-ONLY NEGATIVE-PARTIAL
**DATE**: 2026-06-28
**SEAT**: ronan-dgx
**REPO/CLI UNDER TEST**: `0a8301c3662f190001dc8580d699435d446b40cd` / `OpenClaw 2026.6.10 (0a8301c)`
**DEPLOYED DIST BUILD STAMP OBSERVED**: `64324505fcb8be367abe91234bbb811b005466b4`, built `2026-06-28T08:01:08.648Z`
**RUNNING PROCESS**: built `dist/index.js` gateway process
**PROVENANCE**: manual live run via `run-proof.sh`

## Honest Limit

This row is **candidate-only**. The live run functionally exercised `R-CD-2` on `ronan-dgx`, but target tracking is mixed:

- repo/CLI reported `0a8301c3662f190001dc8580d699435d446b40cd` / `OpenClaw 2026.6.10 (0a8301c)`
- deployed `dist/build-info.json` reported build stamp `64324505fcb8be367abe91234bbb811b005466b4`
- the running gateway process was executing the built `dist/index.js`

Therefore this artifact must **not** claim “runtime SHA = `0a8301c`” unless the dist stamp is later proven stale/irrelevant or a rebuild+restart lands on `0a8301c`. Treat this as a negative-partial proof edge: the scenario behavior was observed, but runtime identity is not fully pinned to the repo/CLI SHA.

## Verdict

The `continue_delegate` tool fired successfully from a non-channel scratch session during the live k6 window. The delegate subagent spawned, executed, and returned its silent-wake payload directly back to the scratch session delivery queue without attempting to route to an origin channel.

Because of the mixed runtime identity above, this remains **HONEST-LIMIT / candidate-only negative-partial**, not promoted/folded proof.

## Evidence

- **k6 Harness Execution**:
  - `scenario="R-CD-2"` executed against local gateway `ws://127.0.0.1:4100`
  - Scratch session initialized: `b1ceb324-4fbb-4770-8772-27715bd8fcda`
  - Test nonce: `R-CD-2-1782691689841-84oj9kj6`
  - K6 result: `✓ silent_wake_return_received`

- **Execution Trace (Scratch Session `b1ceb324-...`)**:
  - `17:08:24` [Main] Agent receives system event instructing delegate dispatch.
  - `17:08:29` [Main] Agent calls `continue_delegate` with `mode: "silent-wake"`.
  - `17:08:35` [Subagent] Delegate session spins up, executes the work string.
  - `17:08:42` [Subagent] Delegate completes, queuing the result.
  - `17:08:45` [Main] Silent-wake return payload is received on the scratch session's delivery queue matching the nonce `R-CD-2-1782691689841-84oj9kj6`.

## Guardrail Checks (Emeric/Silas/Cael)

- Repo/CLI target was `0a8301c3662f190001dc8580d699435d446b40cd`, but deployed dist stamp was `64324505fcb8be367abe91234bbb811b005466b4`; runtime identity is mixed.
- Target session was explicitly non-channel scratch.
- Token from `openclaw.json` was never echoed or committed.
- This is held as **candidate-only** pending byte-review of `EVIDENCE.md`, artifact paths, trace/session artifacts, and runtime identity.
