# R-CD-MODEL-DEFAULT — Emeric substitution default-inheritance receipt

- Corpus SHA: `191a7af989a637f435016fd8d72627fc47fae0e0`
- Seat: `emeric-nuc`
- Canonical row owner: Ronan (`ronan-dgx`)
- Substitution scope: Emeric provides a tool-form default-inheritance receipt only. This does not claim Ronan-local artifacts or final ownership.
- Fired: `2026-06-27 11:23:16 PDT`
- Surface: `continue_delegate` tool form with no alternate model override (`model=default` / none).
- Nonce: `R-CD-MODEL-DEFAULT-TOOL-emeric-191a7af-1782584541`
- Observed child model: `github-copilot/gpt-5.5`
- Expected default model for this runtime: `github-copilot/gpt-5.5`
- Tempo trace ID: `00000000000000000000000000000012`
- Tempo JSON: `tool-default-trace-00000000000000000000000000000012.json`
- Raw receipt: `tool-default-receipt.json`

## Result

PASS-candidate for the default-inheritance contrast on the Emeric substitution seat: no alternate model override was requested, and the child reported the runtime default model `github-copilot/gpt-5.5`.

This evidence is intentionally separate from the alternate-model rows (`R-CD-MODEL-TOOL`, `R-CD-MODEL-TOKEN`, `R-CD-MODEL-CHAINED-ALT`), which remain honest-limited around `karmaterminal/openclaw#1103` because requested alternate `github-copilot/goldeneye` can be accepted/applied-looking while the child reports the default model.
