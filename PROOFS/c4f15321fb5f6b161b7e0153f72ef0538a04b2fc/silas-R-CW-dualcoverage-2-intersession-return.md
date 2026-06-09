# PROOFS — Silas — sub-row 2: intersession return on c4f15321fb

**Candidate:** `c4f15321fb5f6b161b7e0153f72ef0538a04b2fc` (ship-SHA, whatsapp-test-fix on 7dcc9d578c, runtime byte-identical)
**Proof-run:** 2026-06-08 20:17 PDT — FRESH RUN on deployed exact-SHA (clawsweeper-valid)
**Deploy:** lothric gateway deployed c4f15321fb (run 27181280816 = success)
**Final verdict:** **PASS — runtime-proven on exact ship-SHA, config-independent**

## Runtime journal (deployed c4f15321fb)
```
2026-06-08T20:17:50.127-07:00 [continuation:delegate-spawned] hop=17/200 mode=silent session=agent:main:discord:channel:1466192485440164011
2026-06-08T20:17:55.480-07:00 SILAS-PROOF-INTERSESSION-c4f15321fb — intersession-return delegate executed from Silas sprites main session, return targeted to Silas heartbeat session on deployed ship-SHA c4f15321fb.
2026-06-08T20:17:55.534-07:00 [continuation:targeted-return] Delivered to agent:main:discord:channel:1473320126433464465 from agent:main:subagent:continuation-a1725dccb1f0a336de7c7b3ba8b2fd57
```

## Key bytes
1. Delegate spawned SAME-SESSION (1466...11 = sprites). SPAWN same-session; RETURN cross-session.
2. Cross-session DELIVERY: Delivered to 1473320126433464465 (heartbeat). Genuinely cross-session.
3. Zero rejections. The 1042 dispatch-guard never fired (leaf-return path).
4. Byte-string round-tripped: SILAS-PROOF-INTERSESSION-c4f15321fb
5. Config-independent (ungated return-path :1333-1365).

## FINAL VERDICT: PASS (runtime-proven on deployed c4f15321fb, config-independent, clawsweeper-exact)
