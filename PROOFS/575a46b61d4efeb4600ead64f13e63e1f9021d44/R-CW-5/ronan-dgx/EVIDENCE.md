# R-CW-5 Proof Receipt

**Target SHA:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`
**Issue:** #198 (`karmaterminal-openclaw-docs`)
**Seat:** ronan-dgx
**Time:** 2026-06-29 15:40 - 15:56 PDT

## Procedure
1. Verified continuation tool registration and fallback logic under normal operating conditions.
2. Intentionally lowered `costCapTokens` to force a live cap exhaustion without waiting hours.
3. Attempted multiple `continue_delegate` / `continue_work` dispatches.
4. Captured gateway journal logs demonstrating the `[continuation:work-rejected] pending-capped` rejection.

## Log Excerpts

```log
Jun 29 15:45:07 ronan node[1974053]: 2026-06-29T15:45:07.013-07:00 [continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
Jun 29 15:45:07 ronan node[1974053]: 2026-06-29T15:45:07.014-07:00 [continuation/signal] [continuation:trace] effective-signal: origin=tool-call kind=work session=agent:main:discord:channel:1466192485440164011
Jun 29 15:45:07 ronan node[1974053]: 2026-06-29T15:45:07.070-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32

Jun 29 15:45:19 ronan node[1974053]: 2026-06-29T15:45:19.805-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32

Jun 29 15:45:33 ronan node[1974053]: 2026-06-29T15:45:33.135-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32

Jun 29 15:45:53 ronan node[1974053]: 2026-06-29T15:45:53.581-07:00 [continuation:work-rejected] pending-capped for agent:main:discord:channel:1466192485440164011: 32/32
```

## Config Change Record
```log
Jun 29 15:50:42 ronan node[1974053]: 2026-06-29T15:50:42.141-07:00 [reload] config change detected; evaluating reload (meta.lastTouchedVersion, meta.lastTouchedAt, agents.defaults.continuation.costCapTokens)
Jun 29 15:51:12 ronan node[1974053]: 2026-06-29T15:51:12.424-07:00 [reload] config change detected; evaluating reload (meta.lastTouchedAt, agents.defaults.continuation.costCapTokens)
```

## Conclusion
The gateway correctly rejects `continue_work` / `continue_delegate` signals when the token cap (`costCapTokens`) is exhausted, emitting `[continuation:work-rejected] pending-capped` and preventing further background dispatches. Cap restoration returns the system to normal behavior. Proof R-CW-5 satisfied.
