# R-CW-5 exact-candidate fixture evidence

- Issue: `karmaterminal/karmaterminal-openclaw-docs#473`
- Candidate: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Reviewed docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Execution seat: `ronan-dgx`
- Execution class: isolated process-local fixture
- Fixture time: `2026-07-30T10:32:41Z`
- Regression: `karmaterminal/openclaw#1204`
- Proposed state: `fail`

## Result

The single authoritative fixture invocation returned `FAIL-fixture`. The clean
candidate source, frozen lockfile, cost-cap matrix, delegate dispatcher, and
cleanup checks passed. The required typed-tool surface returned exit 1 and did
not satisfy the fixture's no-durable-work contract.

## Receipts

| Receipt | Result |
|---|---|
| `fixture-readiness.json` | PASS: source HEAD and lockfile match the candidate; source was tracked-clean |
| `boundary-matrix.json` | PASS: token totals 99 and 100 allowed; 101 returned `cost-capped` |
| `typed-tool-surface.json` | FAIL: typed tool was captured and over-cap rejection was observed, but the no-durable-work contract did not pass |
| `dispatch-boundary-suite.json` | PASS: below/equal boundaries allowed, over-cap dispatch rejected, rejected flow failed |
| `cleanup.json` | PASS: disposable worktree removed; source remained clean; no production config or state touched |
| `fixture-result.json` | `FAIL-fixture` |

This fixture used the typed `continue_work` surface. The token-form sibling is
R-CW-TOKEN (#483); its live run was not fired because Ronan's deployed runtime
did not match the candidate. No second R-CW-5 fixture invocation was performed.

Tempo and gateway-journal receipts are not applicable to this process-local
fixture. It did not contact a gateway, provider, or live session, and it did not
deploy or restart anything.

## Public-safety statement

No secrets are present. These artifacts contain no tokens, actual session keys,
prompt bodies, nonces, raw gateway payloads, user content, or private filesystem
paths.
