# R-CW-DELEGATE-TOKEN — rune-seat live evidence

**Row:** R-CW-DELEGATE-TOKEN  
**Seat:** 🪨 Rune (`rune`, ROG Ally Z1 Extreme)  
**SHA tested:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Fired:** 2026-06-23 00:11–00:12 PDT  
**Verdict:** ✅ PASS

## What fired

A native depth-1 subagent was spawned from Rune's Discord session for the bare-token self-continuation row.

- Child session: `agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856`
- Session id: `eae39637-6f97-47a3-92c8-e104e05fac9f`

Hop 1 deliberately did **not** call the `continue_work` tool. Its final text ended with the bare terminal token:

```text
R-CW-DELEGATE-TOKEN HOP1 EMITTING TOKEN
CONTINUE_WORK:5
```

The child session then received the continuation wake:

```text
[continuation:wake] Turn 1/200. Chain started at 2026-06-23T07:12:04.614Z. Accumulated tokens: 2188. The agent elected to continue working.
```

Hop-2 final result:

```text
R-CW-DELEGATE-TOKEN PASS

Hop 2 woke via the bare terminal token `CONTINUE_WORK:5`.

Visible chain/session info:
- Continuation wake: Turn 1/200
- Chain started: 2026-06-23T07:12:04.614Z
- Runtime session: agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
- Session ID: eae39637-6f97-47a3-92c8-e104e05fac9f
```

## Journal corroboration

The gateway journal records the token parse, work hedge, and wake:

```text
[continuation/signal] bracket-parse: kind=work delayMs=5000 session=agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
[continuation/signal] effective-signal: origin=bracket kind=work session=agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
[continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=4998ms ... session=agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
[continuation/work-dispatch] [continuation:work-hedge-fired] session=agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
[continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:subagent:3f992865-121e-482b-9040-5d76e1684856
```

## Verdict

✅ PASS: bare terminal `CONTINUE_WORK:5` emitted from a native subagent parsed as a work continuation and executed hop 2 in the same child session on `82827d3cbc`.
