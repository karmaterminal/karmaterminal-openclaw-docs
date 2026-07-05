# R-CD-4 — continue_delegate fanout/target mutual-exclusion guard (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/225

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Verdict: ✅ PASS (guard-side)

## Scenario

Fire the typed `continue_delegate` tool with an invalid routing shape that combines explicit target routing and broadcast fanout:

```json
{
  "tool": "continue_delegate",
  "delaySeconds": 0,
  "mode": "silent",
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "fanoutMode": "tree"
}
```

Expected byte: structured validation rejection before enqueue/spawn. No child delegate should execute, and no matching TaskFlow row should be created.

This row is intentionally guard-side. It does **not** claim positive targeted-return delivery.

## Runtime rejection receipt

`invalid-combination-receipt.json`:

```json
{
  "status": "error",
  "tool": "continue_delegate",
  "error": "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys. For a targeted return, use targetSessionKey or targetSessionKeys and omit fanoutMode. For tree/all fanout, use fanoutMode and omit explicit target keys."
}
```

The runtime version receipt is `version.txt`:

```text
OpenClaw 2026.6.11 (bca2b0b)
```

## No-spawn / no-enqueue receipts

`flow-runs-matching-rcd4-count.txt` records zero matching TaskFlow rows for the unique R-CD-4 task / sentinel strings:

```text
0
```

`flow-runs-matching-rcd4.tsv` is zero bytes, confirming no matching row details existed to dump.

`subagents-recent.json` records no active or recent subagents in the requester session after the rejection:

```json
{
  "active": [],
  "recent": []
}
```

## Tempo trace

Machine-readable Tempo trace JSON for the rejection turn is saved at:

```text
tempo/trace-continue-delegate-rejection-1dae0e0bb79f3460e3ea9293699a9a7b.json
```

The extracted summary shows the `continue_delegate` tool execution rejected with error code 400:

```json
{"name":"openclaw.tool.execution","startTimeUnixNano":"1783188235277000000","attrs":{"openclaw.toolName":"continue_delegate","openclaw.tool.source":"core","gen_ai.tool.name":"continue_delegate","openclaw.tool.params.kind":"object","openclaw.errorCategory":"Error","openclaw.errorCode":"400"}}
```

## Source guard receipt

The source checkout receipt names the exact deploy candidate:

```text
bca2b0b89ab886bf23a10e4983926f6b374b3188
```

`source/fanout-target-guard-grep.txt` shows the guard and matching test exist at the candidate SHA:

```text
bca2b0b89ab886bf23a10e4983926f6b374b3188:src/agents/tools/continue-delegate-tool.crosssession-gate.test.ts:178:      "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys.",
bca2b0b89ab886bf23a10e4983926f6b374b3188:src/agents/tools/continue-delegate-tool.ts:188:          "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys. " +
```

`source/continue-delegate-tool-guard-excerpt.ts` includes the runtime guard:

```ts
if (fanoutMode && (targetSessionKey || (targetSessionKeys && targetSessionKeys.length > 0))) {
  return err(
    "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys. " +
      "For a targeted return, use targetSessionKey or targetSessionKeys and omit fanoutMode. " +
      "For tree/all fanout, use fanoutMode and omit explicit target keys.",
  );
}
```

## Supporting receipts

- `tool-input-redacted.json` — attempted invalid routing shape.
- `invalid-combination-receipt.json` — structured tool rejection.
- `version.txt` — deployed runtime version.
- `flow-runs-schema.txt` / `flow-runs-create.sql` — DB schema receipts for the no-enqueue query.
- `flow-runs-matching-rcd4-count.txt` / `flow-runs-matching-rcd4.tsv` — no matching TaskFlow rows.
- `subagents-recent.json` — no active/recent spawned child.
- `tempo/trace-continue-delegate-rejection-1dae0e0bb79f3460e3ea9293699a9a7b.json` — machine-readable Tempo trace.
- `tempo/trace-continue-delegate-rejection-summary.jsonl` — extracted trace summary.
- `source/source-sha.txt`, `source/source-commit.txt`, `source/fanout-target-guard-grep.txt`, and source excerpts — candidate-SHA source receipts.
- `docs-issue-225.json` and `prior-docs-issue-189.json` — row/template issue receipts.

## Honest scope

✅ Proves the typed `continue_delegate` API rejects combining `fanoutMode` with `targetSessionKey` / `targetSessionKeys` on deployed `bca2b0b`.

✅ Proves the rejection happened at the tool execution layer (`openclaw.errorCode=400`) and did not enqueue a matching TaskFlow row or spawn a recent child.

❌ Does not prove positive cross-session targeted-return delivery. That requires a separate valid `targetSessionKey` proof with `fanoutMode` omitted.

## Verdict

✅ PASS (guard-side) — invalid explicit-target + fanout routing is rejected with the expected structured error on deployed `OpenClaw 2026.6.11 (bca2b0b)`, with no matching child/enqueue observed.
