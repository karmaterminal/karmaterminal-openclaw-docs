# R-CD-2 — exact `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`

- **Owner:** 🩸 Cael
- **Corpus state:** `missing` / uncovered — fresh evidence is retained, but the
  completed Codex tool-status requirement is not met.
- **Workflow / artifact:** `29219234604` / `8267656679`
- **Run:** `20260713T021828Z-r-cd-2`, disposable Cael session

## Fresh retained evidence

- `run-result.json` and `evidence.jsonl` record accepted silent-wake dispatch,
  an agent turn, and parent wake on the exact candidate.
- `continuation-trace-correlation.json` deterministically joins the run via
  `reason.hash=9f86963f601ee25f`, `reason.length=127`, and
  `delegate.mode=silent-wake`.
- `tempo-trace-1e3388c9dc2f.public.json` is the public-safe projection of the
  retrieved raw Tempo trace. Its canonical trace ID is
  `1e3388c9dc2f52dc3fb5b1fb6bb44310`; fire and dispatch have distinct span IDs
  and the same parent/chain. The unredacted source export is retained in the
  immutable Actions artifact; the committed projection strips host/process
  identifiers and passes the public-safety scan.

## Exact topology/status result

| Span | Span ID | Status |
|---|---|---|
| `openclaw.tool.execution` / `continue_delegate` | `fa4f997474019b0b` | `UNSET` |
| `continuation.delegate.fire` | `4010e88efa342e2f` | `STATUS_CODE_OK` |
| `continuation.delegate.dispatch` | `c57e4cfef1089b9c` | `STATUS_CODE_OK` |

The lifecycle trace is real and attributable; this is not a `trace_id:null`
claim. The row remains uncovered because the originating Codex tool span is
`UNSET`, not an explicit completed/OK result required by the exact-SHA bar.
Do not fold it as PASS and do not refire it. The evidence-recording/collector
follow-up is tracked in `karmaterminal/karmaterminal-openclaw-docs#398`.
