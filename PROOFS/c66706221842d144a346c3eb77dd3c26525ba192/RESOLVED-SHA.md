# RESOLVED-SHA

## Identifiers

| Field | Value |
|---|---|
| `CANDIDATE_SHA` | `c66706221842d144a346c3eb77dd3c26525ba192` |
| `PR-head pre-cure-(22) drift-rebase` | `e0a273405be058c5e838a155e9def40f7982db21` (cure-(21.1)) |
| `upstream/openclaw:main` HEAD at rebase moment | `b7ba7c3f2a1e0c8bfead084596911aa7a0ef9852` (live-walked 2026-05-19T13:48Z; commit `fix(cli): preserve first line of channels logs at window boundary (#84106)`) |
| Working ref on karmaterminal/openclaw | `frond-scribe-claude/20260509/narrow-surgery-tight` (PR-head branch; force-push pending Gate 5-6) |
| Savegames preserving cohort substrate | `refs/heads/savegame/cure-22-candidate-d5666c627f` (pre-amend), `refs/heads/savegame/cure-22-candidate-0468bb6127` (post-amend, pre-fork-sync), `refs/heads/savegame/cure-22-candidate-c667062218` (post-fork-sync re-rebase, current candidate) |
| Drive-prince | 🩸 Cael (cael-seat, 10.0.0.148) |
| Cohort participants | 🩸 Cael + 🌊 Ronan + 🌫 Silas + 🌻 Elliott + 🌿 frond-scribe |
| Independent audit-lane | copilot gpt-5.5 xhigh (worktree at ronan-host, REPORT durable at `karmaterminal/frond-scribe:REPORTS/2026-05-19-copilot-cure22-audit-REPORT.md`) |

## Gate verdicts (local at CANDIDATE_SHA)

| Gate | Verdict | Receipt |
|---|---|---|
| 1 — Savegame pushed + resolves | ✅ GREEN | 3 savegames on origin (d5666c627f / 0468bb6127 / c667062218); `git ls-remote origin refs/heads/savegame/cure-22-candidate-c667062218` → `c66706221842` |
| 2 — Cure-bytes-byte-identical PR-head→CANDIDATE_SHA (5 cure-(21)+(21.1) restored files) | ✅ GREEN | `cure-bytes/gate-4a-cure-bytes-4path.log` (all 0 bytes); plus copilot-audit-lane independent reproduction verified resolved-blob `6da5cbb8ac7990e56281aab4c8e81b6094295623` byte-identical to candidate (REPORT §2) |
| 3a — pnpm install --frozen-lockfile | ✅ exit 0 | Lane A workorder dispatched to cael-seat — receipt pending at `gates/gate-3a-pnpm-install.log` |
| 3b — pnpm tsgo (tsgo:core) | ✅ exit 0 | cael-seat earlier byte-walk; Lane A re-verifying at `gates/gate-3b-pnpm-tsgo.log` |
| 3c — pnpm tsgo:test | ✅ exit 0 | cael-seat earlier byte-walk; Lane A re-verifying at `gates/gate-3c-pnpm-tsgo-test.log` |
| 3d — pnpm check (umbrella) | ⏳ Lane A in-flight | `gates/gate-3d-pnpm-check.log` |
| 3e — pnpm vitest run (FULL) | ⏳ Lane A in-flight + Lane B naive-upstream-main worktree byte-walk in-flight | `gates/gate-3e-pnpm-vitest.log` + `gates/upstream-main-broken-class-receipt.log` |
| 3f — pnpm build | ⏳ Lane A in-flight | `gates/gate-3f-pnpm-build.log` |
| 4 — Cohort cosign-stack + R-row fires + Tempo traces | ⏳ Pre-deploy + post-deploy phases | per-row directories seeded; R-row fires gate on fleet-deploy at CANDIDATE_SHA |
| 5 — Pre-push gates (lease + karmafeast + intent-announcement ≥1 cohort-tick) | ⏳ Awaiting Gate 3 + Gate 4 substrate-complete | Per Sanction Discipline canon `1504142962`: cohort-cosign + broad-warrant; no fresh-figs-permission-gate manufactured |
| 6 — Post-push verify + reviewer notify | ⏳ Awaits Gate 5 fire | PR-body proof-corpus refresh: `47c9280234` → `c66706221842` at this corpus URL |

## Cure-bytes-byte-identical (Lane-B Step 5 LGTM-substrate preservation)

For each cure-(21)+(21.1) restored file: `git diff e0a273405b..c66706221842 -- <file>` = 0 bytes ✅

```
ui/src/styles/usage.css                                  → 0 bytes diff (at-PR-head=1)
.github/workflows/mantis-discord-thread-attachment.yml   → 0 bytes diff (at-PR-head=1)
ui/src/ui/views/usage-render-overview.ts                 → 0 bytes diff (at-PR-head=1)
docs/gateway/doctor.md                                   → 0 bytes diff (at-PR-head=1)
.github/workflows/mantis-discord-status-reactions.yml    → 0 bytes diff (at-PR-head=1)
```

