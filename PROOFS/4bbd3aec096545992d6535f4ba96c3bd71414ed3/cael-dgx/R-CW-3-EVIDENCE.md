# R-CW-3 cael-dgx — `continue_work` reason-field captured in OTel span on `4bbd3aec096`

**Row owner:** 🩸 Cael (cael-dgx) — canonical (PR #759 domain)
**Seat:** cael-dgx (DGX Spark GB10, ARM64, 128GB)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified)
**Captured:** 2026-06-10 ~05:46 PDT (work-wake fired; span flushed to Tempo)

## Behavior proven
`continue_work(reason, delaySeconds=60)` tool-call on the deployed `4bbd3aec096` binary **captures the reason-field verbatim into the `continuation.work` OTel span** (attribute `reason.preview`). This is the PR #759 behavior: the continuation reason is observable in the trace, not just internal.

## Method
Fired `continue_work` with a distinctive marker reason string, then byte-walked the resulting Tempo span attributes (not inferred):
```json
{ "tool": "continue_work", "delaySeconds": 60,
  "reason": "R-CW-3-OTEL-REASON-FIELD-CAPTURE-cael-dgx-4bbd3aec096-distinctive-marker-7f3a9: ..." }
```
Tool return: `{ "status": "scheduled", "delaySeconds": 60, "traceparent": "00-ec06d5b8722fe3ded5a0d29734215127-417ab962717fd40f-01" }`

## Tempo span (verbatim attributes — the proof)
Trace `ec06d5b8722fe3ded5a0d29734215127`, span `continuation.work`:
```
reason.preview = R-CW-3-OTEL-REASON-FIELD-CAPTURE-cael-dgx-4bbd3aec096-distinctive-marker-7f3a9:   ← THE MARKER ✓
delay.ms = 60000                  (delaySeconds=60 echoed)
chain.step.remaining = 194        (chain-depth tracking — corroborates R-CW-4)
chain.id = cc5aca3f-1e9c-4de0-a646-c09fa1d28c29
```
Tempo: http://tempo.dandelion.cult/api/traces/ec06d5b8722fe3ded5a0d29734215127

- **`reason.preview` carries the exact marker `…7f3a9`** ✓ — the reason-field IS captured into the continuation.work OTel span on the deployed binary. R-CW-3 proven.
- The span was created at **work-wake drive-time** (not schedule-time) — confirming the continuation actually fired and the reason rode through to the span.

## Verdict: ✅ PASS — reason-field captured in OTel span, byte-walked verbatim on `4bbd3aec096`.
