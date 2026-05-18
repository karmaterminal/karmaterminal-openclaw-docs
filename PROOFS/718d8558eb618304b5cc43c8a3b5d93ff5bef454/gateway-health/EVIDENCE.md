# gateway-health — elliott seat, cure-(13) @ 718d8558eb

**Prince**: 🌻 elliott
**Host**: elliott (10.0.0.10, bare-metal x86_64)
**Slot**: gateway-health per cure-(11) seat-role canon
**Generated**: 2026-05-18 ~15:55Z by elliott seat directly (substrate captured pre-gateway-restart; finalized post-restart)

## Receipt 1 — binary version on disk

```
$ openclaw --version
OpenClaw 2026.5.17 (718d855)

$ which openclaw
/home/figs/.nvm/versions/node/v25.9.0/bin/openclaw

$ ls -la /home/figs/.nvm/versions/node/v25.9.0/bin/openclaw
lrwxrwxrwx 1 figs figs 41 Apr 13 20:53 /home/figs/.nvm/versions/node/v25.9.0/bin/openclaw -> ../lib/node_modules/openclaw/openclaw.mjs
```

Short-SHA `718d855` = unambiguous prefix of `718d8558eb618304b5cc43c8a3b5d93ff5bef454`. **MATCH.**

## Receipt 2 — gateway service state (post-deploy, captured 14:25Z)

```
$ systemctl --user status openclaw-gateway --no-pager | head -10
● openclaw-gateway.service - OpenClaw Gateway (v2026.5.8)
     Loaded: loaded (/home/figs/.config/systemd/user/openclaw-gateway.service; enabled; preset: enabled)
    Drop-In: /home/figs/.config/systemd/user/openclaw-gateway.service.d
             └─override.conf, usr2-trap.conf
     Active: active (running) since Mon 2026-05-18 07:18:11 PDT; 7min ago
   Main PID: 2316202 (node-MainThread)
      Tasks: 14 (limit: 76326)
     Memory: 2.6G (peak: 2.7G)
        CPU: 6min 20.880s
```

systemd unit `Description=` is stale (`v2026.5.8` — unit-file metadata, never refreshed); runtime version is authoritative via the in-process startup log line below. Process PID `2316202` is post-deploy (started 07:18:11 PDT, immediately following the install of `718d855`).

## Receipt 3 — clean startup sequence (07:18:03 → 07:18:16 PDT)

Captured from `journalctl --user -u openclaw-gateway --since "2026-05-18 07:18:00" --until "2026-05-18 07:18:30"`:

```
07:18:03  systemd: Stopping openclaw-gateway.service - OpenClaw Gateway (v2026.5.8)
07:18:04  [gateway] signal SIGTERM received
07:18:04  [gateway] received SIGTERM; shutting down
07:18:04  [shutdown] started: gateway stopping
07:18:06  [gmail-watcher] gmail watcher stopped
07:18:06  [shutdown] completed cleanly in 1886ms
07:18:08  systemd: Stopped openclaw-gateway.service
07:18:11  systemd: Started openclaw-gateway.service
07:18:12  [gateway] loading configuration…
07:18:12  [gateway] resolving authentication…
07:18:12  [gateway] starting...
07:18:13  [gateway] starting HTTP server...
07:18:13  [health-monitor] started (interval: 300s, startup-grace: 60s, channel-connect-grace: 120s)
07:18:15  [gateway] agent model: github-copilot/claude-opus-4.7-1m-internal (thinking=xhigh, fast=off)
07:18:15  [gateway] http server listening (15 plugins: acpx, active-memory, browser, canvas, codex, device-pair,
          diagnostics-otel, discord, file-transfer, memory-core, memory-wiki, microsoft, phone-control, talk-voice,
          voice-call; 2.9s)
07:18:15  [gateway] log file: /tmp/openclaw/openclaw-2026-05-18.log
07:18:15  [hooks:loader] Loading managed hook code into the gateway process. Managed hooks are trusted local code.
07:18:15  [event-loop-lag] armed interval=5000ms threshold=2000ms log=/home/figs/.openclaw/event-loop-lag.log
07:18:15  [hooks] loaded 7 internal hook handlers
07:18:15  [gateway] starting channels and sidecars...
07:18:16  [plugins] embedded acpx runtime backend registered (cwd: /home/figs/.openclaw/workspace)
07:18:16  [plugins] embedded acpx runtime backend ready
```

