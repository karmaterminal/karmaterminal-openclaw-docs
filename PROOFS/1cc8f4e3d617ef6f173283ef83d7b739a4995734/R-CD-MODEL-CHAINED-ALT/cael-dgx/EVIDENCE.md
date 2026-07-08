# R-CD-MODEL-CHAINED-ALT — k6 live candidate receipt (Cael)

**SHA:** `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
**Seat:** Cael / `cael-dgx`
**Verdict:** ✅ PASS-candidate pending human fold review
**Runtime stamp:** `OpenClaw 2026.6.11 (1cc8f4e)`
**Docs runner head:** `29a7479b13810ac36a48455d221091573caf8be6`

## Byte

- k6 exit code: `0`
- runner started at: `2026-07-08T13:55:14Z`
- nonce: `R-CD-MODEL-CHAINED-ALT-1783518914148-5ezd9bpg`
- disposable session: `agent:main:r-cd-model-chain-r-cd-model-chained-alt-1783518914148-5ezd9bpg`
- `dispatch_accepted`: `True`
- `session_created`: `True`
- `depth_1_child_observed`: `True`
- `depth_2_child_observed`: `True`
- `requested_model_byte`: `gpt`
- `model_matches`: `True`
- `return_payload`: `True`
- emitted trace id: `null` / not emitted by the scenario receipt
- Tempo breadcrumb search: window `1783518854`–`1783519214`, candidates `46`, nonce matches `0`
- Trace obtain disposition: no matching Tempo trace JSON found by emitted nonce; retain nonce/session/timestamp breadcrumbs for manual search if review wants deeper trace correlation.

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
- `r-cd-model-chained-alt-summary.json`
- `k6/k6.log`
- `tempo/trace-search-receipt.json`
- `tempo/candidate-traces.txt`
- `tempo/matching-traces.txt`
- `tempo/search_start_*_limit_100.json`

## Review note

This is a live PASS-candidate receipt, not an autonomous final corpus claim. It reduces fold burden by preserving k6 output, summarized evidence bytes, seat readiness, metrics, and trace-search breadcrumbs. Human/corpus review should decide whether this row is sufficient without Tempo JSON, or whether the scenario should emit a stronger trace identifier in a follow-up.
