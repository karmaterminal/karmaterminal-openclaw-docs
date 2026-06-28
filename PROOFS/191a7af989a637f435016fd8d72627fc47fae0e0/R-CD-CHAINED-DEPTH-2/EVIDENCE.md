# R-CD-CHAINED-DEPTH-2 aggregate evidence

**Verdict:** ✅ PASS

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat mix:** `ronan-dgx` aggregate fold, with earlier Silas TEST-3 retained as corroborating canary evidence.
**Final fold time:** 2026-06-27 21:22 PDT

## Proof statement

The depth-2 delegate-chain row is now fully covered on deployed `191a7af` by three clean subtests:

1. **TEST-1 up-tree silent-wake traversal** — depth-2 leaf return delivered up-tree to depth-1 parent, depth-2 grandparent, and main channel (`TEST-1-ronan-dgx`).
2. **TEST-2 inter-session targeted return** — depth-1 fired a depth-2 leaf with `targetSessionKeys=[main channel]`; depth-2 returned the nonce and the gateway delivered directly to the explicit main session (`TEST-2-ronan-dgx`).
3. **TEST-3 tree fanout echo** — depth-1 fired a depth-2 leaf with `fanoutMode="tree"`; depth-2 returned the nonce and the gateway delivered to depth-1 parent + main channel (`TEST-3-ronan-dgx`).

The row was previously partial because local Chain-2/Chain-3 attempts were invalid model/tool-call-shape artifacts. Those remain documented in `RONAN-LOCAL-CHAIN-AUDIT.md` and are not counted. The counted Chain-2B/Chain-3B retries used stricter prompt constraints and clean tool receipts.

## Subtest evidence

| Subtest | State | Evidence |
|---|---|---|
| TEST-1 up-tree silent-wake | PASS | `TEST-1-ronan-dgx/EVIDENCE.md` |
| TEST-2 targeted inter-session return | PASS | `TEST-2-ronan-dgx/EVIDENCE.md` + `TEST-2-ronan-dgx/artifacts/trace-55555555555555555555555555555555-chain2b.json` |
| TEST-3 fanout tree echo | PASS | `TEST-3-ronan-dgx/EVIDENCE.md` + `TEST-3-ronan-dgx/artifacts/trace-77777777777777777777777777777777-chain3b-depth1.json` + `TEST-3-ronan-dgx/artifacts/trace-66666666666666666666666666666666-chain3b-depth2.json` |
| Silas TEST-3 canary | PASS-candidate corroboration | `TEST-3-silas/EVIDENCE.md` |

## Load-bearing Chain-2B journal bytes

```text
DEPTH1-CHAIN2B-FIRED RCDCHAIN2B-191a7af-20260627T2123PDT-ronan status=scheduled
[continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:continuation-a321cecc5c4d954c3c7649e33448a596 task=R-CD-CHAINED-DEPTH-2 CHAIN-2 DEPTH-2 LEAF...
DEPTH2-CHAIN2B-DONE RCDCHAIN2B-191a7af-20260627T2123PDT-ronan
[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-8458067c589001aeccff4dce5a327ec6
```

## Load-bearing Chain-3B journal bytes

```text
DEPTH1-CHAIN3B-FIRED RCDCHAIN3B-191a7af-20260627T2123PDT-ronan status=scheduled
[continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:subagent:continuation-e8721560d9316b31fee3bcf69fb66214 task=R-CD-CHAINED-DEPTH-2 CHAIN-3 DEPTH-2 LEAF...
DEPTH2-CHAIN3B-DONE RCDCHAIN3B-191a7af-20260627T2123PDT-ronan
[continuation:targeted-return] Delivered to agent:main:subagent:continuation-e8721560d9316b31fee3bcf69fb66214,agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-e63b23b86f91fcada6275121cfdd5a8b
```

## Honest limits

- The first local Chain-2/Chain-3 attempts are invalid and excluded.
- Chain-2B/Chain-3B are transcript+journal proofs, not k6 summary artifacts.
- No claim is made about alternate-model rows; those remain honest-limited separately by `karmaterminal/openclaw#1103`.
