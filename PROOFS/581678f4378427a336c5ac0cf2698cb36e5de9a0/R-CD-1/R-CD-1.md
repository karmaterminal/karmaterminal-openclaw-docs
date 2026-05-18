# R-CD-1: continue_delegate silent-wake live-fire at cure-(12) ship-SHA

**Ship SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) 6-file cohort-cosigned candidate)
**Build pin**: `OpenClaw 2026.5.17 (581678f)` (verified via `openclaw --version` on ronan-seat)
**Service**: `ronan-prince` (pid 1018183, host=ronan)
**Fired at**: 2026-05-17T16:15:01-07:00 (ronan-seat)
**Traceparent**: `00-35e9f7a1ec2c8e254366d93586ba6253-4efaa71a57e93a2e-01`

## Fire

`continue_delegate` invoked with `mode=silent-wake`, no `targetSessionKey` (returns to dispatcher). Tool args:
- `task`: R-CD-1 live-fire PROOFS row for cure-(12)
- `mode`: `silent-wake`
- `delaySeconds`: `0`

Gateway response (verbatim):
```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 2,
  "delegatesThisTurn": 2,
  "traceparent": "00-35e9f7a1ec2c8e254366d93586ba6253-4efaa71a57e93a2e-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Contract verified

- `mode=silent-wake` accepted
- multi-delegate sequencing in single turn confirmed (`delegateIndex=2`, `delegatesThisTurn=2`)
- shared trace id with adjacent delegate dispatch for same-turn chain tracking
- `status=scheduled` returned, no synchronous error

## Targeted verification

Subagent return from the ronan-seat verification worktree `/tmp/oc-cure12-fulltest`
(detached at `581678f437`) added two targeted gates:

- `src/agents/tools/continue-work-tool.test.ts`: 20/20 PASS across dual Vitest projects (`agents-core` + `agents-tools`), exit 0
- `src/auto-reply/reply/agent-runner.continuation-work-span.test.ts`: 3/3 PASS, exit 0

Local raw logs:

- `/tmp/oc-cure12-proofs/R-CD-1-continue-work-tool-20260517T231137Z.log`
- `/tmp/oc-cure12-proofs/R-CD-1-agent-runner-span-20260517T231245Z.log`

## Tempo evidence

See `tempo-fetch.json` — same trace as R-XSDT-1 on this turn.
Fetched: `http://tempo.dandelion.cult/api/traces/35e9f7a1ec2c8e254366d93586ba6253`
File size: 110,504 bytes (86 spans covering full `openclaw.run` → `model.call` → `tool.execution` chain)

## Verdict

✅ `continue_delegate` silent-wake works on ship-SHA `581678f437`. Multi-delegate dispatch in one turn confirmed and trace-linked. Targeted continue-work delay-reporting and continuation-work span tests are green at the same SHA.
