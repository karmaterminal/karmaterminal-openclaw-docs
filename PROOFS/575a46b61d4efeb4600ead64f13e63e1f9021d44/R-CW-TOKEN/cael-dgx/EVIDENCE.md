# R-CW-TOKEN: *** Bracket/Token Fallback Test

## Configuration
- Assembly target: `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- Tested by: Cael 🩸
- Seat: `cael-dgx` (DGX Spark, ARM64)

## Result
PASS-CANDIDATE

## Evidence

The test successfully scheduled the next turn using the bare token syntax `CONTINUE_WORK:<delay>`. The next turn was enqueued, armed, and fired successfully.

### Gateway Journal Transcripts

The following gateway journal excerpts prove the token scanning parsing logic correctly detected the token within the subagent, recognized it as originating from `bracket`, and dispatched the continuation logic:

```
Jun 29 16:18:33 cael node[1115872]: 2026-06-29T16:18:33.227-07:00 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=2/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=Execute proof row R-CW-TOKEN (#201) to verify the bare token fallback for `conti
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.735-07:00 [continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=false session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.736-07:00 [continuation/signal] [continuation:trace] bracket-parse: kind=work delayMs=5000 session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.736-07:00 [continuation/signal] [continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.739-07:00 [continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=4999ms fireAt=1782775121738 session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
```
