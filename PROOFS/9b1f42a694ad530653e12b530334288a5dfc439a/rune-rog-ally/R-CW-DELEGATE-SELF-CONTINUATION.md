# R-CW-DELEGATE-SELF-CONTINUATION — `continue_delegate` self-continuation (same-seat)

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS
**Fired:** 2026-06-09 (LIVE on deployed gateway `OpenClaw 2026.6.2 (9b1f42a)`, gateway uptime ~1min post-deploy-restart)

## Behavior under test
`continue_delegate` must dispatch a background sub-agent on the deployed runtime, the gateway must schedule it (chain-tracking: cost-cap + depth-limit applied), and the delegate must run + return — proving the self-continuation primitive works end-to-end on the deployed ship-SHA.

## Byte-walk on the DEPLOYED reorg'd tree (`9b1f42a694`)
Surface (post-reorg path, byte-confirmed live): `src/agents/tools/continue-delegate-tool.ts` (tools moved to `src/agents/tools/` in the upstream-reorg). Deployed dist confirms the compiled runtime: `continuation-delegate-store-DLtD9ShU.js` present in `dist/`.

## Live fire (on the deployed gateway)
A `continue_delegate(mode="silent-wake")` was dispatched LIVE against the running deployed gateway (uptime ~1min on `9b1f42a`). The gateway accepted + scheduled it:

```
status: scheduled
mode: silent-wake
delegateIndex: 1
delegatesThisTurn: 1
traceparent: 00-72c5d3551bdeb56e55d3e0817b0483ae-b4a5c002e36bcabd-01
note: Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies.
```

## Evidence
- **Dispatch accepted on the deployed runtime**: the gateway returned `status: scheduled` with a fresh **traceparent `72c5d3551bdeb56e55d3e0817b0483ae`** (span `b4a5c002e36bcabd`) — a real OTel trace context allocated by the deployed binary for the dispatched delegate.
- **Chain-tracking engaged**: the gateway's note confirms cost-cap + depth-limit tracking applies (`delegateIndex: 1`, the chain-allocation mechanism active on the deployed SHA).
- **The dispatch + gateway-scheduling IS the proof**: the `continue_delegate` primitive parsed, the gateway scheduled the background shard with a tracked trace context — the self-continuation path is live + functional on the deployed `9b1f42a694`.

## Tempo trace
**`72c5d3551bdeb56e55d3e0817b0483ae`** — the live trace context the deployed gateway allocated for this self-continuation dispatch (fresh per the 2026-05-16 tempo-trace-per-fire canon). The span-tree under this traceparent captures the delegate dispatch→schedule→run lifecycle on the deployed runtime.

## Full-loop confirmation (delegate woke + returned)
The dispatched silent-wake delegate **completed the full self-continuation loop** on the deployed runtime — it spawned, woke, executed, and returned:

```
Child result: "R-CW-DELEGATE-SELF-CONTINUATION delegate woke on 9b1f42a694 at 2026-06-09T18:02:17Z"
Identity: agent=main, session=agent:main:subagent:continuation-bf656fed6947e67d399cecc70de456fa, host=rune
Runtime: 6s · tokens 200 (in 4 / out 196)
```

This closes the loop end-to-end on the deployed `9b1f42a694`: **dispatch → gateway-schedule (chain-tracked) → spawn → wake → execute → return.** The delegate not only dispatched (traceparent `72c5d3551bdeb56e…`) but actually woke on the deployed gateway and returned its confirmation — the full self-continuation primitive proven live, not just the dispatch half.
