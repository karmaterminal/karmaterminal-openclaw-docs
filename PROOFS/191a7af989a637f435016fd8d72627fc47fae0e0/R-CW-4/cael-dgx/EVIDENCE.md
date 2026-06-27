# R-CW-4 — continuation chain-depth counter tracking (cael-dgx)

**SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`  
**Seat:** Cael / `cael-dgx` (DGX Spark, ARM64)  
**Verdict:** ✅ PASS — chain-depth counter is live and increments across queued continuation work on the deployed SHA.

## Byte

`chain_depth_journal.txt` captures multiple continuation wake events from the current proof window, including:

```text
[continuation:work-wake] hop=1/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=2/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=3/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=4/200 session=agent:main:discord:channel:1466192485440164011
[continuation:work-wake] hop=5/200 session=agent:main:discord:channel:1466192485440164011
```

The `/200` bound matches the captured live Cael continuation config (`agents.defaults.continuation.maxChainLength=200`) before mutation. Paired `work-drive-skipped ... reason=requests-in-flight` lines show the drive layer held while requests were active rather than racing the turn.

`k6-r-cw-combined-output.txt` reports the combined R-CW infrastructure probe as partial because Tempo readiness was not established inside that scenario; this row's chain-depth receipt is the gateway journal byte above, not the combined scenario's partial verdict.
