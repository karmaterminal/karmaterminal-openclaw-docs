# R-CD-3 — post-compaction delegate queues for compaction seam (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/235

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`
Seat: Cael / `cael-dgx`
Build: `OpenClaw 2026.6.11 (bca2b0b)`
Verdict: ✅ PASS

## Expected byte lock

This row proves the typed tool-form post-compaction delegate surface:

- `continue_delegate(mode="post-compaction")` accepts the request;
- the request is staged for release after the next compaction seam, not timer-dispatched immediately;
- durable state preserves `postCompaction: true`, the marker task, and queued status.

This row does **not** require forcing a compaction seam. If a future compaction fires the child, that can be captured as additional evidence, but the locked byte for this row is immediate accepted + queued-for-compaction.

## Fire

Marker:

```text
RCD3_POST_COMPACTION_BCA2B0B_CAEL_20260704_0837
```

Typed tool call shape:

```text
continue_delegate(
  mode="post-compaction",
  fanoutMode="tree",
  task="RCD3_POST_COMPACTION_BCA2B0B_CAEL_20260704_0837 proof child. If this post-compaction delegate fires at a future compaction seam, return exactly: RCD3_POST_COMPACTION_BCA2B0B_CAEL_20260704_0837_CHILD_RETURNED. Context: proof row R-CD-3 for candidate bca2b0b89ab886bf23a10e4983926f6b374b3188; parent is capturing immediate queued-for-compaction receipt as accepted byte."
)
```

## Observed bytes

### Tool receipt

`tool-receipt.json`:

```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree",
  "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."
}
```

### Durable flow row

`flow-runs-marker.json` contains one marker row:

```json
{
  "flow_id": "4701841c-84db-4fac-b9be-1c955e316a9e",
  "sync_mode": "managed",
  "owner_key": "agent:main:discord:channel:1466192485440164011",
  "controller_id": "core/continuation-post-compaction",
  "revision": 0,
  "status": "queued",
  "notify_policy": "silent",
  "current_step": "Staged for release after compaction",
  "created_at": 1783179451137,
  "updated_at": 1783179451137,
  "ended_at": null,
  "state_json": {
    "kind": "continuation_delegate",
    "postCompaction": true,
    "firstArmedAt": 1783179451137,
    "fanoutMode": "tree",
    "traceparent": "00-461a2847af147a216a86af077010996b-6bdd82fff9d1c274-01"
  }
}
```

The full JSON receipt preserves the complete marker task.

### Tempo trace

Machine-readable Tempo trace JSON is saved at:

```text
tempo/trace-461a2847af147a216a86af077010996b.json
```

`tempo/trace-summary.jsonl` shows the relevant tool execution span:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783179451137000000","attrs":{"openclaw.toolName":"continue_delegate","openclaw.tool.source":"core","gen_ai.tool.name":"continue_delegate","openclaw.tool.params.kind":"object"}}
```

This trace corresponds to the durable flow row traceparent `00-461a2847af147a216a86af077010996b-6bdd82fff9d1c274-01`.

## Loop/resurrection check

The marker search found exactly one durable flow row for `RCD3_POST_COMPACTION_BCA2B0B_CAEL_20260704_0837`, with `status=queued` and `current_step="Staged for release after compaction"`. The evidence does not show an immediate child execution, duplicate release, resurrection, or request-in-flight loop.

## Supporting receipts

- `tool-receipt.json` — typed tool receipt showing `queued-for-compaction`.
- `flow-runs-marker.json` — durable row preserving marker task, `postCompaction: true`, `status: queued`, and `controller_id: core/continuation-post-compaction`.
- `tempo/trace-461a2847af147a216a86af077010996b.json` — machine-readable trace for the parent turn/tool execution.
- `tempo/trace-summary.jsonl` — extracted trace summary showing `continue_delegate` tool execution.
- `version.txt` — deployed build receipt.
- `journal-window.txt`, `journal-marker-lines.txt`, `journal-delegate-lines.txt` — journal window/search receipts.

## Verdict

✅ PASS — typed `continue_delegate(mode="post-compaction")` accepted the request and staged one durable post-compaction delegate row for release at a future compaction seam.
