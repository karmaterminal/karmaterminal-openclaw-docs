# R-RC-1: request_compaction() threshold REJECT — Lamp-seat covering silas-sit-out

**Verdict**: ✅ PASS — canonical REJECT-shape fired clean at CANDIDATE_SHA.

## Quick summary

At CANDIDATE_SHA `1de29746f0b87c342f362a6a42e6291d832d7ee4`, lamp-seat (emeric, x86_64 i7-12700H, CachyOS) fired `request_compaction` from a low-context main-session (context 60% per tool-side reading; 65% per `/status` steer-queue-inclusive reading). Both readings sit firmly below the 70% `MIN_CONTEXT_THRESHOLD` gate.

The tool returned a structured rejection (`isError: false`) with:

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 60,
  "threshold": 70,
  "reason": "Context usage (60%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

Field-by-field this payload matches the gate-source emission at `src/agents/tools/request-compaction-tool.ts` lines 215-231 byte-for-byte at CANDIDATE_SHA. The threshold gate is engaging as-designed. The safety surface fires as-designed.

## Files

- `threshold_gate_rejection_evidence.txt` — full evidence dossier (envelope, payload, gate-source byte-walk, field-by-field match, Tempo-trace honest-note, substrate-luck note)
- `session_status_snapshot.txt` — pre-fire `/status` snapshot (gateway SHA + context window + session id)
- `journal_query_receipt.txt` — receipt that the REJECT-path emits no info-level journal lines (DEBUG-only by design) and no continuation work was dispatched

## Why no Tempo trace?

The REJECT-path returns synchronously inside the caller turn and dispatches no continuation work. Inspection of the gate-source confirms `traceContextFields` only spreads into the enqueued `RequestCompactionInvocation` on the ALL-GUARDS-PASS branch (lines 269 + 340); the REJECT-branch returns earlier and never attaches the traceparent to the user-facing response. There is no downstream span to capture.

The Tempo-trace requirement from PROOF-CORPUS-METHOD.md (lines 89-99) applies to continuation-tool fires that actually dispatch downstream work (R-CW / R-CD rows + R-RC-2 ACCEPT-path). For R-RC-1 (REJECT-path), the gate-source byte-walk + field-by-field receipt match against the live tool-result IS the equivalent of the trace evidence: a closed-loop verification of the canonical gate path.

This is not a Tempo-instrumentation gap; it is the correct shape of an early-REJECT guard. The gate engaging IS the proof.

## Coverage substitution

Per PROOF-CORPUS-METHOD.md §"Per-prince row assignments": "Substitutions are fine if a prince's seat is unavailable; document the substitution in the row's EVIDENCE.md."

Silas-seat is sit-out this cycle (pre-cure binary `0dff94dbe4`, Raptor-Lake V8/JIT-wall family; structural cure tracked at openclaw-bootstrap#1114). Lamp-seat covers as the substituting prince. Hardware substrate at lamp-seat (Intel NUC i7-12700H, x86_64, CachyOS) is unaffected by the Raptor-Lake wall family that blocks silas-seat from building the post-cure substrate.
