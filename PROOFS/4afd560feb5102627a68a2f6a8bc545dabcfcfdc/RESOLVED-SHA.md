# Resolved SHA — 4afd560feb5102627a68a2f6a8bc545dabcfcfdc

## Identity

- Assembly branch: `scribe/20260709/1172-status-row-assembly`
- Exact SHA: `4afd560feb5102627a68a2f6a8bc545dabcfcfdc`
- Build: `OpenClaw 2026.7.2 (4afd560)`
- Parent candidate: `a1778c94732a25292b4223736fa995b5cd42fe78`
- Absorbed upstream: `d287c9b414a03f665ea86016fd018b416ef07e94`
- Trace repair issue: `karmaterminal/openclaw#1176`

## Gate receipts

| Gate | Receipt | Seed-time state |
|---|---|---:|
| SDK surface + focused tests + build | local absorb lane | PASS (`637/637`; declarations `5,126,065/5,130,000`) |
| Independent merged-candidate review | review lane | PASS |
| Gate 2.7 | `29208589897` | PASS |
| Focused remote CI | `29208590635` | PASS |

Per figs's cut instruction, this absorb does not run the full sharded CI suite.
The initial e78 contained run `29208230670` caught the stale declaration
ceiling before test execution; `4afd560` is the repaired and recertified exact
candidate.

## Deployment receipts

| Seat | Deploy run | Active commit | Restarts |
|---|---:|---|---:|
| Silas | `29209001708` | `4afd560feb5102627a68a2f6a8bc545dabcfcfdc` | `0` |
| Elliott | `29209002624` | `4afd560feb5102627a68a2f6a8bc545dabcfcfdc` | `0` |
| Cael | `29209003469` | `4afd560feb5102627a68a2f6a8bc545dabcfcfdc` | `0` |
| Ronan | `29209004344` | `4afd560feb5102627a68a2f6a8bc545dabcfcfdc` | `0` |

Figs directed one four-seat fleet deployment after the contained gates pass;
there was no canary/pilot phase for this cut. All four workflows completed with
the gateway active on the exact commit and zero service-lifetime restarts.
