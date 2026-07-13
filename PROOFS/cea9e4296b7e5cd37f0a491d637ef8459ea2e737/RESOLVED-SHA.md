# Resolved SHA — cea9e4296b7e5cd37f0a491d637ef8459ea2e737

## Identity

- Assembly branch: `scribe/20260712/1172-a177-upstream-absorb`
- Exact SHA: `cea9e4296b7e5cd37f0a491d637ef8459ea2e737`
- Build: `OpenClaw 2026.7.2 (cea9e42)`
- Parent candidate: `2e7861ba45fd8534282aadabab2b855d2f524fdf`
- Absorbed upstream: `d287c9b414a03f665ea86016fd018b416ef07e94`
- Continuation repair: `karmaterminal/openclaw#1108`
- Assembly repair PR: `karmaterminal/openclaw#1179`
- Result-classification repair: `scribe/20260713/1172-codex-result-classification`

## Gate receipts

| Gate | Receipt | Seed-time state |
|---|---|---:|
| Independent exact-diff review | review lane | PASS |
| Focused remote CI | `29218008324` | PASS (`124/124`; core/all-test typechecks; full lint/format) |
| Gate 2.7 | `29218008174` | PASS (`FROZEN-STALE=0`) |

Per figs's contained-blast-radius instruction, this repair does not run the
full sharded CI suite. The first contained invocation did not collect tests
because it named obsolete config paths. The corrected run exposed only a
request-boundary cold-start timeout; test-only follow-up `cea9e42` widened the
existing bounded wait and passed the exact production path remotely.

## Deployment receipts

| Seat | Deploy run | Active commit | Restarts |
|---|---:|---|---:|
| Silas | `29218759572` | `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` | `0` |
| Elliott | `29218757090` | `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` | `0` |
| Cael | `29218759980` | `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` | `0` |
| Ronan | `29218701617` | `cea9e4296b7e5cd37f0a491d637ef8459ea2e737` | `0` |

Figs directed one four-seat fleet deployment after the contained gates pass;
there was no canary/pilot phase for this repair. All four workflows completed
with the gateway active on the exact commit and zero service-lifetime restarts.

## Fresh continuation proof receipts

| Row | Seat | Workflow / artifact | Outcome | Trace |
|---|---|---|---|---|
| R-CD-1 | Silas | `29219185714` / `8267627685` | typed delegate accepted, scheduled, returned; `PASS-candidate` / exit `0` | `ea920a5ed49ca9040345968e8703754f` |
| R-CW-1 | Silas | `29219185714` / `8267627685` | typed work accepted, scheduled, successor wake; `PASS-candidate` / exit `0` | `7ee6322b39875ac81d29dc590bc739b0` |

Both traces are raw public-safe Tempo JSON in their row directories with separate
correlation receipts that prove same-trace, distinct continuation/tool-fire spans.
The generic typed-tool scenarios did not invoke the Codex app-server surface;
OpenClaw harness/run outcomes are completed and artifact scans contain no
`codex_dynamic_tool_error`.

### Journal-side condition

The two exact Silas proof windows also contain active-memory embedded-agent
timeout/unavailable logs and `openclaw-trajectory-flush` foreign-key cleanup
failures. Per-row journal cross-checks distinguish those errors from the proved
continuation receipts; repair tracking is `karmaterminal/openclaw#1181`.
