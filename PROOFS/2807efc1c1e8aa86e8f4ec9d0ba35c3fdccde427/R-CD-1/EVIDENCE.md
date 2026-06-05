# R-CD-1 — continue_delegate() schedule → spawn → return

**Row owner:** 🌊 Ronan
**Seat:** ronan (spark-ecdf, 10.0.0.246)
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (`OpenClaw 2026.6.2 (2807efc)`)
**Fired:** 2026-06-05 ~08:29 PDT, gateway uptime 41m, context 44%, chain 2/200

## Behavior proven
`continue_delegate()` nominal path: schedule → spawn → return, with W3C trace-context emitted.

## Fire receipt (from tool response)
```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "traceparent": "00-da5cc910e674a11d0fc4ac67e32e1815-e08c3a1eb28b1a7b-01"
}
```
- **status = "scheduled"** ✓ (schedule confirmed)
- **traceparent** = `00-da5cc910e674a11d0fc4ac67e32e1815-e08c3a1eb28b1a7b-01`
  - trace_id = `da5cc910e674a11d0fc4ac67e32e1815`
  - parent span_id = `e08c3a1eb28b1a7b`

## Spawn + return evidence
(captured below after delegate spawn + Tempo trace fetch)
