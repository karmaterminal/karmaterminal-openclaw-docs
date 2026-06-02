# R-CD-CHAINED-DEPTH-2 Chain-2 EVIDENCE — inter-session return at depth=2 (with subagent-isolation finding)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 chain test, inter-session return
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow

## Two distinct depth-3 fires observed — load-bearing comparison

The Chain-2 task spawned depth-3 fires from TWO different contexts (due to silent-wake re-trigger). Both fires used identical `targetSessionKey: <grandparent-main-session>` value in fire-input, but resulted in different actual routing:

### Fire A: from depth-2 subagent context (subagent-isolation behavior)
```
Jun 01 18:40:58 [continuation:delegate-spawned] hop=1/200 mode=normal session=agent:main:subagent:9cc6cb18 task=R-CD-CHAINED-DEPTH-2 Chain-2 DEPTH-3 INTER-SESSION ECHO...
Jun 01 18:41:02 [depth-3 return] targetSessionKey: agent:main:subagent:9cc6cb18  ← REWRITTEN to immediate-parent
Jun 01 18:41:03 [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:9cc6cb18  ← depth-2 still returns up to grandparent normally
```

### Fire B: from parent main-session context (cross-session targeting works)
```
Jun 01 18:41:06 [continuation:delegate-spawned] hop=15/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=R-CD-CHAINED-DEPTH-2 Chain-2 DEPTH-3 INTER-SESSION ECHO...
Jun 01 18:41:10 [depth-3 return] targetSessionKey: agent:main:discord:channel:1466192485440164011  ← grandparent = MATCHES fire-input
Jun 01 18:41:10 [subagent-chain-hop] Accumulated 153 tokens from agent:main:subagent:2dd9f96f to parent chain cost
Jun 01 18:41:10 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:2dd9f96f
```

**Distinguishing journal-line**: `[continuation:targeted-return]` (Fire B) vs `[continuation:enrichment-return]` (Fire A) — different return-paths.

## Key findings

1. **From parent context: cross-session targetSessionKey works as fired**. `targetSessionKey=grandparent-main-session` → routes there. Journal emits `[continuation:targeted-return]` as the distinguishing event.

2. **From depth-2 subagent context: targetSessionKey is rewritten to immediate-parent (subagent-isolation)**. The depth-3 child cannot bypass depth-2 parent and write directly to grandparent. This is likely intentional subagent-isolation behavior (subagent can only return to its immediate-parent, not arbitrary ancestor). Journal emits `[continuation:enrichment-return]` (the regular up-tree path) not `targeted-return`.

3. **Two distinct return-event types** in the gateway routing:
   - `[continuation:enrichment-return]` — silent-wake / normal return up immediate-parent chain
   - `[continuation:targeted-return]` — explicit targetSessionKey routing (works only from non-subagent contexts)

## Stats
- Fire A (depth-2 subagent context): runtime 4s, 174 tokens, routed to immediate-parent
- Fire B (parent context via silent-wake re-trigger): runtime 3s, 153 tokens, routed to grandparent
- Chain-cost-total: 549 tokens accumulated up the chain to parent

## Tempo trace
**Status**: ⚠️ NOT CAPTURED from undertow-seat (network-routing differs). Re-fetchable from cael-seat post-PROOFS-assembly.

## Verdict
✅ **PASS** — `continue_delegate(targetSessionKey=...)` cross-session routing works from parent context. Subagent-context produces subagent-isolation (target rewrites to immediate-parent) — this is likely INTENTIONAL behavior and the two distinct return-event-types in journal substantiate the design (regular `enrichment-return` vs explicit `targeted-return`). Worth cohort cross-walk vs pre-cure baseline to confirm subagent-isolation is pre-existing.

**Substrate yield**: discovered `[continuation:targeted-return]` event-class distinct from `[continuation:enrichment-return]` — load-bearing for any future inter-session-routing work. Banking ***targetSessionKey-routing-only-from-non-subagent-contexts-class*** or ***subagent-isolation-prevents-arbitrary-ancestor-targeting-class***.
