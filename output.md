# READY FOR SCRIBE REVIEW — R-CW-3 review-join harness correction

Writer: Silas, persistent Claude TUI lane. Coordinator: frond-scribe.
Canonical issue: https://github.com/karmaterminal/openclaw-bootstrap/issues/1727
Claim: https://github.com/karmaterminal/openclaw-bootstrap/issues/1727#issuecomment-6434929224

Local only. No push, no PR, no comment, no Discord, no live proof re-fire, no row promotion, no
gate signoff. Parent owns GitHub publication.

## Delivery

| Category | Named ref | Exact SHA | Equality |
|---|---|---|---|
| Product/base ref | `karmaterminal/karmaterminal-openclaw-docs:main` (frozen in the workorder) | `63535012e5928c3846a5af8507a747be33f26a56` | Worktree was anchored here; base tree `5e3d3f51adca8b9f828b91bb11b17f1286fb15f8`. |
| Reviewed code head | `silas/20261027/rcw3-review-join` (local, unpushed) | `8f6fd76095dd6101bb279dd262cf5b405f73fd39` | Tree `5142c689d450d2849ff1e3866ecb5b7de962f518`. Everything validated and GitNexus-reviewed below is this commit. Local only — no tracking or server ref exists by design. |
| Report-only successor | same branch tip | this commit | Adds only `output.md`. Its exact SHA and tree cannot be named from inside itself; they are recorded in `review-receipts/silas-1727-rcw3-fix/EXACT-HEAD.txt` and in the lane's return to the parent. |
| CI/workflow ref | N/A | N/A | Docs harness focused/offline gates only; no workflow dispatched. |
| Presentation ref | N/A | N/A | Local branch until authorized parent publication. |
| Docs/proof ref | frozen base above | `63535012e5928c3846a5af8507a747be33f26a56` | `PROOFS/` untouched. |
| Preserved product evidence candidate | J6 R-CW-3 runtime | `935ba44c1737caa017405c9fa881f4624ddfd4bc` | Read-only. Not a live product ref; nothing about it was altered. |

Worktree: `/home/figs/source/WORKTREES/docs-rcw3-review-join`, clean at head.
Durable journal and all receipts: `/home/figs/source/review-receipts/silas-1727-rcw3-fix/`.

### Changed paths (base..head)

```
M  tools/k6-proofs/README.md                                        |  39 +-
A  tools/k6-proofs/scripts/__tests__/r-cw-3-review-join.test.mjs    | 371 +
M  tools/k6-proofs/scripts/__tests__/r-cw-3-review.test.mjs         | 462 +-
M  tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs       | 410 +-
M  tools/k6-proofs/scripts/run-proofs.sh                            |  75 +-
5 files changed, 1277 insertions(+), 80 deletions(-)
```

| file | SHA-256 at head |
|---|---|
| `tools/k6-proofs/scripts/run-proofs.sh` | `28fb234e96c5d8a894983548af45335dd2515a599661601162e19830281b5cb7` |
| `tools/k6-proofs/scripts/review-r-cw-3-reason-telemetry.mjs` | `b151d2d7c96b2fbccf7225a5ab050456f1c2d2cd71ed3f59c8cfa97a6893bbca` |
| `tools/k6-proofs/scripts/__tests__/r-cw-3-review.test.mjs` | `f154a19de1f3e1774a781723e39425f1752a805dfe098636b98bf523e660e885` |
| `tools/k6-proofs/scripts/__tests__/r-cw-3-review-join.test.mjs` | `aac37bcd88367017c2b734dce65c32a8bb5f2eed189a9c6384e7efcf5f2d6b28` |
| `tools/k6-proofs/README.md` | `ca13a1a5f0c25aae6027b4e2af8be46d70966328ec02a54e60b07903e456040d` |

Scoped instruction files: this repository has **no** `AGENTS.md`, `.github/copilot-instructions.md`
or `process_bootstrap.xml` at the frozen base (`git ls-files` match is empty). The user-level
`~/.speckit/` adapter was read and carries no rule that changes this patch.

## Change

`run-proofs.sh` owned two unrelated notions of "review". `REVIEW_PENDING_RECEIPTS` tracked only
artifact **acquisition** (gateway journal, tempo trace, correlation receipt, public-safe evidence).
R-CW-3's manifest separately requires `reason-telemetry-redaction-review`, a **manual** gate. The
runner never read the second. A successful `collect-continuation-trace.mjs` therefore left the list
empty, `run-result.json` wrote `review.status: "ready-for-human-review"` with
`pendingReceipts: []`, and `validate-candidate-run-result.mjs` issued a candidate routing envelope
— while nobody had reviewed the reason telemetry. That is precisely the preserved J6 artifact
state, where the old summary still said `["tempo-trace-json","reason-telemetry-redaction-review"]`.

