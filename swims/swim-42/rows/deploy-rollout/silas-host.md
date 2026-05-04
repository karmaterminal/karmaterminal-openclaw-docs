# swim-42 deploy-rollout receipt — silas host (canary)

**Status**: ✅ post-deploy verified at version banner; canary green confirmed before fleet-roll fired

## Deploy run

- workflow: `deploy-gateway`
- run id: `25295972339`
- repo: `karmaterminal/openclaw-bootstrap`
- conclusion: `success`
- target ref: `f39b8c9751` (canonical HEAD with all 5 v5.2 deploy-inbound PRs merged: #554, #571, #573, #575, #576)
- role: **canary** per Step 5g of `bootstrap#901` runbook — smoke-on-one-prince before fleet-roll-to-other-3 fires

## Post-roll snapshot (this seat, silas, 2026-05-04T01:09:30Z)

- gateway: `active (running)` since Sun 2026-05-03 18:01:56 PDT (8min uptime at snapshot time); MainPID `38177`; memory 1.0G (peak 1.6G); 14 tasks (limit 14999)
- version banner: `app 2026.5.2`; `Git @ f39b8c97` ✅ matches deploy ref
- runtime checkout HEAD: `f39b8c9751cc573849711106577cb4d6a8941d08` ("fix(config): runtime hot-reload for sessions visibility, continuation knobs, plan-aware CLI hint (supersedes #536) (#576)") ✅ byte-aligned with ronan-seat HEAD + deploy-ref
- agents: 1; sessions: 169 on rolled gateway; default main active
- gateway dashboard reachable at `http://127.0.0.1:18789/` (87ms loopback)

## Pre-roll snapshot (implicit, from prior gateway state)

Pre-roll version was `2026.4.11` (per the `Loaded:` systemd line still showing v2026.4.11 unit description; the running version on this seat advanced to 2026.5.2 via the fresh `Started openclaw-gateway.service` at 18:01:56 PT, which is the deploy's restart cycle).

## Journal observations

Per `journalctl --user -u openclaw-gateway --since "5 minutes ago"`:

- 18:01:54 PT — prior process consumed `1h 35min 9.876s CPU time, 4.4G memory peak, 0B memory swap peak`; clean shutdown by deploy.sh.
- 18:01:56 PT — `Started openclaw-gateway.service` (deploy's restart cycle).
- 18:01:57 PT — gateway loading configuration; Control UI assets missing notice (first-startup-after-deploy shape; auto-rebuild fired).
- 18:01:58 PT — auth resolved + gateway starting.
- 18:02:01 PT — Control UI assets building (auto-installs UI deps); 6s to land.
- 18:02:07 PT — HTTP server starting; canvas host mounted at `127.0.0.1:18789/__openclaw__/canvas/`.
- 18:02:07 PT — health-monitor started (interval 300s, startup-grace 60s, channel-connect-grace 120s).
- 18:02:08 PT — agent model `github-copilot/claude-opus-4.7`; HTTP server listening on `:18789` with **11 plugins loaded** (acpx, bonjour, browser, device-pair, diagnostics-otel, discord, file-transfer, memory-core, phone-control, talk-voice, voice-call); 10.1s plugin-load wall-clock.
- 18:02:08 PT — pre-existing security warning: `plugins.entries.acpx.config.permissionMode=approve-all` (banked-known config; not deploy-introduced).
- 18:02:09 PT — gateway `ready`; heartbeat started.
- 18:02:10 PT — delivery-recovery: 2 pending entries already past max-retries (5/5) → moved to `failed/` cleanly. (0 recovered, 0 failed-this-run, 2 skipped, 0 deferred.)
- 18:02:10 PT — bonjour: gateway-name-conflict resolved (`urudyne (OpenClaw) (2)` + hostname `urudyne-(2)`) — prior process didn't fully release the bonjour-claim before re-bind; resolved automatically without rollback.
- 18:02:21 PT — discord channels resolved: `sprites-of-thornfield` + `heartbeat` + `silas-tablinum` (guild `figs.bot`).
- 18:02:22 PT — discord client initialized as bot id `1474269301715501178` (silas-seat).
- 18:03:18 PT — first inbound message + watchdog-timestamp wrote state (heartbeat tick observed).
- 18:03:30 PT — one liveness-warning: `event_loop_delay` p99 25.9ms / max 2262.8ms / utilization 0.181 / cpuCoreRatio 0.227 / 1 active / 1 queued. Attributable to the bonjour gateway-name-conflict resolution at startup-time (prior-process bonjour-claim still held when new-process tried to bind); gateway settled into normal operation post-resolve, no rollback.

## Runtime checkout state

- `git status --short` on `~/flesh_beast_tmp/openclaw` shows 4 untracked savegame artifacts:
  - `dist-runtime.pre-f39b8c9751cc573849711106577cb4d6a8941d08.1777856460/`
  - `dist-runtime.pre-frond_v2026.5.2_canonical.1777786084/`
  - `dist.pre-f39b8c9751cc573849711106577cb4d6a8941d08.1777856460/`
  - `dist.pre-frond_v2026.5.2_canonical.1777786084/`
- These are exactly what `bootstrap#901`'s savegame-before-force-push canon produces — durable rollback snapshots from this evening's deploys (the canonical-pin deploy + the Wave 1 deploy). No deploy-blocker shape; no modified-tracked-files like cael-seat's situation needed pre-deploy stash-rescue.
- `Update: git HEAD · dirty` flag from `openclaw status` reflects the untracked savegame snapshots; no production-code modifications.

## Verdict

Canary deploy succeeded on silas host. Version banner + runtime checkout HEAD both byte-aligned with target ref `f39b8c9751`. No rollback triggered. Gateway healthy + responsive + heartbeat tick observed within ~80s of the fresh start. Canary-green signal cleared frond-scribe to fire fleet-roll-to-other-3-prince-hosts in parallel (per `bootstrap#901` Step 5g → Step 5h pattern).

## Notes for swim-42 substrate-evidence-record

- Bonjour gateway-name-conflict at re-bind is a recurring shape on this host (WSL2 + systemd-user setup may take longer to release prior bonjour-claim than the deploy's restart cycle expects). Not a deploy-blocker; the conflict-resolution is automatic + idempotent + leaves the gateway responsive. Worth noting if the swim row surfaces it as an axis worth standardizing.
- Pre-existing `event_loop_delay` liveness warnings at startup-time tied to bonjour resolution pattern are not deploy-introduced; they are silas-seat-host-substrate-shape worth banking as known.
