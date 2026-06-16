# R-CW-DELEGATE-TOKEN EVIDENCE — `continue_delegate` bracket-token (#952), POSITIVE-CONTROL from final-assistant-text

**Row**: R-CW-DELEGATE-TOKEN (#952 bracket row) — the legacy bracket-token form `[[CONTINUE_DELEGATE:...]]`
**Owner**: 🪨 Rune (rune-rog-ally seat)
**CANDIDATE_SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Seat**: rune (rune-rog-ally) — Runtime `OpenClaw 2026.6.2 (077b261)` (deployed tip, gateway restarted onto the deploy build)

## Scope (the genuinely-distinct half vs 🌊's R-CD-TOKEN)
🌊 Ronan's R-CD-TOKEN proved the NEGATIVE: `[[CONTINUE_DELEGATE:...]]` emitted inside a `message`-tool send body does NOT dispatch (`payload-scan bracketIdx=-1`, no spawn) — because the scanner `src/auto-reply/continuation/signal.ts` walks RESPONSE payloads (`payload.text`), not message-tool bodies. Source-airtight (both discriminators resolved: syntax ruled out, emission-context sole cause).

This row fires the POSITIVE-CONTROL: the SAME `[[CONTINUE_DELEGATE:...]]` bracket emitted in FINAL-ASSISTANT-TEXT (the response-payload surface the scanner DOES walk) — to empirically confirm it DOES dispatch from that surface. Ronan observed the negative (message-tool-body → no fire); this confirms the positive (final-text → fires), closing the both-forms mandate empirically from a distinct seat.

## Pre-fire baseline (message-tool-only turns → bracketIdx=-1, correct negative)
```
Jun 15 18:50:05 rune: payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
Jun 15 18:50:25 rune: payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
Jun 15 18:50:42 rune: payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
```

## Fire (bracket-token at END of final-assistant-text, NOT a message-tool-body)
- Emitted `[[CONTINUE_DELEGATE: R-CW-DELEGATE-TOKEN positive-control ... | silent]]` at the end of the FINAL-ASSISTANT-TEXT response payload (the surface the scanner walks).

## Post-fire byte
- **journal payload-scan** (the bracket FOUND → parsed as a continuation directive):
```
Jun 15 18:52:47 rune: payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:discord:channel:1466192485440164011
Jun 15 18:52:53 rune: payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:subagent:2f3c59dd-1da0-4761-a70e-2af53dea398b
```
- **delegate-spawned**: `[continuation:delegate-spawned] Spawned turn 1/200: R-CW-DELEGATE-TOKEN positive-control ...` — the runtime fired the delegate from the final-text bracket (hop 1/200).
- **BONUS (chain-hop depth-2)**: the spawned delegate's OWN return-bracket fired `[subagent-chain-hop] Spawned chain delegate (2/200)` from `agent:main:subagent:2f3c59dd...` — confirming the bracket-form is the continuation path from a subagent's final-text too (the exact case the source comment flags: "Critical for subagent chain-hops where the bracket is the ONLY continuation path"). The second `bracketIdx=0` line above is the subagent-session scan.
- **Tempo trace**: `trace-9490de5f-bracket-fire.json` (24397 bytes, host.name=rune, 9 batches / 19 spans) — the turn-context Tempo trace for the fire turn (continue_work traceparent `9490de5fa1aafddd8eb1d8fbcb9135bd`). HONEST-LIMIT: this trace captures the turn-spans, NOT the delegate-dispatch spans (those landed under the bracket-spawn's own trace-id, which the journal line did not surface). The AIRTIGHT evidence for this row is the journal payload-scan contrast + the delegate-spawned event; the Tempo JSON is saved-as-file (per the clawsweeper-can't-reach-private-tempo mandate) as supplementary turn-context.

## Verdict
✅ **PASS (positive-control) — bracket-form `[[CONTINUE_DELEGATE:...]]` DISPATCHES from final-assistant-text** on deployed `077b261dd820d16a2667369e3006c4efdd6b0ef0`.

- Pre-fire (message-tool-only turns): `bracketIdx=-1`, no dispatch (×3 baseline).
- Post-fire (bracket in final-assistant-text): `bracketIdx=0` + `[continuation:delegate-spawned] hop 1/200`.

This is the POSITIVE half of 🌊 Ronan's R-CD-TOKEN negative (message-tool-body → no fire); together they close the both-forms mandate empirically: **tool-form canonical+proven (5 R-CD rows); bracket-form ALIVE and fires from final-assistant-text, does NOT fire from message-tool-body** — the emission-surface gap Ronan+Emeric source-resolved (`signal.ts` walks response payloads, not message-tool bodies), now confirmed from BOTH directions across TWO seats (ronan-dgx negative + rune-rog-ally positive). Cross-seat second on the mechanism.

Recorded byte-honest: the airtight evidence is the journal payload-scan contrast (bracketIdx=-1 → bracketIdx=0) + the delegate-spawned event; the Tempo trace is saved-as-file but scoped honestly as supplementary turn-context (HONEST-LIMIT noted — dispatch-spans under a separate trace-id).
