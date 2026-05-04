# swim-42 deploy-rollout receipt — ronan host

**Status**: ✅ post-deploy verified at version banner

## Deploy run

- workflow: `deploy-gateway`
- run id: `25296049601`
- repo: `karmaterminal/openclaw-bootstrap`
- conclusion: `success`
- created: 2026-05-04T01:02:47Z
- updated: 2026-05-04T01:05:06Z
- target ref: `f39b8c9751` (canonical HEAD with all 5 v5.2 deploy-inbound PRs merged)

## Pre-roll snapshot (this seat, ronan, 2026-05-04T01:03:35Z)

- gateway: `active`
- version banner: `OpenClaw 2026.5.2 (4d07db9)` (prior canonical pin)
- `NRestarts=0`, journal clean (continuation-signal traces + benign WS "closed before connect / device identity required")

## Post-roll snapshot (this seat, ronan, 2026-05-04T01:07:48Z)

- gateway: `active`, `SubState=running`, `MainPID=240140`, `NRestarts=0`
- `ActiveEnterTimestamp=Sun 2026-05-03 18:04:52 PDT` (fresh start by deploy)
- version banner: `OpenClaw 2026.5.2 (f39b8c9)` ✅ matches deploy ref
- runtime checkout HEAD: `f39b8c9751c` ("fix(config): runtime hot-reload for sessions visibility, continuation knobs, plan-aware CLI hint (supersedes #536) (#576)") ✅

## Journal observations

- 18:04:16 PT — pre-deploy `liveness warning` on event_loop_delay (p99 41.7ms / max 3632.3ms / utilization 0.226), `continuationQueueStagedPostCompaction=1` from a long-lived staged subagent flow `agent:main:subagent:a03ad783`. Pre-existing on this host across the rollover; not introduced by deploy.
- 18:04:51 PT — embedded run failover (`stage=assistant decision=surface_error reason=timeout`) on a github-copilot/claude-opus-4.7 attempt; consistent with figs's earlier note about copilot rate-limit churn under load.
- 18:04:52 PT — systemd `Started openclaw-gateway.service` (the deploy's own restart cycle; NRestarts still 0 because stop/start is not a service-supervisor restart event).
- 18:04:57 PT — gateway HTTP server started clean.
- 18:04:57 PT — pre-existing security warning: `plugins.entries.acpx.config.permissionMode=approve-all` (banked-known config; not deploy-introduced).
- 18:05–18:07 PT — only WS "closed before connect / connect failed" pings (benign).

## Verdict

Deploy succeeded on ronan host. Version banner + runtime checkout HEAD both byte-aligned with target ref `f39b8c9751`. No rollback triggered. Pre-existing staged post-compaction continuation row (1 entry on `a03ad783`) and the acpx permission-mode warning are not introduced by this deploy and are tracked separately.
