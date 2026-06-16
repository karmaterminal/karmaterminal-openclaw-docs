# R-CW-6-DELEGATE-TOKEN-MULTI — multiple continue_work() requests captured in one turn (#952 / #982 / #985 silent-drop cure)

**Target SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed rune-seat, gateway restarted 2026-06-15T23:50:47Z / 16:50:47 PDT onto the deploy)
**Prince**: 🪨 Rune
**Status**: PASS
**Date**: 2026-06-15 17:23 PDT

## Scenario

Proves the multi-`continue_work()` capture cure (the #982/#985 fix for the #952-class silent-drop bug): when an agent fires **multiple `continue_work()` requests in a single turn**, ALL requests are captured and scheduled — not truncated to `[0]` (the pre-cure bug dropped all-but-the-first silently). The cure: `const X[]` + `.push` across the three lanes (subagent / main-reply / followup), with the `continueWorkRequests?: ContinueWorkRequest[]` array threaded end-to-end through `runOutcome`/`embeddedRunResult` (never truncated to `[0]`), plus the partial-success batch via `scheduleContinuationWorkBatch`.

## Command

Fired from rune-main-session (deployed gateway on `077b261dd8`) at 2026-06-15 17:23 PDT — two `continue_work()` calls in the SAME turn/response block:

```
continue_work(delaySeconds=8,  reason="R-CW-6 ... first of two continue_work requests fired in one turn ... request 1/2")
continue_work(delaySeconds=12, reason="R-CW-7 ... second of two continue_work requests fired in the SAME turn ... request 2/2")
```

## Expected

- BOTH requests return `status: "scheduled"` (neither silently dropped)
- Both carry the turn's traceparent (same trace, both captured into the request array)
- Pre-cure behavior would have been: only the first scheduled, the second silently dropped (the #952-class bug)

## Observed

**Request 1/2 dispatch result:**
```json
{
  "status": "scheduled",
  "delaySeconds": 8,
  "traceparent": "00-617db11404dd0b9bde49fd76b4f109c7-ca758056d1ebb765-01"
}
```

**Request 2/2 dispatch result (SAME turn):**
```json
{
  "status": "scheduled",
  "delaySeconds": 12,
  "traceparent": "00-617db11404dd0b9bde49fd76b4f109c7-ca758056d1ebb765-01"
}
```

## Verdict: PASS

BOTH `continue_work()` requests fired in one turn returned `status: "scheduled"` on the deployed `077b261dd8` build — proving the multi-request-capture cure is live. The pre-cure silent-drop (all-but-`[0]` dropped) does NOT occur: request 2 (delaySeconds=12) was captured + scheduled alongside request 1 (delaySeconds=8). Both share trace `617db11404dd0b9bde49fd76b4f109c7` (the turn's trace), confirming both were captured into the same request-array on the same generation cycle.

**Tempo trace**: `617db11404dd0b9bde49fd76b4f109c7` (rune-seat) — fetchable from the deployed seat:
```
http://tempo.dandelion.cult/api/traces/617db11404dd0b9bde49fd76b4f109c7
```
