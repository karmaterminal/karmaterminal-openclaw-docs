# Resolved SHA — 2e7861ba45fd8534282aadabab2b855d2f524fdf

## Identity

- Assembly branch: `scribe/20260712/1172-a177-upstream-absorb`
- Exact SHA: `2e7861ba45fd8534282aadabab2b855d2f524fdf`
- Build: `OpenClaw 2026.7.2 (2e7861b)`
- Parent candidate: `4afd560feb5102627a68a2f6a8bc545dabcfcfdc`
- Absorbed upstream: `d287c9b414a03f665ea86016fd018b416ef07e94`
- Continuation repair: `karmaterminal/openclaw#1108`
- Assembly repair PR: `karmaterminal/openclaw#1179`

## Gate receipts

| Gate | Receipt | Seed-time state |
|---|---|---:|
| Independent exact-diff review | review lane | PASS |
| Focused remote CI | `29213551090` | PASS (`144/144`; `tsgo:core`) |
| Gate 2.7 | `29213550300` | PASS |

Per figs's contained-blast-radius instruction, this repair does not run the
full sharded CI suite. The PR's deadcode/session-accessor failures are
baseline-class: the reported files, `package.json`, and `pnpm-lock.yaml` are
byte-identical to parent `4afd560`.

## Deployment receipts

| Seat | Deploy run | Active commit | Restarts |
|---|---:|---|---:|
| Silas | `29213966416` | `2e7861ba45fd8534282aadabab2b855d2f524fdf` | `0` |
| Elliott | `29213969365` | `2e7861ba45fd8534282aadabab2b855d2f524fdf` | `0` |
| Cael | `29213971446` | `2e7861ba45fd8534282aadabab2b855d2f524fdf` | `0` |
| Ronan | `29213909729` | `2e7861ba45fd8534282aadabab2b855d2f524fdf` | `0` |

Figs directed one four-seat fleet deployment after the contained gates pass;
there was no canary/pilot phase for this repair. All four workflows completed
with the gateway active on the exact commit and zero service-lifetime restarts.
