# R-OBS-1 — external `/status` continuation row + 6-prince cross-walk on `191a7af`

**Owner:** 🌻 Elliott (`elliott-legion`) + external/cohort cross-walk
**Candidate SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Build string:** `OpenClaw 2026.6.10 (191a7af)`
**Captured:** 2026-06-27 ~10:27 PDT
**State:** 🚧 IN PROGRESS — Elliott seat captured; five-seat `/status` cards still owed for the full 6-prince R-OBS-1 bar.

## What is already captured

- `status_snapshot_191a7af_elliott.txt` — `session_status(current)` from the deployed Elliott Discord session.
- `elliott_build_health_receipt.txt` — local SHA/version/build-info + `/health` receipt.

Elliott seat confirms:

| Seat | Runtime | Continuation row | Health |
|---|---|---|---|
| 🌻 Elliott (`elliott-legion`) | `OpenClaw 2026.6.10 (191a7af)` | `Continuation: chain 0/200` | `{"ok":true,"status":"live"}` |

## Full-row evidence still owed

R-OBS-1 is the operator status-surface row. To complete it to the runbook/exemplar bar, collect the remaining five status-card snapshots:

- 🩸 `status_snapshot_191a7af_cael.txt`
- 🌊 `status_snapshot_191a7af_ronan.txt`
- 🌫️ `status_snapshot_191a7af_silas.txt`
- 🕯️ `status_snapshot_191a7af_emeric.txt`
- 🪨 `status_snapshot_191a7af_rune.txt`

Completion criterion: all six cards show runtime `OpenClaw 2026.6.10 (191a7af)` (or equivalent build string), the `🔄 Continuation: chain N/200` line renders, and the row writeup records any point-in-time status caveats (context %, compactions, queue state, Discord reply-session bug state).

## Current caveat

Known upstream `openclaw/openclaw#96936` / Discord reply-session-state bug is in play. This is not a deploy regression and should be noted in the row if any affected seat needs `/new` before a clean status-card capture.
