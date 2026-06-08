# PROOFS — Silas — sub-row 2: intersession return

**Candidate:** `e66dc63f` · silas/lothric

## Dispatch — CERTIFIED
`continue_delegate(mode=silent, targetSessionKey=#heartbeat)`:
- status=scheduled, targetSessionKey ACCEPTED (#sprites→#heartbeat non-dispatcher)
- traceparent `00-03b227cd819bf77626e56e4cccc70cf1-7af67cb6dcf04743-01`
- delegate SPAWNED (turn 2/200), flow `2aab782a` status=succeeded

## Return-routing — HONEST FINDING
Delegate ran + succeeded, but enrichment landed in delegate worker session, NOT the dormant #heartbeat target transcript (stayed stale). targetSessionKey accepted at dispatch + delegate succeeded = dispatch-routing PASS; return-into-dormant-target = delivery-semantics flag (likely enqueues for next activation). See Ronan R-CD-4 true-bar: runtime `[continuation:targeted-return]` delivery log is the cert plane.

## VERDICT: dispatch+routing-accept PASS; dormant-target-delivery = honest observation, flagged for GATES.
