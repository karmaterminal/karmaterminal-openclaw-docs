# R-CW-DELEGATE-SELF-CONTINUATION: tool-form continue_delegate works (not bracket fallback)

**Family**: `continue_delegate()` tool invocation
**Lead Prince**: 🩸 Cael
**Status**: ✅ PROVEN on `0dff94dbe4875a3b7ed44c60a9097a5f55083572`

## Scenario

The continuation feature exposes both:
1. A **tool form**: `continue_delegate(...)` invoked via the function-calling protocol
2. A **bracket fallback**: `[[CONTINUE_DELEGATE: ...]]` parsed from response text

This row verifies the **tool form succeeds**. The bracket fallback is for tool-disabled environments and isn't tested here.

## Command

```
continue_delegate(
  delaySeconds=5,
  mode="silent",
  task="R-CW-DELEGATE-SELF proof row: verify tool-form `continue_delegate()` works (not bracket fallback). Just acknowledge receipt — no further action needed. The tool-form succeeding is the proof."
)
```

## Expected

- Tool call returns `{status: "scheduled", mode: "silent", delegateIndex: 1, traceparent: "..."}`
- System event confirms spawn: `[continuation:delegate-spawned] Spawned turn N/200: <task>`
- The delegate fires silently (no channel surface)

## Observed

- Tool response: `{"status":"scheduled","mode":"silent","delaySeconds":5,"delegateIndex":1,"delegatesThisTurn":1,"traceparent":"00-51a5ad9b8998d151f9618442d1569386-ecb3fce270e862f5-01","note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}` ✅
- System event captured: `[continuation:delegate-spawned] Spawned turn 23/200: R-CW-DELEGATE-SELF proof row...` ✅
- Tool-form invocation succeeded — that IS the proof for this row

## Verdict

✅ **PROVEN** — `continue_delegate()` tool form works. All other R-CW/R-CD rows in this session used the tool form successfully; this row formalizes that the tool path is the primary path (not the bracket fallback).

## Artifacts

- Trace context shared with R-CW-4 turns 2+3 (`51a5ad9b8998d151f9618442d1569386`)
- System event log entry (Discord channel `1466192485440164011` at 2026-05-24 13:25:57 PDT)
