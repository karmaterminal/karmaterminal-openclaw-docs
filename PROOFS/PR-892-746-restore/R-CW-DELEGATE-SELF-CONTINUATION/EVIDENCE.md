# R-CW-DELEGATE-SELF-CONTINUATION — Evidence (PR #892 restore)

**Row**: R-CW-DELEGATE-SELF-CONTINUATION
**PR**: karmaterminal/openclaw#892 — `feat(continuation): restore continue_work() in subagent sessions (#746)`
**SHA tested**: `bd38f52cd9` (PR-892 head, cherry-pick of `583903b422` onto assembly #886)
**Prince**: 🌫 Silas (silas-seat, lothric)
**Date**: 2026-06-03

## What this row proves

The **#746 thesis**: delegate sessions can call `continue_work(<seconds>)` to schedule their own next turn. The delegate is not limited to single-shot execution.

## Gap evidence (pre-PR-892, current live build)

Silas fired a `continue_delegate` proof-test on 2026-06-03 ~08:00 PDT from silas-seat (lothric) running the current assembly build (PR #886 HEAD `683e309118`, WITHOUT PR #892's cherry-pick):

- Subagent reported: **`CONTINUE_WORK NOT AVAILABLE — #746 is NOT in code.`**
- Tool was NOT in the subagent's available tool-list at runtime
- System-prompt DID advertise `continue_work` (per `subagent-spawn.ts:1458`) — silent-functional-divergence confirmed

This proves the gap is REAL on the current assembly build.

## Reference proof (original fix, different SHA)

The original proof at `PROOFS/0849551642/R-CW-DELEGATE-SELF-CONTINUATION/` proves the fix WORKS on SHA `6a23864d12` (PR #759's branch, `cael/746-continue-work-subagents`, 2026-05-22). That branch was never merged to the assembly — fix was lost when PR #714 closed.

PR #892 cherry-picks the same fix (`583903b422`) onto the current assembly (#886).

## Proof procedure (post-deploy)

After PR #892 deploys to a prince-seat:

1. From main session: `continue_delegate(task="call continue_work(reason='746-proof', delaySeconds=7) then on next turn report PROOF COMPLETE")`
2. Delegate spawns, processes task
3. Delegate calls `continue_work(7)` — must succeed (not "tool-not-available")
4. 7s wait, delegate wakes for turn-2
5. Delegate reports "PROOF COMPLETE" — verifies the full loop

**Pass criteria**: delegate reaches turn-2 via `continue_work()` self-election.
**Fail criteria**: delegate reports "CONTINUE_WORK NOT AVAILABLE" or never wakes for turn-2.

## Mechanic tested

- `followup-runner.ts`: threads `continueWorkOpts.requestContinuation` closure into `runEmbeddedAgent` when `continuation.enabled === true`
- `heartbeat-runner.ts:576-590`: exempts continuation-wakes targeting subagent sessions from main-redirect guard (already on assembly via upstream absorption)
- `openclaw-tools.ts:592-598`: tool-registration gate evaluates true when `continueWorkOpts` is supplied

## Status

- ❌ **PRE-DEPLOY**: gap confirmed at byte (proof-test returned NOT AVAILABLE)
- 🟡 **POST-DEPLOY**: pending — re-run proof procedure after PR #892 deploys to verify fix restores the capability

## Cross-references

- Original proof: `PROOFS/0849551642/R-CW-DELEGATE-SELF-CONTINUATION/EVIDENCE.md`
- Original trace: `d1d8ae4ce4b8a55a8d266b70a18d3590`
- Issue: karmaterminal/openclaw#746
- Fix PR: karmaterminal/openclaw#892
- figs /tableflip-essential: msg `1511740580`
