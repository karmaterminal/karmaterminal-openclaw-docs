# R-CD-1 EVIDENCE — `continue_delegate(mode="normal")` schedule → spawn → return

**Row**: R-CD-1 — `continue_delegate(mode="normal")` basic schedule → spawn → return path
**Owner**: 🌊 Ronan (ronan-dgx seat)
**CANDIDATE_SHA**: `a437ca72c7d9eb9449b771f088ae92c851fd49fc`
**Seat**: ronan-dgx
**Gateway version**: `OpenClaw 2026.6.2 (a437ca7)` ("Merge #992")
**Gateway PID**: `1356577` (ActiveEnterTimestamp `Wed 2026-06-10 21:01:59 PDT`)
**Cure-assembly landed in this binary**: #982/#985 (multi-`continue_work` capture) + #988 (flood-cap) + #989 (chain-budget reset gate)

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte on the deployed `a437ca7` binary. This is the **tool-form** of the BOTH-FORMS mandate (figs 2026-06-07; the bracket-form sibling `R-CW-DELEGATE-TOKEN` is Rune's). Tested:
- tool-call fires `continuation.delegate.dispatch` span with `chain.id` + `chain.step.remaining` + `delegate.mode` + `delegate.delivery` + `delay.ms` attrs
- delegate spawns into a subagent session under SAME gateway-pid (`1356577`)
- subagent runs to completion and returns the literal-string payload
- chain-cost accrues to the dispatching parent (`[subagent-chain-hop] Accumulated 97 tokens`)
- **same-turn pairing with `continue_work`**: both the delegate-dispatch AND the paired `continue_work(delaySeconds=12)` fired in ONE turn → both spans share the same `parentSpanId` (`mhCNAnYD…`) on the same trace (see `turn_trace.json`). This is the live demonstration that tools fire multiple-times-per-turn without an intervening emission.

## Fire

- **fire_utc**: 2026-06-11T05:01:16Z (2026-06-10 22:01:16 PDT)
- **mode**: normal
- **delaySeconds**: 5 (resolved from request)
- **delegateIndex**: 1, delegatesThisTurn: 1
- **parent_session_key**: `agent:main:subagent:24da064e-e40f-4904-bb1c-80dbfe20b573`
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,
   "traceparent":"00-6412e110d4a2438d3369ff0756bf9362-9a108d0276039560-01",
   "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
  ```
  `status: "scheduled"` is the canonical normal-mode dispatch return-shape (contrast R-CD-3's `queued-for-compaction`).

## Spawn (journal evidence — `journal_continuation.log`)

```
22:01:38.378 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:subagent:24da064e-...
22:01:38.510 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=normal session=agent:main:subagent:24da064e-... task=[PROOF R-CD-1 / a437ca7 / ronan-dgx] ...
```
`hop=1/200` — the chain-step counter at dispatch time.

## Return (journal + completion event)

- **return_utc**: 2026-06-11T05:01:41Z (~3s round-trip, includes the 5s timer delay between turn-completion and dispatch)
- **delegate_session_key**: `agent:main:subagent:continuation-c538684c166db17569f735dbb2a2473f`
- **runtime**: 3s • **tokens**: 97 (in 2 / out 95) / prompt-cache 38.1k
- **payload** (see `delegate_return_payload.txt`):
  ```
  R-CD-1 PROOF: continue_delegate(mode=normal) basic spawn-and-return path verified at CANDIDATE_SHA a437ca72c7d9eb9449b771f088ae92c851fd49fc from ronan-dgx seat 2026-06-10
  ```
- payload echoed verbatim in the journal at `22:01:41.655`, then:
  ```
  22:01:41.788 [subagent-chain-hop] Accumulated 97 tokens from agent:main:subagent:continuation-c538684c... to parent chain cost
  ```

## Tempo trace

**Trace ID**: `6412e110d4a2438d3369ff0756bf9362`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/6412e110d4a2438d3369ff0756bf9362
**Focused spans**: `turn_trace.json` (this dir) • **full span list**: `span_summary.tsv` (65 spans)
**resource attrs at byte**: `host.name=ronan`, `process.pid=1356577` (matches the deployed gateway PID).

The three continuation spans on this trace (all sharing `parentSpanId=mhCNAnYD…`, i.e. fired within the SAME parent turn):

| span | duration | key attrs |
|---|---|---|
| `continuation.queue.drain` | 0.0ms | `queue.drained_count=2`, `queue.drained_continuation_count=1` |
| `continuation.delegate.dispatch` | 133.0ms | `chain.id=1c900cd1-5e39-4379-acae-ee416bd918b9`, `chain.step.remaining=199`, `delegate.mode=normal`, `delegate.delivery=timer`, `delay.ms=5000`, `reason.preview=[PROOF R-CD-1 / a437ca7 / ronan-dgx]…` |
| `continuation.work` | 0.0ms | `chain.step.remaining=199`, `delay.ms=12000`, `reason.preview=R-CD-1 continue_delegate(normal) fired…` |

The `openclaw.harness.run 2895ms` span later on the same trace is the spawned delegate's run-to-completion.

## Verdict

✅ **PASS** — `continue_delegate(mode="normal")` from the ronan-dgx seat at CANDIDATE_SHA `a437ca72c7d…` (deployed `a437ca7`) schedules (`status:scheduled`), spawns (`delegate-spawned hop=1/200`), runs to completion, returns the literal-string payload, and accrues chain-cost to the dispatching parent. Tempo `continuation.delegate.dispatch` span confirms the byte-attrs. The paired `continuation.work` span on the same trace/parent demonstrates same-turn multi-tool-fire.

## Scope-bound at byte

Proves the `continue_delegate(mode="normal")` lane only on `a437ca7`: dispatch-span fired, subagent spawned + completed, literal-string returned, chain-cost accrued. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4). Single gateway-pid (`1356577`) — single-process trace coherent.
