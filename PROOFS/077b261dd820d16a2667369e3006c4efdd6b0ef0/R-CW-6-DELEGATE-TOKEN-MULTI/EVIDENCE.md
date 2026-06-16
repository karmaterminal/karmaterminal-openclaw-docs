# EVIDENCE — R-CW-6-DELEGATE-TOKEN-MULTI

**SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` · **Seat**: rune (host.name=rune, host.arch=amd64) · **Verdict**: PASS

## Tempo trace (high-quality receipt)
- File: `trace-617db114.json` (43967 bytes, pulled `curl tempo.dandelion.cult/api/traces/617db11404dd0b9bde49fd76b4f109c7`)
- 36 spans, all `host.name=rune` — confirms execution on the deployed rune-seat
- Span tree includes `openclaw.harness.run` → `openclaw.run` → `openclaw.model.call` → `openclaw.tool.execution` (the continue_work tool-fires)

## Dispatch bytes (both continue_work captured in one turn)
| Request | delaySeconds | status | traceparent |
|---------|-------------|--------|-------------|
| 1/2 | 8 | scheduled | 00-617db11404dd0b9bde49fd76b4f109c7-ca758056d1ebb765-01 |
| 2/2 | 12 | scheduled | 00-617db11404dd0b9bde49fd76b4f109c7-ca758056d1ebb765-01 |

## What it proves
The #952/#982/#985 multi-`continue_work()` capture cure is LIVE on `077b261dd8`: both requests fired in a single turn returned `status: scheduled` — request 2 (delay 12) was NOT silently dropped (the pre-cure `[0]`-truncation bug). Both share the turn's trace, confirming both captured into the same request-array on one generation cycle.
