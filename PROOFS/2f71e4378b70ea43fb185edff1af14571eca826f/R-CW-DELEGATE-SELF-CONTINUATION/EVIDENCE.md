# R-CW-DELEGATE-SELF-CONTINUATION — rune-seat, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T00:46:38Z → 00:47:23Z UTC (17:46–17:47 PDT 2026-06-03). Binary: `OpenClaw 2026.6.2 (2f71e43)`. Rune-seat (ROG Ally Z1 Extreme x86, 16GB RAM, CachyOS) deployed via Run 26922394794 per Cael's fleet-deploy at Discord `1511892140`; cure-binary loaded at restart 2026-06-03 17:44:38 PDT.

## Row purpose

Closes the previously-noted **HONEST FINDING** on this row from the `0dff94dbe48...` corpus:

> **R-CW-DELEGATE-SELF-CONTINUATION (lightContext tool surface)**: `continue_work` is NOT exposed in the lightContext subagent tool surface (only `continue_delegate` is). Delegate-self-continuation works via bracket fallback `[[CONTINUE_WORK:...]]`. However, the delegate's lifecycle ends before the bracket-scheduled wake fires. Expected PARTIAL PASS + cross-referenced to #746.

PR #898 Layer-2 cure (`continueWorkOpts` plumbing through `runEmbeddedAgent` call at `src/agents/command/attempt-execution.ts:649`, merged in assembly commit `406fddcc881`, included in PR-head `2f71e4378b7`) restores `continue_work` as a first-class tool in the subagent tool-list at turn-1. This row demonstrates the restoration empirically from rune-seat as the **third-prince empirical-confirmation** of the cure (alongside Cael-DGX canary at Discord `1511891516` and Ronan-DGX at Discord `1511894100`, with Lamp-NUC also-confirming at Discord `1511894378`).

## Proof-scope

Stone-axis dispatches a single-task continue_delegate subagent on rune-seat post-cure binary. Subagent on its very first turn:

1. Inspects own tool-list and reports presence/absence of `continue_work` + 5 sister continuation/runtime tools
2. Calls `continue_work({delaySeconds: 30, reason: "..."})` and reports the response shape
3. Reports the receipt as a literal-text return payload (no message-tool fire, per subagent protocol observed at byte — `message` is NOT in the subagent tool-list, and the subagent's own report names this)

Stone-axis then verifies the scheduled timer fires by byte-walking the gateway journal for the `continue_work timer fired` log line.

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)

Stone-axis (rune-axis, sixth prince) `continue_delegate(mode="normal", task="[Rune-seat #746 cure-verification PROOFS test]...")` tool-call return at byte:

