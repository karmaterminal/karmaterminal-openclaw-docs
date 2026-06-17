# R-CW-DELEGATE-TOKEN / R-CW-3 (bracket-form) — emeric-nuc

## Status: HONEST NEGATIVE — #952 STILL LIVE on shipped tip `8cafdcd`

**This is NOT a PASS. It is a real finding, captured at the byte, fresh on the ship-tip.**

The `[[CONTINUE_WORK: ...]]` bracket token, emitted from a **lightContext subagent**
(no other tools in its surface, so it can ONLY fire the bracket path — the exact #952
path the tool-form is blind to), was **emitted** but did **NOT drive a real hop-2 turn**.

## What was tested

A one-shot `lightContext: true` subagent (`mode: run`) on gateway SHA `8cafdcd2a9d…`
was tasked to:
1. hop-1: output `hop-1 fired at <time>` then emit the literal token
   `[[CONTINUE_WORK: hop-2 verification — confirm the bracket drove a real second generation cycle]]`
2. hop-2 (IF a second turn actually fires): output `hop-2 EXECUTED at <time>`.

The discriminator: **does hop-2 actually EXECUTE** (a real second generation cycle in
the subagent's session jsonl) — NOT merely whether the token is emitted.

## Dispositive byte (subagent session jsonl `7355d6ef-b6c4-4173-957f-d675212c7f2b`)

Raw jsonl committed alongside: `subagent_7355d6ef_lightcontext_bracket_NO_HOP2.jsonl`

```
line count = 6
turn structure:
  session / model_change / thinking_level_change / custom
  message  role=user        (the [Subagent Task])
  message  role=assistant   (hop-1)
ASSISTANT_TURNS_COUNT = 1
STOP_REASONS = ['stop']
```

The single assistant turn's content (verbatim, via jq `.message.content`):

```json
[
  {
    "type": "text",
    "text": "hop-1 fired at 2026-06-17 02:58 PDT\n\n[[CONTINUE_WORK: hop-2 verification — confirm the bracket drove a real second generation cycle]]"
  }
]
```

So: the token **WAS emitted** (proving this is a genuine no-hop, not a "didn't emit"
artifact) — and the session **ENDED at hop-1**: exactly 1 assistant turn, `stopReason "stop"`,
6 jsonl lines, **no second generation cycle**. Runtime 2s, 66 output tokens — one turn only.

## Conclusion

On `8cafdcd`, the bracket-form continuation token (`[[CONTINUE_WORK:...]]`) emitted from a
lightContext subagent does **NOT** parse-and-dispatch a hop-2. The continuation fires via the
**tool path** (`continue_work` / `continue_delegate` tool calls — those ARE proven on this tip,
see the tool-form traces), but the **bracket-token-only path is blind / non-driving** from a
lightContext subagent surface.

**This is #952 still live on the shipped bytes.** The byte-honest disposition: the tool-form
of continuation works (proven, traced); the bracket-token-from-lightContext-subagent form does
not drive hop-2. Filed as an honest NEGATIVE so the corpus never carries a fake-PASS on the
most-load-bearing row. Cross-ref: ronan's R-CD-TOKEN (`[[CONTINUE_DELEGATE]]` from lightContext,
same dispositive path) — converging two-seat finding.

— emeric-nuc (🕯), captured at the byte fresh on ship-tip `8cafdcd`, 2026-06-17 02:58 PDT
