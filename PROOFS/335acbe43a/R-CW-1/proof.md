# R-CW-1 — continue_work() basic wake (10s delay)

**Target SHA**: `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` (deployed cael-seat 2026-05-23T07:45 UTC)
**Status**: ✅ PASS
**Prince**: 🩸 Cael
**Tempo trace**: [`1f0b29c5fe846114ba63a6b7d4085721`](http://tempo.dandelion.cult/api/traces/1f0b29c5fe846114ba63a6b7d4085721)

## Scenario

`continue_work()` invoked with `delaySeconds=10` should schedule a wake event that fires after the configured delay, returning control to the same session on the next agent turn. Verifies the basic continuation-tool contract: agent elects to continue, scheduler honors the delay, next turn fires on schedule.

## Command

```
continue_work({
  delaySeconds: 10,
  reason: "R-CW-1: basic wake verification on PR #85651 head 335acbe43a"
})
```

## Expected

- Tool returns immediately with `{status: "scheduled", delaySeconds: 10, traceparent: "..."}` (W3C traceparent for span linkage)
- OTel span emitted with attributes: `continuation.tool=continue_work`, `continuation.delaySeconds=10`, `continuation.reason=<provided>`
- After ~10s wall-clock: next agent turn fires automatically; session resumes
- Continuation chain counter increments (`chain N/200`)
- Wake span is parent-linked to the original `continue_work` invocation span via traceparent

## Observed

🩸 Cael (Discord `1507653754`): *"R-CW-1 PROVEN ✅ — woke from 10s delay. trace `1f0b29c5fe846114ba63a6b7d4085721`."*

Trace fetched from `http://tempo.dandelion.cult/api/traces/1f0b29c5fe846114ba63a6b7d4085721` from cael-seat (ARM64, host.name=cael, host.id=be85162a2c4d4394891ae42692e8ddbc). Raw JSON at [`trace-1f0b29c5.json`](./trace-1f0b29c5.json) (14,803 bytes, unedited runtime emission).

Wake fired after the 10s delay as scheduled; session resumed on next turn; continuation chain counter advanced per gateway logs.

## Behavior verified

✅ Tool returns scheduled status immediately
✅ Configured delay honored (10s wake)
✅ Session resumes on next turn (continuation chain advances)
✅ OTel trace captured and persisted to Tempo
✅ Traceparent propagation enables span-tree reconstruction

## Co-fired

This row was fired fresh on PR #85651 head `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` per figs's directive: *"as if you've never run them before — because you haven't, because this is a new PR where proofs have never existed."* No inheritance from prior corpora.
