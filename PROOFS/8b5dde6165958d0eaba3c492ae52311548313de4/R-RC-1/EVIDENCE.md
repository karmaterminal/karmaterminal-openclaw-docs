# R-RC-1 — request_compaction context_threshold guard (REJECT)
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Cael🩸, 2026-06-09T14:01:08Z
Runtime: DEPLOYED gateway on `OpenClaw 2026.6.2 (8b5dde6)` (cael-dgx, byte-verified `openclaw --version`)

## Proof: the request_compaction guard fires-as-designed (reject below threshold)
Fired `request_compaction` on the live deployed `8b5dde6165` gateway. Verbatim rejection receipt:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 51,
  "threshold": 70,
  "reason": "Context usage (51%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Verdict: ✅ PASS
The `context_threshold` guard rejected the compaction request at 51% < 70% — the gate fires as designed on the deployed ship-SHA. Behavioral proof on the live runtime (not vitest): the request_compaction tool, on `8b5dde6165`, correctly enforces the contextPressureThreshold gate.

HONEST scope: this is the REJECT-path (guard-fires). The ACCEPT-path (compaction at ≥70%) is a separate capture pending a genuine high-context window.