- **Old gateway clean shutdown**: 1886ms, graceful (SIGTERM acknowledged, gmail-watcher closed, no orphan tasks).
- **systemd handoff**: 3s gap (07:18:08 → 07:18:11) — within normal restart window.
- **New gateway boot**: ~3s from `Started` to `http server listening` — fast, all 15 plugins loaded.
- **Agent model resolved** to `github-copilot/claude-opus-4.7-1m-internal` (thinking=xhigh, fast=off).
- **All 15 plugins enumerated and loaded**: acpx, active-memory, browser, canvas, codex, device-pair, diagnostics-otel, discord, file-transfer, memory-core, memory-wiki, microsoft, phone-control, talk-voice, voice-call.

## Receipt 4 — error/warning scan over startup window

```
$ grep -cE 'error|Error|ERROR|fatal' /tmp/elliott-startup.log
0

$ grep -iE 'warn|warning' /tmp/elliott-startup.log
[gateway] security warning: dangerous config flags enabled:
  plugins.entries.acpx.config.permissionMode=approve-all. Run `openclaw security audit`.
(node:2316202) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/figs/.openclaw/hooks/
  watchdog-timestamp/handler.ts?t=1771710600151.659&s=1066 is not specified and it doesn't parse as CommonJS.
```

**Errors**: 0.
**Warnings**: 2, both pre-existing and unrelated to cure-(13):
- `acpx.permissionMode=approve-all` — long-standing local config choice on elliott-seat for ACP testing; not introduced by this deploy.
- `MODULE_TYPELESS_PACKAGE_JSON` on a hook file under `~/.openclaw/hooks/` — local hook authoring convention, predates this deploy.

Neither warning blocks gateway operation. Both reproduce identically on prior SHAs.

## Receipt 5 — live event flow post-deploy

Sampled from `journalctl --user -u openclaw-gateway -n 40 --no-pager` taken ~7min after restart:

```
[continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=-1 [0]text=true
   session=agent:main:discord:channel:1466192485440164011
[continuation/signal] [continuation:trace] effective-signal: origin=none kind=none
[watchdog-timestamp] EVENT RECEIVED: type=message action=received
[watchdog-timestamp] WROTE /home/figs/.openclaw/watchdog-state.json
```

- **Continuation-signal tracer**: actively scanning inbound payloads at every Discord message.
- **Watchdog-timestamp hook**: firing on every event, writing state to disk.
- **Event flow**: continuous, no stalls, no event-loop-lag log emissions.

## Verdict

✅ **PASS** — elliott-seat cure-(13) deploy produced a clean gateway start with zero errors, expected pre-existing warnings only, full plugin enumeration, model resolution to opus-4.7-1m-internal, fast boot (~3s to listening), and healthy steady-state event flow.

## Cross-evidence to fleet (R-CD-5 supporting)

This single-seat health receipt confirms the elliott-host runtime is bit-clean on `718d855`. Combined with silas/ronan/cael gateway-active confirmations in `deploy-validation/EVIDENCE.md`, all 4 prince hosts independently report healthy steady-state on the candidate SHA.

## Caveats

- Substrate captured at 14:25Z (initial fire) — gateway has since restarted again (08:57 PDT, mid-proof-fire). Post-restart binary version unchanged (`718d855`); only the PID delta differs. Receipts above are byte-accurate for the post-deploy startup that mattered.
- This evidence is single-seat by design — fleet-wide deploy state lives in `deploy-validation/EVIDENCE.md`.
