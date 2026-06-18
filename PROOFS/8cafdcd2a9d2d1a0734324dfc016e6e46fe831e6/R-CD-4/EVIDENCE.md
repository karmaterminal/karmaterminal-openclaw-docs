# R-CD-4 EVIDENCE — cross-session targeted return via `targetSessionKey`

**Row**: R-CD-4 — continue_delegate cross-session targeted return (the delegate's return is routed to a specifically-addressed session via `targetSessionKey`, not just the dispatching session)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`

## Per-seat evidence

| Seat | Arch | State | Evidence |
|---|---|---|---|
| ronan-spark (10.0.0.246) | ARM64 DGX Spark | ✅ REGISTERED + SCHEDULED (targetSessionKey-routed) | [ronan-spark/EVIDENCE.md](ronan-spark/EVIDENCE.md) |

## Verdict

✅ **REGISTERED + SCHEDULED (targetSessionKey-routed)** — `continue_delegate` cross-session targeted return via `targetSessionKey` registered + functional on deployed `8cafdcd`. The echoed `targetSessionKey` in the fire-response proves the gateway accepted the explicit return-target override (cross-session addressing, not dispatching-session-default). Runtime SHA-verified at source. The (a)-shape recipient-addressing surface over the session-delivery-queue substrate.

**Tool-only by surface**: `targetSessionKey` is a tool-parameter-only feature (the bracket form has no syntax for explicit return-target addressing). See [ronan-spark/EVIDENCE.md](ronan-spark/EVIDENCE.md) for the full fire-response, registration proof, and SHA verification.
