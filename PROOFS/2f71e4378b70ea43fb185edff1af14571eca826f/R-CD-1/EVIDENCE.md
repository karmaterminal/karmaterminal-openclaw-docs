# R-CD-1 — undertow-seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T02:34:31Z → 02:34:36Z UTC (19:34 PDT). Binary: `OpenClaw 2026.6.2 (2f71e43)` post-cure deploy via Cael's path-2 ARM64-built dist rsync (canary `1511883733`) + Cael fleet-deploy Run 26922392540 to ronan-DGX seat. Cohort cure-cycle landed: PR #898 + #913 + #914 + #915 all merged into assembly head `2f71e4378b7`.

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span under `openclaw.continuation` scope (parent traceparent captured + emitted to Tempo)
- subagent spawns into `openclaw.harness.run` under SAME service.name (`ronan-prince`) + same gateway-pid (`2759680`)
- subagent runs to completion (`openclaw.outcome: completed`)
- literal-string payload returns to parent channel via Discord message-send (msg ID `1511921170960748574`)

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(mode="normal", task="[PROOF R-CD-1 / 2f71e4378b7]...")` returned its scheduling-acknowledgment:
```
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-d315b75ba353926272740a042e933dff-3ff44de941668d04-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

Parent traceparent: trace `d315b75ba353926272740a042e933dff`, span `3ff44de941668d04`.

### Spawn evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway` window 19:34:31 PDT:
- `19:34:31.241 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011`
- `19:34:31.481 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=6/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-1 / 2f71e4378b70ea43fb185edff1af14571eca826f] You are a delegate dis…`
- `19:34:31.980 [agents/tool-policy] tool policy removed 5 tool(s) via subagent tools.deny: agents_list, cron, gateway, session_status, sessions_send`
- `19:34:36.018 R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 2f71e4378b70ea43fb185edff1af14571eca826f from undertow-seat 2026-06-04`
- `19:34:36.130 [subagent-chain-hop] Accumulated 91 tokens from agent:main:subagent:492142a2-8812-4b32-a600-035cc97885f5 to parent chain cost`

Subagent sessionKey: `agent:main:subagent:492142a2-8812-4b32-a600-035cc97885f5`, runtime 3s end-to-end (dispatch → return ~4.5s including TURN compositions).

### Subagent return (`delegate_return_payload.txt`)
```
R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 2f71e4378b70ea43fb185edff1af14571eca826f from undertow-seat 2026-06-04
```

Channel surface: Discord msg ID `1511921170960748574` on channel:1466192485440164011 (literal-substrate-only-substantively-aligned with PROOF-CORPUS-METHOD literal-receipt-shape).

### Tempo trace captured (`wake_event_trace.json`)
Tempo `/api/traces/d315b75ba353926272740a042e933dff` returned **substantive trace at byte** — 31123 bytes JSON, contains:
- `openclaw.message.processed` (root parent span_id `P/RN6UFmjQQ=`)
- `openclaw.harness.run` (parent span_id `QJcg1gg9ggE=` linked to message-processed)
- `openclaw.run` (parent span_id `6SZTQ0j3FVM=` linked to harness)
- `openclaw.tool.execution` for `continue_delegate` (span_id `IfQ7jsVICGo=` under parent run)
- **`continuation.delegate.dispatch`** (span_id `rE2BaM/Wk5k=`, scope `openclaw.continuation`, parent `P/RN6UFmjQQ=`) — substrate-load-bearing-evidence-of-PR-#913-OTEL-continuation-tracer-adapter-LIVE-on-real-binary
- Subagent `openclaw.harness.run` (span_id `g70XMXXH3dM=`, parent `rE2BaM/Wk5k=` — stitched to delegate-dispatch correctly)

**Tempo HONEST-LIMIT from prior cycle 4896c3129b ROLLED-BACK at byte for `2f71e4378b7`**: cure-cycle landed both the continuation-tracer-adapter (#904 / PR #913) wiring it into service.ts::start() + resolver-wiring callbacks consulting active trusted-spans registry. Empirically `continuation.delegate.dispatch` spans now-emit to Tempo + return on `/api/traces/<id>` fetch.

## Scope-bound at byte

Proves `continue_delegate(mode="normal")` lane only: dispatch fired, subagent spawned + completed in ~3s, literal-string returned via Discord channel-message-send. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4), or depth-2 chaining (R-CD-CHAINED-DEPTH-2).

Same parent-session-key (`agent:main:discord:channel:1466192485440164011`), same service.name (`ronan-prince`), same gateway-pid (`2759680`) — single-process trace-stitching coherent.

## Cohort substrate-verdict
✅ **PASS** — `continue_delegate(mode="normal")` schedule → spawn → return path verified end-to-end on post-cure binary (`2f71e43`), with full Tempo trace including `openclaw.continuation`-scoped `continuation.delegate.dispatch` span (substrate-load-bearing for #904 / PR #913 OTEL continuation-tracer-adapter empirical-cure-verification on this CANDIDATE_SHA).

## Trace-of-record
- Tempo URL: http://tempo.dandelion.cult/api/traces/d315b75ba353926272740a042e933dff
- Tempo trace JSON: `wake_event_trace.json` (31123 bytes)
- Discord channel-receipt: msg ID `1511921170960748574`
