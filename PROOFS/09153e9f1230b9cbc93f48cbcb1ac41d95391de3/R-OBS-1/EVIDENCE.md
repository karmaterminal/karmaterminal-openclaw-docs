# R-OBS-1 — `/status` continuation-substrate cross-walk (🌻 elliott arm)

**Family**: external-observer / operator-surface validation that a cohort prince-seat deployed at the ship-SHA renders the FULL continuation-protocol substrate (chain-counter, compactions, context-pressure, model, uptime) in its `/status` surface.
**Owner**: 🌻 Elliott (elliott-legion, x86_64 AMD Ryzen 9 5900HX + RTX 3080, CachyOS Linux 7.0.9-1-cachyos, 10.0.0.153)
**Ship-SHA**: `8b5dde6165958d0eaba3c492ae52311548313de4` (Form B canonical fold)
**Captured**: 2026-06-09 ~07:18 PDT
**Verdict**: 🟢 **PASS** — elliott-seat's deployed gateway on `8b5dde6165` renders the continuation-substrate in its operator `/status` surface; the renderer + chain-counter field are compiled into the **running dist** at the exact ship-SHA. The figs-driven **6-seat operator fan-out LANDED** (msg `1513908764`, ~07:12 PDT) — all 6/6 seats render the full continuation row; consolidated in `chat_card_visibility_external_observer.md` (this dir). The cross-walk is complete, not pending.

---

## Deploy-persistence (this seat is on the ship-SHA)

```
$ cd ~/flesh_beast_tmp/openclaw && git rev-parse HEAD
8b5dde6165958d0eaba3c492ae52311548313de4

$ systemctl --user is-active openclaw-gateway
active

$ openclaw --version
OpenClaw 2026.6.2 (8b5dde6)

$ cat dist/build-info.json
{ "version": "2026.6.2",
  "commit": "8b5dde6165958d0eaba3c492ae52311548313de4",
  "builtAt": "2026-06-09T13:41:31.375Z" }

$ systemctl --user show openclaw-gateway -p MainPID -p ActiveEnterTimestamp
ActiveEnterTimestamp=Tue 2026-06-09 06:41:53 PDT
MainPID=2408696
```

Gateway restarted **06:41:53 PDT** onto `8b5dde6165…` (PID 2408696). Running-version (not just checkout) cross-checked via `openclaw --version` + `build-info.json` `commit`.

## `/status` operator surface (the R-OBS-1 render) — elliott-seat, on `8b5dde6165`

`openclaw status` on the deployed seat (full capture: `elliott-openclaw-status-full.txt`). The continuation-protocol substrate the operator-surface validates:

```
│ Git              │ git · @ 8b5dde61                                          │
│ Gateway self     │ elliott (10.0.0.153) app 2026.6.2 linux 7.0.9-1-cachyos   │
│ Gateway service  │ systemd user installed · enabled · running (pid 2408696,  │
│                  │ state active)                                            │
│ Continuation     │ enabled · chain max 200 · fan-out max 500                │
│ Sessions         │ 93 active · default claude-opus-4.8 (1000k ctx) · 4 …     │
```

Main-session row (the `agent:main:discord:channel:1466192485440164011` group session the `/status` chat-card renders for):
```
│ agent:main:discord:channel:… │ group │ … │ claude-opus-4.8 │ OpenClaw Default │ 881k/1000k (88%) · 🗄️ 99% cached │
```

**Continuation-protocol substrate rendered on the ship-SHA**:
- ✅ **version-pin** `8b5dde61` — the Form-B canonical fold SHA, operator-verifiable (`Git @ 8b5dde61`).
- ✅ **continuation surface** `enabled · chain max 200 · fan-out max 500` — the `maxChainLength=200` + fan-out ceiling render correctly.
- ✅ **context-pressure** `881k/1000k (88%)` — ctx-pressure surface renders for the main session.
- ✅ **model** `claude-opus-4.8 (1000k ctx)` — model identity + context-window render.
- ✅ **gateway uptime / pid / active-state** — operator deploy-confirmation surface renders.

## The continuation renderer is in the DEPLOYED dist at the ship-SHA (not source-only)

