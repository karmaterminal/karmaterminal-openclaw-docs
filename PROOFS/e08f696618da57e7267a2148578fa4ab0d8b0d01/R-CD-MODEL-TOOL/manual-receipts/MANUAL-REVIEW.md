# Manual review — R-CD-MODEL-TOOL

The first e08 live run used `github-copilot/claude-sonnet-4.6`, which did not yield the required child model byte/return payload. figs clarified the intended known-good alternate model for this row is `github-copilot/gemini-3.1-pro-preview`.

A fresh Cael live run used:

- `OPENCLAW_ALT_MODEL=github-copilot/gemini-3.1-pro-preview`
- `OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true`
- row `R-CD-MODEL-TOOL`

Artifact root copied into corpus:

- `artifacts/cael/p81-cael-model-tool-gemini-20260709T042513Z/`

Manual receipts:

- `cael-gemini-model-tool-evidence.json`
- `cael-gemini-model-tool-review.json`

The k6 log evidence object proves:

- parent dispatch accepted;
- parent scheduled sentinel observed;
- child session observed;
- requested model byte = `github-copilot/gemini-3.1-pro-preview`;
- child runtime model byte = `github-copilot/gemini-3.1-pro-preview`;
- model bytes match;
- return payload observed;
- child task omitted the requested model, preventing echo-based false PASS.

The generated `run-result.json` / summary still say `PARTIAL-candidate` because the postprocessor did not extract the evidence JSON line from this scenario's k6 log. The preserved console verdict says `PASS-candidate`, and the manual extracted evidence/review JSON supplies the row receipt. The aggregate row is upgraded to `pass`; the original partial artifacts and #367 remain preserved as method friction.
