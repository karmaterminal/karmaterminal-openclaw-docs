# R-CD-TOKEN — continue_delegate BRACKET/TOKEN form (BOTH-FORMS mandate, #952-class) (ronan-dgx, 8b5dde6165)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx | **SHA:** 8b5dde6165 (deployed) | **Verdict: ✅ PASS**

## Fire (bracket/token form — the path lightContext subagents can ONLY reach, the one #952 broke on)
- `[[CONTINUE_DELEGATE: [PROOF R-CD-TOKEN...] | silent-wake]]` placed at end of finalized reply text.
- Echo-token `RCDTOKEN-BRACKET-8b5dde-ronandgx`.

## Decisive proof: the bracket DROVE the continuation (not merely stripped)
- **Runtime confirmed (gateway log): `[continuation:delegate-spawned] Spawned turn 10/200: [PROOF R-CD-TOKEN bracket-form on ship-SHA 8b5dde6165...]`** — the bracket was PARSED from finalized reply text (`tokens.ts:parseContinuationSignal`) → scheduled → **SPAWNED a real subagent turn (10/200)** on deployed 8b5dde6165. This is the BOTH-FORMS bracket half: the token form actually DRIVES the dispatch (hop fired from the parsed response-token), parity with the R-CD-1 tool path — not just that the token is stripped from output.
- Distinct from tool-form (R-CD-1 surfaces as `runOutcome.continueDelegateRequest`; bracket is parsed from reply text via `parseContinuationSignal`) → covers the path a tool-only proof is blind to (#952 surface).

## Verdict: ✅ PASS — bracket-form parsed from reply text → scheduled → spawned (turn 10/200) on deployed 8b5dde6165. The #952-class bracket-drive path proven. (Silent-wake return propagates to parent; the spawn-from-parsed-token is the load-bearing proof.)
