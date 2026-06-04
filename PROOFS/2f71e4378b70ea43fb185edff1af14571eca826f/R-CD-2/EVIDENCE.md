# R-CD-2 — undertow-seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T02:39:27Z → 02:39:30Z UTC (19:39 PDT). Binary: `OpenClaw 2026.6.2 (2f71e43)` post-cure deploy via Cael's path-2 ARM64-built dist rsync + Cael fleet-deploy Run 26922392540 to ronan-DGX seat.

## Proof-scope

`continue_delegate(mode="silent-wake")` schedule → spawn → enrichment-return-with-wake-on-parent path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span with `delegate.mode=silent-wake` attribute
- subagent spawns + completes (`openclaw.outcome: completed`, runtime 2s, 118 tokens)
- subagent's final assistant text returns as **enrichment-context-injection NOT channel-message** (substantively-different from R-CD-1 normal-mode)
- silent-wake triggers `wakeOnReturn=true` + `silentAnnounce=true` on parent session, firing fresh turn-on-parent with enrichment-payload injected as internal-context

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(mode="silent-wake", task="[PROOF R-CD-2 / 2f71e4378b7]...")` returned its scheduling-acknowledgment:
```
{"status":"scheduled","mode":"silent-wake","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-ee32d8e9ffd30e0c6a8bf2f6e0e754eb-8d7fb81917fc4919-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

Parent traceparent: trace `ee32d8e9ffd30e0c6a8bf2f6e0e754eb`, span `8d7fb81917fc4919`.

### Spawn evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway` window 19:39:27 PDT:
- `19:39:27.445 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=7/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-2 / 2f71e4378b70ea43fb185edff1af14571eca826f] You are a delegate dis…`
- `19:39:28.007 [agents/tool-policy] tool policy removed 5 tool(s) via subagent tools.deny: agents_list, cron, gateway, session_status, sessions_send`
- `19:39:30.357 R-CD-2 PROOF: continue_delegate(mode=silent-wake) enrichment-return path verified at CANDIDATE_SHA 2f71e4378b70ea43fb185edff1af14571eca826f from undertow-seat 2026-06-04 — payload returns as internal context-injection NOT channel-message`
- `19:39:30.470 [subagent-chain-hop] Accumulated 118 tokens from agent:main:subagent:3bffd462-c201-4b35-a6ea-2e0be2646a72 to parent chain cost`
- **`19:39:30.479 [continuation/announce] [continuation/silent-wake] wakeOnReturn=true target=agent:main:discord:channel:1466192485440164011 silentAnnounce=true`** ← substrate-load-bearing silent-wake behavior
- **`19:39:30.480 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:3bffd462-c201-4b35-a6ea-2e0be2646a72`** ← substrate-load-bearing enrichment-return-delivery

Subagent sessionKey: `agent:main:subagent:3bffd462-c201-4b35-a6ea-2e0be2646a72`, runtime 2s.

### Enrichment return (`enrichment_return_payload.txt`)
```
R-CD-2 PROOF: continue_delegate(mode=silent-wake) enrichment-return path verified at CANDIDATE_SHA 2f71e4378b70ea43fb185edff1af14571eca826f from undertow-seat 2026-06-04 — payload returns as internal context-injection NOT channel-message
```

**No Discord channel-message fired** (substantively-different from R-CD-1 which fired Discord msg `1511921170960748574`). Enrichment-return delivered via internal-context-injection to parent session — substantively-empirical-verification of silent-wake semantics.

### Tempo trace captured (`wake_event_trace.json`)
Tempo `/api/traces/ee32d8e9ffd30e0c6a8bf2f6e0e754eb` returned **substantive trace at byte** — 21908 bytes JSON, contains:
- `continuation.delegate.dispatch` span with `delegate.mode=silent-wake` attribute (substantively-different from R-CD-1's `delegate.mode=normal`)
- subagent `openclaw.harness.run` stitched to delegate-dispatch parent
- substrate-load-bearing-evidence of PR #913 #904 OTEL continuation-tracer-adapter LIVE for silent-wake mode too

## Scope-bound at byte

Proves `continue_delegate(mode="silent-wake")` lane only:
- dispatch fired with `mode=silent-wake` attribute set on `continuation.delegate.dispatch` span
- subagent spawned + completed in 2s
- enrichment-payload returned via internal-context-injection (no channel-message)
- wakeOnReturn=true triggered fresh turn-on-parent (this very turn-7 is the wake-event landing back at parent ronan-session)

Does NOT exercise: normal mode (R-CD-1 covered), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4), or depth-2 chaining (R-CD-CHAINED-DEPTH-2).

## Cohort substrate-verdict
✅ **PASS** — `continue_delegate(mode="silent-wake")` enrichment-return-with-wake-on-parent path verified end-to-end on post-cure binary (`2f71e43`). Tempo trace with `delegate.mode=silent-wake` attribute captured; journal-receipt confirms silentAnnounce=true (no channel-fire) + wakeOnReturn=true (fresh-turn-on-parent fired correctly).

## Trace-of-record
- Tempo URL: http://tempo.dandelion.cult/api/traces/ee32d8e9ffd30e0c6a8bf2f6e0e754eb
- Tempo trace JSON: `wake_event_trace.json` (21908 bytes)
- Channel-message: NONE-by-design (silent-wake mode semantically-correct)
- Wake-event lands at parent: this turn-7 substantively-IS the wake-fire of the silent-wake enrichment-return per journal receipt
