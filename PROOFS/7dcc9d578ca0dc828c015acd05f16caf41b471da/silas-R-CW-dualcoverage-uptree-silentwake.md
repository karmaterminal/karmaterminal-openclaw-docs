# PROOFS — Silas — sub-row 1: uptree silent-wake (dispatch + spawn + return-wake)

**Candidate:** `7dcc9d578ca0dc828c015acd05f16caf41b471da` (history-preserving ship-SHA, deployed to lothric)
**Proof-run:** 2026-06-08 18:23 PDT — FRESH RUN on deployed exact-SHA (clawsweeper-valid)
**Final verdict:** **PASS — runtime-proven on exact ship-SHA**

## Runtime journal (deployed 7dcc9d578c)

```
2026-06-08T18:22:54.109-07:00 [continuation:delegate-spawned] hop=11/200 mode=silent session=agent:main:discord:channel:1466192485440164011
2026-06-08T18:23:01.107-07:00 SILAS-PROOF-SILENTWAKE-7dcc9d578c — uptree silent-wake delegate dispatched+spawned+returned on deployed ship-SHA 7dcc9d578c, byte-string round-trip confirmed.
```

## Key bytes
1. Delegate dispatched + spawned: hop=11/200 mode=silent on deployed 7dcc9d578c.
2. Byte-string round-tripped: `SILAS-PROOF-SILENTWAKE-7dcc9d578c` — full dispatch-spawn-return path exercised.

## FINAL VERDICT: PASS (runtime-proven on deployed 7dcc9d578c, clawsweeper-exact)
