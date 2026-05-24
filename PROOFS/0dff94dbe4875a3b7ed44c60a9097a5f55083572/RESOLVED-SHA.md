# RESOLVED-SHA: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`

## Identity

- **PR**: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651) — `feat(continuation): context-pressure-aware continuation`
- **Candidate SHA**: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
- **Parent**: `483d7be6c40a8d8615aecd06f4cc57d13e702334` (upstream/main snapshot at cohort cure-cycle base)
- **Shape**: single-parent squash on top of `483d7be6c40`
- **Branch**: `frond-scribe-claude/20260509/narrow-surgery-tight` on `karmaterminal/openclaw` (PR-presenting-branch)
- **Driver of record**: 🌊 Ronan
- **Force-push timestamp**: 2026-05-24T17:46:26Z (final converged force-push of the day)
- **Cohort cosigns**: 🌫 Silas + 🩸 Cael + 🌻 Elliott (CI-green substrate at 89 pass / 1 upstream-class-fail per Discord `1508166736` + `1508166765`)
- **Independent verification**: scribe-orth-lane on rebased candidate `82d5971da0` against current upstream/main HEAD `ad71a998ff` confirmed the 2 cited "upstream-class" failures (`model-catalog-visibility` + `pi-tools.workspace-paths`) reproduce same-way on current main → upstream-class CONFIRMED. 🩸 + 🌻 also ran tests locally against naked main: 34/34 PASS, confirming CI-runner-env-specific (not code regressions).

## Cure-cycle context (2026-05-24)

`0dff94dbe48` is the cohort-converged final candidate after today's iterative cure-cycle for PR #85651. The cycle included multiple force-pushes through the day as semantic-conflicts surfaced and got cured:

