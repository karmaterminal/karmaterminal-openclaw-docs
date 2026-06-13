# swim-43/E1 — V1 pnpm build green

**Swim:** swim-43-v2026.5.5-full
**Block:** E — Rollout-supporting
**Row ID:** E1
**Tracker anchor:** karmaterminal/openclaw-bootstrap#915 (parent #907)
**Case file:** `SWIM/cases/E1.md`
**SUT SHA (target):** `24b76bf62afa7da77eed11ddd7f22c9eba019f58` on `frond/v2026.5.5/canonical`
**Evidence class:** repo-test
**Gather:** fresh detached worktree build on exact target SHA

```text
row_id:           E1
candidate_sha:    24b76bf62afa7da77eed11ddd7f22c9eba019f58
build_info_sha:   4dc0ba820d44e246857eb236795cd95348d2d401ef4736d46aa8a0bd0ccfc0ca  dist/build-info.json
sut:              candidate worktree (/tmp/oc-swim43-e1-24b76bf)
driver:           Ronan 🌊
monitor:          n/a (repo-test)
coord:            n/a (repo-test)
started_at:       2026-05-07T17:25:20-07:00
ended_at:         2026-05-07T17:26:55-07:00
command:          pnpm install && pnpm build
observed:         exit 0 after dependency hydration; build completed through write-cli-compat
verdict:          PASS
contamination:    first fire without node_modules failed method-wise (`tsdown` missing); corrected by hydrating same fresh worktree, then rerunning build
```

## Setup

- Fresh detached worktree created at `/tmp/oc-swim43-e1-24b76bf`
- Exact candidate checked out: `24b76bf62afa7da77eed11ddd7f22c9eba019f58`
- First attempt `pnpm build` was not a candidate verdict because the clean worktree had no dependencies installed yet
- Recovery step used the same worktree and hydrated dependencies before rerunning the build

## Procedure

1. Create fresh worktree at exact candidate SHA.
2. Attempt `pnpm build`.
3. Observe environment/precondition failure:
   - `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsdown" not found`
   - `WARN  Local package.json exists, but node_modules missing, did you mean to install?`
4. Hydrate the worktree with `pnpm install`.
5. Re-run `pnpm build` in the same worktree.
6. Record exit code and artifact hashes.

## Expected

`pnpm build` exits 0 on the exact target SHA and produces a clean dist.

## Actual

Hydrated rerun passed.

Key successful tail:

```text
[build-all] write-build-info
[build-all] write-cli-startup-metadata
[build-all] write-cli-compat
Process exited with code 0.
```

Artifact hashes captured after the successful build:

```text
4dc0ba820d44e246857eb236795cd95348d2d401ef4736d46aa8a0bd0ccfc0ca  dist/build-info.json
1e7c24b242e3819b48c133134554bff7b57bd1c029a124a5cca1e06b1f5fb0b2  dist/index.js
```

## Evidence

- Worktree prep + first-fire failure session: OpenClaw process `marine-bloom`
- Hydrated rerun session: OpenClaw process `nova-orbit`
- Successful worktree: `/tmp/oc-swim43-e1-24b76bf`

## Verdict

**PASS**.

The candidate SHA builds cleanly once the fresh worktree is hydrated. The first failure was a method/precondition miss, not a candidate-bytes failure.

## Notes

This row is intentionally narrow:
- it proves build-green on the candidate SHA
- it does **not** yet prove static checks (`E2`) or full test suite (`E3`)

Clean next move is `E2` rather than reopening wrapper or DNS lanes.
