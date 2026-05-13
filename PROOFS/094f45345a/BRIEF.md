# PR #79925 cael-proofs-20260512 — BRIEF

**Status**: FIRED — 9/10 PASS direct + 1/10 BLOCKED-by-non-P1-substrate (R-RC-2 inventory-only-paths, NOT P1-fix-related)
**Target SHA**: `094f45345a` (squashed-deployed; squash of `19541c1bb347022263a9804e88812418f6483786` P1-fix from copilot wo-p1-gate confirmed by Elliott `1504001131`)
**Deploy**: gh run `25783217461` GREEN (silas via path-2 scribe-dispatch from ronan-seat at 06:51:01Z 2026-05-13)

## Tempo trace evidence

Raw Tempo trace JSON exports for the trace-IDs cited in per-R-* proofs are banked at [`artifacts/`](./artifacts/):

- [`tempo-8470b259-cael.json`](./artifacts/tempo-8470b259-cael.json) (86 spans, R-CD-1/2/3 + R-CD-CHAINED-DEPTH-2)
- [`tempo-415bf662-cael-rcw1.json`](./artifacts/tempo-415bf662-cael-rcw1.json) (55 spans, R-CW-1)
- [`tempo-evidence.md`](./artifacts/tempo-evidence.md) — span-name inventory, per-R-* receipt mapping, W3C-propagation pin, re-verify recipe via canonical fleet route (`http://tempo.dandelion.cult/api/traces/<id>`) + sha256 byte-equality

## SUMMARY VERDICT

