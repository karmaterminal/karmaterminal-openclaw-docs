# R-RC-2 — request_compaction threshold guard honest limit (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/238

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ⚠️ HONEST_LIMIT

## Expected byte lock

This row proves `request_compaction()` behavior for the live Cael session. Per method packet, if the live session is below threshold, do not stuff context or loop requests; capture the single threshold rejection as HONEST_LIMIT.

## Pre-fire status

`session-status.txt` captured immediately before the request:

```text
OpenClaw 2026.6.11 (bca2b0b)
Context: 168k/1.0m (17%)
Session: agent:main:discord:channel:1466192485440164011
Continuation: chain 0/200 | 1 post-compaction staged
Captured before R-RC-2 request_compaction fire.
```

Threshold for `request_compaction()` acceptance is 70%; the live session was 17%.

## Fire

Marker:

```text
RRC2_BCA2B0B_CAEL_20260704_0843
```

Single typed tool call:

```text
request_compaction(
  reason="RRC2_BCA2B0B_CAEL_20260704_0843 proof request for R-RC-2: single request_compaction call after session_status showed 17% context. Expected HONEST_LIMIT threshold rejection if below threshold; no context stuffing, no loop.",
  focus="Proof row R-RC-2 on candidate bca2b0b89ab886bf23a10e4983926f6b374b3188. Marker RRC2_BCA2B0B_CAEL_20260704_0843. Capture request_compaction receipt and pre-status; if below threshold, package HONEST_LIMIT, not failure. Do not repeat request."
)
```

## Observed receipt

`request-compaction-receipt.json`:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 17,
  "threshold": 70,
  "reason": "Context usage (17%) is below the minimum threshold (70%). Compaction is not needed yet.",
  "marker": "RRC2_BCA2B0B_CAEL_20260704_0843"
}
```

This is the expected HONEST_LIMIT byte for the current live substrate. It is not a regression: the guard correctly refused compaction while context was below threshold.

## Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-7c90ab549eea6578bf5e58b2eed3dd9.json
```

`tempo/trace-summary.jsonl` shows both the pre-fire `session_status` and the single `request_compaction` tool execution:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179789748000000","attrs":{"openclaw.toolName":"session_status","openclaw.tool.source":"core","gen_ai.tool.name":"session_status","openclaw.tool.params.kind":"object"}}
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179796402000000","attrs":{"openclaw.toolName":"request_compaction","openclaw.tool.source":"core","gen_ai.tool.name":"request_compaction","openclaw.tool.params.kind":"object"}}
```

## Loop/resurrection check

Only one `request_compaction()` call was made for this row. There was no repeated compaction request, no compaction seam forced, no context stuffing, and no taskflow loop/resurrection signature in the captured receipts.

## Supporting receipts

- `session-status.txt` — pre-fire context/status receipt showing 17% usage.
- `request-compaction-receipt.json` — typed tool receipt showing `status=rejected`, `guard=context_threshold`, `contextUsage=17`, `threshold=70`.
- `tempo/trace-7c90ab549eea6578bf5e58b2eed3dd9.json` — machine-readable trace for the parent turn/tool execution.
- `tempo/trace-summary.jsonl` — extracted trace summary showing `session_status` and `request_compaction` tool execution.
- `tempo/request-compaction-traces.txt` — trace id search receipt.
- `version.txt` — deployed build receipt.
- `journal-window.txt`, `journal-marker-lines.txt`, `journal-compaction-lines.txt` — journal window/search receipts.

## Verdict

⚠️ HONEST_LIMIT — live context was 17%, below the 70% threshold, so `request_compaction()` correctly rejected with `guard=context_threshold`. This row should not be marked PASS unless a future live session is genuinely over threshold; for this proof cycle, the honest byte is the threshold rejection.
