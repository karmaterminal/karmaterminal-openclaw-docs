# R-CD-1 — ronan-dgx, CANDIDATE_SHA `93ace21341bf13a08f9bf75791f8ac70cf9542a5`

Captured 2026-06-21T07:52:14Z → 07:53:04Z UTC (00:53 PDT). Binary: `OpenClaw (93ace21)`. Seat `ronan-dgx` (DGX Spark, ARM64), gateway pid `600103`, deployed at CANDIDATE_SHA (runtime checkout HEAD `93ace21341bf`).

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span with `chain.id` + `chain.step.remaining` + `delegate.mode` attrs
- subagent spawns into `openclaw.harness.run` / `openclaw.run` under the SAME trace + same gateway-pid (`600103`)
- subagent runs to completion (`openclaw.outcome: completed`)
- literal-string payload returns to parent channel in ~3.3s

## Byte-evidence

### Fire trace (`delegate_fire_continuation_trace.json`)
- Trace ID: `49dd295ca32ab1280b4ce1c313766976`
- Tempo: http://tempo.dandelion.cult/api/traces/49dd295ca32ab1280b4ce1c313766976
- `continuation.delegate.dispatch` span (220ms) + stitched `openclaw.harness.run` + `openclaw.run` (child spawn, `outcome=completed`) on the same trace tree.
- `continuation.delegate.dispatch` attrs at byte:
  - `chain.id`: `759bb12a-c6e1-4d82-bca8-7f02bb955540`
  - `chain.step.remaining`: `199`
  - `delay.ms`: `5000`
  - `delegate.delivery`: `timer`
  - `delegate.mode`: `normal`
  - `reason.preview`: `[PROOF R-CD-1 / 93ace21341bf13a08f9bf75791f8ac70cf9542a5] You are a delegate dis…`
- traceparent emitted in tool-result at fire-time: `00-49dd295ca32ab1280b4ce1c313766976-997f0a507ec8082a-01`

### Delegate return (`delegate_return_payload.txt`)
```
R-CD-1 PROOF: continue_delegate(mode=normal) basic spawn-and-return path verified at CANDIDATE_SHA 93ace21341bf13a08f9bf75791f8ac70cf9542a5 from ronan-dgx seat 2026-06-21
```
Child stats: runtime 3s, tokens 99 (in 2 / out 97). Returned the exact literal string, no tool-calls.

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(...)` returned its scheduling-acknowledgment:
```json
{"status":"scheduled","mode":"normal","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-49dd295ca32ab1280b4ce1c313766976-997f0a507ec8082a-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

### Journal evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway`, window 00:53:00–00:53:04 PDT (gateway pid `600103`):
- `[continuation/delegate-dispatch] [continue_delegate] Consuming 1 tool delegate(s)` at 00:53:00.643
- `[continuation:delegate-spawned] hop=1/200 mode=normal task=[PROOF R-CD-1 / 93ace21341bf13a08f9bf75791f8ac70cf9542a5]…` at 00:53:00.863
- literal return string emitted at 00:53:04.176 (~3.3s after spawn)

## Scope-bound at byte

Proves `continue_delegate(mode="normal")` lane only: dispatch-span fired with continuation attrs, subagent spawned + completed, literal-string returned. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4), bracket-form parity (R-CD-TOKEN), or depth-2 chaining (R-CD-CHAINED-DEPTH-2). Same parent-session-key, same gateway-pid (`600103`) — single-process trace-stitching coherent. Tool-form; bracket-form sibling is R-CD-TOKEN (both-forms mandate).

**Verdict: ✅ PASS.**
