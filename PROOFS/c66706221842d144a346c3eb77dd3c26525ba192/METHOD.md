# METHOD.md

## Methodology

This corpus follows `PROOF-CORPUS-METHOD.md` (ratified 2026-05-16 from PR #79925 drift-cure CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418`). One commit per row group, push direct to `karmaterminal-openclaw-docs:main`, no branch/PR detour per figs's "one clean main for cohort + reviewers" directive.

## Reproducer commands

### Gate 1 — Savegame verification

```bash
git ls-remote https://github.com/karmaterminal/openclaw.git refs/heads/savegame/cure-22-candidate-c667062218
# expect → c66706221842d144a346c3eb77dd3c26525ba192
```

### Gate 2 — Cure-bytes byte-identical reproduction

```bash
cd <openclaw-checkout>
git fetch origin
git fetch https://github.com/openclaw/openclaw.git main
PR_HEAD_PRE=e0a273405be058c5e838a155e9def40f7982db21
CANDIDATE=c66706221842d144a346c3eb77dd3c26525ba192

for f in \
  ui/src/styles/usage.css \
  .github/workflows/mantis-discord-thread-attachment.yml \
  ui/src/ui/views/usage-render-overview.ts \
  docs/gateway/doctor.md \
  .github/workflows/mantis-discord-status-reactions.yml; do
    bytes=$(git diff $PR_HEAD_PRE..$CANDIDATE -- "$f" | wc -c)
    echo "$f → $bytes bytes diff"
done
# expect all → 0 bytes diff
```

### Gate 3 — FULL local gates

Per PR-DRIFT-CURE-GATES-RUNBOOK §Gate 3, run from cure-(22) candidate worktree:

```bash
cd <cure-22-candidate-worktree>
git checkout $CANDIDATE
pnpm install --frozen-lockfile  | tee gates/gate-3a-pnpm-install.log
pnpm tsgo                        | tee gates/gate-3b-pnpm-tsgo.log
pnpm tsgo:test                   | tee gates/gate-3c-pnpm-tsgo-test.log
pnpm check                       | tee gates/gate-3d-pnpm-check.log
OPENCLAW_VITEST_MAX_WORKERS=16 pnpm vitest run | tee gates/gate-3e-pnpm-vitest.log
pnpm build                       | tee gates/gate-3f-pnpm-build.log
```

### Gate 3e — Naive-upstream-main worktree byte-walk (failure classification)

Per PR-DRIFT-CURE-GATES-RUNBOOK §Gate 3e:

```bash
UPSTREAM_HEAD=b7ba7c3f2a1e0c8bfead084596911aa7a0ef9852
git worktree add /tmp/oc-bw-mainHEAD-cure22-gate3e $UPSTREAM_HEAD
cd /tmp/oc-bw-mainHEAD-cure22-gate3e
pnpm install --frozen-lockfile
# Run each failing test-file in turn, capture per-file verdict
for f in <failing-test-file-list>; do
    OPENCLAW_VITEST_MAX_WORKERS=4 pnpm vitest run "$f" 2>&1 | tee -a /tmp/upstream-main-broken-class-receipt.log
done
```

Classification per failing test:
- **Failures reproduce on naive upstream/main** → upstream-class, NOT cure-(22)-introduced. Inherited unchanged.
- **Failures only at CANDIDATE_SHA** → rebase-introduced OR ordering-condition; byte-walk further to classify.

### Reproduce the cure-(22) merge resolution independently

```bash
git fetch origin
git fetch https://github.com/openclaw/openclaw.git main
PRE=e0a273405be058c5e838a155e9def40f7982db21
git worktree add --detach /tmp/oc-cure22-reproduce $PRE
cd /tmp/oc-cure22-reproduce
git rebase b7ba7c3f2a1e0c8bfead084596911aa7a0ef9852

# Single conflict expected: src/agents/pi-embedded-runner/run.overflow-compaction.test.ts
# 2 conflict-blocks at lines 276-332 + 693-859 (both = full deleted-test bodies upstream PR #83845 modified)
# Resolution: delete both conflict-blocks wholesale, accept everything outside
# Then: git add . && git rebase --continue
# Verify: grep -c toolAuthProfileStore src/agents/pi-embedded-runner/run.overflow-compaction.test.ts  → expect 2
# Verify: grep -c "xai:work" src/agents/pi-embedded-runner/run.overflow-compaction.test.ts            → expect 1
```

### Gate 4 — Behavioral proof row fires (post fleet-deploy)

Each prince at deployed CANDIDATE_SHA fires assigned rows per PROOF-CORPUS-METHOD per-prince-assignment-table. See README.md verdict-table for assignments.

For each fire:
1. Capture tool-result payload (delegate-return-payload / wake_event_evidence / compaction_accept_request_receipt)
2. Extract Tempo trace ID from journal `[continuation:…]` log line
3. Fetch span hierarchy: `curl http://tempo.dandelion.cult/api/traces/<trace-id>` → save as `<descriptive>_trace.json`
4. Commit to `R-XX/<descriptive>_*.{txt,json,md}` per row's evidence shape
5. Update verdict-table in README.md alongside row commit

### Gate 5 — Pre-push intent surface

Per Sanction Discipline canon `1504142962`: cohort-cosign + broad-warrant; no fresh-figs-permission-gate manufactured. figs's go-signal IS the discrete-pause-point AT Gate 5 (intent-to-force-push surface ≥1 cohort-tick before push-fire), NOT a separate gate above cohort-cosign.

### Gate 6 — Post-push verify + reviewer notify

```bash
gh pr view 79925 --repo openclaw/openclaw --json headRefOid,mergeable,mergeStateStatus
# expect:
#   headRefOid = c66706221842 (CANDIDATE_SHA)
#   mergeable = MERGEABLE
#   mergeStateStatus = UNSTABLE (CI pending) or CLEAN
```

Reviewer notify template:
- New SHA + lease-byte explanation (`e0a273405b` → `c66706221842`)
- Reviewer's specific named asks → status (FIXED / etc.)
- Proof corpus link: `https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/c66706221842d144a346c3eb77dd3c26525ba192/`
- Upstream-class-failures framing (if Gate 3e found upstream-class failures): "corrections made; we inherit these failing tests unchanged"
- Deploy verification: fleet 4/4 on CANDIDATE_SHA with bypass_validation audit-logged reason

### Restart-on-break (figs `1504663337` canon)

If break is found at any post-ship point (CI fail / claw flag / reviewer ask) → **back to Gate 1**. Do NOT patch in place. The PR branch is special-prezzy; full ceremony every cycle.

## Runbook anchors

- `RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md` — 6-gate procedure
- `RUNBOOKS/PROOF-CORPUS-METHOD.md` — corpus shape + per-prince row assignments + Tempo trace requirement + honest-substrate-findings taxonomy
- `RUNBOOKS/PRINCE-CODE-AGENT-RUNBOOK.md` — default-reflex-dispatch substrate (cohort cure-(22) initially missed; corrected mid-cycle at byte)
- `RUNBOOKS/HOW_TO_DO_A_CLEAN_VERSION_UPDATE_FOR_CONTINUE_FEATURE.md` — Lane-A tag-version-update (NOT this lane; do not conflate)

## Lane substrate at byte (in-flight)

- **Lane A** (🩸 cael-seat, copilot CLI gpt-5.5 xhigh, pid 1431834): Gate 3 completion (3d/3e/3f). Output: `gates/gate-3{d,e,f}-pnpm-{check,vitest,build}.log` + `LANE-A-REPORT.md`. Timeout: 60min.
- **Lane B** (🌊 ronan-seat, claude-opus-4-6 via claude_session_start, session `ronan-cure22-lane-b`): Gate 3e naive-upstream-main worktree byte-walk for 14 vitest failure classification. Output: `gates/upstream-main-broken-class-receipt.log` (folded from `/tmp/codeagents/wo-cure22-gate3e-lane-b/upstream-main-broken-class-receipt.md`).
- **Lane C** (🌊 ronan-seat direct, narrative-class per Pattern E): This corpus seed-write. Output: this PROOFS/c66706221842/ directory structure.
- **Fleet-deploy + R-row fires**: gates on Lane A + B + C substrate-stable.
