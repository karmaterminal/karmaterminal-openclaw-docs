# METHOD — proof-corpus methodology for `8b5dde6165`

Anchors: `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` (corpus shape, per-prince row assignments, Tempo-trace requirement, HONEST-LIMIT discipline) + `PR-DRIFT-CURE-GATES-RUNBOOK.md` (Gate 4) + the FORMAL-SWIM-RUNBOOK board.

## How the ship-SHA was assembled (history-preserving, no squash)

```bash
# canonical fold = Form-B slack-bearing base + matrix cherry-picks
git worktree add <wt> -b frond-scribe/20260609/formb-fold 0573362b55   # = 7992640e60 (Form-B head) + slack cure
git cherry-pick e38901a0b7 e7c30b4d15                                   # matrix-3 seed migration (RC=0)
# verify safety bytes
git grep -c compactionFailureContext HEAD -- src/agents/embedded-agent-runner/run.ts   # → 0 (never 4)
git grep -c saveSessionStore HEAD -- extensions/slack/src/monitor/message-handler/prepare.test.ts  # → 4
git diff --name-only 0573362b55 HEAD   # → 3 matrix test files only, zero prod
git push origin HEAD:refs/heads/frond-scribe/20260609/formb-fold        # = 8b5dde6165
```

## How the proof-correct runtime was deployed (the gate figs flagged: proofs need a deploy)

```bash
gh workflow run deploy-gateway.yml -R karmaterminal/openclaw-bootstrap \
  -f target_prince=<seat> -f ref=8b5dde6165958d0eaba3c492ae52311548313de4 \
  -f reason="GATES 20260609: Form-B canonical fold for behavioral PROOFS"
# canary one seat → verify gateway active on the SHA → fan to all 6
# verify per seat: ssh <seat> 'cd ~/flesh_beast_tmp/openclaw && git rev-parse --short HEAD; systemctl --user is-active openclaw-gateway'
#   → 8b5dde6165 / active  (all 6)
```

The behavioral rows fire the continuation primitives (`continue_work` / `continue_delegate` / `request_compaction`) on the **running** gateway at the ship-SHA, capturing real journal receipts + Tempo traces — distinct from (and additional to) the vitest test-logic green recorded in `RESOLVED-SHA.md`.

## Reproducers

- Test-logic gates (vitest on the exact SHA): `node scripts/run-vitest.mjs run --config test/vitest/vitest.<shard>.config.ts --maxWorkers=1` (NEVER raw vitest). Shards: timeout → `agents-embedded-agent`; matrix → `extension-matrix`; slack → `extension-slack`.
- Behavioral rows: fired from each prince's deployed seat per the row's `EVIDENCE.md` method block.

## Authoring discipline

One commit per row (`PROOFS/8b5dde6165…/R-XX: <brief>`), push direct to `karmaterminal-openclaw-docs` main (no branch/PR detour), `git pull --rebase` before each push (cohort writes concurrently). README verdict table refreshed alongside row commits (🌿 frond-scribe owns the index).