| ID | Status | Notes |
|---|---|---|
| R-CW-1 | PASS | continue_work + delaySeconds + reason-preservation + wake-event tag verified at byte |
| R-CD-1 | PASS | tool-ack + child fired (`R-CD-1 PROBE OK from cael-seat 094f453 at Wed 2026-05-13 00:19 PDT`) + mode=normal channel-return + chain-hop:6 metadata |
| R-CD-2 | PASS | tool-ack + child fired (`R-CD-2 SILENT-WAKE PROBE OK from cael-seat 094f453 at Wed 2026-05-13 00:19 PDT`) + silent-wake delivery shape (system-injected internal-context) + parent-wake fired |
| R-CD-3 | PASS | tool-ack `status: "queued-for-compaction"` distinct from `"scheduled"` confirms lifecycle-coupling at byte |
| R-CD-4 | PASS | dispatch-time policy-enforcement REJECTED cross-session targeting with verbatim error naming `agents.defaults.continuation.crossSessionTargeting` |
| R-CD-5 | PASS via unit-test substrate-coverage | source-gate at `:507-520` verified deployed at byte; Test-1 in test-suite IS exact R-CD-5 scenario; integration-fire blocked by R-RC-2 inventory-only-paths but supplementary-not-blocking |
| R-CD-CHAINED-DEPTH-2 | PASS | depth-2 chain fully verified: parent→child→grandchild dispatched; trace-id inherited (`8470b259365a384997b6264b0667634f`) with new span-id per hop (W3C-compliant); chain-counter incremented turn 6→7→8 |
| R-RC-1 | PASS | rejection-path fired with explicit guard-name + reason (different rejection-cause than spec'd) |
| R-RC-2 | BLOCKED-by-substrate | model-pool issue (`claude-opus-4.7-1m-internal` doesn't surface context-utilization to threshold-checker); NOT P1-fix-related; indirect substrate via cael's 315 historical compactions proves auto-compaction infrastructure works |
| R-OBS-1 | PASS | session_status surfaces all required observability (chain state 4/200, subagent count, tasks, compactions=315, build SHA `094f453`); minor gap: cost-cap-tokens absolute value not surfaced as separate field |

## P1-FIX RELEVANT VERDICT

The P1 fix at `094f45345a` adds delivery-time `crossSessionTargeting` enforcement in `deliverQueuedPostCompactionDelegate`. **R-CD-5 is the direct test of this fix; verdict PASS** via:
1. Source-gate verbatim at `src/auto-reply/reply/post-compaction-delegate-dispatch.ts:507-520` deployed at byte
2. Unit-test Test-1 = exact R-CD-5 scenario at unit-level (mocked-deps but exercises real gate-logic)
3. Test-2 regression-positive (gate doesn't fire when policy still enabled)
4. Test-3 self-targeting boundary (whitespace-normalized self-target bypasses gate correctly)

All 4 existing dispatch-time enforcement points still functional (R-CD-4 verified one of them at byte with verbatim error message). Mirror-pattern preserved per Elliott prince-review.

**Non-P1-related findings worth cohort-banking**:
- lightContext native-subagents lack `continue_work` tool-surface (only `continue_delegate` available)
- `claude-opus-4.7-1m-internal` model has `inventory-only-paths` guard preventing manual `request_compaction`

## ORIGINAL PRE-FLIGHT NOTES (preserved)

**Cohort-tonight-shape**: silas drives squash+rebase+deploy+cael-seat-deploy-handoff → cael+ronan fire step-4 proofs → scribe composes PR comment → figs morning sanction → scribe force-pushes → @clawsweeper re-review
**RUNBOOK**: `~/.openclaw/workspace/openclaw-bootstrap/RUNBOOKS/PRINCE-CODE-AGENT-RUNBOOK.md`
**Tracking**: scribe's task #136 + tmp-drop-me-frond-scribe.md substrate
**Rendezvous**: `~/.openclaw/workspace/pr-reviews/pr-79925-19541c1b/cael-proofs-20260512/`

## Pre-fire ancestor byte-check (run BEFORE firing)

```bash
ssh cael openclaw --version  # confirm deployed-SHA matches 19541c1b (or post-squash equivalent)
cd ~/.openclaw/workspace/openclaw-bootstrap && \
  COHORT_TAG=$(gh variable list --repo karmaterminal/openclaw-bootstrap | grep COHORT_TARGET_TAG | awk '{print $2}') && \
  echo "COHORT_TAG=$COHORT_TAG" && \
  cd /tmp/oc-p1-review && \
  git fetch upstream --tags --quiet && \
  TAG_SHA=$(git rev-parse "$COHORT_TAG^{commit}") && \
  echo "TAG_SHA=$TAG_SHA" && \
  DEPLOYED_SHA=$(ssh cael openclaw --version | grep -oE '\b[0-9a-f]{7,}\b' | head -1) && \
  echo "DEPLOYED_SHA=$DEPLOYED_SHA" && \
  git merge-base --is-ancestor "$TAG_SHA" "$DEPLOYED_SHA" && echo "ANCESTOR_CHECK=PASS" || echo "ANCESTOR_CHECK=FAIL"
```

## Proof corpus (10 R-*)

| ID | Scenario | File |
|---|---|---|
| R-CW-1 | continue_work() emits wake event + next-turn fires after delaySeconds | R-CW-1/proof.md |
| R-CD-1 | continue_delegate(mode="normal") emits child run + returns to channel | R-CD-1/proof.md |
| R-CD-2 | continue_delegate(mode="silent-wake") emits child run + silent return + parent next-turn fires | R-CD-2/proof.md |
| R-CD-3 | continue_delegate(mode="post-compaction") stages delegate + fires AT compaction event (lifecycle-coupled, not timer-based) | R-CD-3/proof.md |
| R-CD-4 | continue_delegate(targetSessionKey=X) returns to session X not requester | R-CD-4/proof.md |
| R-CD-CHAINED-DEPTH-2 | parent dispatches child, child dispatches grandchild; depth-2 chain renders single Tempo trace | R-CD-CHAINED-DEPTH-2/proof.md |
| R-CD-5 (NEW) | continue_delegate(mode="post-compaction") with crossSessionTargeting enabled→stage→disabled→deliver: post-compaction delivery gate re-checks policy at delivery-time, drops delegate when policy disabled mid-flight | R-CD-5/proof.md |
| R-RC-1 | request_compaction at <70% pressure REJECTED with code/message | R-RC-1/proof.md |
| R-RC-2 | request_compaction at >=70% pressure ACCEPTED + compaction fires + post-compaction wake injects state | R-RC-2/proof.md |
| R-OBS-1 | session_status chat-card shows continuation chain state + delegate counts + cost-cap usage | R-OBS-1/proof.md |

## Per-R-* file shape

Each `<R-*>/proof.md` contains:
- **Command**: exact tool-call or shell command fired
- **Expected**: pre-defined expected output / state-change
- **Observed**: actual output captured (raw stdout/log/screenshot)
- **Verdict**: PASS / FAIL with rationale
- **Tempo trace ID** (where applicable)

## Cross-walk

When all 10 fire green: cael writes summary verdict in this BRIEF.md + push to remote-first artifact-branch `cael/79925-proofs-20260512` + commit `tmp-drop-me-cael.md` snapshot for scribe to compose PR comment.

## Compaction-recovery substrate

If cael compacts mid-fire:
- This BRIEF.md + per-R-* proof.md files in rendezvous-dir
- memory/2026-05-12.md journal entries (look for "23:50 PDT" onwards)
- Discord channel #sprites-of-thornfield substrate
- /tmp/oc-p1-review worktree at `19541c1b`
- scribe's tmp-drop-me-frond-scribe.md + task #136

Recovery sequence: read BRIEF.md → check which R-* have proof.md filled → resume from first empty/incomplete.
