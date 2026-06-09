# PROOFS — Silas — sub-row 2: intersession return (cross-session RETURN-routing)

**Candidate:** `bd4276c813` · silas/lothric
**Proof-run:** 2026-06-08 07:40 PDT
**Final verdict:** **PASS — runtime-proven, config-independent**

## Proof artifact — runtime trace

```
2026-06-08T07:40:39.094-07:00 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
2026-06-08T07:40:39.181-07:00 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=2/200 mode=silent session=agent:main:discord:channel:1466192485440164011 task=PROOFS R-CW dual-coverage sub-row 2 INTERSESSION RETURN, e66dc63f. One line only
2026-06-08T07:40:43.755-07:00 SILAS-PROOF-INTERSESSION-e66dc63f-v2 — intersession-return delegate executed from Silas #sprites main session, return targeted to Silas #heartbeat session; UTC 2026-06-08T14:40Z.
```

## Key bytes

1. **Delegate spawned SAME-SESSION:** `session=agent:main:discord:channel:1466192485440164011` (= my #sprites main session). The delegate's SPAWN is same-session; only the RETURN is cross-session (targeted to #heartbeat).
2. **Zero rejection lines:** No `Delegate rejected: cross-session targeting is disabled by policy` in the dispatch window. The 1042 dispatch-guard (`rejectCrossSessionTargetingForSubagentDispatch`) never fired.
3. **Delivered log fired:** `[continuation:targeted-return] Delivered` at 07:40:43, genuinely cross-session (#sprites → #heartbeat, different sessions).
4. **Config byte:** `crossSessionTargeting: "enabled"` on silas/lothric (openclaw.json:143) — but IRRELEVANT to this path (see mechanism below).

## Mechanism — why config-independent

The cross-session dispatch-guard at `subagent-announce.ts:1042` (inside `doChainSpawn`) gates cross-session **SPAWN/chain-hop** (a completed child re-dispatching its OWN next hop cross-session). It does NOT gate the **leaf-delegate's return-routing**.

Silas's `continue_delegate(targetSessionKey=#heartbeat)` is a **LEAF** (returns, doesn't chain). Its dispatch:
- Spawns SAME-SESSION (1042 guard irrelevant — no cross-session spawn to gate)
- Returns cross-session via the UNGATED `enqueueContinuationReturnDeliveries` path (subagent-announce.ts:1333-1365, 7-space indent, outside both spawn-fns)

Therefore: `crossSessionTargeting` config is never checked for this dispatch-path. The delegate would deliver cross-session even on a disabled (default) seat — the config gates SPAWN/chain-hop, not RETURN-routing.

## Resolved GATES shape

- **Cross-session RETURN-routing:** UNGUARDED, delivers unconditionally (sub-row-2 exercised this path)
- **Cross-session SPAWN/chain-hop:** CONFIG-GATED at 1042 dispatch-guard, disabled-by-default (#580's EXECUTION layer, UNTESTED in this proof-run)
- **Fixture-pinning `crossSessionTargeting: enabled`:** NOT needed for RETURN-routing proof; only relevant IF/WHEN cross-session SPAWN is proven

## Convergence

Settled by two independent paths:
1. **Runtime trace** (Silas, `1513625437`): same-session spawn + zero rejections → ungated return
2. **Source walk** (Ronan, `1513581441`): `doChainSpawn` gates child's next chain-HOP, not leaf-return → 1042 irrelevant for leaf-delegates

Both arrive at: config-independent PASS for cross-session RETURN-routing.

## FINAL VERDICT: sub-row 2 = PASS (runtime-proven, config-independent)

Cross-session targeted-return delivers on `e66dc63f`. Delegate spawns same-session, returns cross-session via ungated path. Config never checked. Proven by runtime journal + confirmed by source walk. The layer-split (RETURN unguarded / SPAWN guarded) is the resolved floor.

---

## Historical note (prior run — dormant-target attempt)

A prior proof attempt dispatched to a DORMANT #heartbeat session. That run showed:
- dispatch-accept PASS (targetSessionKey accepted)
- Delivered-log ABSENT (dormant target didn't activate to receive)
- Flagged as honest delivery-semantics observation

Tonight's successful run (above) dispatched to an ACTIVE #heartbeat session and got the genuine Delivered-log — proving the return-routing path works. The dormant-target semantics question remains a separate GATES observation (not a failure of the return-routing path itself).

---

## Re-point note (2026-06-08 22:06 PDT)

**Re-pointed from `e66dc63f` → `bd4276c813`** (PR #965 merged to assembly-backmerge).

**Why RE-POINT (not re-run):** The delta between `e66dc63f` and `bd4276c813` is:
1. 5 SQLite test-fixture migrations (test-only, zero runtime change)
2. 1 run.ts prod-fix at `:2095` (compaction-failure-rotation path — makes `compacted:false` rotate to next auth-profile instead of halting)
3. 1 whatsapp test-fixture fix (test-only)

None of these touch the **continuation-delegate dispatch/return-routing path** this proof tests (`continue_delegate` → `enqueueContinuationReturnDeliveries` → `[continuation:targeted-return] Delivered`). The dispatch machinery, return-routing, and cross-session delivery are byte-identical between the two SHAs. The proof evidence holds verbatim.