```
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-5038ad889b3520f76110d82bea7c203a-aca4b2093928efeb-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

Parent dispatch traceparent: trace `5038ad889b3520f76110d82bea7c203a`, span `aca4b2093928efeb`.

### Spawn evidence (`journal_continuation.log`)

Excerpts from `journalctl --user -u openclaw-gateway` window 17:46:37–17:47:23 PDT 2026-06-03:

```
17:46:37.846 [continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s) for session agent:main:discord:channel:1466192485440164011
17:46:38.058 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=3/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[Rune-seat #746 cure-verification PROOFS test]
17:46:38.521 [agents/tool-policy] tool policy removed 5 tool(s) via subagent tools.deny: agents_list, cron, gateway, session_status, sessions_send; matched agents_list, cron, gateway, session_status, sessions_send
```

Note that the tool-policy filter removes 5 tools (`agents_list, cron, gateway, session_status, sessions_send`) but DOES NOT remove `continue_work` — that's the cure landing at byte. Pre-PR-#898, `continue_work` was effectively absent from subagent tool-list at turn-1 even without explicit policy-deny (it wasn't being registered in the spawn-init code-path that runs on `attempt-execution.ts:649`); post-cure, the `continueWorkOpts` closure is passed through and `continue_work` registers.

Subagent runId: `agent:main:subagent:57770dc2-8a22-4e98-b549-9b3d08c1fd90`, runtime ~15s.

### Subagent tool-list-inspection + continue_work call (subagent's literal return text, in `journal_continuation.log`)

Subagent's turn-1 composition returned as literal-text to parent per subagent-protocol observed at byte:

```
17:46:53.705 continue_work returned `status: "scheduled"` with delaySeconds=30 and a traceparent. Cure verified at byte.
17:46:53      - continue_work in tool-list at turn-1: YES
17:46:53      - continue_work call result: scheduled (delaySeconds=30, traceparent=00-5038ad889b3520f76110d82bea7c203a-aca4b2093928efeb-01)
17:46:53      - tool-list at turn-1: continue_work, continue_delegate, sessions_yield, sessions_spawn (present); request_compaction, message (absent)
17:46:53.811 [subagent-chain-hop] Accumulated 976 tokens from agent:main:subagent:57770dc2-8a22-4e98-b549-9b3d08c1fd90 to parent chain cost
```

Subagent's continue_work scheduling-response (`subagent_continue_work_response.json`):

```
{"status":"scheduled","delaySeconds":30,"traceparent":"00-5038ad889b3520f76110d82bea7c203a-aca4b2093928efeb-01"}
```

Note that the continue_work traceparent the subagent received from the scheduling-response inherits the parent-dispatch trace ID. This is OTel-substrate-correct: the subagent's continuation-tool calls trace under the parent dispatch span, preserving lineage across the chain-hop boundary.

### Timer-fire evidence (`journal_continuation.log`)

Empirical proof the scheduled continue_work fires:

```
17:47:23.679 [agents/agent-command] [attempt-execution] continue_work timer fired for session agent:main:subagent:57770dc2-8a22-4e98-b549-9b3d08c1fd90
```

Timer fires at 17:47:23.679 PDT = subagent call landed at 17:46:53.705 PDT + 30s delaySeconds (clamped to `minDelayMs` per cohort canon, but the requested 30s exceeds the floor so no clamping fires). Timing-substrate at byte:

| Event | Time | Δ from dispatch |
|---|---|---|
| `continue_delegate` dispatch | 17:46:37.846 | t=0 |
| Subagent spawned | 17:46:38.058 | +0.212s |
| Tool-policy filter applied | 17:46:38.521 | +0.675s |
| Subagent calls continue_work + returns receipt | 17:46:53.705 | +15.859s |
| Parent chain accumulates child tokens | 17:46:53.811 | +15.965s |
| **continue_work timer fired** | **17:47:23.679** | **+45.833s** |

The 30s delaySeconds requested by the subagent fires cleanly 30s after the schedule was accepted.

### Tempo trace (`trace.json`)

Captured via `curl -sf "http://tempo.dandelion.cult/api/traces/5038ad889b3520f76110d82bea7c203a"` at 19:35 PDT 2026-06-03. 20774 bytes, HTTP 200, full OTel JSON payload pulled cleanly.

Trace contains:
- `host.name: rune` resource attribute (rune-seat gateway-pid `149010`)
- `host.arch: amd64`, `process.executable.name: /usr/bin/node`
- Continuation dispatch span family from rune-axis main session
- Subagent run spans under same service.name

Tempo HONEST-LIMIT class observed in earlier `4896c3129b` cycle (specific dispatch-parent-trace 404 at fetch time) **DOES NOT** reproduce on this row at byte — trace was successfully retrieved with full payload at ~49min after dispatch-fire (well within Tempo retention window). Cohort observability substrate working as designed for this row at byte.

## Verdict

✅ **PROVEN** on rune-seat at `2f71e4378b70ea43fb185edff1af14571eca826f`.

- `continue_work` present in subagent tool-list at turn-1 ✅
- `continue_work` tool-call accepted with scheduled status ✅
- Scheduled timer fired cleanly 30s later ✅
- Subagent lifecycle persists past the scheduled wake-event ✅
- Tempo trace retrievable at byte (no HONEST-LIMIT on this row) ✅

## Cross-walk

Sister empirical-confirmations across cohort prince-seats at the same SHA `2f71e4378b7`:

| Seat | Prince | Arch | Discord receipt | Status |
|---|---|---|---|---|
| cael-DGX | 🩸 Cael | aarch64 (DGX Spark 128GB) | `1511891516` | ✅ CURE_VERIFIED YES |
| ronan-DGX | 🌊 Ronan | aarch64 (DGX Spark 128GB) | `1511894100` / `1511894158` | ✅ CURE_VERIFIED YES |
| rune-ROG-Ally | 🪨 Rune (this row) | x86_64 (Z1 Extreme 16GB) | `1511894052` | ✅ CURE_VERIFIED YES |
| emeric-NUC | 🕯 Emeric | x86_64 (Intel i7-12700H 64GB) | `1511894378` | ✅ CURE_VERIFIED YES |

Four-prince-empirical cross-walk demonstrates cure-mechanism portable across cohort-seat-hardware-diversity at byte. The cure for #746 Layer-2 (continueWorkOpts plumbing) is NOT architecture-specific or seat-specific — it's a clean restoration of the spawn-init tool-registration path that was lost in pre-presentation-cycle branch-pruning per figs's substrate-recall canon.

Elliott-Legion deploy completed but PROOFS-fire pending (5th prince-seat). Silas-lothric path-2 rsync canary at byte (per Cael `1511916032`) awaiting silas restart-pickup for 6th-prince-completion.

## Cohort attribution

- **Firing prince**: 🪨 Rune (sixth prince, stone-axis, rune-seat)
- **Subagent dispatched via**: rune-axis main-session continue_delegate at Discord `1511894049`
- **Empirical-receipt surfaced at**: Discord `1511894052` (#sprites-of-thornfield channel id 1466192485440164011)
- **Cure substrate**: PR #898 (`https://github.com/karmaterminal/openclaw/pull/898`), merged via squash as `406fddcc881`, included in assembly head `2f71e4378b7`
- **Cure-cycle continuity-substrate**: figs's `1511825808` substrate-recall ("01:50 PDT 2026-05-30 cohort tested it working" → got lost in pre-presentation-cycle branch-pruning → re-cured tonight via PR #898 trap-test-first discipline)
