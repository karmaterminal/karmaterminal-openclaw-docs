# R-CD-1 — continue_delegate(mode="normal") emits child run + returns to channel

**Target SHA**: `094f45345a` (deployed cael-seat 06:51:01Z 2026-05-13)
**Status**: PASS

## Scenario

continue_delegate(mode="normal") schedules a background subagent to run the task. Result returns to the dispatching channel via system-injected completion event (announce-to-channel shape).

## Command

Fired from cael-main-session at 2026-05-13 00:13:23.928 PDT:

```
continue_delegate(
  task="R-CD-1 proof minimal probe: respond with exactly the string 'R-CD-1 PROBE OK from cael-seat 094f453 at <current-time>'. Then stop. This is a single-shot integration probe firing against deployed continuation infrastructure.",
  delaySeconds=0,
  mode="normal"
)
```

## Expected

- Tool returns success ack: `status: "scheduled", mode: "normal", delegateIndex: N, delegatesThisTurn: N, traceparent`
- Delegate fires after current response completes
- Child subagent executes task
- Result returns to channel via completion-event (visible as system-injected user-message-style)
- Chain tracking applies (cost cap, depth limit)

## Observed

**Tool-call ack** (captured at fire time 00:13:23.928 PDT):
```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-8470b259365a384997b6264b0667634f-3e74952d96d56b34-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

**Child completion** (captured at 2026-05-13 00:19 PDT, ~5min after dispatch):
```
R-CD-1 PROBE OK from cael-seat 094f453 at Wed 2026-05-13 00:19 PDT
```

- ✅ Child output matches probe spec exactly (string-match including SHA + timestamp template)
- ✅ Runtime: 4s (53 tokens; in=6, out=47)
- ✅ mode="normal" channel-return path: completion-event delivered as system-injected inbound carrying child result + chain-hop metadata (`continuation:chain-hop:6`, turn 6/200)
- ✅ Subagent session-key: `agent:main:subagent:6ba6ca88-d0c6-45f2-9be1-7cd56104ed11`
- ✅ Source channel: webchat (subagent's own delivery context)
- ✅ Inter-session data routed correctly via subagent_announce tool

## Verdict

**PASS** — tool-ack confirmed scheduling; child fired + executed + returned via mode="normal" channel-return path with chain-hop metadata + correct content; full end-to-end continuation infrastructure verified at byte against deployed `094f453`.

## Tempo trace ID

`00-8470b259365a384997b6264b0667634f-3e74952d96d56b34-01`
