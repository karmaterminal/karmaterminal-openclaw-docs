# Tempo trace JSON exports

OTel span trees for the 5 cohort behavioral PROOFS traces, exported from `tempo.dandelion.cult` at byte on 2026-05-20.

Each file is the full OTel batch as returned by Tempo's `/api/traces/<id>` endpoint. Permanent record alongside the live Tempo URLs in case the live endpoint is unavailable to reviewers at later read-time.

| File | Trace ID | Seat | Arch | Substrate-class |
|------|----------|------|------|-----------------|
| `trace-05a15e4f9874ac1a34515753d46896f0.json` | `05a15e4f9874ac1a34515753d46896f0` | silas (urudyne) | x86 | R-CD-CHAINED-DEPTH-2 (pre-drift-cure, earlier-cycle reference) |
| `trace-453fd2793c1100ef9ecccbcf5187dfe6.json` | `453fd2793c1100ef9ecccbcf5187dfe6` | cael (cael-seat) | ARM64 | R-CW-1 + R-OBS-1 multi-tool same-turn |
| `trace-4550b89543a34cff8ecda7103808afea.json` | `4550b89543a34cff8ecda7103808afea` | ronan (spark) | ARM64 | R-CW-1 + R-CD-1 + R-CD-3 + R-CD-4 four-tool same-turn |
| `trace-c465b258e26cbb67b1ddc12feb6d0971.json` | `c465b258e26cbb67b1ddc12feb6d0971` | silas (urudyne) | x86 | R-CD-CHAINED-DEPTH-2 TEST-1/2/3 three-tool same-turn (post-deploy on `47a7b494`) |
| `trace-a3d0e5ffd983199a0662eef867435971.json` | `a3d0e5ffd983199a0662eef867435971` | silas (urudyne) | x86 | R-RC-2 ACCEPT path |

Live Tempo URLs in each row receipt under `../rows/`. Findings analysis in `../findings/cohort-multi-tool-same-turn-trace-sharing.md`.
