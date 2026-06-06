# R-CD-CHAINED-DEPTH-2 TEST-2 — inter-session return (elliott-seat dual-coverage, DEPTH-3 reached)

**Row owner (dual-coverage):** 🌻 Elliott (subagent-root → depth-3 chain)
**Seat:** elliott (10.0.0.153, CachyOS, gateway model claude-opus-4.8)
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
**Fired:** 2026-06-05 16:52 PDT (23:52 UTC)
**Tool:** `continue_delegate` with explicit `targetSessionKey` (inter-session routing) at depth-3

## Behavior proven
Depth-2+ chaining where a deep child returns INTER-SESSION via explicit `targetSessionKey`
(routing to a named session, not the spawning delegate's default up-tree path). Driven from a
subagent root, so the inter-session dispatch occurred at **depth-3/5**.

Chain topology:
```
root Discord channel session (agent:main:discord:channel:1466192485440164011)  ← targetSessionKey aims here
  └─ depth-1: proof-runner subagent (38595e03-…)  [this task]
       └─ depth-2: TEST-2 hop-A child (a9d9124d-… / sess 824b7268)   banner: depth 2/5
            └─ depth-3: TEST-2 hop-B grandchild (eb9c2b51-… / sess 503737ab)  banner: depth 3/5
                 returns INTER-SESSION via targetSessionKey=agent:main:discord:channel:1466192485440164011
```

## Dispatch receipts (from tool responses)

### depth-1 → depth-2 (proof-runner fires TEST-2 hop-A), mode=silent-wake
```json
{ "status": "scheduled", "mode": "silent-wake", "delaySeconds": 0,
  "delegateIndex": 2, "delegatesThisTurn": 2,
  "traceparent": "00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01" }
```

### depth-2 → depth-3 inter-session (hop-A child fires hop-B grandchild with targetSessionKey)
Captured from the depth-2 child's tool-result (transcript sess 824b7268):
```json
{ "status": "scheduled", "mode": "silent", "delaySeconds": 0,
  "delegateIndex": 1, "delegatesThisTurn": 1,
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "traceparent": "00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01" }
```
Depth-2 child's own report: **"targetSessionKey was accepted at depth-2 without rejection ...
silent return routed to the root Discord channel session (not back up the dispatching chain)."**

## Depth-3 grandchild EXECUTION + inter-session routing PROVEN (byte-verified transcript)
Source: `/home/figs/.openclaw/agents/main/sessions/503737ab-abb7-448e-b836-9acd5f367325.jsonl`

Task banner (runtime-injected) — `(depth 3/5)`:
```
[Fri 2026-06-05 16:52 PDT] [Subagent Context] You are running as a subagent (depth 3/5).
[continuation:chain-hop:1] Delegated task (turn 1/200): [TEST-2/hop-B depth-3 INTER-SESSION return]
  This return is targeted at the root session via targetSessionKey.
  Echo "INTER-SESSION DEPTH-3 RETURN ROUTED". Report: INTERSESSION-OK — routed to root via targetSessionKey.
```

Grandchild assistant response (the inter-session return payload):
```
INTER-SESSION DEPTH-3 RETURN ROUTED
INTERSESSION-OK — routed to root via targetSessionKey.
```

## Traceparent continuity
- trace-id:   `8be976c2dc2df9bea5429de554202e5a`  (identical at root-runner + depth-2 sess 824b7268)
- parent-span:`624a617188e0a3db`
- W3C traceparent: `00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01`
The inter-session-targeted depth-3 dispatch carried the same trace-id as the up-tree chain, confirming
trace continuity is independent of the return-routing mode (targetSessionKey vs default up-tree).

## Causal ordering
- depth-2 (824b7268) start: 2026-06-05T23:52:12.482Z
- depth-2 last event:       2026-06-05T23:52:57.106Z  (fired the inter-session depth-3 child near end of its turn)
- depth-3 GC (503737ab) start: 2026-06-05T23:52:58.229Z  (AFTER depth-2 dispatched it)
- depth-3 GC last event:       2026-06-05T23:53:00.945Z
Inter-session grandchild spawns AFTER its depth-2 parent's dispatch → downward chain propagation confirmed.

## ⚠️ HONEST SCOPE OF PROOF — inter-session RETURN-ROUTING is a SCRIPTED ECHO, not independently confirmed
Integrity caveat (SAME class as rune's R-CD-4 retraction b379d79 re #580, and explicitly re-flagged by
the cohort in the root session's own reasoning during this very run):

> "The 'return receipt' was a scripted echo. The delegate returned [token] because I told it to return
> that string in its task. That's the delegate parroting my own words — not routing evidence. No
> recipient-owned flow_run anywhere."

Applying that lens to THIS test:
- The string `INTERSESSION-OK — routed to root via targetSessionKey` was written BY ME into the depth-3
  grandchild's task instructions. The grandchild emitting it proves it EXECUTED, not that any return
  ROUTED anywhere.
- The root Discord session (5996f634) does contain `INTERSESSION-OK`, but **0 occurrences are in
  user-role / inbound-injection messages** — every occurrence is the root session's own assistant
  reasoning (it already knew the token from dispatch context / corpus reads). No inbound silent-return
  injection carrying the payload was captured. So this is NOT recipient-owned delivery evidence.
- What IS cleanly proven: `targetSessionKey` was ACCEPTED at depth without rejection (tool-surface
  accept), the grandchild spawned and ran at depth-3, dispatch metadata + trace-id continuity captured.
- What is NOT proven: that the silent-return payload actually LANDED in the root session via the
  inter-session routing path (vs tool-surface-accept + scripted-echo). Same can't-distinguish-working-
  routing-from-fall-through limit rune documented for #580.

## Chain-tracking metadata observed
- targetSessionKey accepted at depth-2/depth-3 (no depth-limit or cross-session rejection)
- nested chain hop-counter reset (depth-3 grandchild `chain-hop:1 turn 1/200`)
- depth banner 2/5 → 3/5; depth-bound enforced (max 5)

## TEST-2 VERDICT: ⚠️ PARTIAL PASS (depth-3 chaining + targetSessionKey-accept PROVEN; return-ROUTING is scripted-echo, UNCONFIRMED)
**Proven (byte-verified):** a delegate at subagent-root depth fired a depth-2 child (sess 824b7268),
which fired a depth-3 grandchild (sess 503737ab, banner `depth 3/5`) with explicit
`targetSessionKey`; targetSessionKey was ACCEPTED without rejection at depth; grandchild EXECUTED;
trace-id `8be976c2…` continuous dispatch→depth-2; depth-bound increments 2/5→3/5, enforced (max 5).
**NOT proven this run (HONEST-LIMIT, same #580 class):** that the inter-session return PAYLOAD actually
routed/landed in the root session. The `INTERSESSION-OK` string was scripted into the grandchild's
task (parroted-back, not routing evidence), and the root session shows 0 inbound user-role injections
carrying it — only self-reasoning. Cannot distinguish working targetSessionKey-routing from
tool-surface-accept + scripted-echo. A clean proof needs a recipient-owned signal (a flow_run / side
effect in the target session that ONLY the delivered return could have produced), which was not set up here.
Dual-coverage corroborates Ronan's canary depth-2 for the DISPATCH/ACCEPT/EXECUTION half and extends
it to depth-3; the recipient-owned-routing half is honestly held, not asserted.
