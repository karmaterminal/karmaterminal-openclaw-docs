# PROOFS / e08f696618da57e7267a2148578fa4ab0d8b0d01

Live Project 81 proof corpus for the fresh assembly/backmerge candidate `e08f696618da57e7267a2148578fa4ab0d8b0d01` (`OpenClaw 2026.6.11`). This is the first full live fire of the upgraded k6 proof methodology against the proof-presentation SHA.

## Why this corpus is different

Prior proof rounds were largely hand-driven: a prince fired one row, described the result, and another seat had to reconcile prose, logs, and traces after the fact. This run upgrades the method. The Project 81 k6 harness submits known row-shaped traffic over the Gateway WebSocket/API, preserves per-row artifacts, and makes the submit pattern identifiable in logs/Grafana as `web` proof traffic distinct from Discord/channel traffic. That means the row, run, seat, and artifact root can be traced without treating proof gather as vibes.

This corpus therefore preserves both the evidence and the method friction. A PASS-candidate row is still reviewed before canonical fold, and a partial/honest-limit row is not hidden just because the harness continued to the next row.

## Scope

- **Candidate SHA:** `e08f696618da57e7267a2148578fa4ab0d8b0d01`
- **Deploy/proof seats:** Cael and Ronan only
- **Cael artifact roots:** `/tmp/p81-cael-live-*` chunks copied into `artifacts/cael/`
- **Ronan artifact root:** `/tmp/p81-ronan-live-e08f696-20260709T032347Z` copied into `artifacts/ronan/`
- **Rollup:** `35 total / 34 pass / 0 partial / 1 honest_limit / 0 fail / 0 missing`

## Manual closeout after first merge

After the first `e08f696` corpus merge, figs asked whether the non-`request_compaction` partial/honest rows could be manually addressed. Three rows were upgraded by adding manual receipts while preserving the original k6 artifacts and issue links:

- `R-CONFIG-DEFAULTS`: path-scoped Cael/Ronan config receipts under `R-CONFIG-DEFAULTS/manual-receipts/` supply the required continuation defaults bytes.
- `R-CONFIG-INTERSESSION`: path-scoped Cael/Ronan config receipts under `R-CONFIG-INTERSESSION/manual-receipts/` supply `crossSessionTargeting=enabled`.
- `R-CW-3`: Ronan's successful schedule/wake row plus manual Tempo trace review under `R-CW-3/manual-receipts/` supplies the missing reason telemetry/redaction receipt; raw reason sentinel strings are absent from the saved trace JSON.
- `R-CD-MODEL-TOOL`: fresh Cael rerun with `OPENCLAW_ALT_MODEL=github-copilot/gemini-3.1-pro-preview` supplies the child runtime model byte/return payload under `R-CD-MODEL-TOOL/manual-receipts/`.

`R-CD-MODEL-TOOL` was subsequently upgraded by a fresh Cael rerun using known-good `github-copilot/gemini-3.1-pro-preview`; the child runtime model byte matched the requested model. Original partial artifacts remain preserved as method friction.

## Critical caveats

- `R-RC-2` remains **not** folded as clean PASS here. The generated result marked it PASS, but Cael's live evidence/logs emitted `HONEST-LIMIT-candidate`; this mismatch is tracked in karmaterminal/karmaterminal-openclaw-docs#373.
- The first Cael `R-CD-4` unattended all-run exposed that live `all` needs `OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true`; resumed rows used that workaround and the tooling issue is tracked in karmaterminal/karmaterminal-openclaw-docs#366.
- Disposable proof-session cleanup is a follow-up method improvement, tracked in karmaterminal/karmaterminal-openclaw-docs#374. The Grafana `web` heartbeat screenshot is preserved under `artifacts/grafana/`.

## Navigation

- `proofs-manifest.json` — machine-readable row rollup and issue links
- `ARTIFACTS.md` — copied artifact roots and report pointers
- `METHOD.md` — live k6 proof methodology note
- `<ROW>/EVIDENCE.md` — row-level evidence index into the copied artifacts
