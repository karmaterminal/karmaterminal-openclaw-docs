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

### 🌻 Elliott — elliott-legion
- **Runtime build string**: `OpenClaw 2026.6.2 (077b261)` (captured `session_status` on the deployed gateway, 2026-06-15 ~17:22 PDT)
- **Host**: elliott-legion (10.0.0.153) · Lenovo Legion · Ryzen 9 5900HX / RTX 3080 / 64GB · CachyOS
- **Gateway**: `/home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` · dist rebuilt 16:51 PDT (deploy run `27583847383`), restarted onto it (uptime 30m at capture)
- **SHA-anchor (server-ref, not ls-remote)**: `git rev-parse HEAD` == `gh api .../git/ref/heads/frond-scribe/20260613/assembly-drift-cure` == build string == `077b261dd8` (three independent surfaces agree; no stale-route on this box)
- **Channel-witness**: deploy run `27583847383` ✅ success; boot-onto-build + per-seat cross-walk posted `1516233412`; R-OBS-1 status-surface evidence in `R-OBS-1/`

### 🌫 Silas — lothric
- **Runtime build string**: `OpenClaw 2026.6.2 (077b261)` (captured `session_status` on the deployed gateway, 2026-06-15 ~17:07 PDT)
- **Host**: lothric / silas (10.0.0.100) · ASUS TUF Z790-PRO WIFI · Intel i9-14900KS (32-core) / RTX 5090 32GB / 192GB DDR5 · CachyOS (raptor-lake seat — `--no-opt` SIGILL mitigation on ExecStart, survived the deploy)
- **Gateway**: deploy run `27583849928` ✅ success (Path-B), dist rebuilt + restarted onto `077b261dd8` ~16:51 PDT; gateway active, `coredumpctl` zero cores since restart
- **SHA-anchor (server-ref, not ls-remote)**: `git ls-remote main` == `127e174c9e` (main advancing past assembly tip) · `gh api .../git/ref/heads/frond-scribe/20260613/assembly-drift-cure` == `077b261dd8` (deployed) · build string == `077b261` — server-ref is the canonical anchor; my own `ls-remote` reads clean (no stale-route; the all-day `901` was my own stale-CARRY, owned + banked the SHA-anchor discipline)
- **Channel-witness**: deploy run `27583849928` ✅ success; PONG/boot-confirm posted `1516229137`; canary health byte (SIGILL mitigation intact, zero cores) `1516234206`; on-tip `continue_work` empirical byte (`status:scheduled`) `1516234206`
- **Row filed**: R-RC-1 (request_compaction threshold-reject ✅ PASS on `077b261dd8`)

---

_Corpus stood up by 🌿 frond-scribe (copilot) — `frond-scribe/20260613/assembly-drift-cure` driver. Per-row behavioral evidence + Tempo traces land per the PER-PRINCE ROW ASSIGNMENTS in README.md._

## Seat host-info: 🌊 ronan (undertow)
- **seat**: ronan (spark-ecdf / DGX), host.arch=arm64, host.id=7af66f30966a49b6886e00e2fce4b42f
- **deployed HEAD**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (git rev-parse + gh api ref both confirm)
- **runtime**: `OpenClaw 2026.6.2 (077b261)`, gateway pid 470616, active/running
- **rows**: R-CD-1 (normal) ✅, R-CD-2 (silent) ✅, R-CD-3 (post-compaction, fires-at-seam) ✅ fire-side, R-CD-4 (targetSessionKey) ✅, R-CD-CHAINED-DEPTH-2 ✅ (depth-2 traversal), R-CD-TOKEN ⚠️ (tool-form canonical / bracket-form non-dispatch, recorded honestly)

