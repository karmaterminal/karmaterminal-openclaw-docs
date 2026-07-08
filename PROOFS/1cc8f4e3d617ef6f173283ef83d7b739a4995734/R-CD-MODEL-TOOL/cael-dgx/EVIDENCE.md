# R-CD-MODEL-TOOL — k6 live candidate receipt (Cael)

**SHA:** `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
**Seat:** Cael / `cael-dgx`
**Verdict:** ⚠️ PARTIAL-candidate — not a PASS row
**Runtime stamp:** `OpenClaw 2026.6.11 (1cc8f4e)`
**Docs runner head:** `29a7479b13810ac36a48455d221091573caf8be6`

## Byte

- k6 exit code: `99`
- runner started at: `2026-07-08T13:56:14Z`
- nonce: `R-CD-MODEL-TOOL-1783518974297-n5ete2li`
- disposable session: `agent:main:r-cd-model-tool-r-cd-model-tool-1783518974297-n5ete2li`
- `dispatch_accepted`: `True`
- `session_created`: `True`
- `requested_model_byte`: `github-copilot/claude-sonnet-4.6`
- `model_matches`: `False`
- `return_payload`: `False`
- emitted trace id: `null` / not emitted by the scenario receipt

## Artifacts

- `run-result.json`
- `runner-metadata.json`
- `row-manifest.json`
- `seat-readiness.json`
- `evidence-summary.json`
- `evidence.jsonl`
- `evidence-lines.log`
- `metrics-export.json`
- `openclaw-proofs-k6.prom`
- `openclaw-proofs-k6.otlp.json`
- `evidence-summary.json`
- `r-cd-model-tool-summary.json`
- `k6/k6.log`

## Review note

This is a live PARTIAL-candidate receipt, not a PASS claim. It reduces fold burden by preserving k6 output, summarized evidence bytes, seat readiness, metrics, and trace-search breadcrumbs. Human/corpus review should decide whether this row is sufficient without Tempo JSON, or whether the scenario should emit a stronger trace identifier in a follow-up.

Partial reason: parent scheduled typed `continue_delegate(model="github-copilot/claude-sonnet-4.6")`, but the k6 observer did not see child session/model/return payload inside the 180s window. Keep this row separate from the five clean PASS-candidates until the observer or trace path is reviewed.
