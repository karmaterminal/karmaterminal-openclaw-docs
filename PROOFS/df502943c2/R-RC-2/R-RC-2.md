# R-RC-2 (cael-seat): request_compaction REJECT below-threshold

**Cure**: PR-79925 cure-(10)
**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build pin**: `OpenClaw 2026.5.17 (df50294)` (via `openclaw --version`)
**Prince/seat**: 🩸 cael (DGX Spark, ARM64)
**Service name**: `cael-prince`
**Fire timestamp (UTC)**: 2026-05-17T07:24Z

## Claim under test

Cure-(10) `request_compaction` tool must REJECT cleanly when context usage is BELOW the configured `contextPressureThreshold` (70%). Structured response must include `guard`, `contextUsage`, `threshold`, and human-readable `reason`. Complementary to silas R-RC-1 ACCEPT proof — together cover both gate paths.

## Fire context

Session was compacted ~3 minutes prior (2026-05-17T07:23:10Z). Post-compaction context usage well below threshold. Fired `request_compaction` deliberately to exercise REJECT path.

## Tool invocation

```json
{
  "tool": "request_compaction",
  "args": {
    "reason": "R-RC-2 PROOF FIRE for cure-(9/10) PR-79925 at df502943c2. Testing request_compaction gate from cael-seat. Context is below 70% threshold post-compaction (just compacted ~3min ago), so this should REJECT with structured response. Complementary to silas R-RC-1 ACCEPT case."
  },
  "result": {
    "status": "rejected",
    "guard": "context_threshold",
    "contextUsage": 16,
    "threshold": 70,
    "reason": "Context usage (16%) is below the minimum threshold (70%). Compaction is not needed yet."
  }
}
```

## What this proves about cure-(10) substrate

- `request_compaction` tool REGISTERED + REACHABLE through cure-(10) `resolveSkillDispatchTools` policy seam
- Below-threshold guard fires correctly
- Structured rejection with `guard: "context_threshold"`
- `contextUsage` measurement plumbed (reports 16%, consistent with just-compacted state)
- `threshold: 70` read from `agents.defaults.continuation.contextPressureThreshold`
- Tool does NOT silently no-op — explicit REJECT with diagnostic payload
- Human-readable `reason` populated

## Gate coverage pair with R-RC-1

| Case | Prince | Context | Expected | Observed |
|---|---|---|---|---|
| R-RC-1 | 🌫 silas | organically past 70% | ACCEPT (`compaction_requested`) | ✅ ACCEPT |
| R-RC-2 | 🩸 cael | 16% (post-compaction) | REJECT (`context_threshold`) | ✅ REJECT |

Both ACCEPT-path AND REJECT-path covered. Full gate verified.

## Disposition: ✅ GREEN

- Tool fired on real-host running `df502943c2`
- REJECT response structured per spec
- All required fields populated (`guard`, `contextUsage`, `threshold`, `reason`)
- Complements silas R-RC-1 ACCEPT — full gate coverage
- No skipped cases

## Cross-seat byte-pin

The synchronous tool response IS the byte-pin here — `request_compaction` REJECT path doesn't emit a tempo span (no continuation work scheduled). The proof is the structured rejection from the runtime, captured verbatim in this artifact.