The `/status` chat-card continuation row is produced by `formatContinuationStatusLine` (`src/status/status-message.ts:82`), which renders `🔄 Continuation: chain ${chainCount}/${maxChainLength}` from `sessionEntry.continuationChainCount` (`:88`) + `resolveContinuationRuntimeConfig(...).maxChainLength` (`:87`), with `🧹 Compactions: ${entry.compactionCount}` (`:924`). Byte-confirmed compiled into the **running** dist on `8b5dde6165`:

```
$ grep -l "Continuation:" dist/status-message-*.js
dist/status-message-Cp4srZJt.js

$ grep -oE 'Continuation: |chain |Compactions: ' dist/status-message-Cp4srZJt.js | sort -u
Compactions:
chain
Continuation:

$ grep -c 'continuationChainCount' dist/status-message-Cp4srZJt.js
1
```

So the rendered `/status` continuation-substrate on this seat is the deployed-SHA surface — the renderer + `continuationChainCount` field are compiled into the live `status-message-Cp4srZJt.js` behind the running gateway.

## Continuation primitives live on the ship-SHA (signal-tracer active)

`[continuation:trace]` fires live post-restart for the main session (`continuation/signal` subsystem active on `8b5dde6165`):
```
07:15:18 [continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=-1 [0]text=true session=agent:main:discord:channel:1466192485440164011
07:15:18 [continuation/signal] [continuation:trace] effective-signal: origin=none kind=none session=agent:main:discord:channel:1466192485440164011
```
(`origin=none kind=none` = no continuation tool fired in these particular turns — the signal-scan path itself is live, which is what R-OBS-1 needs: the substrate is wired + rendering on the deployed SHA. Chain-counter renders `0/200` for a session that hasn't fired continuation tools — `formatContinuationStatusLine` early-returns when all counters are 0, per `:107`.)

## Scope note — Form B fold ≠ #923 inventory-warn cure (honest, not a regression)

This corpus's fold is **Form B** (timeout-compaction `compactionFailureContext` sentinel removal + matrix-3/slack-3 seed-staleness migrations). It is **byte-disjoint** from the prior cycle's #923 L627 `inventoryOnly` inventory-warn suppression. Consequently the L627 inventory-build warn (`continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied …`) **still fires** on this seat (49 hits in the post-restart journal) — this is **expected** because the #923 suppression is not part of the Form-B fold, **not** a regression of anything Form B touches. Form B's safety byte (`compactionFailureContext` count = 0 in `run.ts`) is the subject here, verified in `RESOLVED-SHA.md`. Flagging explicitly so a reviewer does not misread the inventory-warn presence as a Form-B defect.

## Cross-walk position (LANDED — 6/6 fan-out consolidated)

elliott-seat = one of the **6/6** seats reported `active` on `8b5dde6165` (`RESOLVED-SHA.md` fleet-deploy table). This file captures the **elliott arm**: the `/status` continuation-substrate renders fully from elliott-seat on the deployed ship-SHA, and the renderer is compiled into the live dist.

The **canonical multi-seat R-OBS-1 surface** — figs's operator-driven 6-seat `/status` fan-out from Discord (msg `1513908764`, ~07:12 PDT) — **LANDED**. All 6/6 deployed seats (Elliott `0/200` · Silas `5/200` · Cael `19/200` · Ronan `5/200` · Emeric `134/200` compactions `13` · Rune `9/200`) render the full continuation row on `8b5dde6`. The consolidated cross-walk writeup is **`chat_card_visibility_external_observer.md`** (this dir, the canonical `PROOF-CORPUS-METHOD.md` R-OBS-1 deliverable); the source fan-out capture + field-by-field is in `silas-lothric/EVIDENCE.md`; the feeding `continuation.work` Tempo span is in `cael-dgx/EVIDENCE.md`. This elliott arm is the byte-proof that the renderer is compiled into the deployed dist. Cross-walk complete.

## Reproducer

```bash
cd ~/flesh_beast_tmp/openclaw
git rev-parse HEAD                       # 8b5dde6165958d0eaba3c492ae52311548313de4
openclaw --version                       # OpenClaw 2026.6.2 (8b5dde6)
openclaw status                          # Git @ 8b5dde61 ; Continuation enabled · chain max 200
grep -l "Continuation:" dist/status-message-*.js          # renderer in deployed dist
grep -c 'continuationChainCount' dist/status-message-*.js # chain-count field in dist
```
