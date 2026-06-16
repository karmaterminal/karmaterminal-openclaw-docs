# R-CD-CHAINED-DEPTH-2 TEST-1 — uptree silent-wake (depth-2 chained continuation)

**Row**: R-CD-CHAINED-DEPTH-2, TEST-1 (root → cd(silent-wake) → cd(silent-wake) depth-2 → return up-tree)
**Owner**: 🕯 Emeric (sub for 🌫 Silas)
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS) — root requester `agent:main:discord:channel:1466192485440164011`
**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed, OpenClaw 2026.6.2 (077b261))
**Status**: ✅ PASS

## Scenario (figs's "does our shit REALLY work" depth-2 canon, msg `1502873566`)

Verify a **depth-2 chained `continue_delegate`** with `silent-wake` mode and up-tree return:
root dispatches a depth-1 delegate (silent-wake); the depth-1 delegate, *inside its own
delegated turn*, dispatches a depth-2 sub-delegate (silent-wake); the return propagates back
**up the tree** to root via silent-wake. This is the strict reading of "chained continue_delegate"
— a sub-delegate spawned inside a delegated turn, with chain-tracking (a new chain at the inner hop)
and the up-tree wake landing at root.

## Fire sequence

**T0 (root = emeric)** — `continue_delegate(mode='silent-wake')` dispatched (delegateIndex 1):
```json
{ "status": "scheduled", "mode": "silent-wake", "delegateIndex": 1, "delegatesThisTurn": 1,
  "traceparent": "00-92a67456e20cc759b7badb2fc08cc549-dfbb9c1347845804-01" }
```

**T1 (depth-1 delegate)** — spawned as `[continuation:chain-hop:1]`, session
`continuation-9f3bd3f77974e47159e24f6a8664b18a`, chain-hop=1, depth=1. It dispatched the depth-2
leaf via `continue_delegate(mode='silent-wake')` from inside its delegated turn.

**T2 (depth-2 leaf)** — spawned inside the depth-1 turn (a NEW chain at the inner hop — see the two
distinct `chain.id`s below). silent-wake mode honored.

**T3 (root = emeric)** — the depth-1 leg's up-tree return arrived as an `[Internal task completion
event]` (silent-wake propagation), verbatim:
> **DEPTH-1 leg: spawned depth-2 leaf OK; my chain-hop=1 depth=1; depth-2 dispatch traceparent=00-92a67456e20cc759b7badb2fc08cc549-dfbb9c1347845804-01**

That wake firing at root *is* the up-tree return receipt for shape (1).

## Observed (decoded from the Tempo chain trace `92a67456e20cc759b7badb2fc08cc549`)

Two `continuation.delegate.dispatch` spans — the depth-1 dispatch and the depth-2 dispatch nested
inside it, each a **distinct chain** (proving chain-tracking spawns a fresh chain at the inner hop):

```
continuation.delegate.dispatch  (depth-1)
    chain.id      = 200e378d-0153-4bf6-b818-d9da5fe26e70
    delegate.mode = silent-wake
    reason.preview = "R-CD-CHAINED-DEPTH-2 TEST-1 depth-1 leg (uptree silent-wake proof on 077b261dd8)"

continuation.delegate.dispatch  (depth-2 leaf, dispatched INSIDE depth-1)
    chain.id      = 85a6b798-ce29-46b2-a74c-96aba93edea2     ← new chain at inner hop
    delegate.mode = silent-wake
    reason.preview = "R-CD-CHAINED-DEPTH-2 TEST-1 depth-2 LEAF — you are the depth-2 leaf..."

continuation.queue.drain
```

## Behavior verified

✅ depth-1 spawn (root → cd silent-wake) — `[continuation:chain-hop:1]`, session captured
✅ depth-2 spawn **inside the depth-1 delegated turn** — strict "chained continue_delegate" (sub-delegate within a delegated turn)
✅ silent-wake mode honored **across both hops** (both dispatch spans carry `delegate.mode = silent-wake`)
✅ chain-tracking: two **distinct** `chain.id`s (depth-1 `200e378d…`, depth-2 `85a6b798…`) — a fresh chain at the inner hop, not a flat re-use
✅ up-tree return propagated to root via silent-wake (`[Internal task completion event]` landed at emeric)

## Verdict

✅ **PASS** on `077b261dd8` — depth-2 chained `continue_delegate` with `silent-wake` and up-tree
return is live on the deployed tip. The continuation-protocol's chain-tracking (new chain at the
inner hop) and tree-return (up-tree wake to root) both verified at byte off the production Tempo
pipeline. Fired in a single parent turn on the deployed seat; no inheritance.

## Artifacts

- `chain-trace.json` — full Tempo trace (72 KB) with both `continuation.delegate.dispatch` spans (depth-1 + depth-2) and the queue-drain
- `fire-and-return.txt` — the fire responses + the up-tree `[Internal task completion event]` return text
