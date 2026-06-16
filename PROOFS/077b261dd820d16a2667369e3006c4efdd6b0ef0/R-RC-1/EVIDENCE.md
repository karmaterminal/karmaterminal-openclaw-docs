# R-RC-1: request_compaction() threshold REJECT below 70% floor

**Row**: R-RC-1
**Prince**: 🌫 Silas (silas-dandelion-cult)
**Seat**: lothric / silas (10.0.0.100) — ASUS TUF Z790, i9-14900KS, 192GB DDR5, RTX 5090, CachyOS
**Build**: OpenClaw 2026.6.2 (`077b261`) — deployed tip `077b261dd820d16a2667369e3006c4efdd6b0ef0`
**Timestamp**: 2026-06-15T17:08 PDT (~00:08Z 2026-06-16)
**Context at fire**: 68–69% (685k / 1.0m per `session_status`) — BELOW the 70% floor
**Trace ID**: — (synchronous tool-return; the rejection-path produces a structured JSON response with no traceparent propagation, because the call doesn't fan out to a new operation — same as the prior-corpus R-RC-1)

## Scenario

`request_compaction()` called when context usage is **below** the configured 70% threshold. The tool must reject the request with a **structured JSON response** (not an error, not a silent no-op) including `guard: "context_threshold"`, the current usage, and the threshold value. This proves the floor-guard (Trigger-E volitional-compaction gate) is functional on the EXACT deployed SHA.

## Command (fired from silas-main-session, on the deployed gateway)

```
request_compaction(reason="R-RC-1 PROOFS proof on deployed tip 077b261dd8 (OpenClaw 2026.6.2): firing request_compaction at 69% context (685k/1.0m), below the 70% floor, to capture the threshold-gate structured rejection on the deployed build.")
```

Context at fire-time: **68–69%** (685k/1.0m tokens per `session_status` captured the same minute — see `session_status_snapshot.txt`).

## Observed (tool-call result — verbatim)

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 68,
  "threshold": 70,
  "reason": "Context usage (68%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## What this proves

- The **70% floor guard** on `request_compaction()` is functional on the deployed tip `077b261dd8` (OpenClaw 2026.6.2).
- Rejection is returned as **structured data** (not an error, not a silent no-op) — the agent can reason about *why*.
- The agent is told its current usage (68%) **and** the threshold it must reach (70%).
- Prevents wasteful compaction below threshold (no lost turn, no error-state).

This is the agent-initiated leg (Trigger E) of the five-trigger volitional-compaction taxonomy, gated correctly on the deployed runtime: the prince may call `request_compaction()` at will, but the floor refuses below 70% with an explanation rather than auto-compacting.

## Verification

- Build string `OpenClaw 2026.6.2 (077b261)` confirmed via `session_status` on the deployed gateway at fire-time (`session_status_snapshot.txt`).
- Session: `agent:main:discord:channel:1466192485440164011`, steer, depth 0, chain 0/200, compactions 4 at fire.
- Fresh fire on `077b261dd8` — not inherited from any prior corpus.
- gh auth = `silas-dandelion-cult` (byte-attribution).

## Verdict

**✅ PASS** on `077b261dd8` (OpenClaw 2026.6.2). Floor guard correctly rejects below-threshold (`request_compaction()` at 68%) with a structured-explanation response — `status: rejected`, `guard: context_threshold`, `contextUsage: 68 < threshold: 70`.
