# R-CD-CHAINED-DEPTH-2 TEST-1 — up-tree silent-wake (elliott-seat dual-coverage, DEPTH-3 reached)

**Row owner (dual-coverage):** 🌻 Elliott (subagent-root → depth-3 chain)
**Seat:** elliott (10.0.0.153, CachyOS, gateway model claude-opus-4.8)
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
**Fired:** 2026-06-05 16:52 PDT (23:52 UTC)
**Tool:** `continue_delegate(mode="silent-wake")` chained from a depth-1 subagent root

## Behavior proven
Depth-2+ continuation chaining with up-tree silent-wake return. Because this proof was driven
from a **subagent root** (the R-CD-CHAINED-DEPTH-2 proof-runner itself runs at depth-1/5), the
chain reached **depth-3/5** — one level deeper than the canary depth-2 run, demonstrating the
chain propagates N levels and the depth banner increments correctly at each hop while staying
within maxChainDepth=5.

Chain topology:
```
root Discord channel session (agent:main:discord:channel:1466192485440164011)
  └─ depth-1: proof-runner subagent (38595e03-…)  [this task]
       └─ depth-2: TEST-1 hop-A child (ae1a924c-… / sess d7d84e57)   banner: depth 2/5
            └─ depth-3: TEST-1 hop-B grandchild (e0c89e1e-… / sess ea88a7de)  banner: depth 3/5
```

## Dispatch receipts (from tool responses)

### depth-1 → depth-2 (proof-runner fires TEST-1 hop-A), mode=silent-wake
```json
{ "status": "scheduled", "mode": "silent-wake", "delaySeconds": 0,
  "delegateIndex": 1, "delegatesThisTurn": 1,
  "traceparent": "00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01" }
```

### depth-2 → depth-3 (hop-A child fires hop-B grandchild), mode=silent-wake
Captured from the depth-2 child's own tool-result (transcript sess d7d84e57):
```json
{ "status": "scheduled", "mode": "silent-wake", "delaySeconds": 0,
  "delegateIndex": 1, "delegatesThisTurn": 1,
  "traceparent": "00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies." }
```

## Depth-3 grandchild EXECUTION + up-tree return PROVEN (byte-verified transcript)
Source: `/home/figs/.openclaw/agents/main/sessions/ea88a7de-6094-4b2e-860d-61fc5066dbd4.jsonl`

Task banner (injected by runtime) — note `(depth 3/5)` and fresh nested chain-hop counter:
```
[Fri 2026-06-05 16:52 PDT] [Subagent Context] You are running as a subagent (depth 3/5).
[continuation:chain-hop:1] Delegated task (turn 1/200): [TEST-1/hop-B depth-3 grandchild]
  Echo "DEPTH-3 GRANDCHILD REACHED". Report your depth banner value.
  Return a one-line summary: GRANDCHILD-OK depth=<value> — this return should propagate UP the tree.
```

Grandchild assistant response (the up-tree return payload):
```
DEPTH-3 GRANDCHILD REACHED
My depth banner value: depth 3/5
GRANDCHILD-OK depth=3/5 — propagating up the tree.
```

## Traceparent continuity (the depth-chain proof)
Single trace-id propagated across every level dispatch→depth-2→depth-3:
- trace-id:   `8be976c2dc2df9bea5429de554202e5a`  (identical at root-runner, depth-2 sess d7d84e57, depth-2's dispatch of depth-3)
- parent-span:`624a617188e0a3db`  (the continuation.delegate.dispatch span)
- W3C traceparent: `00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01`
Grep across session transcripts a05788d7 / d7d84e57 / 824b7268 all surface the identical traceparent → continuity confirmed.

## Causal ordering (proves downward propagation)
From session-event timestamps:
- depth-2 (d7d84e57) start: 2026-06-05T23:52:12.148Z
- depth-3 GC (ea88a7de) start: 2026-06-05T23:52:28.685Z  (spawned AFTER depth-2's dispatch turn)
- depth-3 GC last event:      2026-06-05T23:52:31.512Z  (≈3s leaf runtime)
Grandchild spawns strictly AFTER its depth-2 parent dispatches it → downward chain propagation confirmed.

## ⚠️ HONEST SCOPE OF PROOF — up-tree RETURN-WAKE not independently confirmed (scripted-echo contamination)
Integrity caveat (same masked-regression class flagged in rune/cael retractions b379d79/78bfe1d re #580,
and re-flagged by the cohort in the root session's own reasoning this run: "the 'return receipt' was a
scripted echo — the delegate returned [token] because I told it to return that string — not routing evidence"):
The return token `GRANDCHILD-OK` was written BY ME into the grandchild's task instructions, so the
grandchild emitting it proves EXECUTION, not that any return propagated up. Grepping ancestor transcripts
for it is contaminated (the depth-2 parent's task-text already contained the string). Distinguishing
dispatch-echo from actual receipt:
- depth-2 parent (d7d84e57) after dispatching the grandchild: its NEXT user-injection was
  `[OpenClaw heartbeat poll]` → `HEARTBEAT_OK`. **No silent-wake return-injection re-woke it** — it had
  already ended its subagent turn.
- proof-runner root (a05788d7, this session) after `sessions_yield`: next user-injection was also
  `[OpenClaw heartbeat poll]`, **not** a delegate-return wake carrying the grandchild payload.
Conclusion: the grandchild EXECUTED at depth-3 (byte-verified, independent transcript) and the chain
DISPATCHED correctly at every level, but a distinct up-tree silent-wake **return-wake landing** in an
ancestor was NOT captured. Consistent with silent-wake semantics (return targets the dispatching session;
once that subagent terminated, no live turn exists to inject into). Observability/timing limit of THIS
run — NOT a demonstrated regression, but also NOT a proven up-tree return.

## Chain-tracking metadata observed
- Every dispatch response carries: "Chain tracking (cost cap, depth limit) applies."
- Per-chain hop counter RESETS on each nested chain (depth-2 banner shows `chain-hop:1 turn 1/200` for the NEW subagent chain it spawned; depth-3 grandchild likewise `chain-hop:1 turn 1/200`).
- Depth banner increments 2/5 → 3/5 across the hop — depth-bound observable and enforced (max 5).

## TEST-1 VERDICT: ⚠️ PARTIAL PASS (depth-3 chaining PROVEN; up-tree return-wake landing UNCONFIRMED)
**Proven (byte-verified):** chained `continue_delegate(mode=silent-wake)` propagated from a subagent
root through depth-2 to depth-3; the depth-3 grandchild EXECUTED (independent transcript ea88a7de,
banner `depth 3/5`, echo + return-payload emitted); dispatch accepted at each hop; trace-id
`8be976c2…` continuous dispatch→depth-2; depth-bound increments 2/5→3/5 and is enforced (max 5).
**NOT confirmed this run:** a distinct up-tree silent-wake RETURN-WAKE re-injecting the grandchild
payload into an ancestor (see HONEST SCOPE above — ancestors got heartbeat polls, not return-wakes,
after their turns ended). Token-grep matches were dispatch-echo, not receipt.
Dual-coverage extends Ronan's canary depth-2 to depth-3 for the DISPATCH/EXECUTION half; the
return-wake-landing half remains as-yet-uncaptured here and would need a live-ancestor timing setup.
