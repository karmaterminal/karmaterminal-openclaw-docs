# R-CW-4 — continuation chain-depth counter tracking (cael-dgx)

**SHA:** `82827d3cbcba92ff6e19863b30615db028c2651c`  
**Seat:** Cael / `cael` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — chain-depth counter is live and increments across queued continuation work on the deployed SHA.

## Byte

`journal-continuation-window.txt` captures multiple continuation wake events from the current proof window, including:

```text
[continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=2/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=3/200 session=agent:main:discord:channel:1466192485440164011
```

The `/200` bound matches the live `agents.defaults.continuation.maxChainLength=200` on Cael. `reason=requests-in-flight` appears on the paired `work-drive-skipped` lines, so the drive layer correctly held while this proof lane had active requests rather than racing the turn.

## Trace notes

- `trace-4f8c2a3d...json` is the clean counted current-SHA tool-form proof span.
- The `1111...`, `1234...`, `abcdef...`, and `7777...` traces are retained only as supporting/manual-attempt context; they are not the primary clean receipt.