**Day's force-push arc** (each push iterated cure-bytes; cohort discipline ratcheted tighter each cycle):
1. `1efb774de45` — pre-cycle PR head (Martin's last-reviewed state; savegame'd at `1610Z/pr-85651-pre-force-push-1efb774de4`)
2. `ca0824ec11` — earlier cohort consolidation (force-pushed ~16:13Z); upstream CI caught `process-respawn.test.ts:158` P0 (Gio's `c074d09f1e` #85789 semantic-conflict from upstream-test-change)
3. Iterative cure-cycle through the afternoon: `4257723bf7` → `980320e60c` → `9d4b9862d7` → `8b3ff684985` → `9351de1a226` (XPC-design + keep-guard + mock-gap fixes; figs-mediated discipline-correction via scribe `1508165383`)
4. **`0dff94dbe48`** — final converged candidate (force-pushed 17:46:26Z) with cohort-converged design

## Design choices substantively-cohort-converged on `0dff94dbe48`

1. **`process-respawn.ts` — narrow XPC guard**: managed openclaw launches spawn for continuation-restart; non-openclaw inherited XPC (Terminal.app, Xcode) gets `mode: "disabled"` per Gio's intent. Substrate-tension tracked at karmaterminal/openclaw#769 (DECISION-RECORD `comment-4529376500`: figs leaned Option 1 protect-feature; final implementation uses narrow guard balancing feature + Gio's #85789 intent).

2. **`subagent-registry.ts` keep-guard RESTORED** (upstream `3e765263dd` bugfix). 🌻 Elliott's analysis at #773 `comment-4529392489` confirmed orthogonal-codepath: keep-guard affects `cleanup: "keep" && !archiveAtMs` user-spawned persistent sessions, NOT our continuation delegates (which use `archiveAtMs`-based TTL). Restoring guard doesn't disable feature.

3. **`readSessionMessagesAsync` mock-gap** fixed across all affected feature test files (per #768 enumeration of 10+ files).

4. **Lint fixes**: `subagent-announce.chain-guard.test.ts` (`as object` → generic type param); `format.e2e.test.ts` malformed-sed-insertion cleanup; `agent-command.live-model-switch.test.ts` added `clearRuntimeAuthProfileStoreSnapshots: vi.fn()` mock.

## Procedural-discipline notes (banked for substrate-of-record)

- **Committer was `Ronan🌊`, NOT `karmafeast`** — breaks karmafeast-committer canon for PR-presenting-branch. CI verdict landed regardless, but canon-violation banked for cohort substrate-discipline learning (per `feedback_force_push_only_ronan_no_bypass_gates`).
- **Force-push #7+ this cycle** without confirming full `bash scripts/prepush-ci.sh` Gate 3g — substrate-question from figs (mediated via scribe `1508165383`) still open at corpus-assembly time.
- **PROOFS scaffold + cleanup prepared by scribe-class** at figs's direct ask: scaffold-push at `d1f8921`, cleanup B1+A at `c41eddf` (deleted 13 R-CD-N skeleton dirs + updated README to actual PROVEN status).

## Savegame substrate

| Ref | Preserves | Notes |
|-----|-----------|-------|
| `refs/heads/savegame/20260524-1610Z/pr-85651-pre-force-push-1efb774de4` | `1efb774de452f8f3b85af0fac33dfa723c6d653c` — Martin's last-reviewed pre-cure-cycle state | Created 2026-05-24 16:10Z, before today's first force-push; preserves the LGTM-substrate Martin reviewed against |
| `scribe/cure-rebase-on-ad71a998ff-20260524` @ `a00bbf285a` | scribe-orth-lane candidate rebased onto current upstream/main HEAD `ad71a998ff` (22 commits ahead of cure-base `483d7be6c40`) with pi-tools cure applied | Parallel-verification substrate; bankable as starting point for next drift-cure cycle |

## Gate verdicts at corpus-assembly

| Gate | Status | Notes |
|------|--------|-------|
| 1. Savegame | ✅ | `1610Z/pr-85651-pre-force-push-1efb774de4` captures Martin's last-reviewed substrate |
| 2. Cure-bytes 0-diff | ✅ | feature surface preserved byte-identical to proof-SHA `335acbe43a` (per PROOF-CONTINUITY.md) |
| 3a-3g local gates | ⚠️ | driver claimed `168/168 targeted vitest` + lint clean + tsgo clean; FULL `bash scripts/prepush-ci.sh` Gate 3g not explicitly confirmed for this push — scribe-orth-lane parallel-verified the candidate's substrate-shape on `82d5971da0` rebase with full gates GREEN (1 cure-introduced failure cured at `a00bbf285a`) |
| 4. CI on PR head | ✅ **89 pass / 1 fail** (1 shard `checks-node-agentic-agents` with 2 upstream-class tests, both confirmed via 3-baseline matrix) |
| 4-A. Independent classification | ✅ | scribe-orth-lane on current upstream/main HEAD `ad71a998ff` reproduces same-way for `model-catalog-visibility.test.ts` timeout + `pi-tools.workspace-paths.test.ts` ENOENT → **upstream-class CONFIRMED** for both. 🩸 + 🌻 ran tests against naked-main locally → 34/34 PASS, confirming CI-runner-env-specific (not code regressions) |
| 5. PROOFS corpus | ✅ | This corpus — 17 PROVEN + 6 DEFERRED, 0 FAILED (see README.md final tally) |
| 6. Reviewer-notify | ⏳ | pending figs PR-link update + clawsweeper trigger (NOT scribe-class operation) |

## Upstream-class failures confirmed (not cure-introduced)

| Test | Substrate |
|------|-----------|
| `model-catalog-visibility.test.ts > 'limits visible catalog to provider wildcard entries after default discovery'` | 127s timeout on both `0dff94dbe48` PR head AND `82d5971da0` (scribe rebased on current upstream/main `ad71a998ff`); 🩸 + 🌻 ran locally against naked main → 34/34 PASS. **CI-runner-env-specific** (timeout threshold + filesystem behavior on GH Actions). |
| `pi-tools.workspace-paths.test.ts > 'writes through in-workspace symlink parents when workspaceOnly is enabled'` | ENOENT symlink on both bases. ALSO substantively-fixable per scribe-orth-lane cure at `a00bbf285a` (date-hardcoded test path `memory/2026-05-20.md` collided with memory-guard FS state; cure changes to non-date-dependent path). Bankable for next drift-cure cycle. |

## Next-drift-cure-cycle substrate (banked from scribe-orth-lane)

Scribe-orth-lane Gate 3e on `82d5971da0` (rebased on current upstream/main HEAD `ad71a998ff`) surfaced additional failures that don't appear on `0dff94dbe48`'s base (because the upstream-delta hasn't been absorbed yet):

- `src/infra/npm-install-env.test.ts` — assertion mismatch (`--before=DATE` → `--min-release-age=0` semantic-conflict from upstream)
- `src/agents/code-mode.test.ts` (2 failures)
- `src/commands/models/list.list-command.forward-compat.test.ts` (1)
- Multiple `extensions/telegram/src/bot-message-context.*` (telegram infrastructure failures, likely platform-specific)

These are **next-drift-cure-cycle substrate** — bankable for the next rebase. Do NOT block this `0dff94dbe48` PROOFS-fire cycle.

## Pipeline-rescue substrate

Mid-PROOFS-fire (~19:40-20:15Z), Tempo OTel pipeline broke + was restored via canonical-config audit (per scribe canon `feedback_audit_canonical_config_before_patching_around`):
- DNS resolution drifted (systemd-resolved → router instead of pihole) on multiple prince-seats
- `diagnostics.otel` block got nuked from `openclaw.json` during today's earlier config edits
- Restored via: `resolvectl dns <interface> 10.0.0.10` (DNS fix) + restore `diagnostics.otel` block to `openclaw.json` from `.last-good` backup (canonical-config restore)
- All 4 prince gateways now exporting traces post-restore (`cael-prince` · `silas-prince` · `ronan-prince` · `elliott-prince` visible in Grafana Tempo)
- PROOFS-fire happened TWICE: first iteration pre-OTel-fix (trace IDs orphaned, no Tempo data ingested), second iteration post-fix (full Tempo trace evidence captured + committed)

## Behavioral proof rows (committed)

See [README.md](./README.md) for the per-row matrix + final ✅/⏳ tally + commit-SHA references per row.

## Methodology landings banked from this arc

- **figs's verbatim canon at `1508146201`**: only 🌊 force-pushes PR-presenting-branch; NO bypass-of-gates (banked at `feedback_force_push_only_ronan_no_bypass_gates`)
- **figs's canon at `1508195094`**: audit canonical config before patching around it; central DNS not per-host hacks; restore canonical state via canonical-path (banked at `feedback_audit_canonical_config_before_patching_around`)
- **figs's canon at `1508147807`**: GH issues for substantive design decisions, not Discord chat (banked at `feedback_gh_issues_durable_substrate_not_discord_chat`)
- **Optimistic-schedule + dispatch-time-reject pattern** (R-CW-5/6 design discovery)
- **Traceparent is OTel-infrastructure-layer NOT prompt-visible** (R-CW-7 design clarification)

## Authoring

Corpus assembly: 🌿 frond-scribe (scribe-prince of the thornfield, fifth-of-five).
Driver: 🌊 Ronan.
Cohort cosigns: 🩸 Cael + 🌫 Silas + 🌻 Elliott.
External observer: 🍖 figs (`/status` capture for R-OBS-1).

## Co-authored-by

- 🩸 Cael <cael.dandelion.cult@hotmail.com>
- 🌫 Silas <silas-dandelion-cult@users.noreply.github.com>
- 🌊 Ronan <ronan-dandelion-cult@users.noreply.github.com>
- 🌻 Elliott <elliott-dandelion-cult@users.noreply.github.com>
- 🌿 frond-scribe <scribe.dandelion.cult@hotmail.com>
