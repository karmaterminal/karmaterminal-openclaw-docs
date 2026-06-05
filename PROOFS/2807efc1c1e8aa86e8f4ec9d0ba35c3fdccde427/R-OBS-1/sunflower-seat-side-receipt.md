# R-OBS-1 — sunflower-seat-side receipt (external `/status` continuation row)

**Family**: external-observer cross-walk of `/status` chat-card continuation-row + version-string + chain-counter across multiple prince-seats deployed at the same CANDIDATE_SHA `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
**Lead Prince**: 🌻 Elliott (elliott-legion, x86_64 AMD Ryzen 9 5900HX + RTX 3080, CachyOS Linux 7.0.9-1-cachyos)
**Status**: 🟢 sunflower-seat row CAPTURED on `2807efc1c1e`; full cohort cross-walk assembling as the fleet settles (3/6 deployed at capture-time)
**Fired at**: 2026-06-05 ~08:30 PDT (sunflower-prince)
**Deploy persistence verified**: gateway restarted 08:18:43 PDT on the candidate SHA; `openclaw --version` → `OpenClaw 2026.6.2 (2807efc)`; build-info `gitSha: 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
**Discord channel**: `#sprites-of-thornfield` (`1466192485440164011`)

## Scenario

Per `PROOF-CORPUS-METHOD.md`: external `/status` visibility validates that cohort prince-seats expose continuation-protocol substrate (chain-counter, compactions, model, tokens, uptime) to operators after deploying the candidate SHA. This row is the external-observer surface — the `/status` chat-card the operator (figs) and cohort use to verify prince-fleet health + continuation-protocol state on `2807efc1c1e` (the #923 L627-inventory-warn cure).

## Sunflower-seat `/status` build-pin (elliott-legion, 2026-06-05 ~08:30 PDT)

```
🦞 OpenClaw 2026.6.2 (2807efc)
🧠 Model: github-copilot/claude-opus-4.8
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai/gpt-5.5
📚 Context: 303k/1.0m (30%) · 🧹 Compactions: 0
🔄 Continuation: chain 0/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
🧵 Session: agent:main:discord:channel:1466192485440164011
⏱️ Uptime: gateway 11m 10s · system 12d 14h
```

**Continuation-protocol substrate visible on the sunflower-seat `/status`**: ✅ chain-counter rendered (`chain 0/200`), ✅ compactions tracked (`0`), ✅ context-pressure rendered (`303k/1.0m (30%)`), ✅ gateway uptime + model identity rendered. The candidate-SHA `2807efc` is pinned in the version-string — operator-verifiable deploy-confirmation.

## Inventory-misreporting cure corroboration (the #923 subject)

This seat independently byte-verified figs's second GATES criterion on the candidate SHA:
- **Zero** L627 `continueWorkOpts/requestCompactionOpts` warn hits in post-08:18:43-restart journal.
- `inventoryOnly` fix compiled into the running dist (`openclaw-tools-DvIyHf_r.js`, `tool-resolution-By62t_4f.js`, `tool-dispatch-D_CsehLj.js`).
- `[continuation:trace]` firing live post-restart (signal-tracing active on the new SHA).

So the `/status`-rendered continuation substrate is NOT just present — it's the cured continuation surface (the #923 inventory-warn no longer fires on the build behind this `/status`).

## Cross-walk status (assembling)

At sunflower-seat capture-time the fleet is **3/6 deployed on `2807efc1c1e`**:
- 🌻 Elliott (elliott-legion) — ✅ deployed, captured above
- 🩸 Cael (cael-dgx) — ✅ deployed (corpus-driver; `/status` to fold into the cross-walk table)
- 🌊 Ronan (ronan-dgx) — ✅ deployed (canary-validated; `/status` to fold in)
- 🌫 Silas (silas-lothric) — ⚠️ HONEST-LIMIT: build FAILED (`tsdown` killed, Raptor-Lake native-build instability), rolled back clean to `9d07233`; needs Path-B same-arch dist rsync. Documented fleet-divergence (same class as the prior `7522d6c` corpus where silas sat out on `0dff94d`).
- 🕯 Emeric (emeric-nuc) — ⏸️ HELD: hands-off-honored (NRestarts=0, continuous since 22:07, dreaming/uncured); SHA-uptake on pause-word per the do-not-restart-a-self-recovering-prince discipline.
- 🪨 Rune (rune-rog-ally) — ⏸️ HELD: dreaming, healthy; SHA-uptake on pause-word.

The full cross-walk table (Prince | Host | Gateway-version | Uptime | Context | Compactions | Chain | Model) completes as silas takes Path-B + emeric/rune take the SHA on their pause-word. Per the runbook HONEST-LIMIT taxonomy, the held/rolled-back seats are documented fleet-state, not failures — the cross-walk captures the deployed majority's continuation-substrate visibility + the honest divergence.
