# R-RC-1 — request_compaction() threshold REJECT below 70% floor

**Target SHA**: `6a23864d12` (deployed ronan-seat 2026-05-23T03:44:00Z)
**Status**: PASS

## Scenario

`request_compaction()` called when context usage is below the configured 70% threshold. The tool must reject the request with a structured JSON response including `guard: "context_threshold"`, the current usage percentage, and the threshold value. This proves the floor-guard works correctly on the actual PR-head SHA.

## Command

Fired from ronan-main-session at 2026-05-23 ~03:47 PDT:

```
request_compaction(reason="R-RC-1 proof: testing threshold reject on 6a23864d12")
```

Context at fire-time: 68% (681k/1.0m tokens per session_status).

## Expected

- Tool returns structured rejection (not an error)
- `status: "rejected"`
- `guard: "context_threshold"`
- `contextUsage` < `threshold` (usage below floor)
- Human-readable `reason` field

## Observed

**Tool-call result:**
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 68,
  "threshold": 70,
  "reason": "Context usage (68%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

- ✅ Structured rejection returned (not an error — the tool handles this gracefully)
- ✅ `status: "rejected"` — correct refusal semantics
- ✅ `guard: "context_threshold"` — identifies which guard blocked the request
- ✅ `contextUsage: 68` < `threshold: 70` — floor correctly enforced
- ✅ Human-readable reason field with interpolated values
- ✅ Host: `ronan` (ARM64, DGX Spark), build `6a23864d12`

## Verdict

**PASS**: `request_compaction()` correctly rejects requests below the 70% context-usage threshold with a structured, informative response on the actual PR-head SHA `6a23864d12`. The floor-guard prevents unnecessary compaction while providing clear feedback to the agent about why the request was denied.

## Evidence files

- `rejection.json` — full structured rejection response
- `rejection-evidence.json` — raw tool return capture
- `EVIDENCE.md` — scribe's evidence synthesis
