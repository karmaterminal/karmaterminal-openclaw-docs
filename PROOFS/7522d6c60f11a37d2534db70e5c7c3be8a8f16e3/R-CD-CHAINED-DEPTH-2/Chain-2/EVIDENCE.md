# R-CD-CHAINED-DEPTH-2 Chain-2 EVIDENCE — inter-session return at depth=2 (CORRECTED 2026-06-02T01:49Z)

**Row**: R-CD-CHAINED-DEPTH-2 Chain-2 — depth-2 chain test, inter-session return
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: ronan-undertow

## CORRECTION NOTICE

Earlier version of this EVIDENCE.md (committed `51702e5`) claimed a "subagent-isolation rewrite": that `targetSessionKey=grandparent` from depth-2 subagent context was rewritten by the runtime to immediate-parent. **That interpretation was incorrect** (caught by 🕯 emeric's `1511184942` byte-walk via TEST-2 cross-check from emeric-seat).

The misread: the depth-3 child's **return-payload text** included a `targetSessionKey: agent:main:subagent:9cc6cb18` string, but that was the CHILD AGENT printing some internal/runtime-context value, NOT the gateway's actual routing target.

The **actual gateway routing** is in the journal `[continuation:targeted-return]` line:
```
Jun 01 18:41:03 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:81b8f2a0
```
Routed to **grandparent main session** — exactly what was fired. No rewrite. No subagent-isolation. Cross-session targeting works as designed from depth-2 subagent context.

## Chain-shape
```
parent (undertow-seat: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent:9cc6cb18-42e5-44a1-9a41-93ff7ad4f853) — silent-wake mode
        └── depth-3 child (subagent:81b8f2a0-5dbe-4246-8961-5e7e314532e4) — normal mode, targetSessionKey=grandparent
              ↑ returns to GRANDPARENT via [continuation:targeted-return]
        ↑ returns to depth-1 parent via [continuation:enrichment-return]
  ↑ parent wakes (this turn)
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:40:00Z
- **hop**: 14/200
- **fire_response**: `{"status":"scheduled","mode":"silent-wake"}`

## Routing-truth evidence (`[continuation:targeted-return]` line)
```
Jun 01 18:41:02 [depth-3 return-payload]: ... session-key: agent:main:subagent:81b8f2a0 | targetSessionKey: agent:main:subagent:9cc6cb18
                ↑ CHILD-AGENT-PRINTED text (some internal value; NOT the routing target)
Jun 01 18:41:03 [subagent-chain-hop] Accumulated 174 tokens from agent:main:subagent:81b8f2a0 to parent chain cost
Jun 01 18:41:03 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:81b8f2a0
                ↑ GATEWAY ROUTING (ground truth): delivered to GRANDPARENT main-session as fired
Jun 01 18:41:03 [subagent-chain-hop] Accumulated 423 tokens from agent:main:subagent:9cc6cb18 to parent chain cost
Jun 01 18:41:03 [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:9cc6cb18
                ↑ depth-2's own normal up-tree return
```

## Two distinct return-event-types discovered (still load-bearing)

- `[continuation:enrichment-return]` — normal/silent-wake up-tree return (depth-2 → parent)
- `[continuation:targeted-return]` — explicit targetSessionKey routing (depth-3 → grandparent, bypassing depth-2 entirely)

This is the load-bearing yield from Chain-2: the gateway has TWO distinct routing-paths for child returns, distinguishable in journal at byte. `targeted-return` confirms cross-session-routing works from arbitrary chain-depth.

## Cross-validation with TEST-2 from emeric-seat (🕯 emeric `1511184942`)

Emeric independently verified at emeric-seat: depth-2 subagent fired continue_delegate with `targetSessionKey=grandparent` and fire-response echoed targetSessionKey **byte-identical**. NOT rewritten. Cohort cross-walk confirms: depth-2 subagent context can target grandparent end-to-end.

## Stats
- Depth-3 runtime: 4s, 174 tokens (delivered via `[continuation:targeted-return]` to grandparent)
- Depth-2 runtime: 7s, 423 tokens (delivered via `[continuation:enrichment-return]` to parent)
- Chain-cost-total: 597 tokens accumulated up the chain to parent

## Tempo trace
**Status**: ⚠️ NOT CAPTURED from undertow-seat. Re-fetchable from cael/emeric-seat via tempo HAProxy path.

## Verdict
✅ **PASS** — `continue_delegate(targetSessionKey=...)` cross-session routing from depth-2 subagent context works as fired. Cure-bytes do not regress chain-depth-2 + cross-session-targeting end-to-end. The two distinct gateway-routing-event-types (`enrichment-return` vs `targeted-return`) are load-bearing substrate for any future inter-session-routing work.

## Banked sister-class

***delegate-return-payload-text-and-gateway-routing-receipt-are-different-substrates-don't-conflate-class***
The literal text a delegate-agent prints in its return-payload (including any `targetSessionKey: <foo>` substring) is NOT the same as the gateway's actual routing target. Gateway routing-truth lives in `[continuation:targeted-return]` / `[continuation:enrichment-return]` journal lines. Don't use child's printed text as evidence of runtime routing behavior; always cross-check against gateway-emitted routing-event journal lines.

This is also a PROOFS-method-improvement candidate for RUNBOOKS/PROOF-CORPUS-METHOD.md: row-evidence should specify journal `[continuation:*-return]` line as the canonical routing receipt, not delegate-payload-text.