**Runner (3 hunks, all gated on `ROW_ID == "R-CW-3"`).** Seed the manifest-declared manual receipt
and never remove it. After public-artifact redaction — so the review reads the bytes that are
actually published — run the row's offline review helper with the runner's own frozen candidate
SHA, run id, matrix id and collected trace id as external anchors. Record the outcome in
`run-result.json` under `review.rowReview` with the receipt's SHA-256. A failed or impossible join
adds the separate explicit receipt `reason-telemetry-redaction-review-join`.

**Helper, strengthened from presence to a join.** It now requires the exported `reason.hash` and
`reason.length` on the work and fire spans to **equal this run's own recorded digest and length**;
re-derives the tool/work/fire span topology from the trace and requires it to match
`continuation-trace-correlation.json` exactly (one trace, one UUIDv4 chain, distinct spans, both
continuation spans parented to the originating `continue_work` tool span, matching fire-attempt
count, identical `chain.id`); binds candidate SHA, runtime build SHA, seat, run id, matrix id,
trace id and chain id across public evidence, runner metadata and the correlation receipt; and pins
the SHA-256 of all six source artifacts, including the run directory's frozen manifest and scenario
copies against the digests `runner-metadata.json` recorded. Trace identity comes from the
correlation receipt, because public evidence deliberately sanitizes `trace_id` to null — this
closes the provenance gap the prior read-only review flagged.

**Helper success is not acceptance.** The receipt records `manualAcceptanceRequired: true`,
`coordinatorAccepted: false`, `canonicalFoldForbidden: true`, `liveReRun: false`. The manual debt
survives, so R-CW-3 stays `review-pending`, keeps its VU `PARTIAL-candidate` verdict, and receives
no candidate routing envelope until a coordinator accepts the manual review. Reconciliation names
its source and retains the historical verdict with `overwritesOriginalEvidence: false`; no original
VU or summary artifact is written. A missing or malformed input now still writes a receipt with
`verdict: "review-pending"` and a named `error` instead of leaving silence.

## Repair regression

**Invariant and owner.** `run-proofs.sh` owns reconciliation of R-CW-3's manifest-declared manual
review receipt. Successful artifact acquisition may discharge acquisition debt only. The row's
manual reason-telemetry/redaction review is discharged by a coordinator, never by the runner and
never by a helper exit code.

**Deterministic cycle** (`node --test --test-concurrency=1` over both test files; logs 06–09):

| phase | production tree | result | exit |
|---|---|---|---|
| RED-1 | frozen base | 23 tests, 1 pass, **22 fail** | 1 |
| GREEN-1 | patched | 23 tests, **23 pass** | 0 |
| RED-2 | reverted to frozen base | 23 tests, 1 pass, **22 fail** | 1 |
| GREEN-2 | reapplied | 23 tests, **23 pass** | 0 |

The RED is behavioural, not cosmetic. On the frozen base the end-to-end runner test fails with
`actual 'ready-for-human-review' / expected 'review-pending'`, and the trace-missing test fails
with `reason-telemetry-redaction-review must stay pending`.

**Negative controls — none clears review debt or lifts the row.** All exit 1, all write a receipt
with `verdict: "review-pending"` and `coordinatorAccepted: false`:

| control | failing check |
|---|---|
| missing review (join not run / helper fails) | runner adds `reason-telemetry-redaction-review-join`; manual receipt retained |
| missing trace | receipt `error: no tempo-trace…`; both acquisition receipts also retained |
| missing correlation receipt | receipt names the missing input |
| wrong candidate SHA | `identityBound` |
| wrong run id | `identityBound` |
| wrong matrix id | `identityBound` |
| wrong trace id | `traceTopologyBound` |
| wrong chain id | `traceTopologyBound` |
| work/fire not parented to the tool span | `traceTopologyBound` |
| correlation not asserting one trace/chain/distinct spans | `traceTopologyBound` |
| changed source artifact digest (`row-scenario.js` tampered post-run) | `sourceDigestsBound` |
| mismatched reason hash | `reasonTelemetryMatchesEvidence` (while `safeReasonAttrsPresent` still passes — the exact blind spot of the old helper) |
| mismatched reason length | `reasonTelemetryMatchesEvidence` (ditto) |
| correlation claiming a different reason, or `rawPersisted: true` | `reasonTelemetryMatchesEvidence` |
| raw reason sentinel / prefix exposed in the trace | `rawReasonAbsentFromTempo` |
| failed behaviour predicate (each of dispatch / schedule / wake / public-raw-absent) | the corresponding behaviour check |
| malformed correlation receipt | explicit `error`, no silent pass |
| malformed evidence line | explicit `error`, no silent pass |

