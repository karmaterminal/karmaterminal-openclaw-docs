# R-CW-5 remediation receipt — 2026-07-17

- **Candidate:** `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d`
- **Harness change:** docs PR #430 (pending independent rereview)
- **Result:** reported local `PASS-candidate` for the isolated typed-tool boundary fixture; this document is not itself a canonical corpus receipt
- **Canonical state:** remains `missing` until PR review and an explicit corpus disposition; this receipt does not rewrite the original skipped live run.

## Fresh clean rerun

The fixture was rerun from the clean PR worktree against the exact candidate.
The final receipt-producing command must be rerun after the PR head is independently
approved; the local results below are reported evidence, not a corpus fold.

```text
node --test tools/k6-proofs/scripts/__tests__/cost-cap-fixture.test.mjs \
  tools/k6-proofs/scripts/__tests__/live-run-guard.test.mjs
# 122 passed, 0 failed (full proof script suite)

node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-6ee7eca-source> \
  --candidate-sha 6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d \
  --artifact-dir <temporary-artifact-dir> --cap 100 --json
# PASS-candidate

# non-default-cap regression: the typed surface receives the same cap
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-6ee7eca-source> \
  --candidate-sha 6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d \
  --artifact-dir <temporary-artifact-dir> --cap 200 --json
# PASS-candidate
```

Before executing the production-module matrix and before emitting the final
cleanup/result receipts, the fixture requires an empty
`git status --porcelain --untracked-files=no` for the exact candidate source.
Its regression creates both unstaged and staged edits to a tracked scheduler
file and proves each is rejected. A matching `HEAD` alone is therefore not
enough to certify the candidate.

The artifact destination is also fail-closed: it rejects an existing receipt,
an unsafe final directory, and every existing symlink component in its ancestor
path. Public readiness contains only the candidate identity/match booleans,
tracked-clean status, cap, and no-production-mutation booleans; it never stores
the private absolute source path. The fixture reuses only a real (non-symlinked)
pre-existing dependency directory and performs no install. This proves the
tracked candidate source and the stated local dependency condition, not a
cryptographically locked dependency provenance claim.

The fixture's required receipt set was complete:

- budget matrix: `<cap - 1> => allow`, `<cap> => allow`, `<cap + 1> => cost-capped`
  (reported runs covered both `99/100/101` and `199/200/201`);
- real dispatcher boundary suite: over-cap spawn rejected and the flow marked failed;
- typed `continue_work` capture: two exhausted elections created zero durable continuation work;
- cleanup: no production config, gateway state, or candidate-source mutation, and the disposable worktree was removed.

## Decision

The original failure was an invalid shared-config orchestration scaffold, not a demonstrated product failure. The replacement is deliberately process-local and fail-closed because `continue_work` is an internal session-elected primitive rather than a gateway/MCP loopback tool. Missing receipts fail the fixture; they cannot be silently promoted.

No `karmaterminal/openclaw` product issue is warranted from this row. Review/merge of #430 and a human corpus disposition remain required before changing the canonical row state.
