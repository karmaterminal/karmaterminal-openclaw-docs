# R-CW-TOKEN: *** Bracket/Token Fallback Test

## Configuration
- Assembly target: `575a46b61d4efeb4600ead64f13e63e1f9021d44`
- Tested by: Cael 🩸
- Seat: `cael-dgx` (DGX Spark, ARM64)

## Result
PASS-CANDIDATE

## Evidence

The test successfully scheduled the next turn using the bare token syntax `CONTINUE_WORK:<delay>`. The next turn was enqueued, armed, and fired successfully.

### Terminal Completion Evidence

The gateway journal confirms that the work token (`CONTINUE_WORK:5`) originated from bracket fallback, armed the hedge timer, actually fired the work wake, and properly delivered the payload. The subagent (`continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d`) properly handled the sequence and returned its execution via silent-wake delivery back to the main session.

```
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.736-07:00 [continuation/signal] [continuation:trace] effective-signal: origin=bracket kind=work session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:36 cael node[1115872]: 2026-06-29T16:18:36.739-07:00 [continuation/work-dispatch] [continuation:work-hedge-armed] fireIn=4999ms fireAt=1782775121738 session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:41 cael node[1115872]: 2026-06-29T16:18:41.741-07:00 [continuation/work-dispatch] [continuation:work-hedge-fired] session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
Jun 29 16:18:41 cael node[1115872]: 2026-06-29T16:18:41.743-07:00 [continuation/work-dispatch] [continuation:work-wake] hop=1/200 session=agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d reasonCategory=unknown
Jun 29 16:18:37 cael node[1115872]: 2026-06-29T16:18:37.017-07:00 [continuation/announce] [continuation/silent-wake] wakeOnReturn=true target=agent:main:discord:channel:1466192485440164011 silentAnnounce=true
Jun 29 16:18:37 cael node[1115872]: 2026-06-29T16:18:37.017-07:00 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-8e0d72dbbe0c489f0f0a66a5ac365d8d
```
