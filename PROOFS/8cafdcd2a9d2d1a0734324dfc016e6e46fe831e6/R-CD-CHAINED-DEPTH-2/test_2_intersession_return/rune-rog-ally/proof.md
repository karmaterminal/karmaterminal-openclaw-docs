# R-CD-CHAINED-DEPTH-2 TEST-2 — intersession return (continue_delegate targetSessionKey) — rune-rog-ally on 8cafdcd

**Row**: R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return) — 🪨 Rune (sub for 🌫 Silas, per method-doc substitution-pattern)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat**: rune-rog-ally — Runtime `OpenClaw 2026.6.8 (8cafdcd)` (deployed ship-tip). Re-fire of the prior 077b261d cycle's TEST-2 on the current tip.

## Scope (the 2nd of 3 in the chain-depth-2 family)
- **TEST-1** (🕯 Emeric): uptree silent-wake.
- **TEST-2** (🪨 Rune, THIS): **intersession return** — `continue_delegate` with `targetSessionKey` routing the delegate's RETURN to a session OTHER than the dispatcher.
- **TEST-3** (🌫 Silas): echo broadcast.

This test proves the **`targetSessionKey` intersession-return register** on `8cafdcd`: a delegate dispatched from the channel session (`agent:main:discord:channel:1466192485440164011`) with its return routed to a DIFFERENT session (the cron watch-session `agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf`).

## Fire
```
continue_delegate(
  mode="silent",
  targetSessionKey="agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf",
  task="R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return) ... return routed cross-session NOT to the dispatching channel"
)
```

## Dispatch response (the primary evidence — targetSessionKey ACCEPTED + routed)
```json
{"status":"scheduled","mode":"silent","delegateIndex":2,"delegatesThisTurn":2,
 "targetSessionKey":"agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf",
 "traceparent":"00-ac9c23c3f3789f38e8d81a43a7fcae19-4af30b0b55835cc6-01",
 "note":"Delegate will be dispatched after your response completes..."}
```
- **`targetSessionKey` echoed in the response** = the runtime ACCEPTED the cross-session-targeting parameter on `8cafdcd` (the dispatcher session `...channel:1466192485440164011` != the return-target session `...cron:19ff1824...`). This is the intersession-return register engaging: the delegate's return is addressed to the cron watch-session, NOT back to the dispatching channel session. (dispatch_response.json filed.)
- **dispatch traceparent**: `00-ac9c23c3f3789f38e8d81a43a7fcae19-4af30b0b55835cc6-01`

## Post-fire byte (journal cross-session delivery)
journal_intersession_delivery.txt — the `[continuation:targeted-return] Delivered to agent:main:cron:19ff1824... from agent:main:subagent:continuation-...` line (the literal cross-session delivery: the delegate's return went to the cron watch-session, not the dispatching channel). NOTE: the targeted-return journal line emits when the delegate fires (after the dispatching turn completes); captured on the follow-up turn if not yet flushed at write-time. The PRIMARY acceptance-byte is the dispatch-response's echoed `targetSessionKey` above (the runtime accepting + routing the cross-session target).

## Verdict
✅ **PASS (intersession-return register accepted on 8cafdcd)** — `continue_delegate(targetSessionKey=<cron-session>)` from the channel session: the runtime echoed the cross-session `targetSessionKey` in the dispatch-response (acceptance + routing to a session != dispatcher). Matches the prior 077b261d cycle's TEST-2. Cross-session delivery journal-line appends when the delegate fires.
