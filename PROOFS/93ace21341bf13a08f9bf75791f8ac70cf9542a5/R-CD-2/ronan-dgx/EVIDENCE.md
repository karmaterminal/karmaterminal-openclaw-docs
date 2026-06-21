# R-CD-2 — ronan-dgx, CANDIDATE_SHA `93ace21341bf13a08f9bf75791f8ac70cf9542a5`

Captured 2026-06-21T07:55:42Z → 07:56:09Z UTC (00:56 PDT). Binary: `OpenClaw (93ace21)`. Seat `ronan-dgx` (DGX Spark, ARM64), gateway pid `600103`, deployed at CANDIDATE_SHA.

## Proof-scope

`continue_delegate(mode="silent-wake")` full path at byte: silent return (no channel announce) + fresh-turn-trigger (wake-on-return). Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span with `delegate.mode=silent-wake`
- subagent spawns + runs to completion, returns literal string
- the return is SILENT (`silentAnnounce=true`) — not posted to channel
- the return TRIGGERS a fresh parent turn (`wakeOnReturn=true`) — this captured turn IS that wake

## Byte-evidence

### Fire trace (`delegate_silentwake_continuation_trace.json`)
- Trace ID: `699722385da969682c944031d1b17341`
- Tempo: http://tempo.dandelion.cult/api/traces/699722385da969682c944031d1b17341
- `continuation.delegate.dispatch` span + stitched `openclaw.harness.run` / `openclaw.run` (child, completed) on the same trace.
- `continuation.delegate.dispatch` attrs at byte:
  - `chain.id`: `551b6979-e08c-49bd-87b0-5975d744090e`
  - `chain.step.remaining`: `199`
  - `delay.ms`: `5000`
  - `delegate.delivery`: `timer`
  - `delegate.mode`: `silent-wake`
  - `reason.preview`: `[PROOF R-CD-2 / 93ace21341bf13a08f9bf75791f8ac70cf9542a5] You are a de…`
- traceparent emitted at fire-time: `00-699722385da969682c944031d1b17341-f5d74d19801d3742-01`

### The silent-wake dispositive byte (`journal_continuation.log`)
The line that distinguishes silent-wake from normal mode — `journalctl --user -u openclaw-gateway`, window 00:56:05–00:56:09 PDT (gateway pid `600103`):
- `[continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s)` at 00:56:05.746
- `[continuation:delegate-spawned] hop=1/200 mode=silent-wake …` at 00:56:05.925
- literal return string at 00:56:09.066 (~3.3s)
- **`[continuation/announce] [continuation/silent-wake] wakeOnReturn=true target=agent:main:discord:channel:1466192485440164011 silentAnnounce=true`** at 00:56:09.444 — the silent-wake contract at byte: `silentAnnounce=true` (no channel post) + `wakeOnReturn=true` (fresh parent turn triggered).

### Delegate return (`delegate_return_payload.txt`)
```
R-CD-2 PROOF: continue_delegate(mode=silent-wake) silent-return-plus-wake path verified at CANDIDATE_SHA 93ace21341bf13a08f9bf75791f8ac70cf9542a5 from ronan-dgx seat 2026-06-21
```
The return injected as internal context (silent), and the parent woke to act on it — the wake-turn captured this evidence. The string did NOT appear as a channel message (silent), unlike R-CD-1 (mode=normal, which announced).

### Fire-side dispatch-response (`fire_response.json`)
```json
{"status":"scheduled","mode":"silent-wake","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-699722385da969682c944031d1b17341-f5d74d19801d3742-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

## Scope-bound at byte

Proves `continue_delegate(mode="silent-wake")` full path: dispatch (mode=silent-wake) → spawn → completed → silent return (`silentAnnounce=true`) → wake-on-return (`wakeOnReturn=true`, this turn). Tool-form. Distinguished from R-CD-1 (mode=normal, channel-announced) by the `silentAnnounce=true`+`wakeOnReturn=true` byte. Same gateway-pid (`600103`) — single-process trace-stitching coherent.

**Verdict: ✅ PASS.**
