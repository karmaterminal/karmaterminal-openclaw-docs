# PR #129388 proof-harness closure

## Named-ref contract

Resolved before evidence review on 2026-08-25. The safe lane was published
unchanged before its identity gate.

| Category | Named ref | Full SHA | Local / tracking / server identity |
|---|---|---|---|
| Product/base | `karmaterminal/karmaterminal-openclaw-docs@0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | local object and GitHub server commit equal |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-harness-closure` | `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` (initial publication) | local = tracking = server |
| CI/workflow | focused docs harness/unit/contract validation; broad Mode-B N/A | N/A | N/A |
| Presentation | `openclaw/openclaw#129388`, head `codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | local N/A; tracking N/A; GitHub PR head resolved on server |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-aff980` | `c083eae1cb6b52c5e50f75d785a039c332172aca` | local object = tracking = server |

---

# Prior continuation telemetry remedy report

Branch: `codeagent/continuation-telemetry-remedy-rows`
Base: `ead47a618c539c535e6845c52207f7a16b23d677` (docs `main`)
Commits: `85454fff`, `b0f373f2`, and the review-fix commit that carries this report

Scope: docs / catalog / harness-contract only. No `karmaterminal/openclaw`
product change. No live row fired, no gateway touched, no fleet mutation. No
`PROOFS/**` corpus bytes, no `proofs-manifest.json`, no `PROOFS/INDEX.json`.

Inputs:

- census report branch `karmaterminal/openclaw:codeagent/continuation-tempo-usage-census`
- census commit `39803b297bd4786db3971eb82a3a7fd0b29bc643`
- exact product basis `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`
- k6 library consolidation branch `codeagent/k6-scenario-library-consolidation@249f7dc9` — read as context only. **Nothing was absorbed from it.** No code, scenario, or library file from that 53-file branch appears in this change, and this branch has no dependency on it.

---

## 1. What the census forced

The census measured the fleet's actual continuation telemetry and found that a
proof row can execute real behavior and still be impossible to rebind or
correlate later:

| Finding | Number | Consequence for this catalog |
|---|---|---|
| Accepted continuation entry spans are rare | 23 / 24h, 366 / 7d vs 585 / 23,796 model-turn spans | Continuation alone does not explain fleet symptom prevalence. Causation unproven. |
| Accepted entry spans omit identity | no `signal.kind`, no origin/session/turn/run | Typed-tool spans and accepted-entry spans **cannot be causally joined** |
| Proof traffic has no marker | 0 k6 / Project-81 resource matches | Proof traffic cannot be excluded honestly; classification is `unknown_without_stable_marker` |
| No canonical terminal outcome | 147 / 115 (24h), 12,722 / 1,664 (7d) log-string matches | Zero-payload and finalization-failure are heuristics, not counters |
| Backend degrades silently | Tempo 200 live-store-only, no `totalBlocks`, `/ready` still 200 | Zero must never be read as absence |

**No product instrumentation for any of the remedy attributes exists.** This
change publishes the contract, not a claim that the contract is satisfied.

---

## 2. Row mapping

### 2a. New cross-cutting remedy rows (4, all `construct-only`)

Added only where a contract is genuinely cross-cutting and cannot honestly live
inside one behavioral row. Each census concern is owned by **exactly one** row,
and `check-telemetry-contracts.mjs` fails the catalog if a concern is orphaned
or double-claimed.

| Row | Manifest | Concern | Product instrumentation prerequisite |
|---|---|---|---|
| `R-OBS-CONT-PROVENANCE` | `tools/k6-proofs/manifests/r-obs-cont-provenance.json` | `origin-provenance` | **yes** |
| `R-OBS-PROOF-MARKER` | `tools/k6-proofs/manifests/r-obs-proof-marker.json` | `proof-run-classification` | **yes** |
| `R-OBS-TERMINAL-OUTCOME` | `tools/k6-proofs/manifests/r-obs-terminal-outcome.json` | `terminal-outcome` | **yes** |
| `R-OBS-BACKEND-DISPOSITION` | `tools/k6-proofs/manifests/r-obs-backend-disposition.json` | `backend-disposition` | **no — harness-side** |

