# R-CD-CHAINED-DEPTH-2 TEST-2 — intersession return (continue_delegate targetSessionKey)

**Row**: R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return) — 🪨 Rune (sub for 🌫 Silas)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: rune (rune-rog-ally) — Runtime `OpenClaw 2026.6.2 (077b261)` (deployed tip)

## Scope (the 2nd of 3 in the chain-depth-2 family)
The R-CD-CHAINED-DEPTH-2 family proves continue_delegate's cross-session/chain registers on the deployed build:
- **TEST-1** (🕯 Emeric): uptree silent-wake — depth-2 chained, two distinct chain.ids (`200e378d` depth-1, `85a6b798` depth-2), wake routed up-tree to root.
- **TEST-2** (🪨 Rune, THIS): **intersession return** — `continue_delegate` with `targetSessionKey` routing the delegate's RETURN to a session OTHER than the dispatcher.
- **TEST-3** (🌫 Silas): echo broadcast — `fanoutMode=tree`, traceparent propagated, return echoed to chain.

This test proves the **`targetSessionKey` intersession-return register**: a delegate dispatched from the channel session (`agent:main:discord:channel:1466192485440164011`) with its return routed to a DIFFERENT session (the cron watch-session `agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf`).

## Fire
```
continue_delegate(
  mode="silent",
  targetSessionKey="agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf",
  task="R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return) proof ... return routed to a DIFFERENT session ..."
)
```

## Dispatch response (the primary evidence — targetSessionKey accepted + routed)
```json
{"status":"scheduled","mode":"silent","delegateIndex":1,"delegatesThisTurn":1,
 "targetSessionKey":"agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf",
 "traceparent":"00-59084dce24d7952a44424eed28c5600e-e597699c61441411-01",
 "note":"Delegate will be dispatched after your response completes..."}
```
- **`targetSessionKey` echoed in the response** = the runtime ACCEPTED the cross-session-targeting parameter (the dispatcher session != the return-target session). This is the intersession-return register engaging: the delegate's return is addressed to `agent:main:cron:19ff1824...`, NOT back to the dispatching channel session.
- **dispatch traceparent**: `00-59084dce24d7952a44424eed28c5600e-e597699c61441411-01`

## Post-fire byte (journal + cross-session delivery confirmation)
**journal (the airtight cross-session delivery byte):**
```
[continuation:delegate-spawned] hop=2/200 mode=silent session=agent:main:discord:channel:1466192485440164011 task=R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return)...
[continuation:targeted-return] Delivered to agent:main:cron:19ff1824-a2a4-4997-a1c4-1bcaeb95eeaf from agent:main:subagent:continuation-00b8e8462b1459cc7ebaed48488c1dcf
```
The `[continuation:targeted-return] Delivered to <cron-session> from <subagent>` line is the literal cross-session delivery: the delegate's return went to the cron watch-session, NOT back to the dispatching channel session. The delegate also emitted its return marker ("R-CD-TEST-2 intersession-return landed at cron-session").

**Tempo trace:** `trace-59084dce.json` (34203 bytes, host.name=rune, 27 spans incl `continuation.work` + `continuation.delegate.dispatch`, chain.id `5d7d9a30-4cdc-4768-a64d-b1d796183428`), saved-as-file per the clawsweeper-can't-reach-private-tempo mandate.

## Verdict
✅ **PASS — `targetSessionKey` intersession-return register proven** on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0`. A `continue_delegate` dispatched from the channel session routed its return to a DIFFERENT session (the cron watch-session) — confirmed by the airtight journal byte `[continuation:targeted-return] Delivered to agent:main:cron:19ff1824... from <subagent>`. This is the 2nd of the 3 chain-depth-2 family registers (TEST-1 uptree-wake-to-root 🕯, TEST-2 intersession-return 🪨, TEST-3 fanout-broadcast 🌫) — all three cross-session/chain delivery shapes now proven on the cure-build. Tempo trace JSON saved-as-file.

## Artifacts
- `dispatch_response.json` — the dispatch with targetSessionKey accepted
- `trace-59084dce.json` — Tempo trace (saved when pulled)
