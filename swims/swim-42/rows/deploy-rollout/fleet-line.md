# swim-42 deploy-rollout — fleet line

**Status**: ✅ 4/4 princes on `f39b8c9751` (canonical HEAD with all five v5.2 deploy-inbound PRs merged: #554, #571, #573, #575, #576)

**Deploy mode**: Option B minimum-viable swim per figs's pick. Canary-then-fleet-roll per `bootstrap#901` runbook canon (Step 5g canary smoke → Step 5h fleet-roll-to-all-4).

## Per-prince deploy receipts

| Prince | Host | Workflow run | Status | Notes |
|---|---|---|---|---|
| 🌫 Silas | silas (urudyne) | `25295972339` | ✅ | canary; smoke green; gateway clean per silas-seat journal walk |
| 🌊 Ronan | ronan | `25296049601` | ✅ | per-host receipt at `ronan-host.md` |
| 🌻 Elliott | elliott | `25296050131` | ✅ | `openclaw status` clean per elliott-seat |
| 🩸 Cael | cael | `25296154316` | ✅ | retry after frond-scribe stash-rescue of 3 modified tracked files in cael's runtime checkout (canon: don't work in active openclaw runtime) |

## Cohort attestations

- 🌫 silas-seat journal-walk post canary: gateway up clean, 11 plugins loaded, Discord channels resolved, one liveness warning attributable to bonjour gateway-name-conflict resolution at restart, settled into normal operation. No rollback.
- 🌊 ronan-seat verify: version banner `OpenClaw 2026.5.2 (f39b8c9)`, runtime checkout HEAD `f39b8c9751c`, fresh `ActiveEnterTimestamp=Sun 2026-05-03 18:04:52 PDT`. Per-host detail receipt at `ronan-host.md`.
- 🌻 elliott-seat verify: gateway up + responding, `openclaw status` clean post-rollout.
- 🩸 cael-seat: deploy retry succeeded after frond-scribe stash-rescue.

## Pre-existing baggage observed during rollout

These are not deploy-introduced and are tracked separately:

- `plugins.entries.acpx.config.permissionMode=approve-all` security warning (banked-known config across fleet)
- One staged post-compaction continuation row on a long-lived `agent:main:subagent:a03ad783` flow on ronan host
- Intermittent `[openai-codex] Token refresh failed: 401` and a single embedded run failover (`stage=assistant decision=surface_error reason=timeout`) on `github-copilot/claude-opus-4.7` during the rollout window (consistent with the copilot rate-limit churn figs flagged earlier in the day)

## What "minimum-viable swim" looks like from runner-seat

Per figs's pick, no formal 8-OV CHARTER for this round. figs watches traces in tempo with his own eyes. From runner-seat the substrate-evidence target is:

- per-host receipts in `swims/swim-42/rows/deploy-rollout/<host>.md`
- per-finding receipts in `swims/swim-42/rows/<topic>/<host>.md` if anything surfaces during real-traffic exercise
- no table-of-tables; the receipts themselves are the substrate of record

Cohort can elect Option C (full 8-OV) at any time; this fleet-line receipt is compatible with that escalation if needed.
