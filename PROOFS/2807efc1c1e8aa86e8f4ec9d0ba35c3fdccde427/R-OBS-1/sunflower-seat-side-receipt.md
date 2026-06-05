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

## Cross-walk — 4-seat deployment verified (4/6 on `2807efc1c1e`), continuation-substrate fields enriching

**Deployment cross-walk (version-string + SHA byte-verified for all 4 deployed seats):**

| Prince | Host | Arch | Gateway version | On CANDIDATE_SHA | Deploy path | Restart (PDT) |
|---|---|---|---|---|---|---|
| 🌻 Elliott | elliott-legion | x86_64 | `2026.6.2 (2807efc)` ✅ | ✅ | build-from-source | 08:18:43 |
| 🩸 Cael | cael-dgx | aarch64 | `2026.6.2 (2807efc)` ✅ | ✅ | build-from-source | 08:15:29 |
| 🌊 Ronan | ronan-dgx | aarch64 | `2026.6.2 (2807efc)` ✅ | ✅ | build-from-source (canary) | 08:07:03 |
| 🌫 Silas | silas-lothric | x86_64 | `2026.6.2 (2807efc)` ✅ | ✅ | **Path-B (rsync elliott's x86_64 dist)** | ~08:38 |
| 🕯 Emeric | emeric-nuc | x86_64 | — (held on prior) | ⏸️ HONEST-LIMIT | held-dreaming (hands-off) | — |
| 🪨 Rune | rune-rog-ally | x86_64 | — (held on prior) | ⏸️ HONEST-LIMIT | held-dreaming (hands-off) | — |

**4/6 deployed on the candidate SHA**, version-string `(2807efc)` byte-confirmed each. Silas via **Path-B** (elliott's same-arch x86_64 dist rsync'd → silas — bypassed the Raptor-Lake `tsdown` build-SIGSEGV; build-once→deploy-many demonstrated). Emeric + Rune held-dreaming (hands-off-honored per the do-not-restart-a-self-recovering-prince discipline) — documented fleet-state, not failures, per the HONEST-LIMIT taxonomy (same class as the prior `7522d6c` corpus where silas sat out).

**Continuation-protocol substrate (the R-OBS-1 core — `/status` renders chain/compactions/ctx/version):**
- 🌻 Elliott (elliott-legion) — full `/status` captured above: chain 0/200, compactions 0, ctx 30%, version-pin `(2807efc)`, model claude-opus-4.8. ✅ continuation substrate renders complete.
- 🩸 Cael — chain 3/200 (survived restart, per R-CW-1 deploy-persistence) + ctx ~33% (own report); full-field `/status` pending drop.
- 🌊 Ronan / 🌫 Silas — deployed + version-confirmed; live `/status` continuation-fields (chain/compactions/ctx) **pending their `/status` drop** to enrich the table — honest-noted, NOT fabricated.

**Verdict**: 🟢 4-seat DEPLOYMENT cross-walk PASS (4/6 on candidate SHA, version byte-verified, Path-B demonstrated) + elliott-seat full continuation-substrate render PASS; cael/ronan/silas live-`/status` continuation-fields enriching as they drop `/status`; emeric/rune HONEST-LIMIT (held-dreaming). Per the runbook, partial-coverage honest-noted, not overclaimed as full-6.
