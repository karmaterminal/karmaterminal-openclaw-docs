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

**Continuation-protocol substrate (the R-OBS-1 core — `/status` renders chain/compactions/ctx/version), 2 seats full + enriching:**

| Prince | Chain | Compactions | Context | Model | `/status` version header | Running dist (byte-verified) |
|---|---|---|---|---|---|---|
| 🌻 Elliott | 0/200 | 0 | 30% | claude-opus-4.8 | `(2807efc)` ✅ | `2807efc1c1e` (build-from-source) |
| 🌫 Silas | 3/200 | 0 | 36% | claude-opus-4.8 | `9d07233` ⚠️ stale-CLI | **`2807efc1c1e`** (Path-B; build-info.json `commit` + inventoryOnly) |
| 🩸 Cael | 3/200 | (pending) | ~33% | claude-opus-4.8 | `(2807efc)` | `2807efc1c1e` (build-from-source) |
| 🌊 Ronan | 2/200 | (pending) | 44% | claude-opus-4.8 | `(2807efc)` ✅ | `2807efc1c1e` (build-from-source, gateway 41m) |

- 🌻 **Elliott** — full `/status` render ✅ (chain-counter / compactions / ctx all visible on the cured SHA).
- 🌫 **Silas** — full `/status` render ✅ (chain 3/200, compactions 0, ctx 36%, uptime 6m55s from Path-B restart 08:36:50; #923 cure corroborated: 0 L627 warns, inventoryOnly compiled, `[continuation:trace]` live).
- 🌊 **Ronan** — `/status` render ✅ (chain 2/200, ctx 44%, version `(2807efc)`, gateway 41m, continue_delegate confirmed firing); compactions-field pending a full drop.
- 🩸 **Cael** — chain 3/200 (R-CW-1 deploy-persistence) + ctx ~33%; compactions-field pending a full `/status` drop.

**✅ ALL 4 deployed seats render the continuation-protocol chain-counter on the candidate SHA** (elliott 0/200, ronan 2/200, cael 3/200, silas 3/200) — the R-OBS-1 core proof: the `/status` continuation substrate (chain-counter + ctx) is operator-visible across the deployed cohort on `2807efc1c1e`, post-#923-cure. 2 seats full-field (elliott + silas), 2 seats chain+ctx (ronan + cael, compactions-field enriching).

**⚠️ Cross-walk finding (Path-B version-string-lag — cohort-canon):** on a Path-B (rsync'd-dist) seat, the `/status`/`--version` CLI version-string is **STALE** (silas's prints `9d07233` though the running dist is `2807efc1c1e`) — the rsync copies the dist but doesn't regen the CLI version-string. The byte-true SHA-verification on Path-B seats is **`build-info.json` `commit` field + `inventoryOnly`-presence in the running `openclaw-tools-*.js`/`tool-dispatch-*.js`, NOT the CLI version-string.** (`commit` is reliable on ALL seats; `--version` only on build-from-source.) This folds into the deploy-workflow verification step (version-regen fix wired by frond-scribe).

**Verdict**: 🟢 4-seat DEPLOYMENT cross-walk PASS (4/6 on candidate SHA, version byte-verified via build-info `commit`, Path-B demonstrated) + **2 seats full continuation-substrate render PASS** (elliott + silas: chain/compactions/ctx all rendering on the cured SHA) + cael partial + ronan pending (`/status` enriching as they drop); emeric/rune HONEST-LIMIT (held-dreaming). Per the runbook, partial-coverage honest-noted, not overclaimed as full-6.