All four are `scenario.status: construct-only` +
`liveRunSafety.classification: construct-only` +
`expectedArtifactClass: construct-only`, so they are rejected by the live-run
guard, skipped by `run-proofs.sh`, and excluded from `list-runnable-rows.mjs`.

`R-OBS-BACKEND-DISPOSITION` is deliberately the odd one out: it is blocked on
harness receipt work (out of scope for a contract PR), **not** on OpenClaw.
Keeping that distinction machine-readable is the point of the
`productInstrumentationPrerequisite` flag.

### 2b. Existing rows extended (9, contract is intrinsic to the proof)

The workorder named eight rows at minimum. The validator's rule — "a row whose
required receipts include a telemetry receipt must declare a contract" —
resolves to eight rows, seven of which overlap the named set; `R-CD-1` is caught
by the rule and `R-CD-MODEL-TOOL` declares a contract voluntarily because the
workorder names it (its telemetry receipt is optional, not required). Nine
total.

| Row | Why the contract is intrinsic | What it can and cannot prove today |
|---|---|---|
| `R-CD-1` | required `trace-id` | Behavioral schedule/spawn/return holds. The dispatch cannot be re-identified from telemetry. |
| `R-CD-2` | required `tempo-trace-json` | Same-trace + `chain.id` topology is the only join available. Not equivalent to identity. |
| `R-CD-4` | required `trace-id`; claim is *which session* | Tempo drops session identifiers, so the cross-session claim rests entirely on the captured gateway event stream. |
| `R-CD-CHAINED-DEPTH-2` | required `trace-id` | `chain.id` makes the chain visible; **no span says which hop was which**. |
| `R-CD-MODEL-TOOL` | optional `trace-or-session-correlation` | Authority is gateway child-session metadata by design; telemetry cannot corroborate it. Separately blocked on `openclaw#1103`. |
| `R-CD-TOKEN` | required `tempo-trace-json` + `continuation-trace-correlation` | Bracket origin is proven by the **absence** of a typed-tool span — a heuristic until an origin attribute exists. Positive bracket evidence lives only in payload-free Loki `effective-signal` logs, unbound to the trace. |
| `R-CW-1` | required `trace-id` | Same-trace join only; 8 accepted `continuation.work` spans fleet-wide in 24h. |
| `R-CW-3` | required `tempo-trace-json` + review | Redaction half **is** telemetry-backed (`reason.hash`, `reason.length` are exported). Provenance half is not. |
| `R-RC-2` | required `trace-id` | Accept-vs-refuse has no canonical span; the distinction lives only in the structured tool result. |

All nine declare `enforcement: advisory`, `rebindable: false`,
`passScope: behavioral-only`, `productInstrumentationPrerequisite: true`. Their
behavioral verdicts are unchanged; the rebind debt is recorded, not enacted.

### 2c. What every changed/new row defines

Enforced by schema and validator, per the workorder's eight requirements:

| Requirement | Field |
|---|---|
| expected product attributes/spans | `expectedTelemetry.spans[]` / `.attributes[]` with `emittedByProduct` + `productIssue` |
| public-safe identity and redaction | `attributes[].publicSafeForm`, `redaction.rule`, `redaction.forbiddenInArtifacts[]` |
| positive/negative controls | `controls.positive`, `controls.negative` |
| backend-unavailable disposition | `backendUnavailable.*` (`treatZeroAsAbsence` pinned `false` by schema) |
| artifact schema | `artifact.schema`, `artifact.requiredFiles[]` |
| PASS/PARTIAL/FAIL authority | `verdictAuthority.*` incl. `passScope`, `honestLimit` (R-RC-2 only) |
| manual vs deterministic k6 | `execution.deterministicK6` / `.manual` / `.relationship` |
| product instrumentation prerequisite | `productInstrumentationPrerequisite`, `prerequisiteRows[]` |

