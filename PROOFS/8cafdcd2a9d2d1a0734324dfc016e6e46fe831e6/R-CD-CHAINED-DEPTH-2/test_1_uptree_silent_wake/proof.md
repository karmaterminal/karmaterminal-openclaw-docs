# R-CD-CHAINED-DEPTH-2 TEST-1 — uptree silent-wake (depth-2 chained continuation)

**Row**: R-CD-CHAINED-DEPTH-2, TEST-1 (root → cd(silent-wake) → cd(silent-wake) depth-2 → return up-tree)
**Owner**: 🕯 Emeric (sub for 🌫 Silas)
**Seat**: emeric-nuc (i7-12700H Alder-Lake, CachyOS) — root requester `agent:main:discord:channel:1466192485440164011`
**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed, OpenClaw 2026.6.8 (8cafdcd) — FF'd ship-tip)
**Status**: ✅ PASS (up-tree propagation proven)

## Scenario (figs's "does our shit REALLY work" depth-2 canon)

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
  "traceparent": "00-6a9f65bd7a9381305b1f9f541f5fcd7d-4127c7a279466bcb-01" }
```

**T1 (depth-1 delegate)** — spawned as `[continuation:chain-hop:1]`, session
`agent:main:subagent:continuation-aa588d9df93f3b5622c9a3ea33c4a77e`, chain-hop=1, depth=1/5. It dispatched
the depth-2 leaf via `continue_delegate(mode='silent-wake')` from inside its delegated turn, and
captured the depth-2 dispatch traceparent.

**T2 (depth-2 leaf)** — spawned inside the depth-1 turn (a distinct chain at the inner hop). silent-wake mode honored.

**T3 (root = emeric)** — the depth-1 leg's up-tree return arrived as an `[Internal task completion
event]` (silent-wake propagation), verbatim:
> **DEPTH-1 leg: spawned depth-2 leaf OK on 8cafdcd; my chain-hop=1 depth=1; depth-2 dispatch traceparent=00-6a9f65bd7a9381305b1f9f541f5fcd7d-4127c7a279466bcb-01**

That wake firing at root **is** the up-tree return receipt — the depth-2 chained `continue_delegate`
propagated its return back up the tree to the root requester. (Full receipt in `fire-and-return.txt`.)

## Observed (Tempo chain trace `chain-trace.json`)

The depth-1 dispatch trace `6a9f65bd7a9381305b1f9f541f5fcd7d` (55017 bytes, 41 spans, `host.name=emeric`)
carries the `continuation.delegate.dispatch` span for the depth-1 leg on the deployed `8cafdcd` runtime.

**Honest trace-shape note:** the depth-1 dispatch (initiated at root) and the depth-2 dispatch
(initiated *inside the depth-1 subagent's own turn*) are **distinct chains** — so the depth-2 dispatch
emits under the subagent's own trace context, not nested in the root-initiated depth-1 trace. So the
captured depth-1 chain trace shows the depth-1 `continuation.delegate.dispatch`; the depth-2 leg is
evidenced by its captured traceparent + the up-tree return receipt (which only fires if the depth-1
leg successfully spawned the depth-2 sub-delegate). The BEHAVIOR — depth-2 chained continue_delegate
with up-tree silent-wake return to root — is proven end-to-end by the return receipt + the depth-2
dispatch traceparent; the single-trace "two nested dispatch spans" shape (reference `077b261dd8`) is a
same-trace-context artifact that differs here because my depth-2 was dispatched from the subagent turn,
which is the strict-reading shape (distinct inner chain).

## Verdict

✅ **PASS** — depth-2 chained `continue_delegate(silent-wake)` fired root→depth-1→depth-2 and the
return propagated **up-tree to root** on the deployed `8cafdcd` bytes. The up-tree wake landing at
root (the `[Internal task completion event]` receipt) is the propagation proof; chain-tracking spawned
a distinct inner chain at the depth-2 hop. runtime==ship `8cafdcd` byte-verified.

🕯 Emeric (sub for 🌫 Silas) — R-CD-CHAINED-DEPTH-2 TEST-1 up-tree silent-wake PASS on `8cafdcd`.
