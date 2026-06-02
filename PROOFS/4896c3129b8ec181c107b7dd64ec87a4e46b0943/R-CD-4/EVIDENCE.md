# R-CD-4 — undertow-seat, CANDIDATE_SHA `4896c3129b8ec181c107b7dd64ec87a4e46b0943`

Captured 2026-06-02T16:00:30Z → 16:00:34Z UTC (09:00 PDT). Binary: `OpenClaw 2026.6.2 (4896c31)`.

## Proof-scope

`continue_delegate(mode="normal", targetSessionKey=...)` schedule → spawn → routed-return path at byte. Tested:
- targetSessionKey parameter accepted at dispatch
- subagent return is delivered to the specified targetSessionKey (vs. dispatching session)
- In this case targetSessionKey == dispatching session (channel) — so the test verifies the parameter-passing path; cross-session routing is tested in Chain-2

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
```
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":3,"delegatesThisTurn":3,
 "targetSessionKey":"agent:main:discord:channel:1466192485440164011",
 "traceparent":"00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01"}
```

The `targetSessionKey` field is echoed in the scheduled-response — proving the routing-target was accepted and bound at dispatch-time.

### Spawn evidence (`journal_continuation.log`)
- `09:00:30.793 [continuation:delegate-spawned] hop=20/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-4 / 4896c3129b] You are a delegate dispatched by Ronan (🌊) for PROO…`

Subagent runId: `3c39a0ee-934c-4e9e-90bf-dcd6c6f2fdbb` (sessionKey `agent:main:subagent:e78e8e20-059d-4b3c-b62e-576435c01a2b`), runtime 1826ms.

### Subagent return (`delegate_return_payload.txt`)
```
R-CD-4 PROOF: continue_delegate targetSessionKey routing verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02
```

### Journal return evidence
- `09:00:34.026 R-CD-4 PROOF: continue_delegate targetSessionKey routing verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02`
- `09:00:34.060 [subagent-chain-hop] Accumulated 94 tokens from agent:main:subagent:e78e8e20-059d-4b3c-b62e-576435c01a2b to parent chain cost`

## Tempo HONEST-LIMIT

Same as R-CD-1: parent trace 404 at fetch time. HONEST-LIMIT precedent per cael `018e39ce45.../R-CW-1/`.

## Scope-bound at byte

Proves `continue_delegate` with `targetSessionKey` parameter passes through dispatch-side correctly (echoed in scheduled-response) and round-trip completes in 1826ms. Cross-session routing tested in Chain-2 (depth-2 delegate with targetSessionKey=agent:main:main).
