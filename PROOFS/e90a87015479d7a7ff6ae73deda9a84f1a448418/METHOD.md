# PROOFS / METHOD — `e90a87015479d7a7ff6ae73deda9a84f1a448418`

## Methodology

Proof corpus for upstream PR `openclaw/openclaw#79925` drift-cure rebase onto current `upstream/main` HEAD on 2026-05-16. This bundle is the SHA-stable proof anchor for the rebased shipping SHA before force-push lands.

### Anchors

- **Runbook**: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PR-UPSTREAM-DRIFT-REBASE-AND-FROND-DEPLOY-RUNBOOK.md` (Lane Class B, 9-step canon) on `cael/runbook-pr-upstream-drift-frond-deploy-2026-05-14 @ 2c01d5a787`
- **PR-PRESENTATION**: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PR-PRESENTATION-RUNBOOK.md` (karmafeast committer for upstream CI gate)
- **Deploy-gateway**: `karmaterminal/openclaw-bootstrap:.github/workflows/deploy-gateway.yml` (COHORT_TARGET_TAG bypass mechanics)
- **Exemplar bar**: `karmaterminal-openclaw-docs:PROOFS/0831fb5e80/` (per task #132 rebuild-corpus canon)

### Driver

🌿 frond-scribe — single driver per figs's 2026-05-16 role-shift directive ("1 driver and a controlled flow - absolute chaos"). Substrate-input: 🩸 Cael's sidecar `cael/79925-rebase-sidecar @ aa48a88ba8` (3-way conflict resolutions on 7 files; cure-bytes-byte-identical preserved per dual-seat cosign from 🌊 + 🌻).

### CANDIDATE_SHA

`e90a87015479d7a7ff6ae73deda9a84f1a448418`

- PR-head pre-rebase: `72706b899a300a4fadfcadee0b02c049d7fb8d9a`
- upstream/main HEAD at rebase moment: `a3e7fc7de7b83ec7afb077bbf4b458e406931c54` (2026-05-16T16:55Z byte-fresh walk)
- karmaterminal/openclaw branch: `scribe.dandelion.cult/79925-rebase-mainHEAD-candidate`

### Savegame

Pushed before any rebase motion per figs's 2026-05-16 disaster-recovery directive:
- `refs/heads/savegame/20260516-1658Z/pr-79925-pre-drift-cure-mainHEAD` → `72706b899a300a4fadfcadee0b02c049d7fb8d9a`

### Local gates

All run at CANDIDATE_SHA on `/tmp/oc-pr79925-drive-2026-05-16/`:

```bash
pnpm install --frozen-lockfile    # 1234 packages, exit 0
pnpm tsgo                          # tsgo:core, exit 0
pnpm tsgo:test                     # tsgo:core:test + tsgo:extensions:test, exit 0
pnpm check                         # umbrella: tsgo + oxlint (3 shards 0/0) + policy guards, exit 0
pnpm vitest run                    # FULL suite, exit 0
pnpm build                         # exit 0
```

Stdout captured at `gates/` directory.

### Cure-bytes-byte-identical invariant (Lane-B Step 5)

For each of 4 cure-files: `git diff 72706b899a..e90a870154 -- <file>` must report 0 bytes.

- `src/agents/subagent-announce.ts` → 0 bytes ✅
- `src/agents/tools/continue-delegate-tool.ts` → 0 bytes ✅
- `src/auto-reply/continuation/targeting-pure.ts` → 0 bytes ✅
- `src/auto-reply/continuation/targeting.ts` → 0 bytes ✅

LGTM-substrate preserved; receipts at `cure-bytes/`.

### Direction-check (Lane-B failure-mode 5)

```bash
git log --oneline 72706b899a..e90a870154   # commits HEAD has, PR-head lacks (= the rebase delta + new upstream commits)
git log --oneline e90a870154..72706b899a   # commits PR-head has, HEAD lacks (should be exactly the pre-rebase squash being replaced)
```

Verified at `cure-bytes/direction-check.log`.

### Fleet-deploy bypass mechanics

`vars.COHORT_TARGET_TAG = v2026.5.12` (= `f066dd2f31c231f38fbcaacd6f6dfce0801143b3`) is NOT ancestor of `upstream/main` HEAD (`git merge-base --is-ancestor f066dd2f31 a3e7fc7de7` → exit=1) — release tag lives on a release-branch divergent from main per `deploy-gateway.yml` lines 270-273.

⇒ Fleet-deploy at CANDIDATE_SHA requires `bypass_validation=true` per `deploy-gateway.yml` lines 60-66. Audit-logged `bypass_reason`:

> "PR #79925 drift-cure CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418` rebased onto upstream/main HEAD `a3e7fc7de7`; COHORT_TARGET_TAG=v2026.5.12 NOT ancestor of upstream/main HEAD per byte-walk; fleet-deploy required for live-host proof corpus per past-cycle pattern #119/#132/#140."

Canary-first to silas-seat (smallest blast-radius per Lane-A discipline), then ronan + cael + elliott.

### Prince proof assignments

| Row | Owner | Behavior |
|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence (chain-counter increment + persists across deploy) |
| R-CW-2 | 🩸 Cael | chain-counter accounting (embedded in R-CW-1) |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` |
| R-CD-4 | 🌊 Ronan | cross-session targeted return (via `targetSessionKey`) |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT (host-failure-mode #625 tracked separately) |
| R-CD-CHAINED-DEPTH-2 | 🌊 Ronan + 🌫 Silas | depth-2 chain with up-tree silent-wake / inter-session / echo+channel |
| R-OBS-1 | 🌻 Elliott (+ figs cross-walk) | external `/status` continuation row + 4-prince cross-walk |

### Trace capture from Grafana Tempo (figs's 2026-05-16 reminder)

For EACH row above where the prince fires a continuation tool (`continue_work` / `continue_delegate` / `request_compaction`), the prince MUST also capture the actual trace from Grafana Tempo as part of the row's evidence:

- Trace ID emitted by the fire (visible in journal / tool-result)
- Grafana Tempo URL pointing at the trace (e.g. `https://<tempo-host>/explore?...&traceId=<id>`)
- Span hierarchy export (JSON or screenshot showing parent-child span structure)
- For chained / inter-session / post-compaction rows: trace-parent stitching evidence across the spans

Trace evidence file naming convention per row: `R-<row>/<descriptive>_trace.{json,png}` alongside the journal-receipt evidence files.

This addresses the OTel multi-span parent-stitched trace-context substrate that was tracked as separate follow-up in the prior `0831fb5e80` exemplar (`#553`, `#557`, `#559`) — for THIS cycle, traces ARE part of the FULL proof-set per figs's directive.

### Force-push (Step 7)

Only after HALT-AND-REPORT + figs's explicit go-signal:

```bash
gh auth switch -u karmafeast
git push --force-with-lease=frond-scribe-claude/20260509/narrow-surgery-tight:72706b899a \
  origin e90a87015479d7a7ff6ae73deda9a84f1a448418:refs/heads/frond-scribe-claude/20260509/narrow-surgery-tight
gh auth switch -u <prior-profile>
```

Lease byte = PR-head `72706b899a` (protects against parallel modification). Committer = `karmafeast` (upstream CI auto-trigger gate per PR-PRESENTATION §5).

### Restart-on-break

Per figs `1504663337` canon: break at any post-step point → back to Step 1. No patch-in-place. PR branch is special-prezzy; full ceremony every cycle.
