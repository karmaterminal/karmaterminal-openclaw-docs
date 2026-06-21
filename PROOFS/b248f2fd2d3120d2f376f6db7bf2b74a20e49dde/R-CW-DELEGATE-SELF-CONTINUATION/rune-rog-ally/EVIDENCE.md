# R-CW-DELEGATE-SELF-CONTINUATION — rune-rog-ally native proof — SHA `749f95b9b10`

**Seat:** rune-rog-ally (host.name=`rune`, host.arch=`amd64`, service.name=`rune-prince`)
**Date:** 2026-06-21 15:59–16:00 PDT / 22:59–23:00 UTC
**Result:** ✅ **PASS** — a `continue_delegate` child fired its **own** `continue_work`; the work hedge fired, the same subagent session woke to hop2, and the hop2 turn executed a marker write.

## The live child
This proof was produced by the child itself, not by the parent:

- delegate session: `agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43`
- sessionId: `9e2164d3-be2e-4c18-b68f-a9e34c530ef4`
- runId: `85272307-95fd-4950-8fdf-8770b6bcdcf3`
- spawn traceID: `4b4c9049e12483bcc4d34f9db906b0a9`
- spawn traceparent root: `00-4b4c9049e12483bcc4d34f9db906b0a9-9cc8fa47044f432b-01`

Markers:

```text
hop1.txt:          R-CW-DELEGATE-SELF-HOP1-rune-rog-ally-749f95b 2026-06-21T22:59:01Z
hop2-EXECUTED.txt: R-CW-DELEGATE-SELF-HOP2-EXECUTED-rune-rog-ally-749f95b 2026-06-21T23:00:06Z
```

## The child fired its OWN continue_work
Transcript summary (`transcript-self-continuation-summary.txt`):

```text
line 70 2026-06-21T22:59:21.365Z ASSISTANT TOOL-CALL continue_work delay=25 reason=R-CW-DELEGATE-SELF-CONTINUATION hop1->hop2: I am the continue_delegate child (session 0e248108); firing my OWN continue_work to drive hop2.
line 71 2026-06-21T22:59:21.384Z TOOL-RESULT continue_work status=scheduled delay=25 traceparent=00-4b4c9049e12483bcc4d34f9db906b0a9-9cc8fa47044f432b-01
line 77 2026-06-21T22:59:55.429Z USER WAKE: [continuation:wake] Turn 1/200. Chain started at 2026-06-21T22:59:30.095Z ... Reason: R-CW-DELEGATE-SELF-CONTINUATION hop1->hop2: I am the continue_delegate child (session 0e248108); firing my OWN continue_work to drive hop2.
line 78+ 2026-06-21T23:00:06Z HOP2 marker written by live hop2 turn: R-CW-DELEGATE-SELF-HOP2-EXECUTED-rune-rog-ally-749f95b 2026-06-21T23:00:06Z
```

## Journal proof — same subagent session woke
Journal (`journal-self-continuation.log`) shows this exact session emitted the work signal, then the work hedge fired and woke the same subagent lane:

```text
Jun 21 15:59:30 rune node[1826952]: 2026-06-21T15:59:30.094-07:00 [continuation/signal] [continuation:trace] effective-signal: origin=tool-call kind=work session=agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43
Jun 21 15:59:30 rune node[1826952]: 2026-06-21T15:59:30.097-07:00 [continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=24999ms fireAt=1782082795095 session=agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43
Jun 21 15:59:55 rune node[1826952]: 2026-06-21T15:59:55.098-07:00 [continuation/work-dispatch] [continuation:work-hedge-fired] session=agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43
Jun 21 15:59:55 rune node[1826952]: 2026-06-21T15:59:55.102-07:00 [continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:subagent:0e248108-1b2b-4308-ae3f-76f517346c43
```

This is the load-bearing byte: `work-hedge-fired` + `work-wake` occur on the same continue_delegate child session key (`...0e248108...`) that called `continue_work`.

## Tempo proof
Saved live Tempo traces (all have `host.name=rune`, `host.arch=amd64`, `service.name=rune-prince`):

- `trace-4b4c9049-after-hop2.json`: the original delegate dispatch trace, now 75 spans and containing `continuation.work` / `continuation.queue.drain` under the same traceID `4b4c9049e12483bcc4d34f9db906b0a9`.
- `trace-77f5ef0d3af8536283052580f1b80c90.json`: `continuation.work.fire` at `2026-06-21T22:59:55.102Z` — same instant as journal `work-wake`.
- `trace-826cec06bb97f0b198c32446b9334da7.json`: hop2 `openclaw.message.processed` / `openclaw.harness.run` / `openclaw.run` spans from `2026-06-21T22:59:55.859Z` forward, proving hop2 execution on the rune-prince service.

## Net
A delegate child (`agent:main:subagent:0e248108...`) executed hop1, called `continue_work` itself, received a scheduled result with the propagated traceparent, then the gateway emitted `work-hedge-fired` and `work-wake` for that same child session. The hop2 turn ran and wrote `R-CW-DELEGATE-SELF-HOP2-EXECUTED-rune-rog-ally-749f95b`. R-CW-DELEGATE-SELF-CONTINUATION PASS.
