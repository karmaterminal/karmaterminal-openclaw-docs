# RESOLVED-SHA — 191a7af989a637f435016fd8d72627fc47fae0e0

**Short**: `191a7af989a6`

**Branch**: `karmaterminal/openclaw:frond-scribe/20260624/assembly-continuation-followons`

## What this SHA is

`191a7af989a637f435016fd8d72627fc47fae0e0` is the deployed assembly branch tip after:

- #1095 iMessage serial-order isolation fix,
- #1094 `continue_delegate` return-target/model default handling fix,
- #1102 Matrix session-store fixture preservation fix,
- repeated upstream back-merges through `upstream/main@b8e3de11608d12354b17cadd3703b3823b055a24`.

## Gate verdicts

| Gate | Verdict |
|---|---|
| Hosted drift gate `28294844687` | PASS: `FROZEN-STALE=0`, `MIXED-CLOBBER=0`, total 317 |
| `openclaw-local-ci` `28294845382` | PASS: 85,062 tests passed / 0 failed |
| Focused local validation | PASS: Gate 2.7, core `tsgo`, #1094/#1095/Matrix/Telegram focused tests |

## Deploy state

All six prince gateways were deployed and verified on `191a7af989`:

| Prince | Runtime byte |
|---|---|
| Cael | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |
| Ronan | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |
| Silas | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |
| Elliott | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |
| Emeric | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |
| Rune | build-info commit `191a7af989a637f435016fd8d72627fc47fae0e0`, `/health` live |

## Known caveats

- Upstream moved after this green SHA. Per figs, later drift is post-proof incidental unless it touches continuation feature surface; if it does, rerun proofs after GATES.
- Discord reply-session conflict remains an upstream open bug (`openclaw/openclaw#96936`) and is not treated as a `191a7af989` deploy regression.
