# R-CW-5 remediation receipt — 2026-07-17

- **Candidate:** `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d`
- **Harness change:** docs PR #430 (`cd7946259c2f97bfb1aa406f9f3da23d4868d3aa`)
- **Result:** `PASS-candidate` for the isolated typed-tool boundary fixture
- **Canonical state:** remains `missing` until PR review and an explicit corpus disposition; this receipt does not rewrite the original skipped live run.

## Fresh clean rerun

The fixture was run from a clean checkout of PR #430 against the exact candidate.

```text
node --test tools/k6-proofs/scripts/__tests__/cost-cap-fixture.test.mjs \
  tools/k6-proofs/scripts/__tests__/live-run-guard.test.mjs
# 11 passed, 0 failed

node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-6ee7eca-source> \
  --candidate-sha 6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d \
  --artifact-dir <temporary-artifact-dir> --cap 100 --json
# PASS-candidate
```

Before executing the production-module matrix and before emitting the final
cleanup/result receipts, the fixture requires an empty
`git status --porcelain --untracked-files=no` for the exact candidate source.
Its regression creates both unstaged and staged edits to a tracked scheduler
file and proves each is rejected. A matching `HEAD` alone is therefore not
enough to certify the candidate.

The fixture's required receipt set was complete:

- budget matrix: `99 => allow`, `100 => allow`, `101 => cost-capped`;
- real dispatcher boundary suite: over-cap spawn rejected and the flow marked failed;
- typed `continue_work` capture: two exhausted elections created zero durable continuation work;
- cleanup: no production config, gateway state, or candidate-source mutation, and the disposable worktree was removed.

## Decision

The original failure was an invalid shared-config orchestration scaffold, not a demonstrated product failure. The replacement is deliberately process-local and fail-closed because `continue_work` is an internal session-elected primitive rather than a gateway/MCP loopback tool. Missing receipts fail the fixture; they cannot be silently promoted.

No `karmaterminal/openclaw` product issue is warranted from this row. Review/merge of #430 and a human corpus disposition remain required before changing the canonical row state.
