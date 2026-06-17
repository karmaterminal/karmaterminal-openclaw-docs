# RESOLVED-SHA — `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`

**Short**: `8cafdcd`
**Runtime build string**: `OpenClaw 2026.6.8 (8cafdcd)`
**Fleet deploy**: ALL SIX princes live on `8cafdcd` (2026-06-17 ~00:00–00:30 PDT) — via self/own-handle re-deploy off the orphaned `2e46961` → `8cafdcd` (the FF'd ship-tip) + gateway-restart-onto-tip. All six byte-confirmed runtime==ship.

| Prince | Seat | Deploy path | Result |
|---|---|---|---|
| 🩸 Cael | cael-dgx | gateway restart → on-ship | ✅ runtime==`8cafdcd` (proof-by-return) |
| 🌻 Elliott | elliott-legion | deploy-gateway run `27671564002` | ✅ runtime==`8cafdcd` (trace-receipt) |
| 🌫 Silas | silas-lothric | gateway restart → on-ship | ✅ runtime==`8cafdcd` (trace-receipt) |
| 🌊 Ronan | ronan-dgx | self re-deploy run `27671333664` | ✅ runtime==`8cafdcd` (proof-by-return + Tempo) |
| 🕯 Emeric | emeric-nuc | self re-deploy (`upstream refs/pull/85651/head`) `2e46961`→`10a0427`→`8cafdcd` | ✅ runtime==`8cafdcd` (trace-receipt) |
| 🪨 Rune | rune-rog-ally | self re-deploy run `27671481774` | ✅ runtime==`8cafdcd` (proof-by-return + Tempo) |

_(Deploy-run IDs per-seat: each prince confirm/append your own from your deployed gateway.)_

## What this SHA is

`8cafdcd2a9` = a **merge commit**: `Merge remote-tracking branch 'upstream/main' into frond-scribe/20260613/assembly-drift-cure`
- parent 1 (assembly tip): `10a0427ca33b98b5a19de6a0a22c16ce95d9ebe8` (the prod-re-export-both fix for #85651 — `isCoreToolResultMediaTrustedName` + `STALE_UNENDED_SUBAGENT_RUN_MS` both `export`)
- parent 2 (upstream): `18aa3276554cf9862a7c6cf94c14785491582de0` (current upstream/main at merge-time)
- author-date: 2026-06-16 23:35:01 -0700

This is the **FF re-sync** that reconciled the assembly's re-exports against upstream's strips — the merge that cleared the `dirty` conflict (`10a0427` was the one-behind pre-re-sync tip). This corpus certifies the **continuation feature live on the FF'd ship-tip `8cafdcd`** each prince runs. Per the clawsweeper principle: every row stands ALONE at this SHA — its own EVIDENCE.md/proof.md + dispatch-result + channel-receipts + Tempo trace. No inherited evidence.

## Source-intact on `8cafdcd` (the #85651 fix survives the FF)

- `STALE_UNENDED_SUBAGENT_RUN_MS` = `export const` ✅ (`src/agents/subagent-run-liveness.ts`)
- `isCoreToolResultMediaTrustedName` = `export function` ✅ (`src/agents/embedded-agent-subscribe.tools.ts`)
- check-prod-types ✅ · check-test-types ✅ (the export-strip dragon is dead; both symbols re-exported prod-side)

## Gate verdicts (board state on `8cafdcd`)

| Gate | Verdict |
|---|---|
| Entire code-check surface (~45: build-export trio + check-dependencies + checks-node-core ×30+) | ✅ GREEN — zero code-reds |
| `mergeable` | flaps null↔true on recompute (re-resolve at instant-of-use; was `true` post-FF, the conflict cleared) |
| `merged` | `false` — NOT merged yet; FF-merge gated on the flake-retry + figs's call |
| android-test-play · android-test-third-party | 🔴 flakes (retryable; keep the rollup `unstable`) |
| Real-behavior-proof | 🔴 flake (13s infra) |

**Zero code-reds.** The compile/conflict dragons are dead. What remains: flake-retry → `unstable`→clean → FF-merge.

> **Scope note:** this is the *deployed runtime-proofs* SHA (the FF'd ship-tip). The FF-merge to upstream/main is gated on the flake-retry clearing the `unstable` rollup + figs's merge call. This corpus certifies the deployed runtime; merge is the deliberate follow-up.

## Per-seat host info

_Princes: append your seat's runtime build string + host + channel-witness below, confirmed from your deployed gateway._

### 🕯 Emeric — emeric-nuc
- **Runtime build string**: `OpenClaw 2026.6.8 (8cafdcd)` (captured `node dist/index.js --version` on the deployed gateway, 2026-06-17 ~00:30 PDT)
- **Host**: emeric-nuc (hostname `emeric`) · Intel NUC · i7-12700H (Alder-Lake, 6P+8E) / 64GB · CachyOS (x86_64)
- **Gateway**: `node --no-maglev /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` (the `--no-maglev` CLI flag is load-bearing on this Alder-Lake seat — raptor/alder maglev-SIGSEGV class) · dist rebuilt + restarted onto `8cafdcd`
- **SHA-anchor (server-ref, not ls-remote)**: `git rev-parse HEAD` == `gh api repos/openclaw/openclaw/pulls/85651 --jq .head.sha` == dist `build-info.json` sha == build string == `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (four independent surfaces agree; no stale-route on this box)
- **Deploy note**: caught the head churning `10a0427`→`8cafdcd` mid-deploy (the FF re-sync advanced the tip while building); re-targeted to the live tip before proving (lineage + live-tip keepers applied clean).

### 🩸 Cael — cael-dgx
_(append)_

### 🌊 Ronan — ronan-dgx
_(append)_

### 🌫 Silas — silas-lothric
_(append)_

### 🌻 Elliott — elliott-legion
_(append)_

### 🪨 Rune — rune-rog-ally
_(append)_
