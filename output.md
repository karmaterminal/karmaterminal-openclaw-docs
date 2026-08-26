# PR #129388 backend-disposition verdict semantics

## Named-ref identity gate

The unchanged safe lane was published before contract evidence was evaluated.
Exact commits and immutable run metadata are used where no branch ref applies.

| Category | Named ref | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base | `karmaterminal/karmaterminal-openclaw-docs@a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | N/A (immutable commit) | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Equal |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-backend-disposition-verdict` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | `a1b52de161185efcd4e503e9b1e962e76c67a7b0` | Equal; unchanged branch published |
| CI/workflow | Focused docs harness tests | N/A | N/A | N/A | N/A; this lane is `focused-only` and uses no external workflow ref |
| Presentation | `openclaw/openclaw#129388` | N/A | N/A | N/A | N/A; protected and untouched |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs` Actions run `32956764849` | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | N/A (immutable run head) | `ef850a6943bda22a863c7608c07d707b0b8a49ff` | Equal; local commit object matches the run's recorded `headSha` |

The directly reviewed implementation successor was
`2e38c8d53691df17795d3be50f7873f8e66278a8`; local, remote-tracking, and
server branch refs all resolved to that full SHA after push. The final
output-only child is reported by the required COMPLETE message.

## Material verdict

The row title and pipeline define `R-OBS-BACKEND-DISPOSITION` as proof that a
degraded backend is classified explicitly instead of producing a zero that reads
as absence. Its manifest and #517 require public-safe status receipts, classifier
controls, and rebind keys. They do not require this docs harness row to repair
Tempo or Loki.

Run `32956764849` is the decisive receipt. Tempo and Loki both returned HTTP
200. Both interactions remained `partial`; aggregate `complete` and
`countAuthority` remained `false`; both zero results remained
non-authoritative; all five classifier controls matched; all four required row
receipts were present; and every declared rebind key had a value. The rejected
harness emitted `PARTIAL-candidate` solely because it treated backend health as
row-contract completeness.

The corrected contract has two independent levels:

1. Backend health remains exactly `complete | partial | unavailable | capped | unknown`, with `complete` and `countAuthority` derived only from complete backend metadata.
2. The row emits `PASS-candidate` when exactly one Tempo and one Loki receipt are valid and public-safe, the observed status is `complete`, `partial`, or `capped`, degraded zeros are non-authoritative, all five classifier controls and all four required receipts pass, required artifacts exist, and rebind keys are complete.

`unknown`, `unavailable`, a failed query, a missing or invalid receipt, missing
controls, contradictory count authority, unsafe data, an incomplete rebind key
set, or a missing required artifact remains non-PASS. Ordinary
telemetry-dependent rows still require complete backend metadata; the exception
is reserved to `R-OBS-BACKEND-DISPOSITION`.

The manifest/schema, k6 scenario, shared classifier, row-list disposition
composer, summary postprocessor, evidence writer, candidate-envelope emitter and
consumer, pipeline/operator docs, and focused tests now carry the same rule.
OpenClaw product code, `PROOFS/INDEX.json`, docs main, and folded corpus bytes
were not changed.

## Regression completeness

| Requirement | Receipt |
|---|---|
| Exact invariant and owner | The `R-OBS-BACKEND-DISPOSITION` composition boundary (`handleSummary` -> `apply-telemetry-disposition.mjs` / `postprocess-k6-summary.mjs` -> candidate envelope) owns row acceptance. It must never alter `backend-status.json` health or count authority. |
| Rejected-base negative control | With `HEAD=a1b52de161185efcd4e503e9b1e962e76c67a7b0`, the new exact-receipt test exited 1 for the expected assertion: actual `PARTIAL-candidate`, expected `PASS-candidate`. |
| Successor control | The same run-32956764849 receipt now exits green as `PASS-candidate`, while `backendDisposition=partial`, `backendComplete=false`, and `backendCountAuthority=false` remain bound through the candidate envelope. |
| Nearest sibling | A partial backend receipt still withholds PASS for an ordinary telemetry row with `passScope=behavioral-only`. Complete and capped alternate paths are also pinned for the disposition row. |
| Missing/partial failure cases | Focused regressions cover absent backend status, a missing fourth receipt, unknown disposition, failed/unavailable query, incomplete rebind, contradictory count authority, unsafe public data, wrong run identity, missing artifacts, and sidecar tampering. |
| Persistence/recovery | Existing atomic-store append/finalize/re-read coverage passes; corrupt persistence, cross-run identity reuse, and changed rebind keys are rejected. Candidate validation re-reads the persisted receipt, normalized summary, artifacts, and siblings. |
| Rollback/restart | N/A. The row is read-only and mutates no gateway, backend, product state, config, or corpus. There is no restart or rollback path to exercise. |

The downloaded source receipt has SHA-256
`de6ec193dd85c830cfe8581a62f155d67e805da118e8e8f7d1306a34d32ab1fa`.
The committed fixture is field-for-field JSON-identical. The source artifact has
no terminal newline while the repository fixture uses the conventional terminal
newline; no receipt field differs.

## Focused validation

Rejected-base command:

```bash
node --test \
  --test-name-pattern='run 32956764849 complete partial receipt' \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs
