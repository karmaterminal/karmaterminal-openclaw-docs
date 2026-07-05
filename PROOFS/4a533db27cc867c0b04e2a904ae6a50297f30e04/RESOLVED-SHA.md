# Resolved SHA — 4a533db27cc867c0b04e2a904ae6a50297f30e04

This full copied corpus is transposed from the Cael live-fire corpus at
`bca2b0b89ab886bf23a10e4983926f6b374b3188` after the safe assembly candidate advanced to
`4a533db27cc867c0b04e2a904ae6a50297f30e04`.

| Check | Receipt |
|---|---|
| Safe branch | `scribe/20260704/assembly-upstream-drift-backmerge` |
| Candidate SHA | `4a533db27cc867c0b04e2a904ae6a50297f30e04` |
| Carried-from live-fire SHA | `bca2b0b89ab886bf23a10e4983926f6b374b3188` |
| Build string | `OpenClaw 2026.6.11 (4a533db)` transposed from `OpenClaw 2026.6.11 (bca2b0b)` live-fire receipts |
| Review-only PR | `karmaterminal/openclaw#1163` |
| Local targeted validation | Upstream/main passes `plugin-sdk-surface-report.test.ts`; `4a533db` passes the exact failed test and `scripts/plugin-sdk-surface-report.mjs --check` after the wildcard budget-pin correction |
| GATES frozen wall | `drift-cure-gate.sh upstream/main HEAD 9a7092649eb25d6e70937267b0879f8e3d0c4e51` exited 0 with no `FROZEN-STALE`; logs in `gates/` |
| Corpus shape | Full copied row corpus under this exact SHA; no symlink/link-only proof indirection |
| Cael deploy/live-fire source | `karmaterminal/openclaw-bootstrap/actions/runs/28699830297` on carried-from `bca2b0b89ab886bf23a10e4983926f6b374b3188` |
