# R-RC-1 — `request_compaction` threshold guard rejects below threshold (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/212

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves `request_compaction` refuses to compact when the current context usage is below the configured threshold. It must return a structured guard rejection, not trigger compaction.

## Precheck context

`session-status-receipt.txt` records the precheck context:

```text
OpenClaw 2026.6.11 (bca2b0b)
Context: 186k/1.0m (19%)
Continuation: chain 0/200 | 1 post-compaction staged
Session: agent:main:discord:channel:1466192485440164011
```

At 19% context usage, this was safely below the compaction threshold.

## Tool receipt

`request-compaction-receipt.json` records the typed tool call and guard result:

```json
{
  "tool": "request_compaction",
  "reason": "R-RC-1 proof marker RRC1_BCA2B0B_CAEL_20260704_1028_THRESHOLD_GUARD_REJECT: expect low-context request_compaction guard rejection, not compaction",
  "receipt": {
    "status": "rejected",
    "guard": "context_threshold",
    "contextUsage": 19,
    "threshold": 70,
    "reason": "Context usage (19%) is below the minimum threshold (70%). Compaction is not needed yet."
  }
}
```

The expected guard is present: `status=rejected`, `guard=context_threshold`, `contextUsage=19`, `threshold=70`.

## Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-request-compaction-c168c17b03e5ff70192863b721a57276.json
```

`tempo/trace-request-compaction-summary.jsonl` includes the typed tool execution:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783186095585000000","attrs":{"openclaw.toolName":"request_compaction","openclaw.tool.source":"core","gen_ai.tool.name":"request_compaction","openclaw.tool.params.kind":"object"}}
```

The same trace includes the parent model/run context and the post-rejection visible status update. `tempo/trace-precheck-context-155215d3356672c1cf26fbde5bfc9343.json` is included as the preceding context/status trace.

## Supporting receipts

- `request-compaction-receipt.json` — typed tool call + structured threshold rejection.
- `session-status-receipt.txt` — precheck context usage/version receipt.
- `discord-status-receipts.jsonl` — visible pre/post status receipts.
- `tempo/trace-request-compaction-c168c17b03e5ff70192863b721a57276.json` — machine-readable request-compaction tool trace.
- `tempo/trace-request-compaction-summary.jsonl` — extracted trace summary.
- `tempo/trace-precheck-context-155215d3356672c1cf26fbde5bfc9343.json` — context/status precheck trace.
- `tempo/trace-precheck-context-summary.jsonl` — extracted precheck trace summary.
- `journal-window.txt`, `journal-compaction-lines.txt`, `journal-marker-lines.txt` — journal window receipts; no compaction event fired in the captured window.
- `version.txt` — deployed build receipt.

## Verdict

✅ PASS — `request_compaction` rejected below threshold with `guard=context_threshold`, `contextUsage=19`, and `threshold=70`, without triggering compaction.
