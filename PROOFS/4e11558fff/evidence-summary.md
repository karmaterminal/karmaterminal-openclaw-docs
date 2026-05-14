# Proof Evidence Summary — SHA 4e11558fff

SUT: silas-canary (urudyne WSL2, RTX 3080 16GB)
Deployed SHA: 4e11558fff73a705192b54b74d32b7bc259ad3a9
PR: openclaw/openclaw#79925
CI: 92 pass / 0 fail / 7 skipping / 1 neutral (ALL GREEN)
Collected: 2026-05-13 20:45 PDT

## Proofs (all PASS)

| ID | Test | Result | Notes |
|---|---|---|---|
| R-CW-1 | `continue_work` schedule + wake | ✅ PASS | Traceparent: `2603fa8b62f96c61476c1a07a1480b09` |
| R-CD-1 | `continue_delegate` normal mode spawn + return | ✅ PASS | Delegate completed in 5s |
| R-CD-2 | `continue_delegate` silent mode (no channel announcement) | ✅ PASS | Delegate completed in 4s, no channel output |
| R-OBS-1 | `session_status` observability fields | ✅ PASS | Version: 2026.5.12-beta.1 (4e11558) |
| R-RC-1 | `request_compaction` gate-behavior | ✅ PASS | Rejected at 36% < 70% threshold |

## Artifacts

- `tempo-R-CW1-CD1-CD2-2603fa8b.json` — Tempo trace (continuation tools span topology)

## SHA Match

PR head SHA `4e11558fff` = deployed SHA = proof SHA. No delta-note needed.
