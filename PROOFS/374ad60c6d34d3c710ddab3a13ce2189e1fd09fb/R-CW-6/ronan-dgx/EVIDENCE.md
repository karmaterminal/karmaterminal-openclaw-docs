# R-CW-6 exact-candidate fixture evidence

- Issue: `karmaterminal/karmaterminal-openclaw-docs#475`
- Candidate: `374ad60c6d34d3c710ddab3a13ce2189e1fd09fb`
- Reviewed docs harness: `a566100da92a87a7fa61d5d742a745f5964d4dbf`
- Execution seat: `ronan-dgx`
- Execution class: isolated process-local fixture
- Fixture time: `2026-07-30T10:34:47Z`
- Regression: `karmaterminal/openclaw#1203`
- Proposed state: `fail`

## Result

The single authoritative fixture invocation returned `FAIL-fixture`. Exact
candidate source, pnpm 11.15.1, frozen-lockfile dependency provenance, the
direct max-chain matrix, both delegate dispatcher boundaries, cleanup, and
public-artifact safety passed. The required runtime scheduler, durable recovery,
and typed-tool surface did not produce passing receipts.

## Receipts

| Receipt | Result |
|---|---|
| `fixture-readiness.json` | PASS: candidate source, pnpm, lockfile, local executables, and worktree integrity verified |
| `boundary-matrix.json` | PASS: hops 2 and 3 allowed; hop 4 returned `chain-capped` |
| `runtime-boundary.json` | FAIL: production scheduler runtime receipt did not pass |
| `durable-state-recovery.json` | FAIL: at-limit reload/recovered rejection contract did not pass |
| `typed-tool-surface.json` | FAIL: typed `continue_work` boundary contract did not pass |
| `dispatch-boundary-suite.json` | PASS: selected max 3 and candidate regression dispatcher suites passed |
| `cleanup.json` | PASS: disposable worktree removed; source remained clean; no gateway, config, or fleet state touched |
| `public-artifact-safety.json` | PASS: private paths and prohibited fields absent |
| `fixture-result.json` | `FAIL-fixture` |

This fixture used the typed `continue_work` surface. The token-form sibling is
R-CW-TOKEN (#483); its live run was not fired because Ronan's deployed runtime
did not match the candidate. No second R-CW-6 fixture invocation was performed.

Tempo and gateway-journal receipts are not applicable to this process-local
fixture. It did not contact a gateway, provider, or live session, and it did not
deploy or restart anything.

## Public-safety statement

No secrets are present. These artifacts contain no tokens, actual session keys,
prompt bodies, nonces, raw gateway payloads, user content, or private filesystem
paths.
