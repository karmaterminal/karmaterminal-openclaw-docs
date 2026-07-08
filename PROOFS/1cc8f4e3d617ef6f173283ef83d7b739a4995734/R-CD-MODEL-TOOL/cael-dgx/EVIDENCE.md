# R-CD-MODEL-TOOL — k6 live candidate receipt (Cael)

**SHA:** `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
**Seat:** Cael / `cael-dgx`
**Verdict:** ⚠️ HONEST-LIMIT-candidate — model override refused by current agent allowlist; not a PASS row
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

This was initially packaged as a live PARTIAL-candidate receipt, not a PASS claim. Targeted post-run review found the concrete blocker: the requested model override was rejected by agent allowlisting before a child model byte could exist. The row is therefore folded as HONEST-LIMIT-candidate, with the original k6 artifacts plus the narrowed model-not-allowed diagnosis preserved for review.

Disposition update (2026-07-08): targeted session/DB review found this was not merely an observer-window miss. The delegate flow spawned a subagent, but the child failed before producing `MODEL-TOOL-CHILD` because model override `github-copilot/claude-sonnet-4.6` is not allowed for agent `main`. Keep this row as HONEST-LIMIT until the allowed-model/runtime override contract changes or a permitted alternate model proves the path. See `model-not-allowed-diagnosis/`.

## Model-not-allowed diagnosis

- `model-not-allowed-diagnosis/README.md`
- `model-not-allowed-diagnosis/flow-runs-model-not-allowed.json`
- `model-not-allowed-diagnosis/subagent-runs-model-not-allowed.json`
- `model-not-allowed-diagnosis/task-runs-model-not-allowed.json`
