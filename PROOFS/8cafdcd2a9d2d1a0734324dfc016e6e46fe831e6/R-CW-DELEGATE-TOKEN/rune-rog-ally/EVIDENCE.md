# R-CW-DELEGATE-TOKEN EVIDENCE — `continue_delegate` bracket-token (#952), POSITIVE-CONTROL from final-assistant-text — rune-rog-ally on 8cafdcd

**Row**: R-CW-DELEGATE-TOKEN (#952 bracket row) — the legacy bracket-token form `[[CONTINUE_DELEGATE:...]]`
**Owner**: 🪨 Rune (rune-rog-ally seat)
**CANDIDATE_SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat**: rune-rog-ally — Runtime `OpenClaw 2026.6.8 (8cafdcd)` (deployed ship-tip). Re-fire of the prior 077b261d cycle's R-CW-DELEGATE-TOKEN on the current tip.

## Scope (the both-forms mandate, #952 — the bracket-form half of R-CW-DELEGATE)
`continue_delegate` has two surfaces: the TOOL form (`continue_delegate(...)`, proven at `R-CW-DELEGATE-SELF-CONTINUATION/`) and the TOKEN/BRACKET fallback (`[[CONTINUE_DELEGATE:...]]`, this row). The #952 mandate: prove BOTH on the deployed SHA, because the bracket exercises the token-parse path (`src/auto-reply/continuation/signal.ts` payload-scan) the tool-form is blind to.

## The discriminator: EMISSION-SURFACE, not token-syntax (byte-proven both directions on 8cafdcd)
The bracket fires from a RESPONSE-PAYLOAD the scanner walks (`payload.text`), NOT from message-tool-body or an undelivered final-text. Captured BOTH halves live on `8cafdcd`:

**NEGATIVE (main-session, empty-payload → no fire):**
```
01:45:54 payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
01:47:08 payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
         effective-signal: origin=none kind=none
```
A main-session `[[CONTINUE_DELEGATE:]]` in final-text does NOT fire: the channel-session's final-assistant-text isn't auto-delivered as a scanned response-payload (delivery is via the message-tool, whose body the scanner does NOT walk) → `bracketIdx=-1`, empty payload, the scanner has nothing to walk. (Matches the prior cycle's finding: main-session bare-text bracket → empty payloads.)

**POSITIVE-CONTROL (leaf-subagent final-text → FIRES):**
```
01:47:51 payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:subagent:df1aa523-39a1-48c3-9c19-8ea7302719bf
01:47:51 bracket-parse: kind=delegate delayMs=default
01:47:51 effective-signal: origin=bracket kind=delegate session=...subagent:df1aa523...
01:47:51 [[CONTINUE_DELEGATE: R-CW-DELEGATE-TOKEN grandchild — dispatched via bracket-token from a leaf-subagent final-text on 8cafdcd ... | silent ]]
01:47:51 [subagent-chain-hop] Spawned chain delegate (1/200) from ...subagent:df1aa523...
01:48:00 R-CW-DELEGATE-TOKEN grandchild — confirmation complete.
```
The SAME `[[CONTINUE_DELEGATE:...]]` bracket, emitted in a LEAF-SUBAGENT's final-assistant-text (the surface the scanner DOES walk — a subagent's final-text IS the scanned payload) → **`bracketIdx 0`** (found) → **`effective-signal: origin=bracket kind=delegate`** → **`[subagent-chain-hop] Spawned chain delegate (1/200)`** → the grandchild ran + confirmed. The bracket-token path FIRES on the deployed `8cafdcd` bytes.

## Byte-true 2×2 (the discriminator proven)
- **FIRES**: bracket in a response-payload-that-reaches-the-scanner (leaf-subagent final-text → `bracketIdx 0`, hop dispatched). ✅
- **Does NOT fire**: bracket in main-session final-text (not auto-delivered → empty payload → `bracketIdx=-1`). ✅ (the negative discriminator)
- **Same syntax, opposite result by SURFACE** → the discriminator is emission-surface, not token-syntax. Complements 🌊's R-CD-TOKEN negative (message-tool-body → no fire).

## Verdict: PASS
The `[[CONTINUE_DELEGATE:]]` bracket-token positive-control FIRES from final-assistant-text on deployed `8cafdcd` (`bracketIdx 0` → bracket-parse kind=delegate → chain-hop 1/200 spawned → grandchild ran). The both-forms mandate on the R-CW-DELEGATE shape is CLOSED: tool-form (R-CW-DELEGATE-SELF-CONTINUATION) + bracket-form (this row), both proven on the shipped bytes. Discriminator captured both directions (surface, not syntax). Journal: bracket_fire_journal.txt.
