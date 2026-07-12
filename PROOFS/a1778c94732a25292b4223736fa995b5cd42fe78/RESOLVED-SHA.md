# Resolved SHA — a1778c94732a25292b4223736fa995b5cd42fe78

## Identity

- Assembly branch: `scribe/20260709/1172-status-row-assembly`
- Exact SHA: `a1778c94732a25292b4223736fa995b5cd42fe78`
- Build: `OpenClaw 2026.7.2 (a1778c9)`
- Parent candidate: `455a2bb75da2dab69ac599e2ecb465f612710eed`
- Trace repair issue: `karmaterminal/openclaw#1176`

## Gate receipts

| Gate | Receipt | Seed-time state |
|---|---|---:|
| Changed-surface tests | local/review lane | PASS (`597/597`) |
| Independent base-to-head review | review lane | PASS |
| Gate 2.7 | `29203372104` | PASS |
| Focused remote CI | `29203414924` | PASS |

The cancelled full-sharded run `29203371347` executed no tests and is neither a
green receipt nor a code failure.

## Deployment receipts

| Seat | Deploy run | Active commit | Restarts |
|---|---:|---|---:|
| Silas | `29203830604` | `a1778c94732a25292b4223736fa995b5cd42fe78` | `0` |
| Elliott | `29204323031` | `a1778c94732a25292b4223736fa995b5cd42fe78` | `0` |
| Cael | `29204600470` | `a1778c94732a25292b4223736fa995b5cd42fe78` | `0` |
| Ronan | `29204750394` | `a1778c94732a25292b4223736fa995b5cd42fe78` | `0` |

Silas readiness run `29204168252`, artifact `8263250009`, reported
`PASS-candidate` with k6 `v2.0.0`, gateway health/status reachable,
continuation enabled, and exact candidate identity.

No behavioral exact-SHA proof had fired when these deployment receipts were
folded.