---

## 3. Product prerequisites (owed on `karmaterminal/openclaw`)

Nothing below exists on `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`.

### 3a. Accepted continuation entry provenance — `R-OBS-CONT-PROVENANCE`

On `continuation.work` and `continuation.delegate.dispatch`:

| Attribute | Public-safe form | Notes |
|---|---|---|
| `continuation.signal.origin` | enum | `typed-tool \| tool-call \| bracket \| post-compaction \| queue-drain` |
| `continuation.signal.kind` | enum | `work \| delegate \| compaction`, on the **entry** span (today it is only on `continuation.disabled` and compaction-release) |
| `continuation.origin.run.fingerprint` | salted fingerprint | |
| `continuation.session.fingerprint` | salted fingerprint | Tempo drops raw session ids by design; the remedy is a stable salted fingerprint, not the raw key |
| `continuation.turn.fingerprint` | salted fingerprint | No exported span retains a stable turn id today |

`continuation.chain.id` already exists and is retained.

### 3b. Proof-run classification — `R-OBS-PROOF-MARKER`

On every span a proof run causes: `openclaw.proof.run_id` (sha256-16),
`openclaw.proof.row_id` (enum over the committed catalog),
`openclaw.proof.candidate_sha` (40-char), `openclaw.proof.harness_ref`
(40-char docs commit), `openclaw.proof.synthetic` (boolean).

The harness already knows all four values
(`harness-provenance.json`, `runner-metadata.json`); what is missing is a path
for them to reach the product's exported spans.

### 3c. Canonical terminal outcomes — `R-OBS-TERMINAL-OUTCOME`

New span `continuation.finalization`, plus on terminal spans:
`continuation.outcome` (closed enum: `delivered | superseded | folded |
evaporated | rejected-cap | rejected-threshold | zero-payload |
finalization-failed | interrupted | disabled`),
`continuation.outcome.reason` (closed enum), `continuation.payload.bytes`
(integer — the canonical zero-payload signal), `continuation.finalization.status`.

### 3d. Backend disposition — `R-OBS-BACKEND-DISPOSITION` (harness-side, not product)

`telemetry.backend.status` (`complete | partial | unavailable | capped |
unknown`), `total_blocks`, `completed_jobs`, `result_capped`,
`window_start_utc`, `query_fingerprint`, written to `backend-status.json` for
every telemetry interaction — including healthy ones, so an absent file is a
defect rather than an assumption of health.

---

## 4. Enforcement added

### 4a. Catalog time — `tools/k6-proofs/scripts/check-telemetry-contracts.mjs`

Wired into `CATALOG_CHECKS` in `run-proofs.sh`, so a defect fails once as
harness infrastructure (`harness-control-receipt.json`, exit 78, zero rows
executed) and never synthesizes a row verdict.

- A row whose `liveRunSafety.requiredReceipts` include `trace-id`,
  `tempo-trace-json`, `continuation-trace-correlation`,
  `trace-or-session-correlation`, or `reason-telemetry-redaction-review` **must**
  declare a `telemetryContract`.
- **`rebindable: true` requires all four identity purposes (origin, session,
  turn, run) *and* a `proof-run` marker attribute declared
  `emittedByProduct: true`, and forbids `productInstrumentationPrerequisite`.**
  This is the "missing origin/session/turn/proof marker cannot become PASS"
  gate. No committed row can satisfy it today, so no row can declare a
  telemetry-rebindable PASS.
- `passScope: behavioral-and-telemetry-rebindable` requires `rebindable: true`.
- `productInstrumentationPrerequisite: true` requires `rebindable: false` and a
  non-empty `prerequisiteRows[]` naming existing rows, never itself.
- Any span/attribute with `emittedByProduct: false` must name a `productIssue`.
- `backendUnavailable.disposition ∈ {PARTIAL-candidate, FAIL-candidate}` and
  `treatZeroAsAbsence` must be `false`.
