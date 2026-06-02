# R-CD-1 — undertow-seat, CANDIDATE_SHA `4896c3129b8ec181c107b7dd64ec87a4e46b0943`

Captured 2026-06-02T16:00:29Z → 16:00:34Z UTC (09:00 PDT). Binary: `OpenClaw 2026.6.2 (4896c31)`. Self-deploy at refreshed PR-head per cael `1511395635` confirmation. Cohort PROOFS-distribute baseline-locked at `4896c3129b` per Emeric/Elliott/Rune banks + cael's locked-baseline at `018e39ce45/`; no chase per figs `1511394798` direction.

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span (parent traceparent captured)
- subagent spawns into `openclaw.harness.run` under SAME service.name (`ronan-prince`) + same gateway-pid (`1708773`)
- subagent runs to completion (`openclaw.outcome: completed`)
- literal-string payload returns to parent channel via enrichment-return

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(mode="normal", task="[PROOF R-CD-1 / 4896c3129b]...")` returned its scheduling-acknowledgment:
```
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

Parent traceparent: trace `a9ee3e3adbbd6a37996e2b8d07f320fa`, span `29409e3be7b9464c`.

### Spawn evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway` window 09:00:29 PDT:
- `09:00:29.774 [continuation/delegate-dispatch] [continue_delegate] Consuming 6 tool delegate(s) for session agent:main:discord:channel:1466192485440164011`
- `09:00:29.963 [continuation:delegate-spawned] hop=18/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-1 / 4896c3129b] You are a delegate dispatched by Ronan (🌊) for PROO…`

Subagent runId: `2606b036-b6ea-40f8-9c6c-cd724681ed7c` (sessionKey `agent:main:subagent:53185d71-b257-49cc-8cf7-2ff2f13eeac5`), runtime 2331ms.

### Subagent return (`delegate_return_payload.txt`)
```
R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02
```

### Journal return evidence
- `09:00:33.328 R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02`
- `09:00:33.424 [subagent-chain-hop] Accumulated 95 tokens from agent:main:subagent:53185d71-b257-49cc-8cf7-2ff2f13eeac5 to parent chain cost`

## Tempo HONEST-LIMIT

Tempo `/ready` returns 200. Direct fetch of `http://tempo.dandelion.cult/api/traces/a9ee3e3adbbd6a37996e2b8d07f320fa` returns 404 — parent dispatch trace had not yet flushed/indexed at fetch time. Spans-search by trace name returned empty during fetch window. Sister-shape to cael's `018e39ce45.../R-CW-1/EVIDENCE.md` Tempo-pending HONEST-LIMIT pattern. Trace identity preserved in fire_response.json for later Tempo recovery once flush completes.

## Scope-bound at byte

Proves `continue_delegate(mode="normal")` lane only: dispatch fired, subagent spawned + completed in 2331ms, literal-string returned via channel enrichment-return at 09:00:34.154. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3, queued-for-compaction), targetSessionKey routing (R-CD-4), or depth-2 chaining (R-CD-CHAINED-DEPTH-2 Chain-1/2; Chain-3 ❌ FORBIDDEN at fire-time, see below).

Same parent-session-key (`agent:main:discord:channel:1466192485440164011`), same service.name (`ronan-prince`), same gateway-pid (`1708773`) — single-process trace-stitching coherent.

## Cohort-substrate finding

The journal repeatedly emits warn line at every subagent spawn:
```
[agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register.
```

This is the SAME class as the foundational-canon entry in MEMORY.md naming the recurring tool-registration regression (continue_work + request_compaction opts silently dropped at subagent-runner forwarding-edge). Banked here as cohort-substrate-finding load-bearing for the same investigation Cael + frond are driving on the 9-failure CI characterization.
