# RESOLVED-SHA — `077b261dd820d16a2667369e3006c4efdd6b0ef0`

**Short**: `077b261`
**Runtime build string**: `OpenClaw 2026.6.2 (077b261)`
**Fleet deploy**: ALL SIX princes live on `077b261dd8` via `deploy-gateway.yml` (karmafeast, figs-authorized msg `1516223767`), 2026-06-15 ~16:37–16:50 PDT — all 6 runs completed/SUCCESS:

| Prince | Seat | deploy-gateway run | Result |
|---|---|---|---|
| 🩸 Cael | cael-dgx | `27583557535` | ✅ success (canary) |
| 🌻 Elliott | elliott-legion | `27583847383` | ✅ success |
| 🌫 Silas | silas-lothric | `27583849928` | ✅ success (Path-B) |
| 🌊 Ronan | ronan-dgx | `27583852652` | ✅ success |
| 🕯 Emeric | emeric-nuc | `27583855160` | ✅ success |
| 🪨 Rune | rune-rog-ally | `27583857813` | ✅ success |

**Long loop**: cut — fresh gateways, clean restart, candidate bytes live (🌫 PONG post-restart, 🌊 3/3 continuation tools registered on deployed seat, all seats byte-confirmed server-ref `077b261dd8`).

## What this SHA is

`077b261dd8` = the assembly tip `frond-scribe/20260613/assembly-drift-cure`:
- pr-presentation `frond-scribe-claude/20260509/narrow-surgery-tight` (`599f7ba0c9`)
- **+ #1027** telegram store-isolation (merge → `68fa726286`)
- **+ #1029** active-memory recall-isolation (merge → `077b261dd8`)

This corpus certifies the **runtime-half** of the continuation feature + the two test-isolation cures (#1027 telegram, #1029 active-memory) on the EXACT deployed SHA each prince runs. Per the clawsweeper principle (figs `1507594486`): every row stands ALONE at this SHA — its own EVIDENCE.md + dispatch-result + channel-receipts + Tempo trace. No inherited evidence.

## Gate verdicts (CI belt `27579901505` on `077b261dd8`, both arches — byte-confirmed checkout)

| Gate | Verdict |
|---|---|
| active-memory `index.test.ts` | ✅ GREEN 148/148 BOTH arches (#1029 cure) |
| telegram `:1403` store-isolation | ✅ GREEN (#1027 cure) |
| codex-supervisor flake | ✅ cleared |
| install-sh / compaction-planning-worker / shell-snapshot | ⚠️ provably-upstream receipts (origin/main `93b7e3d7` reds them too, belt `27558857124`) |
| browser/server.agent-contract-core | ⚠️ byte-identical-upstream (test 0-diff + source 0-diff) → isolation/flake-class, NOT product-regression |
| slack/monitor/message-handler/prepare | ⚠️ drift-divergent (077b is 131-behind upstream on slack; classifies clean after the drift-correct follow-up) |

**Zero ours-reds remain.** The two genuine ours-reds (active-memory, telegram) are fixed source-clean + GREEN both arches.

> **Scope note (Option-1 sequencing per figs `1516213568`):** this is the *deploy-now + runtime-proofs* SHA. The drift-correct onto upstream/main (for mergeability → upstream-CI + Clawsweeper review + PR-presentation update) is the deliberate follow-up; this corpus certifies the deployed runtime.

## Per-seat host info

_Princes: append your seat's runtime build string + host + channel-witness below (per template), confirmed from your deployed gateway._

---

_Corpus stood up by 🌿 frond-scribe (copilot) — `frond-scribe/20260613/assembly-drift-cure` driver. Per-row behavioral evidence + Tempo traces land per the PER-PRINCE ROW ASSIGNMENTS in README.md._
