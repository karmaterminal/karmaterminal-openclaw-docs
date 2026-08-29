# Covenant retention-authority fix

## Named-reference contract

| Category | Named reference | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | N/A - product refs were out of scope | N/A | N/A | N/A | N/A |
| Safe lane implementation ref | `codeagent/129388-covenant-proof-retention-authority-fix-20260828` | `281552c039dcf45f7fdc3a7960448f0e989ea801` | `281552c039dcf45f7fdc3a7960448f0e989ea801` | `281552c039dcf45f7fdc3a7960448f0e989ea801` | equal before the report-only successor |
| Final report-only successor | This `output.md` handoff | N/A | N/A | Recorded in the corrected COMPLETE receipt | Report content cannot contain its own commit SHA |
| CI/workflow ref | N/A - focused docs validation only | N/A | N/A | N/A | N/A |
| Presentation ref | N/A - `openclaw/openclaw#129388` is issue binding only and remained out of scope | N/A | N/A | N/A | N/A |
| Docs/proof ref | `codeagent/129388-covenant-authority-proof-harness-20260828` (docs base) | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | equal |

The safe lane was published unchanged at the docs base before evidence work. Implementation local, tracking, and server refs were resolved independently and were equal before this report-only successor.

## What changed

- Candidate `cleanup-draft.json` claims now land only in private `candidate-cleanup-diagnostic.json` with `passEligible: false`; no candidate `retained` or `allCaseHandlesClosed` value enters signed cleanup.
- The docs-owned scenario binds exact run/SHA/case-form identity, raw response bytes and digest, timing, and final gateway PID/start/socket. Redirect, forged-clean, and transparent-relay responses fail.
- Signed delegate, queue, and temporary-session counts come from launcher-owned no-follow reads of canonical isolated `state/openclaw.sqlite` `subagent_runs`/`flow_runs` and every contained `sessions.json`, once while the attested driver PID/start is alive and again after shutdown. The sets must remain stable.
- The durable inspector counts every retained subagent, every flow except `succeeded`/`failed`/`cancelled` (including `waiting`, `blocked`, and `lost`), and every session in the fresh synthetic runtime. Unknown flow status, missing stores, unexpected/symlinked paths, SQLite views, malformed state, and count overflow fail as `unverified-resource-retention`.
- `allCaseHandlesClosed` and the handle set derive from the docs-owned issued/closed/open request ledger plus exact case/form phase-chain coverage. Gateway and fixture-process counts derive launcher `/proc` PID/start/process-group/socket observations.
- `waitForJson` and sandbox `waitForFile` report `signalCode` as well as `exitCode`.

Sixteen files changed including this report. No `PROOFS/**`, current-corpus, product, presentation, or workflow ref was modified.

## Regression proof

**Invariant and owner boundary:** the trusted launcher/authoritative-receipt composition is the sole PASS authority. Candidate cleanup and gateway summaries are diagnostics/corroboration; canonical isolated durable stores, docs-owned case-handle ledger coverage, and launcher `/proc` observations determine cleanup.

On rejected docs SHA `78927a643e8b5894a389691e695c1eb6bd7d2b4b`, the added deterministic control:

```bash
node --test --test-name-pattern='candidate zero cleanup cannot mask docs-owned retained resources' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

failed 0/4 because retained delegate, queue-item, and temporary-session observations each still received `PASS-candidate` from candidate zero claims. The successor's full owner/closure run passes all controls, including:

- one real mutable retained delegate, queue item, or temporary session while candidate claims zero;
- missing/duplicated/open case-handle ledger coverage while candidate claims closed;
- missing/unsupported gateway or durable-store seam;
- stale/mismatched run, SHA, PID, start fingerprint, socket, URL, or timestamp;
- malformed, partial, count-mismatched, and over-limit responses;
- redirect, same-gateway forged-clean arrays, and transparent relay to a clean responder;
- alternate owner/controller keys, `waiting`/`blocked`/`lost` flow handling, unknown status drift, and SQLite view substitution;
- clean live/final store stability plus independent process teardown;
- gateway restart/recovery lineage and signal-terminated child failure.

## Validation

Acceptance path: **focused-only**.

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
# 70/70 pass

node --test tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs
# 2/2 pass

node tools/k6-proofs/scripts/validate-corpus.mjs --current
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
# all pass; current corpus remains 37 rows, 32 pass / 4 partial / 1 honest-limit

node --check <each changed JavaScript/MJS authority script>
# all pass

# JSON.parse over all six return-covenant schemas
# parsed 6

git diff --check
# pass
```

Independent review at exact pushed SHA `281552c039dcf45f7fdc3a7960448f0e989ea801` reran 70/70 and returned `VERDICT: CONFIRMED`: candidate cleanup self-report and forged/redirected/relayed gateway bytes cannot yield signed PASS while canonical isolated stores retain a delegate, queue item, temporary session, or the docs-owned handle ledger is open/missing/duplicated.

## Limits and uncertainties

- No exact-head product proof, live proof, Mode-B workflow, Gate 3g fallback, or PR was run/opened in this lane.
- The live durable-store read uses a bounded one-second scenario hold; a severely delayed launcher read fails closed as `unverified-resource-retention` rather than producing a false PASS.
- The docs-owned inspector validates canonical paths, real table types, required columns, and source identity, but does not pre-pin the complete product DDL. Exact product proof still requires review that the pinned candidate uses these canonical stores as its source of truth.
