# swim-43/E2 — V2 check / lint / type-check green

**Swim:** swim-43-v2026.5.5-full
**Block:** E — Rollout-supporting
**Row ID:** E2
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/E2.md`
**SUT SHA (target):** `24b76bf62afa7da77eed11ddd7f22c9eba019f58` on `frond/v2026.5.5/canonical`
**Evidence class:** repo-test
**Gather:** static gate run on the same hydrated fresh worktree used for E1

```text
row_id:           E2
candidate_sha:    24b76bf62afa7da77eed11ddd7f22c9eba019f58
build_info_sha:   4dc0ba820d44e246857eb236795cd95348d2d401ef4736d46aa8a0bd0ccfc0ca  dist/build-info.json
sut:              candidate worktree (/tmp/oc-swim43-e1-24b76bf)
driver:           Ronan 🌊
monitor:          n/a (repo-test)
coord:            n/a (repo-test)
started_at:       2026-05-07T17:27:23-07:00
ended_at:         2026-05-07T17:29:28-07:00
command:          pnpm format:check && pnpm check
observed:         format gate failed before check pipeline; exit 1
verdict:          FAIL
contamination:    none
```

## Setup

- Reused the hydrated fresh worktree from E1: `/tmp/oc-swim43-e1-24b76bf`
- Candidate remained pinned to `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- Static-gate sequence chosen was the honest minimal path for this row from this seat:
  - `pnpm format:check`
  - `pnpm check`

## Procedure

1. Run `pnpm format:check && pnpm check` in the hydrated candidate worktree.
2. Stop at the first failing gate.
3. Record the exact failure set rather than pushing through theatrically.

## Expected

Formatting check passes, then `pnpm check` passes all static gates.

## Actual

The first gate failed immediately:

```text
> openclaw@2026.5.5 format:check /tmp/oc-swim43-e1-24b76bf
> oxfmt --check --threads=1
```

Reported files:

```text
extensions/diffs/assets/viewer-runtime.js
extensions/line/src/monitor.lifecycle.test.ts
scripts/lib/local-build-metadata.d.mts
src/agents/pi-bundle-lsp-runtime.ts
src/agents/pi-bundle-lsp-runtime.windows-spawn.test.ts
src/agents/pi-embedded-runner/run/attempt.spawn-workspace.test-support.ts
src/commands/agent/session.test.ts
src/gateway/server-chat.stream-text-merge.test.ts
ui/src/ui/app-channels.test.ts
```

Tail of failure:

```text
Format issues found in above 9 files. Run without `--check` to fix.
Finished in 12895ms on 16205 files using 1 threads.
ELIFECYCLE Command failed with exit code 1.
```

Because the format gate failed, `pnpm check` did not run.

## Evidence

- OpenClaw process session: `wild-kelp`
- Candidate worktree: `/tmp/oc-swim43-e1-24b76bf`

## Verdict

**FAIL**.

This is a real static-gate failure on the candidate SHA as fired from a hydrated fresh worktree. It is not an environment miss.

## Notes

This row currently proves only the first failing static gate.

If the swim wants the full E2 failure surface later, the next step is a fix lane or a broader rerun after formatting remediation. For now the honest result is the first failing gate, not a guessed downstream summary.
