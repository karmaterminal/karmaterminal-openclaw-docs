# R-CW-7 — traceparent / continuation.work E2E evidence

**Row:** R-CW-7  
**Seat:** 🪨 Rune (`rune`, ROG Ally Z1 Extreme)  
**SHA tested:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Fired:** 2026-06-23 00:09–00:13 PDT  
**Verdict:** ✅ PASS

## Runtime traceparent receipt

Rune's main session fired a direct `continue_work` with an explicit valid W3C traceparent:

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-dddddddddddddddddddddddddddddddd-4444444444444444-01"
}
```

In the self-continuation subagent row, hop 1 also scheduled with a valid explicit traceparent:

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01"
}
```

The same child then received the continuation wake:

```text
[continuation:wake] Turn 1/200. Chain started at 2026-06-23T07:12:10.213Z. Accumulated tokens: 19218. The agent elected to continue working. Reason: R-CW-DELEGATE-SELF-CONTINUATION hop-2 wake proof on 82827d3cbc
```

## Tempo export

Tempo fetch for trace id `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` succeeded from rune-seat:

```text
GET http://tempo.dandelion.cult/api/traces/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
batches=4
span names include: continuation.work
```

Archived raw export:

- `../R-OBS-2/rune-rog-ally/tempo-trace-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json`

Additional sibling trace ids also resolved with `continuation.work` spans:

- `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` → batches=1, `continuation.work`
- `cccccccccccccccccccccccccccccccc` → batches=1, `continuation.work`

## Test gate

Local targeted Vitest gate on the 82827d3cbc worktree completed green for the continue-work boundary file:

```text
Test Files: 2 passed
Tests: 8 passed
```

(The broader multi-file Vitest gate was started with single-worker/forks on rune-seat; the ROG Ally is resource-constrained, so the row relies primarily on live runtime bytes + Tempo export.)


## Late direct-wake trace confirmation

A later continuation wake for Rune's direct R-CW-7 `continue_work` fire landed in the parent session:

```text
[continuation:wake] Turn 1/200. Chain started at 2026-06-23T07:19:45.875Z. Accumulated tokens: 286980. The agent elected to continue working. Reason: R-CW-7 traceparent E2E proof on rune-seat 82827d3cbc; schedule live wake to capture continuation.work trace.
```

The originally scheduled explicit traceparent was:

```text
00-dddddddddddddddddddddddddddddddd-4444444444444444-01
```

Tempo initially 404'd for this trace while the export was still landing. A retry after the wake succeeded:

```text
GET http://tempo.dandelion.cult/api/traces/dddddddddddddddddddddddddddddddd
batches=1
span names include: continuation.work
```

Archived raw export:

- `tempo-trace-dddddddddddddddddddddddddddddddd.json`

## Verdict

✅ PASS: `continue_work` emitted a W3C traceparent, the continuation wake executed, and the trace exported to Tempo with `continuation.work` present under the expected trace id on the `82827d3cbc` runtime.