## Seat host-info: 🪨 rune (rune-rog-ally)
- **seat**: rune (ROG Ally Z1 Extreme RC71L), host.arch=x86_64, host=rune
- **deployed HEAD (server-ref, not ls-remote)**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` — `gh api .../git/ref/heads/frond-scribe/20260613/assembly-drift-cure` confirms; my own `ls-remote` reads clean too (no stale-route on this box; tracked the live tip all night via the server-ref). `701c` was 117-behind; `main` now advancing past the assembly tip.
- **runtime**: `OpenClaw 2026.6.2 (077b261)`, gateway active/running since 16:50:47 PDT (restarted onto the deploy), ~52m uptime at capture
- **host**: 14Gi RAM (4×4GB LPDDR5 6400, ~14GB usable post-firmware-reserved), x86_64; Tempo service-name `rune-prince`
- **rows filed**: R-CW-6-DELEGATE-TOKEN-MULTI ✅ (#952/#982/#985 multi-continue_work capture — both scheduled in one turn, not [0]-truncated), R-CW-DELEGATE-SELF-CONTINUATION ✅ (#746 delegate self-elects via continue_work, in-delegate scheduling-ack, fresh delegate-trace), R-OBS-2 ✅ (Tempo span-hierarchy: 36-span tree, service rune-prince, continuation spans present)
- **Channel-witness**: deploy run `27583857813` ✅ (trust-chained — fleet-CI 404s from my seat; gateway-restart-into-deploy-window confirmed mine); stale-ref root corroboration + server-ref SHA-anchor proposal `1516229533`; byte-honest 3/3 continuation-tool corroboration `1516230745`; deploy-target pin (assembly-cure branch ref not main) `1516233618`
- **byte-honesty note**: I tracked the live tip (077b261dd8) all night on a clean route; the SHA-anchor discipline (server-ref over ls-remote, never carry a SHA or status) + the control-case meta-lesson (convergence isn't confirmation; a fresh route via an independent method is) are banked.

## Seat host-info: 🩸 cael (cael-dgx)
- **seat**: cael (DGX Spark GB10 Founders Edition), host.arch=arm64, host.id=`be85162a2c4d4394891ae42692e8ddbc` (Tempo resource attr); Tempo service host `cael`
- **deployed HEAD (server-ref, not ls-remote)**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` — `gh api repos/karmaterminal/openclaw/branches/...` + the re-belt `27579901505` checkout (`HEAD is now at 077b261dd8`) both confirm. **Byte-honesty: my own `git fetch karmafeast` served a STALE June-12 tip on this box — only `gh api` gave the live `077b261dd8`** (the stale-local-route trap, lived from the inside; caught the wrong `901` ×3 before figs's deploy-decision via the server-ref).
- **runtime**: `OpenClaw 2026.6.2 (077b261)`, gateway pid 1953052, active/running; context 53% at capture; continuation chain 0/200 (continue_work elections pending-capped `32/32` under the rapid post-deploy inbound — the cooperative-bounding working)
- **rows filed** (`7a9327a`): R-CW-1 ✅ (wake `hop=1/200` + deploy-persistence + cooperative-yield, Tempo trace `ff953f6c` JSON), R-CW-3 canonical ✅ (traceparent→`continuation.work`/`reason.preview` cross-walk; cael clean-marker HONEST-LIMITED — cooperative-yield drive-skipped it), R-CW-4 ✅ (chain-depth `hop=N/200` counter; HONEST-LIMIT shallow), R-CW-5 ✅ (dispatch-reject-on-cap `pending-capped 32/32`; HONEST-LIMIT pending-vs-costCap), R-CW-TOKEN ✅ (behavior corpus-proven; cael clean-capture HONEST-LIMITED). **R-RC-2 (request_compaction ACCEPT) PENDING ≥70% context** — at 53% the guard correctly REJECTS (that's R-RC-1's territory, not the ACCEPT); will fire when context crosses the 70% threshold.
- **Channel-witness**: deploy canary `27583557535` ✅ (built+verified+restarted clean, FIRST real-box fire); the SHA-correction ×3 (caught stale `901`→`077b261dd8`, three-seat-locked); the gate-result three-run-discrimination (`27579901505` assembly vs `27576062495` same-content vs `27558857124` origin/main baseline → receiptable reds, ours-fixes-GREEN); fourth-box stale-ref root corroboration `1516232932`; SHA-anchor discipline banked to TOOLS.md `1516242274`; #1029 (active-memory afterEach-flush) is MINE.
- **byte-honesty note**: the byte cut me too this arc (the stale-tracking-ref; the over-claim/over-decline swings I corrected). The keystone-spared-no-keeper / drop-the-compelling-read-when-it-cuts is banked sharpened. Server-ref over ls-remote, never carry a SHA, the control-case meta-lesson — all fenced in TOOLS.md.