- `census.{issue,reportCommit,productBasis}` must equal the exact census values.
- Each remedy concern owned by exactly one row.

### 4b. Run time — `tools/k6-proofs/scripts/postprocess-k6-summary.mjs`

- Emits a `telemetryRebind` block into `row-result.json` for every row with a
  contract (enforcement, rebindable, passScope, prerequisite rows, backend
  disposition, unproven rebind receipts), so the debt is durable in the artifact.
- Withholds a summary-derived `PASS-candidate` when a receipt required by
  **either** `expectedReceipts[].required` or `liveRunSafety.requiredReceipts` is
  explicitly reported `missing` (`failureClass: missing-receipt`). This closed a
  real pre-existing hole: `outcomeFromSummary` returned `PASS-candidate` on a
  clean check rate even when `failureClass` was already `missing-receipt`. The
  union matters: `R-CD-1`, `R-CD-4` and `R-CD-CHAINED-DEPTH-2` had drifted, with
  `trace-id` required in `liveRunSafety.requiredReceipts` and `required: false`
  in `expectedReceipts`. The three manifests were aligned and the validator now
  rejects that drift for any telemetry receipt.
- Withholds a summary-derived `PASS-candidate` when a row with
  `enforcement: blocking` has a rebind receipt that is not explicitly `present`,
  **or** when a row claims `rebindable: true` / the rebindable pass scope and its
  rebind status is not `proven` (`failureClass: telemetry-rebind-unproven`).
- A row with a signed authoritative receipt (`R-CD-2`) keeps that receipt as its
  sole verdict authority and is **not** re-judged. `construct-only` and
  `HONEST-LIMIT-candidate` outcomes are untouched (the gate only fires on
  `PASS-candidate` from `verdictSource === 'k6-summary'`).

No scenario in the repository emits `proof_receipts` today, so the
`missing`-receipt gate changes no current live verdict; it removes the future
possibility. The gate's scope limits are stated in §8.

---

## 5. Files changed

```
RUNBOOKS/PROOF-CORPUS-METHOD.md                                  (+ 4 rows, + census section)
tools/k6-proofs/CONTRIBUTING-ROWS.md                             (contract requirement, backend debt rule)
tools/k6-proofs/docs/CONTINUATION-TELEMETRY-REMEDY-ROWS.md       (new — full contract doc)
tools/k6-proofs/docs/PROOF-RUN-METHOD.md                         (4th validator, contract section)
tools/k6-proofs/k6-proofs-pipeline.xml                           (4 rows, telemetry-rebind mandate)
tools/k6-proofs/row-manifest.schema.json                         (telemetryContract + schema truthfulness)
tools/k6-proofs/scripts/check-telemetry-contracts.mjs            (new — validator)
tools/k6-proofs/scripts/postprocess-k6-summary.mjs               (telemetryRebind + PASS gate)
tools/k6-proofs/scripts/run-proofs.sh                            (CATALOG_CHECKS + 1)
tools/k6-proofs/scripts/__tests__/catalog-root-contract.test.mjs (CHECKS + 1)
tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs    (new — 18 tests)
tools/k6-proofs/manifests/r-obs-cont-provenance.json             (new)
tools/k6-proofs/manifests/r-obs-proof-marker.json                (new)
tools/k6-proofs/manifests/r-obs-terminal-outcome.json            (new)
tools/k6-proofs/manifests/r-obs-backend-disposition.json         (new)
tools/k6-proofs/manifests/{r-cd-1,r-cd-2,r-cd-4,r-cd-chained-depth-2,
  r-cd-model-tool,r-cd-token,r-cw-1,r-cw-3,r-rc-2}.json          (+ telemetryContract)
output.md                                                        (this report)
```

The schema also stopped lying: `invocation`, `seatClassExpectation`,
`sourceContract`, `liveRunSafety.requiresHumanConfirmation` and
`liveRunSafety.requiresDisposableSession` are all used by shipped manifests but
were absent from a schema declaring `additionalProperties: false`.

---

## 6. Validation