**Positive control.** Valid reviewed evidence produces a correctly bound receipt and claims nothing
live or canonical: verdict `reason-telemetry-redaction-review-passed`, binding to candidate SHA /
run id / matrix id / trace id / chain id, all six source digests pinned and equal to the runner
metadata, `coordinatorAccepted: false`, `canonicalFoldForbidden: true`, VU verdict still
`PARTIAL-candidate`, the original `r-cw-3-reason-telemetry-summary.json` byte-unchanged, and
`summarize-review-debt.mjs` reporting R-CW-3 as a `manual-review` pending row.

**Nearest sibling unchanged.** R-CW-1 is the nearest `continue_work` row with trace-only debt. Its
end-to-end control asserts `traceStatus: present`, `pendingReceipts: []`,
`status: ready-for-human-review`, no R-CW-3 review artifact. It passes identically in all four
phases — before and after the correction.

**Preserved real evidence.** The strengthened helper was run against byte-verified copies of the
preserved J6 public evidence (digests equal to the prior read-only review's): 12/12 checks, exit 0,
and it now resolves the real trace id `ed97f1870118915e8e310f0eb17e4848` from the correlation
receipt instead of reporting `null`.

**Persistence / rollback / partial failure.** The correction is locked by the two test files;
rollback is a revert of two production files. No runtime, gateway, config, service, DB or
deployment was touched, so restart/recovery is N/A. Partial failure is explicit by construction:
every unreviewable state keeps the debt named in `pendingReceipts` and writes a receipt saying why.

## Validation

| gate | command | result |
|---|---|---|
| Focused owner proof | `node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/r-cw-3-review.test.mjs tools/k6-proofs/scripts/__tests__/r-cw-3-review-join.test.mjs` | 23/23 pass, exit 0 (RED 22-fail on base) |
| Full serialized suite | `node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs` | 739 tests, **736 pass, 3 fail** — the same 3 that fail on the frozen base (718/715/3) |
| Catalog | `check-manifest-scenarios.mjs`, `check-scenario-alignment.mjs`, `check-proof-row-manifests.mjs` | pass; 43 manifests, 35 scenarios, 0 missing |
| Telemetry | `check-telemetry-contracts.mjs` | pass; 13 contracts, 9 receipt-requiring rows, 0 rebindable PASS claims |
| Skill | `check-k6-skill.mjs` | ok |
| Shell syntax | `bash -n` over every tracked `*.sh` (200 files) | all pass |
| JS syntax | `node --check` on all three changed/new JS files | pass |
| Whitespace | `git diff --check` / `git diff HEAD --check` | clean |
| Worktree | `git status --porcelain` | clean at head |
| PR review gate | GitNexus (installed `karmaterminal/GitNexus` fork, exact-worktree index, verdict EXACT) | risk **low**, 0 affected flows, 0 external d=1 dependants — see below |

## GitNexus PR review gate

Full report: `review-receipts/silas-1727-rcw3-fix/GITNEXUS-PR-REVIEW.md`.

- **Index scope/version**: `karmaterminal-openclaw-docs`, build storage v40, 93,260 nodes /
  105,145 edges / 856 clusters / 273 flows, built on the exact review worktree. `gnx fresh … HEAD`
  → **EXACT** (0 drift, clean worktree), exit 0. Installed fork only, never `npx` stock.
  No prior index for this repository existed in the registry; one was built for the exact head.
- **detect_changes** (`compare`, base `63535012e5…`): 5 files, 83 symbols, **0 affected
  processes**, **risk low**. File set equals `git diff --name-status`.
- **Non-trivial symbol impact** (upstream, `--include-tests`, ambiguous names re-resolved by UID):
  every changed symbol's blast radius is confined to `review-r-cw-3-reason-telemetry.mjs`. Zero
  d=1 dependants outside the diff. `status` is MEDIUM by count only (13 in-file callers).
- **Key-symbol context**: `buildReceipt` is called only by `main` and fans out to the pure check
  functions; `main` additionally calls `acceptanceBlock`/`reconciliationBlock` on its error path,
  which is why a malformed input still yields a receipt carrying the non-acceptance statement.
- **Flows/coverage**: 0 processes affected. The run-result consumers (`summarize-review-debt.mjs`,
  `export-row-metrics.mjs`, `export-prometheus-metrics.mjs`, `render-run-report.mjs`,
  `candidate-run-result-contract.mjs`, `validate-candidate-run-result.mjs`) read only
  `review.status` / `pendingReceipts` / `complete`; grep confirms **no non-test consumer reads
  `review.rowReview`**. GitNexus shows no test edges into the changed file because both test files
  drive it as a subprocess — coverage is by execution, and `run-proofs.sh` is bash and outside the
  graph entirely, so its ordering contract is pinned by an explicit source-offset assertion plus
  three end-to-end runs.
- **Risk**: LOW. **Recommendation**: APPROVE as a candidate for parent review; not a canonical
  PASS and not an acceptance.
- Disclosure: `gitnexus analyze` writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills/gitnexus/`
  into the analyzed repository. Those untracked files were removed after each analyze and are
  listed in the journal; they are not in the patch. The 1.16 GB local index was removed afterwards.

## Semantic invariants

1. R-CW-3's `reason-telemetry-redaction-review` receipt is present in `review.pendingReceipts` for
   the whole life of a run and is removed by nothing in the harness.
2. Successful trace acquisition discharges acquisition debt only.
3. A review receipt is valid only if it is bound to this candidate SHA, matrix id, run id, trace id
   and chain id, and to the SHA-256 of every source artifact it read.
4. Exported reason telemetry must **equal** this run's recorded digest and length, and the trace's
   tool/work/fire topology must match the correlation receipt, not merely carry the right keys.
5. Trace identity comes from the correlation receipt; `evidence.trace_id` is null by design.
6. Helper success ≠ coordinator acceptance ≠ canonical PASS. The receipt says so in machine-readable
   form, and the row verdict and routing envelope both reflect it.
7. Missing or invalid review is always explicit: a named pending receipt plus a receipt stating the
   reason.
8. Original VU and summary evidence is never rewritten; reconciliation is additive and names its
   source and the historical verdict.
9. Everything above is row-scoped. Other rows, including the nearest sibling R-CW-1, are unchanged.

## Remaining limits and uncertainties

- **No live execution.** No proof row was fired against a real gateway, no Tempo was queried, no
  re-fire occurred. The end-to-end tests use a stub k6 binary, a stub Tempo HTTP server and the
  existing stub readiness gateway. They prove the runner's reconciliation ownership boundary, not
  Tempo's real projection behaviour.
- **Offline agreement with real evidence** is shown against byte-verified copies of the preserved
  J6 artifacts, not against a fresh capture.
- **Behaviour change to disclose**: R-CW-3 no longer emits `candidate-run-result.json` while its
  manual review is outstanding. This follows from the unchanged candidate-routing contract applied
  to an honestly review-pending row; the envelope previously existed only because the debt had been
  cleared. If the coordinator wants an envelope for reviewed-but-unaccepted R-CW-3 runs, that needs
  an explicit acceptance mechanism, which this patch deliberately does not invent.
- **Pre-existing, untouched**: three corpus tests
  (`current-corpus-active-scope.test.mjs` ×2, `harness-provenance-runner.test.mjs` ×1) and
  `validate-corpus.mjs --index` / `--current` fail identically on the frozen base and on this head
  (output diffed byte-for-byte). They concern `PROOFS/` corpus composition — `current_sha`
  `e821503d0764d72b0d53a17e329b1efe9446690a` exposes 41 rows where the test expects 37, and
  `PROOFS/INDEX.json` carries no `source_corpus_sha`. Repairing that is a separate corpus lane.
- **Not generalized**: the manual-receipt seed is row-scoped rather than derived from any
  manifest-declared manual-review receipt. Flagged as the natural follow-up; doing it here would
  silently change future rows.
- **R-RC-2 untouched** (Rune's row): neither its scenario nor its summary logic was read into this
  patch; its two test files remain green.

## Next review gate

Parent inspects this report, `review-receipts/silas-1727-rcw3-fix/JOURNAL.md` and
`GITNEXUS-PR-REVIEW.md`, then decides on publication to #1727 and on whether to open a PR from
`silas/20261027/rcw3-review-join`. Scribe retains sequencing and fold authority. This branch has
not promoted the row, has not folded anything canonical, and has not accepted the R-CW-3 manual
review. Gate 5 / cut HOLD unchanged.