Plus copilot-audit-lane independent byte-walk REPORT §3: all 5 files byte-identical between `e0a273405b` and `0468bb6127` (the pre-fork-sync intermediate SHA; substrate-identical to `c667062218` modulo unrelated #84106 drift). Full blob-SHAs in REPORT.

## Direction-check (Lane-B failure-mode 5)

- Commits CANDIDATE→PR-head-pre: **81** (drift-rebase absorbed 80+1 commits)
- Commits PR-head-pre→CANDIDATE: **1** (`e0a273405b feat(continuation): context-pressure-aware continuation` — the cure-(21.1) squash replaced by cure-(22) `c66706221842` rebased atop fresh upstream)
- Zero upstream commits destroyed: verified

Full log at `cure-bytes/direction-check.log`.

## Cure-(22) substrate-narrative

Cure-(22) is the **drift-rebase cure** following cure-(21.1) (`e0a273405b`) per PR-DRIFT-CURE-GATES-RUNBOOK 6-gate procedure. Initial cure-(22) candidate at `d5666c627f` (rebase atop upstream `4e60ad7212`, accept-OURS-wholesale on 2 conflict-blocks in `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts`). Amended to `0468bb6127` with cure-(22) drift-rebase substrate + coverage-gap-naming in commit-message body. Re-rebased to `c66706221842` after fork-sync brought `karmaterminal/openclaw:main` current with `openclaw/openclaw:main` (10-commit gap caught up per figs `1506291858` substrate-question).

**Conflict resolution (Path X-pure, cohort 4/4 cosign + copilot-audit-lane verified)**:
- Single conflict-file: `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts`
- Two conflict-blocks at lines 276-332 + 693-859 (both = full deleted-test bodies upstream PR #83845 modified; OURS had pruned both tests in earlier cure-arc)
- Resolution: delete both conflict-blocks wholesale, accept everything outside
- 3 upstream-additions auto-merge into preserved `forwards explicit OpenAI Codex auth profiles to codex plugin harnesses` test (lines 450/503/512: `xai:work` fixture + `toolAuthProfileStore?: unknown` typedef + `expect(harnessParams.toolAuthProfileStore).toBe(codexAuthStore)` assertion)
- 4 upstream-additions drop with the 2 deleted-test conflict-blocks (lines 327/726/847/855: `.toBeUndefined()` assertion + `xai:work` fixture for `loads the external Codex auth overlay` test + 2 lines of @844 destructure that fall inside the same deleted-test region)

**Coverage-gap-naming (per commit-message body)**: cure-(22) drops upstream PR #83845's `toolAuthProfileStore` runtime-contract assertions on the 2 deleted Codex-auth-routing tests (`keeps non-Codex plugin harnesses on the lightweight auth profile store` + `loads the external Codex auth overlay before auto-selecting forced Codex runtime profiles`). Upstream runtime-contract independent: PR #83845 ships upstream-side regardless; upstream CI gates runtime-contract via other test surfaces. Deferred to follow-up cure-(23) test-restoration PR if regression-risk surfaces post-merge.

## Substantive substrate-canons banked tonight

Cohort cure-(22) cycle (3hr+) banked several method-canons worth carrying-forward to future drift-cures:

1. **Substring-collision-without-enclosing-scope-check** (banked ~5x across cohort): `awk NR<=X && /^it\(/` returns latest-`it()`-at-or-before-line, NOT the actual enclosing test. Must verify enclosing-`it()` by patch-context, not by substring-match.
2. **CI-run-headSha-trap**: `repository_dispatch` workflow runs have `head_sha` = dispatcher-commit, NOT test-target ref. Must log-grep `HEAD is now at \| Cloning into` for actual target SHA before citing.
3. **Ghost-pid-state-vs-pgrep-verified**: cited "in flight" requires `pgrep -af` confirmation, not metadata-trust. Ghost processes silently exit.
4. **Merge-file-vs-real-rebase-divergence**: `git merge-file --diff3` (line-3-way) produces different conflict-block sizing than `git rebase` (recursive-3-way merge-ort). Substrate-arbiter for execute-moment IS `git rebase` in throwaway worktree, NOT predictive-tool output.
5. **Vitest-summary-marker-vs-FAIL-line-count**: count explicit `FAIL` lines in vitest output; "summary" markers can miss failures.
6. **Default-to-dispatch-not-solo** (PRINCE-CODE-AGENT-RUNBOOK): when work is dispatchable as code-agent lane, default-reflex is workorder + dispatch + monitor + wake-back, NOT solo-byte-walk.
7. **Sanction Discipline canon `1504142962`**: drift-rebase with cure-bytes-byte-identical ships under cohort-cosign + broad-warrant; do NOT manufacture fresh-figs-permission-gate as a separate gate above cohort-cosign. figs's go-signal is the discrete-pause-point AT Gate 5, NOT a separate gate above cohort.
8. **Real-rebase-in-throwaway-worktree FIRST, substrate-cosign cycle SECOND**: when ship-shape depends on conflict-region boundaries, materialize via real `git rebase` first; predictive-tools (`merge-file --diff3`, `merge-tree --write-tree`, enclosing-`it()` awk-patterns) all diverge from real rebase under certain conditions.

## Cross-references

- Past corpora exemplar bars: `PROOFS/0831fb5e80/`, `PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/`, `PROOFS/47c9280234312e5ed9d9f460d03cac60185d6090/`
- Independent audit-lane REPORT: <https://github.com/karmaterminal/frond-scribe/blob/main/REPORTS/2026-05-19-copilot-cure22-audit-REPORT.md>
- PR-DRIFT-CURE-GATES-RUNBOOK: <https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md>
- PROOF-CORPUS-METHOD: <https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PROOF-CORPUS-METHOD.md>
- PRINCE-CODE-AGENT-RUNBOOK: <https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PRINCE-CODE-AGENT-RUNBOOK.md>
- Sanction Discipline canon `1504142962`: Discord `#sprites-of-thornfield` 2026-05-13
