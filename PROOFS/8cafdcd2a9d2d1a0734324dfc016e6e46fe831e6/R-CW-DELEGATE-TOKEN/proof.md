# R-CW-DELEGATE-TOKEN / CONTINUE_WORK bracket+bare form — emeric-nuc

## Status: ALIVE + CORRECTLY PARSED — "no hop-2 from subagent" is BY DESIGN, not #952-live

**CORRECTION of an earlier draft of this file**: a prior version of this proof asserted
"honest NEGATIVE → #952 still live." That was WRONG on two counts, both corrected at the
byte below. The earlier negative was (1) a **syntax-confound** (I emitted a malformed
`[[CONTINUE_WORK:5]]` — CONTINUE_WORK has no bracket form) and (2) even with correct syntax,
the absence of an in-subagent hop-2 is an **intentional design guard**, not a defect. The
byte corrected my own story, both directions. Filed honestly.

## The two syntaxes (source: `src/auto-reply/tokens.ts`)

- **CONTINUE_WORK** is a **BARE** token: `CONTINUE_WORK` or `CONTINUE_WORK:<delay>` at
  end-of-text (tokens.ts lines ~463-538). It has **NO `[[...]]` bracket form.**
- **CONTINUE_DELEGATE** is the **bracketed** form: `[[CONTINUE_DELEGATE: task]]`
  (tokens.ts line ~491 regex). The `[[ ]]` brackets belong to DELEGATE only.

My first test fired `[[CONTINUE_WORK:5]]` — a non-existent token shape. The gateway
continuation log confirmed the miss: `payload-scan bracketIdx=-1 origin=none kind=none`.

## Dispositive byte — bare `CONTINUE_WORK:5` from a lightContext subagent

Test subagent `522fdd7e-4c15-47e3-a500-49e77273f099` (lightContext, run-mode, `8cafdcd`)
emitted `hop-1 fired.\nCONTINUE_WORK:5`. The gateway `continuation/signal` +
`continuation/work-dispatch` trace logs (the authoritative runtime evidence):

```
[continuation/signal]  payload-scan: count=1 bracketIdx=0 [0]text=true   session=…522fdd7e
[continuation/signal]  bracket-parse: kind=work delayMs=5000             session=…522fdd7e
[continuation/signal]  effective-signal: origin=bracket kind=work        session=…522fdd7e
[continuation/work-dispatch] work-hedge-armed fireIn=4999ms              session=…522fdd7e
[subagent-chain-hop] CONTINUE_WORK not supported in sub-agent chain (from …522fdd7e), ignoring
[continuation/work-dispatch] work-orphan-reaped … parent confident-terminal, can never rehydrate
```

So, at the byte:
1. The bare `CONTINUE_WORK:5` **IS recognized + parsed** from a lightContext subagent
   (`bracketIdx=0`, `kind=work`, `origin=bracket`) — the parser + signal path are ALIVE.
2. A continuation wake is **armed** — the machinery engages.
3. **`[subagent-chain-hop] CONTINUE_WORK not supported in sub-agent chain … ignoring`** —
   the runtime **deliberately does not drive a CONTINUE_WORK hop inside a sub-agent chain.**
   This is an explicit guard, BY DESIGN: CONTINUE_WORK = "the same session's own next turn,"
   which is meaningless for a one-shot run-mode subagent that returns to its parent. The wake
   is then orphan-reaped because the parent is confident-terminal.

## Conclusion (the honest disposition)

- **CONTINUE_WORK bare-token**: parses + signals correctly even from a lightContext subagent,
  but is **intentionally not honored as an in-subagent hop** (explicit `[subagent-chain-hop]`
  guard). Not a bug — a design choice. The token is alive; the subagent-chain hop is guarded off.
- **CONTINUE_DELEGATE bracket form**: ALIVE + drives hop-2 from a subagent (it spawns a NEW
  shard, a different mechanism that IS supported in subagent context) — empirically proven by
  elliott-seat `a3e6757` (origin=bracket kind=delegate → hop-2 dispatched → shard returned).
- **Emission-surface gap (ronan R-CD-TOKEN `4f7e4e0`, source-walked)**: in message-tool-only
  MAIN-session delivery, the bracket rides empty payloads and can't reach the scanner — also
  not a build-death, an emission-surface property.

**#952 is NOT live-as-a-bug.** The bracket/token parse paths are alive; the "no in-subagent
CONTINUE_WORK hop" is an intentional `[subagent-chain-hop]` guard. The both-forms mandate
is satisfied: tool-form proven (R-CD-1/R-CD-2), CONTINUE_DELEGATE bracket proven (elliott),
CONTINUE_WORK bare-token parse confirmed-alive + design-guarded in subagent chain (this proof).

— emeric-nuc (🕯), reconciled at the byte (gateway continuation logs + tokens.ts source) on
ship-tip `8cafdcd`, 2026-06-17 03:07 PDT. Supersedes the earlier false-negative draft; the
byte won my story both directions.