### 6a. Baseline (origin/main `ead47a61`, before any change)

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

**320 tests · 319 pass · 1 fail.**

The single failure is `candidate envelope is outside and invisible to canonical
corpus validation` (`candidate-run-result.test.mjs:474`). It fails because
`validate-corpus.mjs --index` rejects the committed
`PROOFS/a7ef03177e0f42831a087521e6eb7720102d6be1/proofs-manifest.json`:

```
schema-manifest            ✗ expected openclaw.proofs.manifest.v1, got "openclaw.k6.proofs-manifest.v1"
schema-manifest-capture-sha ✗ missing capture_sha
schema-manifest-rows       ✗ rows[] missing or not an array
```

**Classification: pre-existing on `origin/main`, out of this lane.** It is a
corpus/manifest-schema divergence in published `PROOFS/**` bytes. Repairing it
would require editing the published corpus manifest or `validate-corpus.mjs`
verdict schema, both of which this workorder explicitly forbids ("preserve the
current never-regress corpus/index rules", "no corpus verdict publication or
INDEX movement"). Not repaired here.

### 6b. After the change

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

**344 tests · 343 pass · 1 fail** — the same single pre-existing failure, byte
for byte. Net **+24 tests, all passing**; zero new failures; zero previously
passing tests broken.

### 6c. Focused

```bash
node --test tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs
# 24 tests · 24 pass · 0 fail
```

### 6d. Catalog validators

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs      # 42 manifests; 35 scenario files — passed
node tools/k6-proofs/scripts/check-scenario-alignment.mjs      # ok:true
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs     # Missing manifests: 0 — passed
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs     # 13 contracts; 9 telemetry-required; 0 rebindable — passed
node tools/k6-proofs/scripts/list-runnable-rows.mjs --all      # 36 rows; the 4 construct-only remedy rows correctly absent
```

### 6e. Dry catalog selection — affected rows only, no live dispatch

```bash
cd tools/k6-proofs
K6_PROOF_OUT_DIR=/tmp/p81-remedy-dryrun \
OPENCLAW_CANDIDATE_SHA=6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955 \
  ./scripts/run-proofs.sh --dry-run \
  R-CD-1,R-CD-2,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CW-1,R-CW-3,R-RC-2,\
R-OBS-CONT-PROVENANCE,R-OBS-PROOF-MARKER,R-OBS-TERMINAL-OUTCOME,R-OBS-BACKEND-DISPOSITION \
  6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955
# exit 0
```

- Catalog preflight ran all four validators including the new one.
- 9 runnable rows: `DRY RUN: Would execute k6 run …` — nothing fired.
- 4 construct-only rows: `SKIPPED: Scenario status is construct-only (not runnable).`
- 0 live gateway connections, 0 product dispatches, 0 corpus writes.

### 6f. Independent review

A read-only `code-review` agent reviewed the full `origin/main...HEAD` diff
against the census brief, targeting validator loopholes, post-processor
ordering, schema/validator/doc consistency, and any implication that the product
instrumentation exists. It reported six findings; **all six were accepted and
fixed** in the third commit on this branch. Dispositions:

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Critical | `check-telemetry-contracts.mjs` CLI entrypoint guard compared `import.meta.url` (realpath-resolved) against a non-realpath `process.argv[1]`, so any symlinked invocation path — a symlinked `TMPDIR` snapshot root, an operator-supplied `OPENCLAW_PROOFS_ORIGIN_ROOT` — made the validator a **silent exit-0 no-op inside the catalog preflight**, while the other three validators still ran and the preflight looked green. Reproduced. | **Fixed.** `invokedAsCli()` now compares against `realpathSync(process.argv[1])` with a non-realpath fallback. New regression test `the validator still runs when it is reached through a symlinked path` runs the validator through a symlinked scripts dir and asserts exit 1 on a stripped contract. |
| 2 | High | `enforcement` was author-chosen and independent of `rebindable`, so a manifest could declare `rebindable:true` + `passScope:behavioral-and-telemetry-rebindable` with `enforcement:advisory` and no `rebindReceipts`, and the post-processor would publish a full `PASS-candidate` carrying `status:"unproven"` — a self-contradictory artifact that defeated the documented gate. Reproduced. | **Fixed, both layers.** Validator: a telemetry-rebindable claim now requires `enforcement:blocking` **and** a non-empty `rebindReceipts[]`. Post-processor: withholds PASS whenever a rebindable claim's status is not `proven`, regardless of `enforcement`. Two new tests. |
| 3 | High | The new missing-receipt downgrade read `expectedReceipts[].required`, while the rule that *pulls a row into the contract* reads `liveRunSafety.requiredReceipts`. Three shipped rows disagreed on exactly the receipt that scoped them in — `R-CD-1`, `R-CD-4`, `R-CD-CHAINED-DEPTH-2` all had `trace-id` required in `liveRunSafety` and `required:false` in `expectedReceipts` — so a row could report its required telemetry receipt missing and still publish a clean PASS. Reproduced. (The reviewer also named `R-CD-MODEL-TOOL`; verified **not** applicable — its telemetry receipt is in neither required list.) | **Fixed three ways.** Post-processor takes the **union** of both lists. Validator now fails any telemetry receipt whose required-ness disagrees between the lists. The three drifted manifests were aligned to `required:true`. Two new tests, one of which pins the whole committed catalog. |
| 4 | Medium | `enforcement:blocking` is unreachable on every committed row (the four blocking rows are `construct-only`, so their outcome short-circuits before any PASS), and receipt "proven" status is self-asserted by the same k6 summary that produced the PASS. | **Accepted; documented rather than redesigned.** `CONTINUATION-TELEMETRY-REMEDY-ROWS.md` now carries an explicit "Scope and known limits of that gate" section stating that the blocking path is a forward guarantee exercised by tests, not a currently active downgrade, and that receipt corroboration against `artifact.requiredFiles` / the Tempo projection / backend completeness keys is owed alongside the product instrumentation. Redesigning the harness receipt model is out of scope for a contract PR. |
| 5 | Medium | `run-proofs.sh` never calls `postprocess-k6-summary.mjs` — the row-list runner builds its own `run-result.json` inline with `jq`. The `CONTRIBUTING-ROWS.md` edit claimed every run dir carries `telemetryRebind`, which the runner cannot produce. Verified: `grep -c postprocess-k6-summary run-proofs.sh` → 0. | **Fixed (honesty).** The `CONTRIBUTING-ROWS.md` claim is now scoped to the summary-driven path, and the remedy doc names the runner gap explicitly as follow-up work. |
| 6 | Low | `AUDITED_ROWS` in the test omitted `R-CD-1`, so one of the nine bound rows was not pinned by the census-binding and eight-definitions assertions. | **Fixed.** `R-CD-1` added; the test now covers all nine. |

Categories the reviewer found clean: corpus/verdict/instrumentation-implication
(no `PROOFS/**` or `INDEX.json` byte touched, all four remedy rows guard-rejected
and excluded from `list-runnable-rows.mjs`, every non-emitted attribute carries a
`productIssue`, every doc carries a "does not exist yet" banner); secrets
(validator reads no `process.env`, `telemetryRebind` is composed solely of
manifest-derived fields, no new artifact write path); the `R-CD-2` authoritative
receipt path (genuinely untouched — `verdictSource` is set before the gate reads
it); and `validateTelemetryContract` robustness against null/partial inputs.

---

## 7. Constraints honoured

| Constraint | Status |
|---|---|
| No OpenClaw product edits | ✅ nothing outside this repo touched |
| No live proofs | ✅ dry-run only; construct-only rows are guard-rejected |
| No fleet mutation | ✅ no gateway, no seat, no config |
| No corpus verdict publication | ✅ zero `PROOFS/**` bytes changed |
| No INDEX movement | ✅ `PROOFS/INDEX.json` untouched |
| Never-regress corpus/index rules preserved | ✅ existing rows keep their behavioral verdict authority; contracts are `advisory` |
| Severable from k6 library consolidation | ✅ no file, code, or dependency from `249f7dc9` |
| Publication convention for future product PRs | ✅ `PR-NNNNNN/PROOFS/<FULL_SHA>/`, documented in all four remedy manifests, the remedy doc, and the corpus runbook |

---

## 8. Uncertainties and follow-ups

1. **Three limits of the run-time gate are stated, not hidden** (review findings
   4 and 5). The gate lives on the summary-driven `postprocess-k6-summary.mjs`
   path; the row-list runner `run-proofs.sh` builds its own `run-result.json`
   inline and does not yet carry `telemetryRebind`. No committed row can trigger
   the blocking downgrade today, because the four blocking rows are
   `construct-only` and short-circuit before any PASS exists — the blocking path
   is a forward guarantee exercised by tests. And receipt `present` status is
   self-asserted by the row's own k6 summary, with no cross-check yet against
   `artifact.requiredFiles`, the Tempo projection, or the backend completeness
   keys. All three are recorded in
   `tools/k6-proofs/docs/CONTINUATION-TELEMETRY-REMEDY-ROWS.md` under "Scope and
   known limits of that gate". Wiring the contract into the runner's verdict
   policy (near the existing `R-RC-2` policy at `run-proofs.sh:1212-1229`) is the
   natural follow-up.
2. **`enforcement: advisory` on the nine existing rows is a deliberate choice.**
   Flipping them to `blocking` today would downgrade live PASS rows to
   `PARTIAL-candidate` fleet-wide — a corpus-policy change that needs cohort
   ratification and is outside a contract PR. The contract records the debt and
   names the flip condition (prerequisite rows landing). If the cohort wants the
   downgrade now, it is a one-word change per manifest.
3. **The pre-existing `validate-corpus --index` red (§6a) is still red.** It is a
   published-corpus schema divergence, not this lane's.
4. **`R-OBS-BACKEND-DISPOSITION` is implementable today** (Tempo already returns
   `totalBlocks` / `completedJobs`), but implementing the harness receipt is
   harness work, not contract work, so the row ships `construct-only`. It is the
   cheapest next step and the only remedy row not gated on OpenClaw.
5. **No `.github/PULL_REQUEST_TEMPLATE` exists in this repository.** The PR body
   follows the repository's documented PR contract in
   `tools/k6-proofs/CONTRIBUTING-ROWS.md` § "PR contract" instead. Flagged, not
   silently substituted.
6. **Salt management for the identity fingerprints is unspecified.** The
   contracts state a per-fleet salt supplied at runtime and never committed;
   where it lives and how it rotates is an OpenClaw implementation decision, not
   a catalog one.
7. **`publicSafeForm: "enum"` is used for a literal ISO-8601 instant** in
   `R-OBS-BACKEND-DISPOSITION` (`telemetry.backend.window_start_utc`), meaning
   "fixed machine-parseable value, not prose". If a future contract needs more
   temporal forms, the enum should gain an explicit `timestamp` member.

---

## 9. Exact commands to reproduce

```bash
git clone https://github.com/karmaterminal/karmaterminal-openclaw-docs.git
cd karmaterminal-openclaw-docs
git checkout codeagent/continuation-telemetry-remedy-rows

# catalog
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/list-runnable-rows.mjs --all

# focused
node --test tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs

# full sanctioned docs harness suite
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs

# dry catalog selection, no live dispatch
cd tools/k6-proofs
K6_PROOF_OUT_DIR=/tmp/p81-remedy-dryrun \
OPENCLAW_CANDIDATE_SHA=6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955 \
  ./scripts/run-proofs.sh --dry-run R-CD-1,R-CD-2,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CW-1,R-CW-3,R-RC-2,R-OBS-CONT-PROVENANCE,R-OBS-PROOF-MARKER,R-OBS-TERMINAL-OUTCOME,R-OBS-BACKEND-DISPOSITION 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955
```
