# R-CW-1 — exact-cea9e42 Silas typed-work proof

- **Owner / firing seat:** 🌫 Silas / `silas`
- **State:** `pass` for the assigned typed-tool row. The separate token/bracket
  counterpart is `R-CW-TOKEN`, assigned and fired independently.
- **Exact runtime SHA:** `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- **Workflow run / artifact:** `29219185714` / `8267627685`
- **Execution:** disposable session; one typed `continue_work()` fire only.

## Raw receipts

- `silas/20260713T021744Z-r-cw-1/run-result.json` — `k6ExitCode=0`,
  `postprocessExitCode=0`, `PASS-candidate`; tool invocation accepted, explicit
  scheduled result observed, then a real successor wake.
- `silas/20260713T021744Z-r-cw-1/evidence.jsonl` — public-safe harness evidence.
- `silas/20260713T021744Z-r-cw-1/r-cw-1-tool-schedule-wake-summary.json` —
  60,028 ms, zero k6 failures; recorded wake delay 13,060 ms.

## Tempo correlation and topology

- Trace: `7ee6322b39875ac81d29dc590bc739b0` (valid non-zero 32-hex ID).
- `silas/20260713T021744Z-r-cw-1/tempo-trace-7ee6322b3987.json` — raw
  public-safe Tempo export.
- `silas/20260713T021744Z-r-cw-1/continuation-trace-correlation.json` — safe
  reason-hash/length attribution; one trace; distinct valid non-zero work span
  `668fb69252a9015d` and delayed work-fire span `3793bba8db060ab4`, with
  `sameTrace=true` and `distinctSpans=true`.

The collector recovered the trace from safe reason-hash/length attribution
rather than the scenario's null inline `trace_id`; no time-window-only match is
being used. This generic typed-tool scenario did not invoke the Codex app-server
surface; the actual OpenClaw harness/run outcomes are completed and the work /
work-fire spans have `STATUS_CODE_OK`. Artifact scan found no
`codex_dynamic_tool_error`.
