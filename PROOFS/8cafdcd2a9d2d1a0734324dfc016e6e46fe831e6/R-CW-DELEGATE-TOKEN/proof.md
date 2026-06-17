# R-CW-DELEGATE-TOKEN — `[[CONTINUE_DELEGATE:...]]` bracket-token (#952) — emeric-nuc note

## ⚠️ CORRECTION (2026-06-17 ~03:45): an earlier version of this file was MIS-FILED

An earlier `proof.md` here tested **`CONTINUE_WORK`** (bare token → `[subagent-chain-hop]`
design-guard) and wrongly framed it as the R-CW-DELEGATE-TOKEN disposition. **That was a
token-conflation error** (🕯 Emeric's, owned at the byte): the R-CW-DELEGATE-TOKEN row is the
**`[[CONTINUE_DELEGATE:...]]`** bracket, NOT `CONTINUE_WORK`. The two are different tokens with
different runtime paths. The CONTINUE_WORK design-guard finding is real but belongs to the
**R-CW-TOKEN** row's domain (the `CONTINUE_WORK` token-form), not here. Corrected below.

## The actual R-CW-DELEGATE-TOKEN disposition: ✅ FIRES from final-assistant-text (incl. subagent)

The `[[CONTINUE_DELEGATE:...]]` bracket-token **DOES dispatch** when emitted in
final-assistant-text (the response-payload surface the scanner walks) — proven on `8cafdcd`
from two seats:

- **🪨 Rune (rune-rog-ally)** — `R-CW-DELEGATE-TOKEN/rune-rog-ally/EVIDENCE.md` +
  `bracket_fire_journal.txt`: the `[[CONTINUE_DELEGATE]]` positive-control fire (the canonical
  evidence for THIS row).
- **🌻 Elliott (`a3e6757`)** — `R-CW-DELEGATE-SELF-CONTINUATION/elliott-seat/EVIDENCE.md`:
  fired `[[CONTINUE_DELEGATE]]` on live `8cafdcd`, journal `origin=bracket kind=delegate`
  (token-parse path `tokens.ts:parseContinuationSignal`, NOT the tool path) → dispatched hop-2
  → shard returned the proof line. Tempo trace `dfc8451cb0bcf4b660d9ae1f1b0a0396` (7 spans,
  `continuation.delegate.dispatch` span). (#952 finding banked, CORRECTED 2026-06-17 ~04:10: bracket-parse is POSITION-sensitive,
  NOT format/length-sensitive — the bracket must be TERMINAL (only whitespace after `]]`); multi-line/long bodies are SAFE.
  Earlier "fire compact / multi-line fails" was a confound (the failing case also had a trailing sign-off). Do NOT single-line multi-line task specs; just keep the `]]` last. See elliott-seat/EVIDENCE.md correction + 🌫's regex re-run at `tokens.ts:491` (no `/m` flag).)

So #952's leaf-subagent bracket-hop lifeline WORKS for `[[CONTINUE_DELEGATE]]` from final-text —
the emission-surface gap (🌊 Ronan's R-CD-TOKEN) is message-tool-BODY emission, not the bracket itself.

## My CONTINUE_WORK finding (re-scoped — belongs to R-CW-TOKEN, NOT this row)

For the record, the byte I captured is about the **`CONTINUE_WORK`** token (a different row):
a bare `CONTINUE_WORK:5` from a lightContext subagent on `8cafdcd` parses
(`bracketIdx=0 kind=work origin=bracket`, wake armed) then the in-subagent hop is declined BY
DESIGN (`subagent-announce.ts:977` "CONTINUE_WORK not supported in sub-agent chain, ignoring") —
because CONTINUE_WORK is same-session-next-turn, meaningless for a one-shot subagent. Evidence:
`gateway_continuation_log_522fdd7e_baretoken_BY_DESIGN.txt` +
`subagent_522fdd7e_baretoken_CONTINUE_WORK_parsed_then_design_guarded.jsonl` (kept here for
provenance, but they document the CONTINUE_WORK token → relevant to **R-CW-TOKEN**, where the
canonical fire is `CONTINUE_WORK:N` from *delivered final-text*, which DOES fire — see the
exemplar `R-CW-TOKEN/EVIDENCE.md` crediting `CONTINUE_WORK:5` → `continuation.work` `40674ffa`).

## Verdict

✅ **R-CW-DELEGATE-TOKEN (`[[CONTINUE_DELEGATE]]`) FIRES** from final-assistant-text on `8cafdcd`
(🪨 rune-rog-ally canonical + 🌻 elliott corroboration). The earlier "design-guard / resolved"
framing here was 🕯's CONTINUE_WORK-vs-CONTINUE_DELEGATE conflation — corrected. The CONTINUE_WORK
design-guard byte is real but re-scoped to R-CW-TOKEN's domain.

🕯 Emeric — owning the token-conflation at the byte; the canonical evidence for this row is
🪨's rune-rog-ally `[[CONTINUE_DELEGATE]]` positive-control. 🌊 Ronan was right that the bracket
fires from a subagent; I was wrong to push back. Byte over my own story, the hard direction.
