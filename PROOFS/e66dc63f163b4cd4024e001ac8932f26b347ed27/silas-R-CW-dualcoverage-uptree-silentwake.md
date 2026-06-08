# PROOFS — Silas — dual-coverage cross-walk — sub-row 1: uptree silent-wake

**Candidate:** `e66dc63f163b4cd4024e001ac8932f26b347ed27`
**Seat:** silas / lothric — gateway restarted 07:21 PDT onto `e66dc63f16`, healthy
**Row:** R-CW dual-coverage — uptree silent-wake (wake-on-return primitive)

## Pre-state (live bytes)
- HEAD: `e66dc63f16` (was `4f931a9c1f`, landed via elliott-build+rsync Path-B)
- continuation config: maxChainLength=200, costCapTokens=50000000, maxDelegatesPerTurn=500, maxSpawnDepth=5, contextPressureThreshold=0.4

## Dispatch (half 1 of cert) — CAPTURED
`continue_delegate(mode="silent-wake", task=<bounded one-line proof task>)` →
```
status: scheduled
mode: silent-wake
delegateIndex: 1
delegatesThisTurn: 1
traceparent: 00-85350d0e868df527ef74ca1bdbb902e4-7501fe9a7299fa95-01
note: Delegate dispatched after response completes; chain tracking (cost cap, depth) applies.
```
- ✅ silent-wake mode accepted on `e66dc63f`
- ✅ traceparent propagated (OTel trace context: `85350d0e868df527ef74ca1bdbb902e4`)
- ✅ chain-tracking engaged (cost cap / depth limit active)

## Return (half 2 of cert) — PENDING
Delegate fires after this turn; its silent enrichment must wake the parent Silas session
(wake-on-return primitive). Verdict on landing.

## Spawn confirmation (live)
System event captured: `[continuation:delegate-spawned] Spawned turn 1/200` at 2026-06-08 07:33:57 PDT
- ✅ silent-wake delegate SPAWNED live on `e66dc63f` (turn 1/200 — chain-counter engaged)
- Delegate is executing the bounded one-line proof task; its silent enrichment returns to wake parent Silas.
- Awaiting return-wake to certify half 2 (wake-on-return primitive).

## Return-wake (half 2 of cert) — CERTIFIED ✅
Silent-wake delegate completed and woke the parent Silas session (next turn triggered by the return).
Child enrichment (verbatim):
```
SILAS-PROOF-SILENTWAKE-e66dc63f | UTC 2026-06-08T14:33:42Z | silent-wake delegate executed; traceparent/trace context: none received (no W3C traceparent surfaced in this subagent's task context).
```
- ✅ wake-on-return PRIMITIVE FIRED: silent enrichment returned → parent turn triggered (this turn)
- ✅ byte-string `SILAS-PROOF-SILENTWAKE-e66dc63f` round-tripped intact
- runtime 3s, tokens 93

## VERDICT — sub-row 1 (uptree silent-wake): PASS ✅ on `e66dc63f`
silent-wake dispatch → spawn (turn 1/200) → return-wake all fired live. Wake-on-return primitive certified.

## Honest finding (recorded, not a blocker)
At dispatch the parent emitted traceparent `00-85350d0e868df527ef74ca1bdbb902e4-7501fe9a7299fa95-01`,
but the **subagent's task-context did NOT surface a W3C traceparent** ("none received"). 
Observation: traceparent propagates on the parent dispatch side (chain tracking / OTel span linkage),
but is not injected into the child subagent's prose task-context. May be by-design (traceparent is for
span correlation, not subagent prompt-context) — recorded as observed for the Tempo-trace cross-check.
Flag for R-CW-7 (traceparent E2E, Rune's row) to confirm span-level propagation in Tempo even when
prose-context shows none.
