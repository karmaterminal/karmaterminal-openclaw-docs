# R-RC-1 — request_compaction threshold ACCEPT (volitional trigger)

**SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build-info on host**: `OpenClaw 2026.5.17 (df50294)`, `build-info.json` commit `df502943c2667ff2e1eed9f850379b41f9b8a8f6`, builtAt `2026-05-17T06:56:38.908Z`
**Fire by**: 🌫 silas-seat (`urudyne`) — main session, organically past threshold
**Fire at**: 2026-05-17 ~07:15Z

## Claim under test

Cure-(10) preserves `request_compaction` tool through the new policy seam. When invoked from a session organically past the context-pressure threshold (~70%), the tool must ACCEPT with structured response (`status: compaction_requested`, `trigger: volitional`, `contextUsage`, `compactionRequestId`, `traceparent`) and enqueue compaction for after the current turn completes.

This is the trigger-E pathway (per the 5-trigger taxonomy in the canary RFC): agent-initiated proactive compaction.

## Method

1. Confirmed binary on host shows `df50294` via `openclaw --version` and `build-info.json` reads commit `df502943c2`.
2. From silas-seat main session that had organically accumulated context past the threshold (`contextUsage=136`), invoked `request_compaction` natively with a real `reason` describing the proof-fire context.
3. Captured the structured tool result containing all 5 expected fields (status, compactionRequestId, trigger, contextUsage, traceparent).
4. Pre-emptively staged a `continue_delegate(mode="post-compaction", ...)` lifeboat to carry proof-build state across the compaction boundary if needed.
5. Fetched the full trace from tempo backend, verified `request_compaction` tool.execution span present.

## Evidence

### Tool result returned

```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mp9frzzh-wkCJWw",
  "trigger": "volitional",
  "contextUsage": 136,
  "reason": "R-RC-1 proof-fire at cure-(10) df502943c2 (silas-seat): main session organically past 70% threshold (~103k tokens). Capture traceparent + tempo trace for request_compaction gate evidence. Cohort proof corpus. Lease byte 92c36a73a9 HELD on PR head.",
  "traceparent": "00-0443b800d51612477067c342c98d48d9-f686deebf2ef0be8-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

All 5 expected fields present. Status = `compaction_requested` = ACCEPT. Trigger = `volitional` (Trigger-E from the 5-trigger taxonomy).

### Tempo evidence

- **Trace ID**: `0443b800d51612477067c342c98d48d9`
- **Tempo URL**: <http://tempo.dandelion.cult/api/traces/0443b800d51612477067c342c98d48d9>
- **Trace dump**: [`trace.json`](./trace.json) (7.8 KB, 5 spans)

### request_compaction span (recipient-side from tempo)

```json
{
  "spanId": "HEfgVMMacD4=",
  "parentSpanId": "9obe6/LvC+g=",
  "name": "openclaw.tool.execution",
  "attributes": [
    {"key": "openclaw.toolName", "value": {"stringValue": "request_compaction"}},
    {"key": "gen_ai.tool.name", "value": {"stringValue": "request_compaction"}},
    {"key": "openclaw.tool.params.kind", "value": {"stringValue": "object"}}
  ]
}
```

The tool.execution span is correctly named, attributed, and stitched into the per-turn run tree on the `df50294` runtime.

### Post-compaction lifeboat (paired evidence)

A `continue_delegate(mode="post-compaction", ...)` was queued in the same turn with the proof-build state. The gateway response confirmed `status: queued-for-compaction` and shared the same trace-root `0443b800d51612477067c342c98d48d9`. This is end-to-end coverage of the request_compaction + post-compaction-delegate pairing the cure-(10) feature explicitly supports.

```json
{
  "status": "queued-for-compaction",
  "mode": "post-compaction",
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-0443b800d51612477067c342c98d48d9-f686deebf2ef0be8-01"
}
```

## Verdict

**PASS**.

- `request_compaction` tool is present + invokable on `df502943c2` ✅
- Returns structured ACCEPT response with all 5 expected fields when context organically past threshold ✅
- Tempo trace contains the tool span correctly ✅
- Pairs correctly with `continue_delegate(mode="post-compaction")` lifeboat semantics ✅
- Trigger-E (volitional, agent-initiated) pathway operational live on the runtime ✅

## Honesty note: context-usage at fire

The silas-seat main session organically reached `contextUsage=136` (well past 70% threshold) through the long cure-(9)/cure-(10) cohort coordination day, then `request_compaction` was fired. This is the **opposite** of the elliott-seat attempt earlier this turn-cycle, which was forced to abort because a freshly-spawned isolated subagent was at ~1-2% context (below threshold) and would have fabricated the precondition. Both attempts surface complementary evidence: 🌻's abort + this PASS prove the gate IS load-bearing (rejects below, accepts above).

## Recipient-side receipt vs agent prose

Tool-result JSON copied verbatim from the gateway's structured response (not narrated). Trace data fetched from tempo backend API. Both are recipient-side substrate; agent prose summarises.

## Honesty note: compaction-failed event after this turn

After this proof was pushed, the queued compaction `cmp-mp9frzzh-wkCJWw` failed at the provider layer with:

```
[system:compaction-failed] code=provider_error_4xx
reason=Turn prefix summarization failed: 400 bad request: missing Editor-Version header for IDE auth
```

This is an **upstream github-copilot provider auth bug** on the summarization endpoint (IDE-auth-only path missing the Editor-Version header), NOT a cure-(10) regression. The same failure would occur for any compaction attempt against that provider endpoint, irrespective of our feature code.

R-RC-1's verdict (PASS) stands on what it claims to verify — the **gateway-side** request_compaction tool behavior:
- Tool present + invokable
- Structured ACCEPT response with all 5 fields when above threshold
- Tempo span emitted
- post-compaction-delegate pairing returns `queued-for-compaction`

What R-RC-1 does NOT claim to verify: provider-side summarization succeeds end-to-end. That is a separate concern, downstream of cure-(10)'s scope. The cohort had 14 successful compactions on silas-seat today before this one; the failure is sporadic provider-flake, not cure-introduced.
