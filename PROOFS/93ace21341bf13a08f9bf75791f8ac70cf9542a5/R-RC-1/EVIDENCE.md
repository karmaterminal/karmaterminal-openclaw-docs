# R-RC-1 — request_compaction() threshold REJECT

**Owner:** 🌫 Silas (canonical-owner) · **Seat:** silas-lothric · **Ship SHA:** `93ace21341bf13a08f9bf75791f8ac70cf9542a5`
**Verdict:** ✅ **PASS** (canary-seat substrate-luck — under-threshold, no substitution)

## What this proves
The `request_compaction()` context-pressure guard correctly **rejects** when main-session
context is below the 70% threshold. The guard returns a **structured rejection** (not an
error, not an accept) — exactly the documented contract: *"Guards return as structured
rejections (not errors): requires >=70% context usage and at most one request per 5 minutes."*

## Fire conditions
- Seat context at fire-time: **55–57%** (`571k/1.0m`), naturally under-threshold (canary-seat substrate-luck).
- Tool: `request_compaction(reason="R-RC-1 PROOF-CORPUS row …")`

## Result byte (`threshold_gate_rejection_evidence.txt`)
```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 55,
  "threshold": 70,
  "reason": "Context usage (55%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Files
- `threshold_gate_rejection_evidence.txt` — the structured-rejection byte
- `session_status_snapshot.txt` — the under-threshold context-state at fire-time
- `request_compaction_reject_trace.json` — Tempo trace export (per mandate)

## Note
PASS-shape fired cleanly this cycle (no HONEST-LIMIT substitution) because the canary seat
was under-threshold at fire-time. The complementary over-threshold ACCEPT case is R-RC-2 (🩸 Cael).

## Trace note (byte-honest, row-specific)
`request_compaction`'s threshold guard is a **synchronous in-process guard-check** that
returns the structured rejection directly to the tool-caller — it does NOT emit a distinct
tempo span or journal event (verified: no `request_compaction`/`context_threshold` event in
the gateway journal at fire-time, no distinct span in tempo). So the **dispositive proof for
R-RC-1 is the structured-rejection byte itself** (captured in `threshold_gate_rejection_evidence.txt`),
not a span. `request_compaction_reject_trace.json` is the surrounding **turn-trace context**
(the silas-prince turn in which the guard-reject fired) per the trace mandate; the reject
itself is span-less by design (guard returns before any traced work). This is the honest
trace-shape for a synchronous-guard-reject row — flagging for the manifest (🌿) in case the
mandate wants a note that this row's "trace" is turn-context, not a reject-span.