```

Result on the rejected base: test-process exit `1`; tests `1`, pass `0`, fail
`1`; exact reason `PARTIAL-candidate` versus required `PASS-candidate`.

Successor focused owner command:

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/telemetry-backend-status.test.mjs \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/tempo-fetch.test.mjs \
  tools/k6-proofs/scripts/__tests__/loki-fetch.test.mjs \
  tools/k6-proofs/scripts/__tests__/collect-continuation-trace.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/golden-path.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-2-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-rc-2-honest-limit-policy.test.mjs \
  tools/k6-proofs/scripts/__tests__/observability-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/review-debt.test.mjs \
  tools/k6-proofs/scripts/__tests__/report-render.test.mjs
```

Result: tests `192`, pass `192`, fail `0`.

Catalog and syntax commands:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --check tools/k6-proofs/lib/telemetry-backend-status.js
node --check tools/k6-proofs/lib/telemetry-rebind.js
node --check tools/k6-proofs/scenarios/r-obs-backend-disposition.js
node --check tools/k6-proofs/scripts/apply-telemetry-disposition.mjs
node --check tools/k6-proofs/scripts/postprocess-k6-summary.mjs
node --check tools/k6-proofs/scripts/validate-candidate-run-result.mjs
node --check tools/k6-proofs/scripts/candidate-run-result-contract.mjs
git diff --check
```

Result: all passed. The manifest registry reports 42 manifests and 36 scenario
files; proof coverage reports 41 rows, 38 required rows, three supplemental
rows, and zero missing/manifest-only rows; 13 telemetry contracts validate and
zero claim a telemetry-rebindable PASS.

Scenario runtime inspection:

```bash
k6 version
k6 inspect tools/k6-proofs/scenarios/r-obs-backend-disposition.js
```

Result: `k6 v2.0.0`; one `shared-iterations` scenario, one VU, one iteration,
`maxDuration=1m0s`.

Acceptance path: **focused-only**. No Mode-B run or Gate 3g fallback was used or
claimed.

## Refire and fold handoff

No live refire or corpus fold was performed in this lane. The refire owner must
supply the reviewed bounded public-safe TraceQL and LogQL text; the public
artifact intentionally retains only their fingerprints.

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-backend-disposition-verdict \
  -f rows=R-OBS-BACKEND-DISPOSITION \
  -f candidate_sha=6aca9d1d9294376d0466cc8cc608ba731220aab9 \
  -f runtime_build_sha=6aca9d1d9294376d0466cc8cc608ba731220aab9 \
  -f dry_run=false \
  -f runner_labels_json='["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388 \
  -f tempo_traceql='<reviewed bounded public-safe TraceQL>' \
  -f loki_logql='<reviewed bounded public-safe LogQL>'
```

Review the resulting `backend-status.json`, `run-result.json`,
`candidate-run-result.json`, and `telemetry-disposition.json` together. A valid
repeat of the observed degraded response should show row
`PASS-candidate`, backend `partial`, `backendComplete=false`, and
`backendCountAuthority=false`. Folding remains a separate reviewed coordination
step; do not repoint `PROOFS/INDEX.json` or update the canonical corpus from this
lane.
