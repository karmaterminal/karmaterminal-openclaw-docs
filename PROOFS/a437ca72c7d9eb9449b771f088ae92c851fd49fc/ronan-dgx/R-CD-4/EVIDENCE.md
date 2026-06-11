# R-CD-4 EVIDENCE — `continue_delegate(targetSessionKey)` cross-session targeted return

**Row**: R-CD-4 — cross-session targeted return via `targetSessionKey`
**Owner**: 🌊 Ronan (ronan-dgx seat)
**CANDIDATE_SHA**: `a437ca72c7d9eb9449b771f088ae92c851fd49fc`
**Seat**: ronan-dgx
**Gateway version**: `OpenClaw 2026.6.2 (a437ca7)` ("Merge #992")
**Gateway PID**: `1356577` (ActiveEnterTimestamp `Wed 2026-06-10 21:01:59 PDT`)
**Cure-assembly landed in this binary**: #982/#985 (multi-`continue_work` capture) + #988 (flood-cap) + #989 (chain-budget reset gate)

## Proof-scope

`continue_delegate(targetSessionKey=…)` cross-session return-routing at byte on the deployed `a437ca7` binary. This is the **tool-form** of the BOTH-FORMS mandate (figs 2026-06-07). The proof: a delegate **dispatched from one session** (the discord-channel session) **routes its return to a DIFFERENT session** (`agent:main:main`) via `targetSessionKey` — the return does NOT go back to the dispatching channel-session as a channel-announce; it arrives at the target as a targeted-return. Chain-cost still accrues to the **dispatching** parent (return-routing ≠ cost-routing).

## Fire

- **fire_utc**: 2026-06-11T05:15:xxZ (2026-06-10 22:15 PDT) — see `fire_response.json`
- **mode**: normal
- **delaySeconds**: 0 (→ `delegate.delivery=immediate`)
- **delegateIndex**: 2, delegatesThisTurn: 2
- **dispatching_session**: `agent:main:discord:channel:1466192485440164011`
- **targetSessionKey**: `agent:main:main`
- **fire_response**:
  ```json
  {"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":2,"delegatesThisTurn":2,
   "targetSessionKey":"agent:main:main",
   "traceparent":"00-18e68520ec98e0703918939a30cd7dca-44b00bb0cc297c68-01"}
  ```
  The `targetSessionKey: "agent:main:main"` field is captured in the dispatch return-shape — distinct from R-CD-1/R-CD-2/R-CD-3 (no targetSessionKey → default return to dispatcher).

## Spawn + Return + Cross-session delivery (journal byte-trail — `journal_dispatch.log`)

```
22:15:39.289 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=2/200 mode=normal
             session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-4 ... Cross-session targeted-return]
22:15:42.617 R-CD-4 PROOF: continue_delegate cross-session targetSessionKey-routing verified at CANDIDATE_SHA
             a437ca72c7d... from ronan-dgx main session 2026-06-10; return targeted to agent:main:main   ← payload echoed
22:15:42.752 [subagent-chain-hop] Accumulated 106 tokens from agent:main:subagent:continuation-c64945d1... to parent chain cost
22:15:42.754 [continuation:targeted-return] Delivered to agent:main:main from agent:main:subagent:continuation-c64945d1...
```

**The two dispositive lines** (22:15:42):
- `[continuation:targeted-return] Delivered to agent:main:main` — the return routed to the **target** session (`agent:main:main`), NOT the dispatching channel-session. The `[continuation:targeted-return]` journal signature is distinct from R-CD-1's normal-announce + R-CD-2's `[continuation:enrichment-return]`. This is the cross-session-routing proof.
- `[subagent-chain-hop] Accumulated 106 tokens … to parent chain cost` — chain-cost accrued to the **dispatching** parent (the channel-session), proving cost-routing is independent of return-routing.

Spawn at `hop=2/200` (the chain-step counter; this was the 2nd delegate dispatched this turn-chain). Round-trip: fire 22:15:39 → return/deliver 22:15:42 (~3s).

## Tempo trace

**Trace ID**: `18e68520ec98e0703918939a30cd7dca`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/18e68520ec98e0703918939a30cd7dca
**Raw**: `turn_trace_raw.json` (this dir) • **span list**: `span_summary.tsv` (45 spans)
**resource attrs at byte**: `host.name=ronan`, `process.pid=1356577` (matches the deployed gateway PID).

The dispatch span:

| span | duration | key attrs |
|---|---|---|
| `continuation.delegate.dispatch` | 68.9ms | `chain.id=e271a24a-2926-4056-a865-431e73ccee77`, `chain.step.remaining=198`, `delegate.mode=normal`, `delegate.delivery=immediate`, `delay.ms=0`, `reason.preview=[PROOF R-CD-4 … Cross-session targeted-return]…` |

(`chain.step.remaining=198` — one step below R-CD-1's 199, since the R-CD-3 staging-fire consumed a step in the same turn-chain; the chain-id differs per dispatch.)

## Verdict

✅ **PASS** — `continue_delegate(targetSessionKey="agent:main:main")` from the ronan-dgx main (channel) session at CANDIDATE_SHA `a437ca72c7d…` (deployed `a437ca7`) schedules, spawns (`hop=2/200`), and routes the return to the named cross-session target (`[continuation:targeted-return] Delivered to agent:main:main`) — NOT to the dispatching channel-session — while chain-cost accrues to the dispatching parent (`106 tokens to parent chain cost`). Tempo `continuation.delegate.dispatch` span confirms the byte-attrs. Behavior matches the prior-cycle baseline (`1de29746…/R-CD-4`).

## Scope-bound at byte

Proves the `continue_delegate(targetSessionKey)` cross-session return-routing only on `a437ca7`: targetSessionKey captured in fire_response, return delivered to `agent:main:main` via `[continuation:targeted-return]` (not the dispatcher), chain-cost to dispatching parent. Does NOT exercise: normal default-return (R-CD-1), silent-wake (R-CD-2), post-compaction (R-CD-3). Single gateway-pid (`1356577`) — single-process trace coherent. Tool-form only (bracket-form sibling = Rune's R-CW-DELEGATE-TOKEN).
