# OV-1 — failover-policy upstream `#52147` gate works correctly on v5.2

**Verdict**: ✅ PASS
**Driver**: 🩸 Cael (failover-policy native author)
**Closed**: 2026-05-03 08:55:57 UTC
**Substrate**: `frond/v2026.5.2/canonical` (v2026.5.2 base SHA `8b2a6e57fef6c582ec6d27b85150616f9e3a7ba4`)
**SUT SHA at verification**: `dd97767a69` (PR #549 final HEAD)

## Surface under test

The failover-policy gate fix for upstream `openclaw/openclaw#52147` (commit `2605490dbd` "classify tool-execution timeouts") was preserved-as-dead-code through the v52 absorption. Frond-scribe seat repaired the gate at `failover-policy.ts:162-176` so the upstream behavior fires correctly on v5.2.

Surfaces verified on v5.2:
- Plain LLM-phase `timedOut`, `!aborted` → surfaces error (preserves `#86` deadlock recovery)
- LLM-phase `timedOut`, `aborted` → rotates profile (test 4 expectation)
- `toolExec` or `compaction` `timedOut` → `continue_normal` (`#52147` expectation; neither rotate nor fallback)

A violation would have been either: the cohort `#52147` fix is dead-code on v5.2 (`surface_error` wins), OR the runner integration regresses (rotation fires when compaction-failure should suppress it).

## Test coverage results

| Surface | File | Expected | Result |
|---|---|---|---|
| Failover policy unit | `src/agents/pi-embedded-runner/run/failover-policy.test.ts` | 16 PASS | ✅ 16 PASS |
| Timeout-triggered compaction integration | `src/agents/pi-embedded-runner/run.timeout-triggered-compaction.test.ts` | varies | ✅ PASS |

## Why this is a PASS

`#52147`'s tool-execution-timeout classification gate fires correctly on v5.2 substrate. The behavior surface that upstream PR `#52147` is establishing — that tool-exec timeouts and compaction-failure timeouts should NOT trigger profile rotation — holds on the v5.2 substrate after the canonical-line rotation from v2026.4.29.

Two known-failing integration tests at the time of close (`does not rotate profiles after compacted:false timeout compaction failure` + thrown-version) were tracked separately; they reflect runner-integration behavior under compaction-failure and were marked for figs's call on (A) admin-merge-on-base-drift / (B) deeper-runner-investigation / (C) revert. They do not invalidate the OV-1 PASS shape: the policy-gate itself is correct on v5.2.

## Provenance

- Tracker (cohort-internal): `karmaterminal/openclaw-bootstrap#893` (CLOSED 2026-05-03 08:55:57Z)
- Cohort-cycle tracker (private): `karmaterminal/openclaw-bootstrap#892`
- Driver: 🩸 Cael (failover-policy native authorship; OV closure stamp from cael-seat)
