# R-CD-1 — exact-cea9e42 Silas typed-delegate proof

- **Owner / firing seat:** 🌫 Silas / `silas`
- **State:** `pass` (fresh exact-SHA live behavior, raw receipts and correlated Tempo
  topology reviewed)
- **Exact runtime SHA:** `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- **Workflow run / artifact:** `29219185714` / `8267627685`
- **Execution:** disposable session; `continue_delegate(mode="normal")`; one fire
  only.

## Raw receipts

- `silas/20260713T021659Z-r-cd-1/run-result.json` — `k6ExitCode=0`,
  `postprocessExitCode=0`, `PASS-candidate`; typed invocation accepted, scheduled
  sentinel emitted, parent return and channel receipt observed.
- `silas/20260713T021659Z-r-cd-1/evidence.jsonl` — public-safe harness evidence.
- `silas/20260713T021659Z-r-cd-1/r-cd-1-typed-delegate-summary.json` — 43,863 ms,
  zero k6 failures.

## Tempo correlation and topology

- Trace: `ea920a5ed49ca9040345968e8703754f` (valid non-zero 32-hex ID).
- `silas/20260713T021659Z-r-cd-1/tempo-trace-ea920a5ed49c.json` — raw public-safe
  Tempo export.
- `silas/20260713T021659Z-r-cd-1/continuation-trace-correlation.json` —
  reason-hash/length/mode attribution; one trace; distinct valid non-zero
  dispatch span `3f54d7cd7389807d` and delayed-fire span `ec9040e70eab6bf2`.
  Both sit under parent `26619d40bffcd256`, with `sameTrace=true` and
  `distinctSpans=true`.

The collector recovered the trace from safe reason-hash/length/mode attribution
rather than the scenario's null inline `trace_id`; no time-window-only match is
being used. This generic typed-tool scenario did not invoke the Codex app-server
surface; its actual OpenClaw harness/run outcomes are completed and the
continuation dispatch/fire spans have `STATUS_CODE_OK`. Artifact scan found no
`codex_dynamic_tool_error`.

## Gateway journal cross-check

The retained `JOURNAL-OBSERVATIONS.md` records the exact session-side continuation
lines and the separate active-memory degradation observed in the same time window.
The latter is filed as `karmaterminal/openclaw#1181`; it is not conflated with the
continuation outcome.

## Bounded gateway-journal receipt

This historical exact-run fold now includes the sanitizer-filtered `gateway-journal.log`
and accompanying `gateway-journal-capture.json` / `gateway-journal-redaction.json`.
Raw journal bytes were transient; the receipt package is the public-safe audit surface.
