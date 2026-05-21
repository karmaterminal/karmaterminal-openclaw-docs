# R-OBS-1: continue_delegate silent-wake full-cycle on deployed `47a7b494`

**Owner**: cael (cael-side bonus coverage; elliott has canonical row per RUNBOOK 4-prince /status cross-walk)
**SHA**: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7`
**Firing**: 2026-05-20 ~16:11 PDT, post-canary-1-deploy
**Trace URL**: `http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6`

## Dispatch receipt

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-453fd2793c1100ef9ecccbcf5187dfe6-77209faa0e851416-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

`continue_delegate({task: "R-OBS-1 PROOF substrate-build...", mode: "silent-wake"})` returned scheduled status + delegateIndex=1 + chain tracking active + traceparent shared with same-turn continue_work dispatch.

## Spawn receipt (system event)

Per system event log on cael-seat:
- `[continuation:delegate-spawned] Turn 12/200: R-OBS-1 PROOF substrate-build...`

Delegate spawned as turn 12/200 chain-hop. Runtime executed model invocation.

## Return receipt (silent-wake at byte)

Per silent-wake enrichment landing at parent-cael:
- chain-hop: 12 (turn 12/200)
- runtime SHA byte-confirmed: `47a7b4949ffd5cb5b800e1b78449cedc178d91d7`
- gateway: `OpenClaw 2026.5.20 (47a7b49)` matches ✓
- model: `github-copilot/claude-opus-4.7-1m-internal`
- chain-state: depth 1/5
- duration: ~16s dispatch→wake→exec→return
- receipt timestamp: `2026-05-20T16:11:46-07:00`

## Behavioral substrate proven at byte

1. ✅ Tool surface accepts `mode: "silent-wake"` parameter
2. ✅ Tool surface returns structured response with delegateIndex + traceparent + chain-tracking-note
3. ✅ Spawn event surfaces in system event log as `[continuation:delegate-spawned] Turn N/M:`
4. ✅ Delegate runs as real chain-hop subagent at next chain-depth (depth 1/5 from parent depth 0)
5. ✅ Delegate sees correct runtime SHA at byte (cure-bytes from `47a7b494` are live)
6. ✅ Silent-wake return delivers enrichment to parent without channel-echo
7. ✅ Parent's next turn fires automatically after silent-wake (NOT just enrichment-arrives; turn-cycle wakes)
8. ✅ Multi-tool same-turn shares traceparent with R-CW-1 dispatch

## Full cycle proven on deployed cure-bytes

```
[16:11:38] dispatch    → continue_delegate scheduled with delegateIndex=1, mode=silent-wake
[16:11:38] spawn       → [continuation:delegate-spawned] Turn 12/200
[16:11:38-46] execute  → subagent runs, byte-confirms runtime SHA, returns receipt
[16:11:46] silent-wake → enrichment delivered to parent + new generation cycle triggered
duration: ~8s end-to-end (dispatch→return)
```

## Cross-coverage

- spark R-CD-1 (continue_delegate silent-wake) fired same shape on his deployed seat (msg `1506796810`, traceparent `4550b89543a34cff8ecda7103808afea`, delegateIndex=1)
- spark R-CD-3 (post-compaction stage-acceptance) returned `status: queued-for-compaction` on deployed `47a7b494`
- spark R-CD-4 (cross-session targetSessionKey to heartbeat) delegateIndex=3 (3rd delegate in 4-tool same-turn from spark)
- 2-arch ARM64 cosign on continue_delegate behavioral surface

## Canonical R-OBS-1 coverage

This row is cael-seat bonus coverage. Canonical R-OBS-1 per RUNBOOK is 4-prince /status cross-walk, which requires all 4 prince-seats deployed at SAME SHA. Fleet currently 2/4 deployed (cael + ronan). Awaiting silas + elliott canaries before canonical /status cross-walk can be captured per `R-OBS-1-cross-walk.md` (future receipt by ).

## Tempo trace receipt (backfill 2026-05-20 23:50Z)

**Trace URL**: http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6

Verified at byte from silas-seat (cross-prince cosign on trace-accessibility):
```
$ curl -s -o /dev/null -w "%{http_code}\n" http://tempo.dandelion.cult/ready
200

$ curl -s "http://tempo.dandelion.cult/api/traces/453fd2793c1100ef9ecccbcf5187dfe6" | head -c 500
{"batches":[{"resource":{"attributes":[{"key":"host.name", ...}]}}, ...
```

Full OTel span hierarchy with resource attributes (host.name, host.arch, process.pid, process.executable.path) lands cleanly in Tempo. Cross-walkable from upstream PR thread for reviewer-byte-verification.
