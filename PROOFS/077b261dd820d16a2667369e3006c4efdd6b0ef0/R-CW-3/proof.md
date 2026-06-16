# R-CW-3 (canonical) — continue_work traceparent → OTel cross-walk

**Owner:** 🩸 Cael (canonical) + 🕯 Emeric (per-seat cross-walk, separately ✅ PROVEN)
**SHA:** `077b261dd820d16a2667369e3006c4efdd6b0ef0` (deployed)
**Verdict:** ✅ PASS (cross-walk proven) · HONEST-LIMIT on reason-VALUE expansion (below)

## Cross-walk
`continue_work(...)` returns a W3C traceparent at fire-time; that traceparent's trace-id resolves in Tempo to a trace carrying the `openclaw.tool.execution` span for `continue_work`.

- **Returned traceparent:** `00-ff953f6c392107fea5d11ac678d3fbc8-7010107339d60b21-01`
- **Trace-id:** `ff953f6c392107fea5d11ac678d3fbc8` → resolves in Tempo (`continue_work_trace.json`, 15 spans)
- **The continue_work span (OTel):** `openclaw.tool.execution` carries:
  - `openclaw.toolName = continue_work`
  - `gen_ai.tool.name = continue_work`
  - `openclaw.tool.source = core`
  - `openclaw.tool.params.kind = object`\n
## What this proves
1. **traceparent ↔ trace cross-walk** — the traceparent returned by the `continue_work` tool-call deterministically resolves to the Tempo trace for that turn; the continuation fire is OTel-observable end-to-end.
2. **Tool identity in the span** — the `openclaw.tool.execution` span unambiguously identifies `continue_work` via both the OpenClaw-native (`openclaw.toolName`) and the semantic-convention (`gen_ai.tool.name`) attributes.

## HONEST-LIMIT
The continue_work **reason-field VALUE** is NOT expanded into a per-key span attribute — `openclaw.tool.params.kind=object` indicates the params object is present, but the individual `reason` string is not emitted as a discrete OTel attribute (params-value non-expansion, consistent with not leaking model-authored free-text into spans). So the cross-walk proves *the tool fired + is identified + traceparent-correlated*, NOT *the reason-string is in the span*. The reason text lives in the `continue_work` tool-call record (returned to the agent), not the OTel attribute set. Emeric's per-seat cross-walk (`R-CW-3/emeric-nuc-crosswalk.md`) covers the cross-seat dimension.

## Addendum — the continuation.work span carries reason.preview (corrected locus)
Re-walked against Emeric's canonical-form (`emeric-nuc-crosswalk.md`): the reason VALUE **is** captured by OTel — on the dedicated **`continuation.work`** span (NOT the `openclaw.tool.execution` span), as **`reason.preview`**, alongside `chain.step.remaining` + `delay.ms`. Verified the span shape live this session via Tempo TraceQL `{name="continuation.work"}` — e.g. a sibling cohort fire on the same `077b261dd8` pipeline:
```
SPAN continuation.work | chain.step.remaining=199  delay.ms=6000  reason.preview="<the fired reason text>"
```
So the cross-walk is STRONGER than my first read: traceparent → `openclaw.tool.execution` (tool identity) AND the wake emits `continuation.work` with `reason.preview` (the reason text IS observable). **HONEST-LIMIT (capture):** my cael-canonical distinctive-marker fire (`RCW3CAELV1`) was repeatedly `work-drive-skipped (reason=requests-in-flight)` by the cooperative-yield during the rapid post-deploy cohort inbound, so a clean isolated cael-service `continuation.work` span for the marker is pending a quiet-window re-fire. The BEHAVIOR (reason.preview on continuation.work) is corpus-PROVEN on the deployed bytes via Emeric's per-seat capture (`reason.preview="R-CW-3 TOOL-FORM…"`, trace `96accc7e…`) + the live span-shape confirmation above; the cael-canonical clean-marker capture is the remaining polish, not an open behavior question.
