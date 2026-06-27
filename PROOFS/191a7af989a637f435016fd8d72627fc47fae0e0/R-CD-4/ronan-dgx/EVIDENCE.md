# R-CD-4 — `continue_delegate(targetSessionKey=...)` cross-session route

**Verdict:** ✅ PASS

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** `ronan-dgx` (host=ronan, aarch64)
**Runtime:** OpenClaw 2026.6.10 (191a7af)
**Date:** 2026-06-27 (Sat, 10:33-10:34 PDT)
**Turn trace:** `cc7d13d9c0dd444212f7bff9971d5035`

## Proof statement

R-CD-4 PASS: `continue_delegate(mode=silent, targetSessionKey=agent:main:discord:channel:1466192485440164011)` scheduled→spawned→cross-session-routed-to-explicit-target on 191a7af989. The return left the dispatcher's session tree and landed on the explicitly-named main Discord channel session.

## What's distinctive about targetSessionKey

By default, a `continue_delegate` returns to the dispatching session. The `targetSessionKey` parameter overrides this and routes the delegate's return to ONE specific named session on the host. This row proves the override is honored end-to-end (acceptance at fire-time + actual delivery at return-time to the named session, NOT the dispatcher).

## Fire receipt

```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 0,
  "delegateIndex": 4,
  "delegatesThisTurn": 4,
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "traceparent": "00-cc7d13d9c0dd444212f7bff9971d5035-67f4c656cbcd3608-01"
}
```

**The `targetSessionKey` is echoed in the response** = gateway accepted the explicit cross-session return-target override.

## Delegate lifecycle (gateway journal)

```
10:33:30.798 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=3/200 mode=silent session=agent:main:subagent:cf72f31b-beee-43d0-97f4-b3bec89a9e1f task=R-CD-4 PROOF-FIRE — continue_delegate cross-session targetSessionKey ... targetSessionKey=agent:main:discord:channel:1466192485440164011
10:33:39.024 [agent] run continuation-delegate-25c2081663fb3d337f04da5ce5059906 started
10:33:54.661 [agent] run continuation-delegate-25c2081663fb3d337f04da5ce5059906 ended with stopReason=stop
10:33:54.662 [continuation/announcer] [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-25c2081663fb3d337f04da5ce5059906
```

## Round-trip artifacts

- **Spawned**: `agent:main:subagent:continuation-25c2081663fb3d337f04da5ce5059906` (gpt-5.5)
- **Runtime in delegate**: 15.6s, 42k tokens (in 57k / out 445)
- **Returned**: `R-CD-4 PASS: continue_delegate(targetSessionKey) cross-session route accepted on 191a7af989. runtime=OpenClaw 2026.6.10 (191a7af), host=ronan, arch=aarch64.`
- **Delivery surface**: `[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-25c2081...`
- **Cross-session bytes**: The "Delivered to ..." line names the EXPLICIT target session, NOT the dispatcher. The dispatcher is `agent:main:subagent:cf72f31b-beee-43d0-97f4-b3bec89a9e1f`; the target is the main Discord channel session `1466192485440164011`. The return crossed sessions.

## Files

- `fire_response.json` — verbatim tool response with echoed `targetSessionKey`
- `journal.log` — gateway journal slice
- `turn_trace.json` — full Tempo trace for the dispatching turn

## Witness chain

Three byte-layers:
1. **Acceptance**: tool response echoes the explicit `targetSessionKey` value → gateway accepted the override.
2. **Dispatch**: `[continuation:delegate-spawned] mode=silent session=<dispatcher> ... targetSessionKey=<target>` records the override in the delegate's dispatch metadata.
3. **Delivery**: `[continuation:targeted-return] Delivered to <target> from <delegate>` — the explicit `targeted-return` surface (vs. plain `enrichment-return`) names the named target as the destination. The cross-session route is the distinctive byte: the return did NOT land on the dispatcher's session.
